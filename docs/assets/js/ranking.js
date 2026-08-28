/**
 * Sıralama motoru — saf hesaplama, DOM bilmez.
 *
 * Akış: filtreye uyan kayıtlar seçilir → (üniversite, yıl) kırılımında toplanır →
 * üniversite bazında 2021–2026 ortalaması hesaplanır → ölçüte göre sıralanır.
 *
 * Bir üniversitenin aynı programda birden çok varyantı olabilir (Burslu, %50
 * İndirimli, İngilizce ...). Yıl bazında birleştirme kuralı:
 *   kontenjan / yerleşen : toplanır
 *   en büyük puan        : varyantların en yükseği
 *   en küçük puan        : varyantların en düşüğü
 *   doluluk              : toplam yerleşen / toplam kontenjan
 * Kullanıcı ücret/dil filtreleriyle varyantları daraltarak bunu değiştirebilir.
 */

export const OLCUT = {
  puan: {
    anahtar: "puan",
    ad: "En Büyük Puan",
    kisa: "En büyük puan",
    birim: "puan",
    aciklama: "2021–2026 en büyük puan ortalamasına göre yüksekten düşüğe",
  },
  doluluk: {
    anahtar: "doluluk",
    ad: "Doluluk Oranı",
    kisa: "Doluluk",
    birim: "%",
    aciklama: "2021–2026 doluluk oranı ortalamasına göre yüksekten düşüğe; eşitlikte kontenjanı yüksek olan üstte",
  },
};

/** Üniversite, kapsam (bölge + tür) filtresine uyuyor mu? */
export function kapsamaUyar(uni, filtre) {
  const { bolge } = filtre;
  if (bolge.tip === "TR" && !uni.yurtici) return false;
  if (bolge.tip === "IST" && uni.sehir !== "İSTANBUL") return false;
  if (bolge.tip === "SEHIR" && uni.sehirIndeks !== bolge.sehir) return false;
  if (bolge.tip === "KKTC" && uni.turGrubu !== "kktc") return false;
  if (bolge.tip === "YURTDISI" && uni.turGrubu !== "yurtdisi") return false;

  const tur = filtre.tur;
  if (tur.tip === "GRUP" && uni.turGrubu !== tur.deger) return false;
  if (tur.tip === "TUR" && uni.turIndeksi !== tur.deger) return false;
  if (tur.tip === "YURTICI_HEPSI" && !["devlet", "vakif"].includes(uni.turGrubu)) return false;
  return true;
}

export function hesapla(veri, filtre) {
  const { sutun, meta } = veri;
  const yilSayisi = meta.yillar.length;
  const secilenYil = filtre.yillar; // Uint8Array benzeri: 1 = dahil

  // 1) Kapsam maskesi
  const uniUygun = new Uint8Array(veri.universiteler.length);
  for (const uni of veri.universiteler) {
    uniUygun[uni.indeks] = kapsamaUyar({ ...uni, turIndeksi: meta.uniTurleri.indexOf(uni.tur) }, filtre) ? 1 : 0;
  }

  // 2) Kayıtları tara
  const kayitlar = veri.programKayitlari(filtre.program);
  const uzunluk = kayitlar ? kayitlar.length : veri.n;
  const gruplar = new Map(); // uniIndeks -> { yillik: [...] }

  let toplamKontenjan = 0;
  let toplamYerlesen = 0;
  let kayitSayisi = 0;
  const varyantKumesi = new Set();
  const programKumesi = new Set();
  const dilKumesi = new Set();

  for (let sira = 0; sira < uzunluk; sira++) {
    const i = kayitlar ? kayitlar[sira] : sira;

    const yil = sutun.y[i];
    if (!secilenYil[yil]) continue;
    const u = sutun.u[i];
    if (!uniUygun[u]) continue;
    if (filtre.seviye != null && sutun.l[i] !== filtre.seviye) continue;
    if (filtre.puanTuru != null && sutun.s[i] !== filtre.puanTuru) continue;
    if (filtre.dil != null && sutun.d[i] !== filtre.dil) continue;
    if (filtre.ucret != null && sutun.f[i] !== filtre.ucret) continue;
    if (filtre.ogretim != null && sutun.e[i] !== filtre.ogretim) continue;

    let grup = gruplar.get(u);
    if (!grup) {
      grup = { u, yillik: new Array(yilSayisi).fill(null), diller: new Set() };
      gruplar.set(u, grup);
    }
    grup.diller.add(sutun.d[i]);
    dilKumesi.add(sutun.d[i]);
    let hucre = grup.yillik[yil];
    if (!hucre) {
      hucre = { kontenjan: 0, yerlesen: 0, min: null, max: null, kayitlar: [] };
      grup.yillik[yil] = hucre;
    }

    const kontenjan = sutun.k[i];
    const yerlesen = sutun.ye[i];
    hucre.kontenjan += kontenjan;
    hucre.yerlesen += yerlesen;
    hucre.kayitlar.push(i);

    const enKucuk = sutun.mn[i];
    const enBuyuk = sutun.mx[i];
    if (enKucuk !== meta.puanYok) hucre.min = hucre.min == null ? enKucuk : Math.min(hucre.min, enKucuk);
    if (enBuyuk !== meta.puanYok) hucre.max = hucre.max == null ? enBuyuk : Math.max(hucre.max, enBuyuk);

    toplamKontenjan += kontenjan;
    toplamYerlesen += yerlesen;
    kayitSayisi++;
    varyantKumesi.add(u * 1e7 + sutun.p[i] * 100 + sutun.d[i] * 10 + sutun.f[i]);
    programKumesi.add(sutun.p[i]);
  }

  // 3) Üniversite bazında ortalamalar
  const carpan = meta.puanCarpani;
  const satirlar = [];
  for (const grup of gruplar.values()) {
    let puanToplam = 0;
    let puanAdet = 0;
    let dolulukToplam = 0;
    let dolulukAdet = 0;
    let kontenjanToplam = 0;
    let yerlesenToplam = 0;
    let ilkPuan = null;
    let sonPuan = null;

    const yillik = grup.yillik.map((hucre) => {
      if (!hucre) return null;
      const doluluk = hucre.kontenjan > 0 ? (hucre.yerlesen / hucre.kontenjan) * 100 : null;
      const enBuyuk = hucre.max != null ? hucre.max / carpan : null;
      const enKucuk = hucre.min != null ? hucre.min / carpan : null;
      if (enBuyuk != null) {
        puanToplam += enBuyuk;
        puanAdet++;
        if (ilkPuan == null) ilkPuan = enBuyuk;
        sonPuan = enBuyuk;
      }
      if (doluluk != null) {
        dolulukToplam += doluluk;
        dolulukAdet++;
      }
      kontenjanToplam += hucre.kontenjan;
      yerlesenToplam += hucre.yerlesen;
      return {
        kontenjan: hucre.kontenjan,
        yerlesen: hucre.yerlesen,
        doluluk,
        enBuyuk,
        enKucuk,
        kayitlar: hucre.kayitlar,
      };
    });

    satirlar.push({
      uni: veri.universiteler[grup.u],
      yillik,
      diller: [...grup.diller].sort((a, b) => a - b),
      ortPuan: puanAdet ? puanToplam / puanAdet : null,
      ortDoluluk: dolulukAdet ? dolulukToplam / dolulukAdet : null,
      yilAdedi: puanAdet,
      dolulukYilAdedi: dolulukAdet,
      toplamKontenjan: kontenjanToplam,
      toplamYerlesen: yerlesenToplam,
      genelDoluluk: kontenjanToplam ? (yerlesenToplam / kontenjanToplam) * 100 : null,
      puanDegisimi: ilkPuan != null && sonPuan != null ? sonPuan - ilkPuan : null,
    });
  }

  // 4) Sıralama
  const olcut = filtre.olcut === "doluluk" ? "ortDoluluk" : "ortPuan";
  satirlar.sort((a, b) => {
    const av = a[olcut];
    const bv = b[olcut];
    if (av == null && bv == null) return b.toplamKontenjan - a.toplamKontenjan;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (bv !== av) return bv - av;
    return b.toplamKontenjan - a.toplamKontenjan; // eşitlikte kontenjanı yüksek olan üstte
  });

  let sira = 0;
  for (const satir of satirlar) {
    satir.sira = satir[olcut] == null ? null : ++sira;
  }

  return {
    satirlar,
    ozet: {
      universite: gruplar.size,
      varyant: varyantKumesi.size,
      program: programKumesi.size,
      diller: [...dilKumesi].sort((a, b) => a - b),
      kontenjan: toplamKontenjan,
      yerlesen: toplamYerlesen,
      doluluk: toplamKontenjan ? (toplamYerlesen / toplamKontenjan) * 100 : null,
      kayit: kayitSayisi,
      siralanan: sira,
    },
  };
}

/**
 * Bir üniversite satırının öğretim diline göre kırılımı.
 *
 * Türkçe ve İngilizce bölümler YÖK nezdinde ayrı bölümlerdir ve doluluk gibi
 * kurumsal ölçütler bölüm bazında değerlendirilir; birleşik satır yeterli
 * olmadığında bu fonksiyon aynı satırı dil bazında yeniden toplar. Birleştirme
 * kuralları `hesapla` ile aynıdır, yalnızca dil boyutu ayrı tutulur.
 *
 * Dönüş: dil indeksine göre sıralı [{ dil, ad, yillik: [hücre|null], ... }]
 */
export function dilKirilimi(veri, satir) {
  const { sutun, meta } = veri;
  const carpan = meta.puanCarpani;
  const yilSayisi = meta.yillar.length;
  const gruplar = new Map(); // dil -> yıllık ham hücreler

  satir.yillik.forEach((hucre, yil) => {
    if (!hucre) return;
    for (const i of hucre.kayitlar) {
      const d = sutun.d[i];
      let grup = gruplar.get(d);
      if (!grup) gruplar.set(d, (grup = new Array(yilSayisi).fill(null)));
      let ham = grup[yil];
      if (!ham) grup[yil] = ham = { kontenjan: 0, yerlesen: 0, min: null, max: null, kayitlar: [] };
      ham.kontenjan += sutun.k[i];
      ham.yerlesen += sutun.ye[i];
      ham.kayitlar.push(i);
      const enKucuk = sutun.mn[i];
      const enBuyuk = sutun.mx[i];
      if (enKucuk !== meta.puanYok) ham.min = ham.min == null ? enKucuk : Math.min(ham.min, enKucuk);
      if (enBuyuk !== meta.puanYok) ham.max = ham.max == null ? enBuyuk : Math.max(ham.max, enBuyuk);
    }
  });

  return [...gruplar.keys()]
    .sort((a, b) => a - b)
    .map((dil) => {
      let dolulukToplam = 0;
      let dolulukAdet = 0;
      let puanToplam = 0;
      let puanAdet = 0;
      let kontenjanToplam = 0;
      let yerlesenToplam = 0;
      const yillik = gruplar.get(dil).map((ham) => {
        if (!ham) return null;
        const doluluk = ham.kontenjan > 0 ? (ham.yerlesen / ham.kontenjan) * 100 : null;
        const enBuyuk = ham.max != null ? ham.max / carpan : null;
        const enKucuk = ham.min != null ? ham.min / carpan : null;
        if (doluluk != null) {
          dolulukToplam += doluluk;
          dolulukAdet++;
        }
        if (enBuyuk != null) {
          puanToplam += enBuyuk;
          puanAdet++;
        }
        kontenjanToplam += ham.kontenjan;
        yerlesenToplam += ham.yerlesen;
        return { kontenjan: ham.kontenjan, yerlesen: ham.yerlesen, doluluk, enBuyuk, enKucuk, kayitlar: ham.kayitlar };
      });
      return {
        dil,
        ad: meta.diller[dil],
        yillik,
        ortDoluluk: dolulukAdet ? dolulukToplam / dolulukAdet : null,
        ortPuan: puanAdet ? puanToplam / puanAdet : null,
        toplamKontenjan: kontenjanToplam,
        toplamYerlesen: yerlesenToplam,
        genelDoluluk: kontenjanToplam ? (yerlesenToplam / kontenjanToplam) * 100 : null,
      };
    });
}

/**
 * Kurum görünümü: bir üniversitenin tüm programları, satır başına bir bölüm.
 *
 * Fakülte raporları "bölümlerimizin doluluğu yıllara göre nasıl değişti?"
 * sorusunu sorar; bu, program → üniversiteler ekseninin tersidir. Her satır
 * için `hesapla` seçili kapsamla çalıştırılır, böylece bölümün kapsam içindeki
 * gerçek sırası da gelir. Öğretim dili ayrı bölüm sayılır: kurum bir programı
 * birden fazla dilde sunuyorsa her dil ayrı satırdır (#1). Ad yazımı ÖSYM
 * kılavuzunu izler: Türkçe için ek yok, diğer diller parantez içinde.
 *
 * Dönüş: { satirlar: [{ program, dil, etiket, satir, sira, siralanan, sonFark }],
 *          toplam: { yillik: [{kontenjan, yerlesen, doluluk}|null], kontenjan, yerlesen, doluluk } }
 */
export function kurumTablosu(veri, filtre, uniIndeks) {
  const { meta } = veri;
  const harita = uniIndeks == null ? null : veri.universiteProgramlari(uniIndeks);
  const satirlar = [];
  if (!harita) return { satirlar, toplam: bosToplam(meta.yillar.length) };

  const secilenYillar = meta.yillar.map((_, indeks) => indeks).filter((indeks) => filtre.yillar[indeks]);
  const olcut = filtre.olcut === "doluluk" ? "doluluk" : "enBuyuk";

  for (const [programIndeks, kurumDilleri] of harita) {
    const program = veri.programlar[programIndeks];
    // Ülke genelinde tek dilli program: dil boyutu anlamsız, filtre uygulanmaz.
    const diller = program.diller.length > 1 ? [...kurumDilleri].sort((a, b) => a - b) : [null];
    for (const dil of diller) {
      const sonuc = hesapla(veri, { ...filtre, program: programIndeks, dil });
      const satir = sonuc.satirlar.find((aday) => aday.uni.indeks === uniIndeks);
      if (!satir) continue; // kurum seçili kapsam/yıl/ek filtrelerin dışında
      const dilAdi = dil == null ? null : meta.diller[dil];
      const etiket = dilAdi && dilAdi !== "Türkçe" ? `${program.ad} (${dilAdi})` : program.ad;

      // Son iki seçili yılın farkı (sunumlardaki "son 2 yıl fark" sütunu)
      const degerler = secilenYillar.map((yil) => satir.yillik[yil]?.[olcut] ?? null);
      const son = degerler.at(-1);
      const onceki = degerler.length > 1 ? degerler.at(-2) : null;
      const sonFark = son != null && onceki != null ? son - onceki : null;

      satirlar.push({
        program: programIndeks,
        dil,
        etiket,
        satir,
        sira: satir.sira,
        siralanan: sonuc.ozet.siralanan,
        sonFark,
      });
    }
  }

  return { satirlar, toplam: kurumToplami(satirlar, meta.yillar.length) };
}

function bosToplam(yilSayisi) {
  return { yillik: new Array(yilSayisi).fill(null), kontenjan: 0, yerlesen: 0, doluluk: null };
}

/** Satır kümesinin yıl bazında kontenjan/yerleşen toplamı — fakülte geneli için. */
export function kurumToplami(satirlar, yilSayisi) {
  const toplam = bosToplam(yilSayisi);
  for (const { satir } of satirlar) {
    satir.yillik.forEach((hucre, yil) => {
      if (!hucre) return;
      const t = toplam.yillik[yil] ?? (toplam.yillik[yil] = { kontenjan: 0, yerlesen: 0, doluluk: null });
      t.kontenjan += hucre.kontenjan;
      t.yerlesen += hucre.yerlesen;
      t.doluluk = t.kontenjan ? (t.yerlesen / t.kontenjan) * 100 : null;
      toplam.kontenjan += hucre.kontenjan;
      toplam.yerlesen += hucre.yerlesen;
    });
  }
  toplam.doluluk = toplam.kontenjan ? (toplam.yerlesen / toplam.kontenjan) * 100 : null;
  return toplam;
}

/** İlk N satır + (listede yoksa) takip edilen üniversitenin gerçek sıralı satırı. */
export function gosterilecekSatirlar(sonuc, takipIndeksi, adet = 20) {
  const ilkler = sonuc.satirlar.slice(0, adet);
  if (takipIndeksi == null) return { ilkler, takip: null, takipIcerde: false };
  const icerde = ilkler.some((satir) => satir.uni.indeks === takipIndeksi);
  const takip = sonuc.satirlar.find((satir) => satir.uni.indeks === takipIndeksi) || null;
  return { ilkler, takip: icerde ? null : takip, takipIcerde: icerde };
}
