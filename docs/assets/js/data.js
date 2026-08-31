/**
 * Veri setinin yüklenmesi ve bellek içi indekslenmesi.
 *
 * `records.json` sütun bazlı ve sözlük indekslidir; burada TypedArray'lere
 * çevrilip program bazında bir kova (bucket) indeksi kurulur. Bir program
 * seçildiğinde yalnızca o programın kayıtları taranır, bu yüzden filtreleme
 * 128 bin satırda bile milisaniyeler sürer.
 */

import { trSirala, aramaAnahtari } from "./format.js";

export const TUR_GRUBU = {
  DEVLET: "devlet",
  VAKIF: "vakif",
  "VAKIF MYO": "vakif",
  KKTC: "kktc",
  "KKTC VAKIF": "kktc",
  YURTDISI: "yurtdisi",
  "YURTDISI KAMU": "yurtdisi",
  "YURTDISI VAKIF": "yurtdisi",
  "YURTDISI DEVLET": "yurtdisi",
};

export const TUR_ETIKETI = {
  DEVLET: "Devlet",
  VAKIF: "Vakıf",
  "VAKIF MYO": "Vakıf MYO",
  KKTC: "KKTC",
  "KKTC VAKIF": "KKTC Vakıf",
  "YURTDISI KAMU": "Yurt dışı (kamu)",
  "YURTDISI VAKIF": "Yurt dışı (vakıf)",
  "YURTDISI DEVLET": "Yurt dışı (devlet)",
};

export async function veriYukle(kokDizin = "data") {
  const [meta, kayitlar, surum] = await Promise.all([
    getir(`${kokDizin}/meta.json`),
    getir(`${kokDizin}/records.json`),
    getir(`${kokDizin}/VERSION.json`).catch(() => null),
  ]);

  const n = kayitlar.n;
  const s = kayitlar.sutunlar;
  const sutun = {
    y: new Uint8Array(s.y),
    l: new Uint8Array(s.l),
    t: new Uint8Array(s.t),
    u: new Uint16Array(s.u),
    p: new Uint16Array(s.p),
    d: new Uint8Array(s.d),
    f: new Uint8Array(s.f),
    e: new Uint8Array(s.e),
    s: new Uint8Array(s.s),
    k: new Int32Array(s.k),
    ye: new Int32Array(s.ye),
    mn: new Int32Array(s.mn),
    mx: new Int32Array(s.mx),
  };

  // Program -> kayıt indeksleri (sayarak yerleştirme, tek geçiş)
  const programSayisi = meta.programlar.length;
  const adet = new Int32Array(programSayisi);
  for (let i = 0; i < n; i++) adet[sutun.p[i]]++;
  const baslangic = new Int32Array(programSayisi + 1);
  for (let p = 0; p < programSayisi; p++) baslangic[p + 1] = baslangic[p] + adet[p];
  const kovaYazma = baslangic.slice(0, programSayisi);
  const kova = new Int32Array(n);
  for (let i = 0; i < n; i++) kova[kovaYazma[sutun.p[i]]++] = i;

  // Program -> öğretim dili kümesi. Aynı temel program Türkçe ve İngilizce
  // olarak iki ayrı bölüm hâlinde yürütülebilir (ör. Moleküler Biyoloji ve
  // Genetik); arayüz bu bilgiyle dil varyantlarını ayrı seçenek olarak sunar.
  const programDilleri = Array.from({ length: programSayisi }, () => new Set());
  for (let i = 0; i < n; i++) programDilleri[sutun.p[i]].add(sutun.d[i]);

  const programlar = meta.programlar.map((program, indeks) => ({
    indeks,
    ad: program.n,
    seviyeler: program.l,
    kayit: adet[indeks],
    diller: [...programDilleri[indeks]].sort((a, b) => a - b),
    anahtar: aramaAnahtari(program.n),
  }));
  const programSirali = [...programlar].sort((a, b) => trSirala(a.ad, b.ad));

  const universiteler = meta.universiteler.map((uni, indeks) => ({
    indeks,
    ad: uni.n,
    sehir: meta.sehirler[uni.c],
    sehirIndeks: uni.c,
    tur: meta.uniTurleri[uni.t],
    turGrubu: TUR_GRUBU[meta.uniTurleri[uni.t]] || "diger",
    yurtici: uni.tr === 1,
    anahtar: aramaAnahtari(uni.n),
  }));
  const universiteSirali = [...universiteler].sort((a, b) => trSirala(a.ad, b.ad));

  const sehirSirali = meta.sehirler
    .map((ad, indeks) => ({ ad, indeks }))
    .filter((sehir) => !["KKTC", "YURT DIŞI", "BİLİNMİYOR"].includes(sehir.ad))
    .sort((a, b) => trSirala(a.ad, b.ad));

  const uniProgramOnbellek = new Map();

  return {
    meta,
    surum,
    n,
    sutun,
    kova,
    kovaBaslangic: baslangic,
    programlar,
    programSirali,
    universiteler,
    universiteSirali,
    sehirSirali,
    /**
     * Bir üniversitenin (hiç açtığı) programları: program indeksi ->
     * { diller: Set, seviyeler: Set }. `has`/`size` ile küme gibi de kullanılır.
     * Seviye kümesi, aynı adlı lisans ve ön lisans programlarının (ör. Çocuk
     * Gelişimi: SBF lisans + SHMYO ön lisans) ayrı bölümler olarak ele
     * alınabilmesi için tutulur.
     */
    universiteProgramlari(uniIndeks) {
      if (uniIndeks == null) return null;
      let harita = uniProgramOnbellek.get(uniIndeks);
      if (!harita) {
        harita = new Map();
        for (let i = 0; i < n; i++) {
          if (sutun.u[i] !== uniIndeks) continue;
          let kayit = harita.get(sutun.p[i]);
          if (!kayit) harita.set(sutun.p[i], (kayit = { diller: new Set(), seviyeler: new Set() }));
          kayit.diller.add(sutun.d[i]);
          kayit.seviyeler.add(sutun.l[i]);
        }
        uniProgramOnbellek.set(uniIndeks, harita);
      }
      return harita;
    },
    /** Dil indeksinden okunaklı ad. */
    dilAdi(dilIndeks) {
      return meta.diller[dilIndeks];
    },
    /** Bir programın kayıt indekslerini verir. */
    programKayitlari(programIndeks) {
      if (programIndeks == null) return null; // tüm kayıtlar
      return kova.subarray(baslangic[programIndeks], baslangic[programIndeks + 1]);
    },
    /** Kayıt indeksinden okunaklı program varyantı etiketi üretir. */
    varyantEtiketi(i) {
      const parcalar = [meta.programlar[sutun.p[i]].n];
      const dil = meta.diller[sutun.d[i]];
      if (dil && dil !== "Türkçe") parcalar.push(`(${dil})`);
      const ogretim = meta.ogretimler[sutun.e[i]];
      if (ogretim && ogretim !== "Örgün") parcalar.push(`(${ogretim})`);
      const ucret = meta.ucretler[sutun.f[i]];
      if (ucret && ucret !== "Ücretsiz") parcalar.push(`(${ucret})`);
      return parcalar.join(" ");
    },
    programAdi(programIndeks) {
      return meta.programlar[programIndeks].n;
    },
    universiteAra(ad) {
      const hedef = aramaAnahtari(ad);
      return universiteler.find((uni) => uni.anahtar === hedef) || null;
    },
    programAra(ad) {
      const hedef = aramaAnahtari(ad);
      return programlar.find((program) => program.anahtar === hedef) || null;
    },
  };
}

async function getir(yol) {
  const yanit = await fetch(yol, { cache: "no-cache" });
  if (!yanit.ok) throw new Error(`${yol} yüklenemedi (${yanit.status})`);
  return yanit.json();
}
