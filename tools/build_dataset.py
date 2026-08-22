#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ham YKS yerleştirme verisini web uygulamasının okuduğu JSON'lara çevirir.

Kullanım:
    python3 tools/build_dataset.py --girdi data/raw/yks-2021-2026.csv.gz
    python3 tools/build_dataset.py --girdi Kitap1.xlsx --ham-yaz

Üretilen dosyalar (varsayılan `docs/data/`):
    meta.json     – sözlükler (üniversite, program, şehir, puan türü ...) ve özet sayımlar
    records.json  – sütun bazlı (columnar), sözlük indekslerine çevrilmiş kayıtlar
    VERSION.json  – üretim zamanı, kaynak dosya özeti, satır sayısı

Neden sütun bazlı? 128 bin satırlık veri, satır bazlı JSON'da ~25 MB tutarken
sözlük indeksli sütunlarda ~1 MB'a (gzip) iniyor; tarayıcı tek istekte indirip
tamamen bellekte filtreliyor, böylece sunucu tarafı gerekmiyor.

Doluluk oranı kaynakta bulunsa da türetilebilir olduğu için (yerleşen/kontenjan)
saklanmaz, tarayıcıda hesaplanır.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import sys
from collections import Counter, OrderedDict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from normalize import (  # noqa: E402
    DIL_SIRASI,
    OGRETIM_SIRASI,
    UCRET_SIRASI,
    Program,
    kanonik_program_haritasi,
    program_ayristir,
    universite_ayristir,
)

BEKLENEN_BASLIKLAR = [
    "YIL",
    "LİSANS/ÖN LİSANS",
    "ÜNİVERSİTE TÜRÜ",
    "ÜNİVERSİTE",
    "BÖLÜM/PROGRAM ADI",
    "PUAN TÜRÜ",
    "KONTENJAN",
    "YERLEŞEN",
    "DOLULUK ORANI %",
    "EN KÜÇÜK PUAN",
    "EN BÜYÜK PUAN",
]

PUAN_CARPANI = 100_000  # puanlar tam sayıya çevrilir; kaynaktaki 5 ondalık korunur
PUAN_YOK = -1


class Sozluk:
    """Değer -> indeks eşlemesi; sırayı korur."""

    def __init__(self, sabit_sira: list[str] | None = None):
        self._map: OrderedDict[str, int] = OrderedDict()
        for deger in sabit_sira or []:
            self._map[deger] = len(self._map)

    def indeks(self, deger: str) -> int:
        if deger not in self._map:
            self._map[deger] = len(self._map)
        return self._map[deger]

    @property
    def degerler(self) -> list[str]:
        return list(self._map.keys())


def satirlari_oku(yol: Path):
    """xlsx, csv ve csv.gz girdilerini tek biçimde satır sözlüğü olarak verir."""
    if yol.suffix.lower() in {".xlsx", ".xlsm"}:
        try:
            import openpyxl
        except ImportError:  # pragma: no cover
            sys.exit("xlsx okumak için openpyxl gerekli: pip install -r tools/requirements.txt")
        kitap = openpyxl.load_workbook(yol, read_only=True, data_only=True)
        sayfa = kitap.worksheets[0]
        satirlar = sayfa.iter_rows(values_only=True)
        basliklar = [str(b).strip() if b is not None else "" for b in next(satirlar)]
        _basliklari_dogrula(basliklar)
        for satir in satirlar:
            if satir[0] is None:
                continue
            yield dict(zip(basliklar, satir))
        kitap.close()
        return

    ac = gzip.open if yol.suffix.lower() == ".gz" else open
    with ac(yol, "rt", encoding="utf-8", newline="") as dosya:
        okuyucu = csv.DictReader(dosya)
        _basliklari_dogrula([b.strip() for b in okuyucu.fieldnames or []])
        for satir in okuyucu:
            yield satir


def _basliklari_dogrula(basliklar: list[str]) -> None:
    eksik = [b for b in BEKLENEN_BASLIKLAR if b not in basliklar]
    if eksik:
        sys.exit(f"Girdi dosyasında beklenen sütunlar yok: {', '.join(eksik)}")


def puan_kodla(deger) -> int:
    from normalize import sayiya_cevir

    sayi = sayiya_cevir(deger)
    if sayi is None:
        return PUAN_YOK
    return int(round(sayi * PUAN_CARPANI))


def tam_sayi(deger) -> int:
    try:
        return int(float(str(deger).replace(",", ".")))
    except (TypeError, ValueError):
        return 0


def dosya_ozeti(yol: Path) -> str:
    ozet = hashlib.sha256()
    with open(yol, "rb") as dosya:
        for parca in iter(lambda: dosya.read(1 << 20), b""):
            ozet.update(parca)
    return ozet.hexdigest()[:16]


def calistir(girdi: Path, cikti_dizin: Path, ham_yaz: Path | None) -> None:
    seviyeler = Sozluk()
    uni_turleri = Sozluk()
    puan_turleri = Sozluk()
    diller = Sozluk(DIL_SIRASI)
    ucretler = Sozluk(UCRET_SIRASI)
    ogretimler = Sozluk(OGRETIM_SIRASI)
    sehirler = Sozluk()
    universiteler = Sozluk()
    programlar = Sozluk()

    uni_bilgi: dict[str, dict] = {}
    program_seviyeleri: dict[str, set[int]] = {}
    program_sayaci: Counter = Counter()   # ham temel ad -> kayıt sayısı
    program_son_yil: dict[str, int] = {}  # ham temel ad -> en son görüldüğü yıl

    sutunlar = {ad: [] for ad in ("y", "l", "t", "u", "p", "d", "f", "e", "s", "k", "ye", "mn", "mx")}
    ham_satirlar: list[list] = []
    uyarilar: Counter = Counter()

    for satir in satirlari_oku(girdi):
        yil = tam_sayi(satir["YIL"])
        if not yil:
            uyarilar["yıl okunamadı"] += 1
            continue

        ham_uni = str(satir["ÜNİVERSİTE"]).strip()
        uni = universite_ayristir(ham_uni)
        program: Program = program_ayristir(str(satir["BÖLÜM/PROGRAM ADI"]).strip())

        if uni.sehir == "BİLİNMİYOR":
            uyarilar[f"şehir çözülemedi: {uni.ad}"] += 1

        uni_indeks = universiteler.indeks(uni.ad)
        if uni.ad not in uni_bilgi:
            uni_bilgi[uni.ad] = {
                "n": uni.kisa_ad,
                "tam": uni.ad,
                "c": sehirler.indeks(uni.sehir),
                "yurtici": uni.yurtici,
                "turler": Counter(),
            }

        tur = str(satir["ÜNİVERSİTE TÜRÜ"]).strip()
        uni_bilgi[uni.ad]["turler"][tur] += 1

        seviye_indeks = seviyeler.indeks(str(satir["LİSANS/ÖN LİSANS"]).strip())
        program_indeks = programlar.indeks(program.ad)  # şimdilik ham ad; aşağıda kanonikleşir
        program_seviyeleri.setdefault(program.ad, set()).add(seviye_indeks)
        program_sayaci[program.ad] += 1
        program_son_yil[program.ad] = max(program_son_yil.get(program.ad, 0), yil)

        sutunlar["y"].append(yil)  # ham yıl; aşağıda sıralı indekse çevrilir
        sutunlar["l"].append(seviye_indeks)
        sutunlar["t"].append(uni_turleri.indeks(tur))
        sutunlar["u"].append(uni_indeks)
        sutunlar["p"].append(program_indeks)
        sutunlar["d"].append(diller.indeks(program.dil))
        sutunlar["f"].append(ucretler.indeks(program.ucret))
        sutunlar["e"].append(ogretimler.indeks(program.ogretim))
        sutunlar["s"].append(puan_turleri.indeks(str(satir["PUAN TÜRÜ"]).strip()))
        sutunlar["k"].append(tam_sayi(satir["KONTENJAN"]))
        sutunlar["ye"].append(tam_sayi(satir["YERLEŞEN"]))
        sutunlar["mn"].append(puan_kodla(satir["EN KÜÇÜK PUAN"]))
        sutunlar["mx"].append(puan_kodla(satir["EN BÜYÜK PUAN"]))

        if ham_yaz is not None:
            ham_satirlar.append([satir[b] for b in BEKLENEN_BASLIKLAR])

    kayit_sayisi = len(sutunlar["y"])
    if not kayit_sayisi:
        sys.exit("Girdi dosyasından hiç kayıt okunamadı.")

    # Yıllar kaynakta ters sırada gelebiliyor; sözlüğü artan sıraya sabitle.
    sirali_yillar = sorted(set(sutunlar["y"]))
    yil_indeksi = {yil: i for i, yil in enumerate(sirali_yillar)}
    sutunlar["y"] = [yil_indeksi[yil] for yil in sutunlar["y"]]

    # Kılavuzlar arası adlandırma farklarını ("Tıp Fakültesi" -> "Tıp",
    # "UOLP-Suny ..." -> "UOLP-SUNY ...") tek bir kanonik ada indirge.
    harita = kanonik_program_haritasi(dict(program_sayaci), program_son_yil)
    kanonik_programlar = Sozluk()
    ham_to_kanonik = [kanonik_programlar.indeks(harita[ad]) for ad in programlar.degerler]
    sutunlar["p"] = [ham_to_kanonik[p] for p in sutunlar["p"]]
    kanonik_seviyeler: dict[str, set[int]] = {}
    for ham_ad, seviye_kumesi in program_seviyeleri.items():
        kanonik_seviyeler.setdefault(harita[ham_ad], set()).update(seviye_kumesi)
    birlestirilen = sum(1 for ad, yeni in harita.items() if ad != yeni)
    if birlestirilen:
        uyarilar[f"{birlestirilen} program adı kanonik ada indirgendi"] += 1
    programlar, program_seviyeleri = kanonik_programlar, kanonik_seviyeler

    cikti_dizin.mkdir(parents=True, exist_ok=True)

    uni_listesi = []
    for ad in universiteler.degerler:
        bilgi = uni_bilgi[ad]
        uni_listesi.append(
            {
                "n": bilgi["n"],
                "c": bilgi["c"],
                "t": uni_turleri.indeks(bilgi["turler"].most_common(1)[0][0]),
                "tr": 1 if bilgi["yurtici"] else 0,
            }
        )

    program_listesi = [
        {"n": ad, "l": sorted(program_seviyeleri[ad])} for ad in programlar.degerler
    ]

    meta = {
        "surum": 1,
        "uretim": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "puanCarpani": PUAN_CARPANI,
        "puanYok": PUAN_YOK,
        "yillar": sirali_yillar,
        "seviyeler": seviyeler.degerler,
        "uniTurleri": uni_turleri.degerler,
        "puanTurleri": puan_turleri.degerler,
        "diller": diller.degerler,
        "ucretler": ucretler.degerler,
        "ogretimler": ogretimler.degerler,
        "sehirler": sehirler.degerler,
        "universiteler": uni_listesi,
        "programlar": program_listesi,
        "ozet": {
            "kayit": kayit_sayisi,
            "universite": len(uni_listesi),
            "program": len(program_listesi),
            "toplamKontenjan": sum(sutunlar["k"]),
            "toplamYerlesen": sum(sutunlar["ye"]),
        },
    }

    _json_yaz(cikti_dizin / "meta.json", meta)
    _json_yaz(cikti_dizin / "records.json", {"n": kayit_sayisi, "sutunlar": sutunlar})
    _json_yaz(
        cikti_dizin / "VERSION.json",
        {
            "uretim": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "kaynakDosya": girdi.name,
            "kaynakOzet": dosya_ozeti(girdi),
            "kayitSayisi": kayit_sayisi,
        },
    )

    if ham_yaz is not None:
        ham_yaz.parent.mkdir(parents=True, exist_ok=True)
        with gzip.open(ham_yaz, "wt", encoding="utf-8", newline="") as dosya:
            yazici = csv.writer(dosya)
            yazici.writerow(BEKLENEN_BASLIKLAR)
            yazici.writerows(ham_satirlar)

    _rapor(meta, cikti_dizin, uyarilar)


def _json_yaz(yol: Path, veri) -> None:
    with open(yol, "w", encoding="utf-8") as dosya:
        json.dump(veri, dosya, ensure_ascii=False, separators=(",", ":"))


def _rapor(meta: dict, cikti_dizin: Path, uyarilar: Counter) -> None:
    ozet = meta["ozet"]
    print(f"kayıt        : {ozet['kayit']:,}".replace(",", "."))
    print(f"üniversite   : {ozet['universite']}")
    print(f"program      : {ozet['program']}")
    print(f"yıllar       : {meta['yillar'][0]}–{meta['yillar'][-1]}")
    for dosya in ("meta.json", "records.json"):
        boyut = (cikti_dizin / dosya).stat().st_size / 1e6
        gz = len(gzip.compress((cikti_dizin / dosya).read_bytes(), 6)) / 1e6
        print(f"{dosya:<13}: {boyut:.2f} MB (gzip ~{gz:.2f} MB)")
    if uyarilar:
        print("\nuyarılar:")
        for mesaj, adet in uyarilar.most_common(10):
            print(f"  {adet:>5} × {mesaj}")


def main() -> None:
    ayristirici = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ayristirici.add_argument("--girdi", required=True, type=Path, help="xlsx, csv veya csv.gz kaynak dosya")
    ayristirici.add_argument("--cikti", type=Path, default=Path("docs/data"), help="JSON çıktı dizini")
    ayristirici.add_argument(
        "--ham-yaz",
        nargs="?",
        const=Path("data/raw/yks-ham.csv.gz"),
        type=Path,
        default=None,
        help="ham veriyi csv.gz olarak da yaz (varsayılan: data/raw/yks-ham.csv.gz)",
    )
    args = ayristirici.parse_args()
    calistir(args.girdi, args.cikti, args.ham_yaz)


if __name__ == "__main__":
    main()
