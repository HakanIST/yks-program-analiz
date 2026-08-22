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
      grup = { u, yillik: new Array(yilSayisi).fill(null) };
      gruplar.set(u, grup);
    }
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
      kontenjan: toplamKontenjan,
      yerlesen: toplamYerlesen,
      doluluk: toplamKontenjan ? (toplamYerlesen / toplamKontenjan) * 100 : null,
      kayit: kayitSayisi,
      siralanan: sira,
    },
  };
}

/** İlk N satır + (listede yoksa) takip edilen üniversitenin gerçek sıralı satırı. */
export function gosterilecekSatirlar(sonuc, takipIndeksi, adet = 20) {
  const ilkler = sonuc.satirlar.slice(0, adet);
  if (takipIndeksi == null) return { ilkler, takip: null, takipIcerde: false };
  const icerde = ilkler.some((satir) => satir.uni.indeks === takipIndeksi);
  const takip = sonuc.satirlar.find((satir) => satir.uni.indeks === takipIndeksi) || null;
  return { ilkler, takip: icerde ? null : takip, takipIcerde: icerde };
}
