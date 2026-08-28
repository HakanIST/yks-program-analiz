#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sıralama motorunun beklenen çıktısını ham veriden bağımsız olarak üretir.

Tarayıcıdaki JavaScript hesabı ile buradaki pandas hesabı aynı sonucu vermeli;
`tools/tests/ranking.test.mjs` bu dosyanın ürettiği `expected.json`'a bakar.

Kullanım:
    python3 tools/tests/groundtruth.py [--girdi data/raw/yks-ham.csv.gz]
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from normalize import (  # noqa: E402
    kanonik_program_haritasi,
    program_ayristir,
    sayiya_cevir,
    universite_ayristir,
)

TUR_GRUBU = {
    "DEVLET": "devlet",
    "VAKIF": "vakif",
    "VAKIF MYO": "vakif",
    "KKTC": "kktc",
    "KKTC VAKIF": "kktc",
    "YURTDISI KAMU": "yurtdisi",
    "YURTDISI VAKIF": "yurtdisi",
    "YURTDISI DEVLET": "yurtdisi",
}

DURUMLAR = [
    {"ad": "Psikoloji · Türkiye geneli · puan", "program": "Psikoloji",
     "bolge": {"tip": "TR"}, "tur": {"tip": "YURTICI_HEPSI"}, "olcut": "puan"},
    {"ad": "Psikoloji · İstanbul vakıf · puan", "program": "Psikoloji",
     "bolge": {"tip": "IST"}, "tur": {"tip": "GRUP", "deger": "vakif"}, "olcut": "puan"},
    {"ad": "Psikoloji · Türkiye geneli · doluluk", "program": "Psikoloji",
     "bolge": {"tip": "TR"}, "tur": {"tip": "YURTICI_HEPSI"}, "olcut": "doluluk"},
    {"ad": "Hemşirelik · vakıf · doluluk", "program": "Hemşirelik",
     "bolge": {"tip": "TR"}, "tur": {"tip": "GRUP", "deger": "vakif"}, "olcut": "doluluk"},
    {"ad": "Bilgisayar Mühendisliği · devlet · puan", "program": "Bilgisayar Mühendisliği",
     "bolge": {"tip": "TR"}, "tur": {"tip": "GRUP", "deger": "devlet"}, "olcut": "puan"},
    # Dil bazında ayrım: Türkçe ve İngilizce bölümler ayrı bölüm olarak raporlanır (#1)
    {"ad": "Moleküler Biyoloji ve Genetik · İstanbul vakıf · doluluk · İngilizce",
     "program": "Moleküler Biyoloji ve Genetik", "dil": "İngilizce",
     "bolge": {"tip": "IST"}, "tur": {"tip": "GRUP", "deger": "vakif"}, "olcut": "doluluk"},
    {"ad": "Moleküler Biyoloji ve Genetik · İstanbul vakıf · doluluk · Türkçe",
     "program": "Moleküler Biyoloji ve Genetik", "dil": "Türkçe",
     "bolge": {"tip": "IST"}, "tur": {"tip": "GRUP", "deger": "vakif"}, "olcut": "doluluk"},
]


def veriyi_hazirla(girdi: Path) -> pd.DataFrame:
    df = pd.read_csv(girdi)
    ayristirilmis = [universite_ayristir(ad) for ad in df["ÜNİVERSİTE"]]
    df["uni_ad"] = [uni.kisa_ad for uni in ayristirilmis]
    df["sehir"] = [uni.sehir for uni in ayristirilmis]
    df["yurtici"] = [uni.yurtici for uni in ayristirilmis]
    ayristirilmis_program = [program_ayristir(ad) for ad in df["BÖLÜM/PROGRAM ADI"]]
    df["temel_program"] = [program.ad for program in ayristirilmis_program]
    df["dil"] = [program.dil for program in ayristirilmis_program]
    # Kılavuzlar arası adlandırma farkları (bkz. normalize.kanonik_program_haritasi);
    # test edilen şey sıralama hesabı olduğu için normalleştirme ortak kullanılır.
    sayac = Counter(df["temel_program"])
    son_yil = df.groupby("temel_program")["YIL"].max().to_dict()
    harita = kanonik_program_haritasi(dict(sayac), {k: int(v) for k, v in son_yil.items()})
    df["temel_program"] = df["temel_program"].map(harita)
    df["en_buyuk"] = [sayiya_cevir(deger) for deger in df["EN BÜYÜK PUAN"]]
    # Üniversitenin baskın tür kodu (JS tarafı da baskın türü kullanıyor)
    baskin = df.groupby("uni_ad")["ÜNİVERSİTE TÜRÜ"].agg(lambda seri: Counter(seri).most_common(1)[0][0])
    df["tur_grubu"] = df["uni_ad"].map(baskin).map(TUR_GRUBU).fillna("diger")
    return df


def kapsama_uygula(df: pd.DataFrame, bolge: dict, tur: dict) -> pd.DataFrame:
    if bolge["tip"] == "TR":
        df = df[df["yurtici"]]
    elif bolge["tip"] == "IST":
        df = df[df["sehir"] == "İSTANBUL"]
    if tur["tip"] == "GRUP":
        df = df[df["tur_grubu"] == tur["deger"]]
    elif tur["tip"] == "YURTICI_HEPSI":
        df = df[df["tur_grubu"].isin(["devlet", "vakif"])]
    return df


def durum_hesapla(df: pd.DataFrame, durum: dict) -> dict:
    secili = df[df["temel_program"] == durum["program"]]
    if durum.get("dil"):
        secili = secili[secili["dil"] == durum["dil"]]
    secili = kapsama_uygula(secili, durum["bolge"], durum["tur"])

    yillik = secili.groupby(["uni_ad", "YIL"]).agg(
        kontenjan=("KONTENJAN", "sum"),
        yerlesen=("YERLEŞEN", "sum"),
        en_buyuk=("en_buyuk", "max"),
    ).reset_index()
    yillik["doluluk"] = yillik["yerlesen"] / yillik["kontenjan"] * 100

    ozet = yillik.groupby("uni_ad").agg(
        ortPuan=("en_buyuk", "mean"),
        ortDoluluk=("doluluk", "mean"),
        toplamKontenjan=("kontenjan", "sum"),
    ).reset_index()

    olcut_kolonu = "ortDoluluk" if durum["olcut"] == "doluluk" else "ortPuan"
    ozet = ozet.sort_values(
        by=[olcut_kolonu, "toplamKontenjan"], ascending=[False, False], kind="mergesort", na_position="last"
    )

    ilk10 = [
        [satir.uni_ad, round(float(getattr(satir, olcut_kolonu)), 4)]
        for satir in ozet.head(10).itertuples()
    ]
    return {
        **{anahtar: durum[anahtar] for anahtar in ("ad", "program", "bolge", "tur", "olcut", "dil") if anahtar in durum},
        "ozet": {
            "universite": int(secili["uni_ad"].nunique()),
            "kontenjan": int(secili["KONTENJAN"].sum()),
            "yerlesen": int(secili["YERLEŞEN"].sum()),
        },
        "ilk10": ilk10,
    }


def main() -> None:
    ayristirici = argparse.ArgumentParser(description=__doc__)
    ayristirici.add_argument("--girdi", type=Path, default=Path("data/raw/yks-ham.csv.gz"))
    ayristirici.add_argument("--cikti", type=Path, default=Path("tools/tests/expected.json"))
    args = ayristirici.parse_args()

    df = veriyi_hazirla(args.girdi)
    sonuc = {"kaynak": args.girdi.name, "durumlar": [durum_hesapla(df, durum) for durum in DURUMLAR]}
    args.cikti.parent.mkdir(parents=True, exist_ok=True)
    args.cikti.write_text(json.dumps(sonuc, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{args.cikti} yazıldı · {len(sonuc['durumlar'])} senaryo")
    for durum in sonuc["durumlar"]:
        print(f"  {durum['ad']}: {durum['ozet']['universite']} üniversite, 1. sıra {durum['ilk10'][0][0]}")


if __name__ == "__main__":
    main()
