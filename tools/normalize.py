#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ÖSYM/YKS kılavuz verisindeki serbest metin alanlarını normalleştirir.

İki ana iş yapar:

1. **Program adı ayrıştırma.** Kılavuzlardaki program adları, temel program adının
   yanına parantez içinde birden çok nitelik taşır:

       "Psikoloji (İngilizce) (%50 İndirimli)"
       -> temel ad : "Psikoloji"
          dil      : "İngilizce"
          ücret    : "%50 İndirimli"
          öğretim  : "Örgün"

   Böylece kullanıcı "Psikoloji" seçtiğinde burslu/ücretli/İngilizce tüm varyantlar
   tek program altında toplanır; isterse dil/ücret/öğretim filtreleriyle daraltır.

   UOLP (ortak program), M.T.O.K., bakanlık adına açılan kontenjanlar, yerleşke ve
   cinsiyet bilgileri **temel adın parçası olarak bırakılır**; bunlar gerçekten ayrı
   programlardır ve tek bir kalemde toplanmaları yanıltıcı olur.

2. **Üniversite ayrıştırma.** "ÜSKÜDAR ÜNİVERSİTESİ (İSTANBUL)" gibi adlardan şehir
   çıkarılır; parantez yoksa ad içinde geçen il adı aranır (ör. "ADIYAMAN
   ÜNİVERSİTESİ"). Hiçbiri tutmazsa `MANUEL_SEHIR` tablosuna bakılır.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

# --------------------------------------------------------------------------- #
# Program adı etiketleri
# --------------------------------------------------------------------------- #

UCRET_ETIKETLERI = {
    "Burslu": "Burslu",
    "%75 İndirimli": "%75 İndirimli",
    "%50 İndirimli": "%50 İndirimli",
    "%25 İndirimli": "%25 İndirimli",
    "Ücretli": "Ücretli",
}
UCRET_VARSAYILAN = "Ücretsiz"

DIL_ETIKETLERI = {"İngilizce", "Almanca", "Fransızca", "Arapça", "Rusça", "İspanyolca", "Türkçe"}
DIL_VARSAYILAN = "Türkçe"

OGRETIM_ETIKETLERI = {
    "İÖ": "İkinci Öğretim",
    "Açıköğretim": "Açıköğretim",
    "Uzaktan Öğretim": "Uzaktan Öğretim",
}
OGRETIM_VARSAYILAN = "Örgün"

# Temel addan atılan, ayrı bir boyut olarak da tutulmayan etiketler.
ATILAN_ETIKETLER = {"KKTC UYRUKLU", "T.C. VATANDAŞLARI"}

# Sıralamada mantıklı görünsün diye sabit sıra.
UCRET_SIRASI = ["Ücretsiz", "Burslu", "%75 İndirimli", "%50 İndirimli", "%25 İndirimli", "Ücretli"]
DIL_SIRASI = ["Türkçe", "İngilizce", "Almanca", "Fransızca", "Arapça", "Rusça", "İspanyolca"]
OGRETIM_SIRASI = ["Örgün", "İkinci Öğretim", "Uzaktan Öğretim", "Açıköğretim"]


@dataclass(frozen=True)
class Program:
    ad: str          # temel program adı
    dil: str
    ucret: str
    ogretim: str


def program_ayristir(ham_ad: str) -> Program:
    """'Psikoloji (İngilizce) (Burslu)' -> Program('Psikoloji', 'İngilizce', 'Burslu', 'Örgün')."""
    dil, ucret, ogretim = DIL_VARSAYILAN, UCRET_VARSAYILAN, OGRETIM_VARSAYILAN

    def _degistir(eslesme: re.Match) -> str:
        nonlocal dil, ucret, ogretim
        etiket = eslesme.group(1).strip()
        if etiket in UCRET_ETIKETLERI:
            ucret = UCRET_ETIKETLERI[etiket]
            return ""
        if etiket in DIL_ETIKETLERI:
            dil = etiket
            return ""
        if etiket in OGRETIM_ETIKETLERI:
            ogretim = OGRETIM_ETIKETLERI[etiket]
            return ""
        if etiket.upper() in ATILAN_ETIKETLER:
            return ""
        return eslesme.group(0)  # tanınmayan etiket adda kalsın

    kalan = re.sub(r"\s*\(([^()]*)\)", _degistir, str(ham_ad))
    kalan = re.sub(r"\s+", " ", kalan).strip(" -–")
    return Program(kalan, dil, ucret, ogretim)


# --------------------------------------------------------------------------- #
# Üniversite / şehir
# --------------------------------------------------------------------------- #

ILLER = [
    "ADANA", "ADIYAMAN", "AFYONKARAHİSAR", "AĞRI", "AKSARAY", "AMASYA", "ANKARA", "ANTALYA",
    "ARDAHAN", "ARTVİN", "AYDIN", "BALIKESİR", "BARTIN", "BATMAN", "BAYBURT", "BİLECİK",
    "BİNGÖL", "BİTLİS", "BOLU", "BURDUR", "BURSA", "ÇANAKKALE", "ÇANKIRI", "ÇORUM", "DENİZLİ",
    "DİYARBAKIR", "DÜZCE", "EDİRNE", "ELAZIĞ", "ERZİNCAN", "ERZURUM", "ESKİŞEHİR", "GAZİANTEP",
    "GİRESUN", "GÜMÜŞHANE", "HAKKARİ", "HATAY", "IĞDIR", "ISPARTA", "İSTANBUL", "İZMİR",
    "KAHRAMANMARAŞ", "KARABÜK", "KARAMAN", "KARS", "KASTAMONU", "KAYSERİ", "KİLİS", "KIRIKKALE",
    "KIRKLARELİ", "KIRŞEHİR", "KOCAELİ", "KONYA", "KÜTAHYA", "MALATYA", "MANİSA", "MARDİN",
    "MERSİN", "MUĞLA", "MUŞ", "NEVŞEHİR", "NİĞDE", "ORDU", "OSMANİYE", "RİZE", "SAKARYA",
    "SAMSUN", "SİİRT", "SİNOP", "SİVAS", "ŞANLIURFA", "ŞIRNAK", "TEKİRDAĞ", "TOKAT", "TRABZON",
    "TUNCELİ", "UŞAK", "VAN", "YALOVA", "YOZGAT", "ZONGULDAK",
]

# Adında il geçmeyen ve parantezle şehir bilgisi verilmeyen üniversiteler.
MANUEL_SEHIR = {
    "GEBZE TEKNİK ÜNİVERSİTESİ": "KOCAELİ",
    "TÜRK-JAPON BİLİM VE TEKNOLOJİ ÜNİVERSİTESİ": "İSTANBUL",
}

YURTDISI_ETIKETI = "YURT DIŞI"
KKTC_ETIKETI = "KKTC"


@dataclass(frozen=True)
class Universite:
    ad: str          # ham ad (kaynaktaki hâli, tekilleştirme anahtarı)
    kisa_ad: str     # sondaki şehir parantezi atılmış görünen ad
    sehir: str       # il adı, "KKTC" ya da "YURT DIŞI"
    yurtici: bool    # Türkiye içi mi


def _buyuk(metin: str) -> str:
    """Türkçe duyarlı büyük harf (i -> İ)."""
    return metin.replace("i", "İ").replace("ı", "I").upper()


def universite_ayristir(ham_ad: str) -> Universite:
    ad = re.sub(r"\s+", " ", str(ham_ad)).strip()
    buyuk = _buyuk(ad)
    kisa_ad = ad
    sehir = None
    yurtici = True

    parantez = re.search(r"\(([^()]*)\)\s*$", ad)
    if parantez:
        icerik = _buyuk(parantez.group(1).strip())
        aday = icerik
        if aday in ILLER:
            sehir = aday
            kisa_ad = ad[: parantez.start()].strip()
        elif aday.startswith("KKTC"):
            sehir, yurtici = KKTC_ETIKETI, False
            kisa_ad = ad[: parantez.start()].strip()
        else:
            sehir, yurtici = YURTDISI_ETIKETI, False
            kisa_ad = ad[: parantez.start()].strip()

    if sehir is None:
        for il in ILLER:
            if re.search(r"(^|[\s\-])" + re.escape(il) + r"($|[\s\-])", buyuk):
                sehir = il
                break

    if sehir is None:
        sehir = MANUEL_SEHIR.get(buyuk) or MANUEL_SEHIR.get(ad)

    if sehir is None:
        sehir = "BİLİNMİYOR"

    return Universite(ad=ad, kisa_ad=kisa_ad, sehir=sehir, yurtici=yurtici)


# --------------------------------------------------------------------------- #
# Yardımcılar
# --------------------------------------------------------------------------- #

def slug(metin: str) -> str:
    """URL/dosya adı için Türkçe duyarlı sadeleştirme."""
    esle = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    metin = metin.translate(esle)
    metin = unicodedata.normalize("NFKD", metin).encode("ascii", "ignore").decode()
    metin = re.sub(r"[^A-Za-z0-9]+", "-", metin).strip("-").lower()
    return metin


def sayiya_cevir(deger) -> float | None:
    """'--' ve boş değerleri None'a çevirir, virgüllü ondalığı da kabul eder."""
    if deger is None:
        return None
    metin = str(deger).strip()
    if metin in {"", "--", "-", "---", "nan", "None"}:
        return None
    metin = metin.replace(".", "") if metin.count(".") > 1 else metin
    metin = metin.replace(",", ".")
    try:
        return float(metin)
    except ValueError:
        return None
