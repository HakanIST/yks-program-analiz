/**
 * Uygulama kabuğu: filtre durumunu tutar, hesaplamayı çağırır, arayüzü çizer.
 *
 * Durum tek bir `filtre` nesnesinde toplanır ve URL hash'ine yazılır; böylece
 * her görünüm paylaşılabilir bir bağlantıya sahip olur.
 */

import { AYAR } from "./config.js";
import { veriYukle, TUR_ETIKETI } from "./data.js";
import { hesapla, gosterilecekSatirlar, OLCUT } from "./ranking.js";
import { sparkline, cizgiGrafik, SERI_RENKLERI, ipucuGizle } from "./charts.js";
import { combobox } from "./combobox.js";
import { sayi, puan, yuzde, kisaSayi, degisim, trSirala, aramaAnahtari } from "./format.js";

const $ = (secici) => document.querySelector(secici);

const ON_AYARLAR = [
  { kod: "tumu", ad: "Tüm Üniversiteler", bolge: { tip: "TR" }, tur: { tip: "YURTICI_HEPSI" } },
  { kod: "devlet", ad: "Devlet Üniversiteleri", bolge: { tip: "TR" }, tur: { tip: "GRUP", deger: "devlet" } },
  { kod: "vakif", ad: "Vakıf Üniversiteleri", bolge: { tip: "TR" }, tur: { tip: "GRUP", deger: "vakif" } },
  { kod: "ist", ad: "İstanbul – Tümü", bolge: { tip: "IST" }, tur: { tip: "YURTICI_HEPSI" } },
  { kod: "ist-devlet", ad: "İstanbul – Devlet", bolge: { tip: "IST" }, tur: { tip: "GRUP", deger: "devlet" } },
  { kod: "ist-vakif", ad: "İstanbul – Vakıf", bolge: { tip: "IST" }, tur: { tip: "GRUP", deger: "vakif" } },
];

let veri = null;
let filtre = null;
let sonSonuc = null;
let seciliUniversite = null; // detay panelinde gösterilen

/* ------------------------------------------------------------------ başlat */

(async function baslat() {
  temaKur();
  $("#repo-baglanti").href = AYAR.repo;
  $("#repo-baglanti-alt").href = AYAR.repo;

  try {
    veri = await veriYukle(AYAR.veriDizini);
  } catch (hata) {
    $("#yukleniyor").innerHTML = `<p>Veri yüklenemedi: ${hata.message}</p>`;
    return;
  }

  filtre = varsayilanFiltre();
  urldenOku();

  kontrolleriDoldur();
  olaylariBagla();

  $("#yukleniyor").hidden = true;
  $("#uygulama").hidden = false;
  $("#yil-araligi").textContent = `${veri.meta.yillar[0]}–${veri.meta.yillar.at(-1)}`;
  $("#veri-surumu").textContent = veri.surum
    ? `Veri sürümü: ${veri.surum.uretim.slice(0, 10)} · ${sayi(veri.surum.kayitSayisi)} kayıt`
    : `${sayi(veri.n)} kayıt`;

  yenile();
})();

function varsayilanFiltre() {
  const program = veri.programAra(AYAR.varsayilanProgram);
  const vurgulanan = veri.universiteAra(AYAR.vurgulananUniversite);
  const kapsam = ON_AYARLAR.find((onAyar) => onAyar.kod === AYAR.varsayilanKapsam) ?? ON_AYARLAR[0];
  return {
    program: program ? program.indeks : null,
    seviye: null,
    puanTuru: null,
    dil: null,
    ucret: null,
    ogretim: null,
    yillar: new Uint8Array(veri.meta.yillar.length).fill(1),
    bolge: { ...kapsam.bolge },
    tur: { ...kapsam.tur },
    olcut: "puan",
    takip: vurgulanan ? vurgulanan.indeks : null,
  };
}

/* ------------------------------------------------------------- kontroller */

function kontrolleriDoldur() {
  // program combobox
  const programKayitlari = veri.programSirali.map((program) => ({
    etiket: program.ad,
    anahtar: program.anahtar,
    aciklama: `${program.kayit} kayıt`,
    indeks: program.indeks,
  }));
  const cbProgram = combobox({
    girdi: $("#secim-program"),
    liste: $("#liste-program"),
    kayitlar: programKayitlari,
    bosMetin: "Program bulunamadı",
    secilince: (kayit) => {
      filtre.program = kayit.indeks;
      seciliUniversite = null;
      yenile();
    },
  });
  if (filtre.program != null) cbProgram.deger(veri.programAdi(filtre.program));

  // takip edilen üniversite combobox
  const uniKayitlari = veri.universiteSirali.map((uni) => ({
    etiket: uni.ad,
    anahtar: uni.anahtar,
    aciklama: uni.sehir,
    indeks: uni.indeks,
  }));
  const cbTakip = combobox({
    girdi: $("#secim-takip"),
    liste: $("#liste-takip"),
    kayitlar: uniKayitlari,
    bosMetin: "Üniversite bulunamadı",
    secilince: (kayit) => {
      filtre.takip = kayit.indeks;
      yenile();
    },
  });
  if (filtre.takip != null) cbTakip.deger(veri.universiteler[filtre.takip].ad);

  // kapsam
  const kapsam = $("#secim-kapsam");
  kapsam.append(
    secenek("TR", "Türkiye geneli (devlet + vakıf)"),
    secenek("IST", "İstanbul"),
    secenek("HEPSI", "Hepsi (KKTC ve yurt dışı dahil)"),
    secenek("KKTC", "KKTC üniversiteleri"),
    secenek("YURTDISI", "Yurt dışı üniversiteleri")
  );
  const grup = document.createElement("optgroup");
  grup.label = "Şehir";
  for (const sehir of veri.sehirSirali) grup.append(secenek(`SEHIR:${sehir.indeks}`, sehirBasligi(sehir.ad)));
  kapsam.append(grup);

  // üniversite türü
  const tur = $("#secim-tur");
  tur.append(
    secenek("YURTICI_HEPSI", "Devlet + Vakıf"),
    secenek("GRUP:devlet", "Devlet"),
    secenek("GRUP:vakif", "Vakıf"),
    secenek("HEPSI", "Ayrım yapma")
  );
  const turGrup = document.createElement("optgroup");
  turGrup.label = "Kaynaktaki tür kodu";
  veri.meta.uniTurleri.forEach((ad, indeks) => turGrup.append(secenek(`TUR:${indeks}`, TUR_ETIKETI[ad] ?? ad)));
  tur.append(turGrup);

  // seviye / puan türü / dil / ücret / öğretim
  hepsiliSecim($("#secim-seviye"), veri.meta.seviyeler, "Tümü", (ad) => baslikBicimi(ad));
  hepsiliSecim($("#secim-puanturu"), veri.meta.puanTurleri, "Tümü");
  hepsiliSecim($("#secim-dil"), veri.meta.diller, "Tümü");
  hepsiliSecim($("#secim-ucret"), veri.meta.ucretler, "Tümü");
  hepsiliSecim($("#secim-ogretim"), veri.meta.ogretimler, "Tümü");

  // yıl çipleri
  const yilKap = $("#yil-cipleri");
  veri.meta.yillar.forEach((yil, indeks) => {
    const cip = document.createElement("button");
    cip.type = "button";
    cip.className = "cip";
    cip.textContent = yil;
    cip.dataset.yil = indeks;
    cip.addEventListener("click", () => {
      const acik = filtre.yillar[indeks] === 1;
      const kalan = filtre.yillar.reduce((toplam, deger) => toplam + deger, 0);
      if (acik && kalan === 1) return; // en az bir yıl kalsın
      filtre.yillar[indeks] = acik ? 0 : 1;
      yenile();
    });
    yilKap.append(cip);
  });

  // hazır kapsam çipleri
  const onAyarKap = $("#on-ayar-listesi");
  for (const onAyar of ON_AYARLAR) {
    const cip = document.createElement("button");
    cip.type = "button";
    cip.className = "cip";
    cip.textContent = onAyar.ad;
    cip.dataset.onayar = onAyar.kod;
    cip.addEventListener("click", () => {
      filtre.bolge = { ...onAyar.bolge };
      filtre.tur = { ...onAyar.tur };
      yenile();
    });
    onAyarKap.append(cip);
  }
}

function secenek(deger, metin) {
  const dugum = document.createElement("option");
  dugum.value = deger;
  dugum.textContent = metin;
  return dugum;
}

function hepsiliSecim(dugum, degerler, hepsiMetni, bicim = (ad) => ad) {
  dugum.append(secenek("", hepsiMetni));
  degerler.forEach((ad, indeks) => dugum.append(secenek(String(indeks), bicim(ad))));
}

function baslikBicimi(metin) {
  return metin.charAt(0) + metin.slice(1).toLocaleLowerCase("tr");
}

function sehirBasligi(metin) {
  return metin.charAt(0) + metin.slice(1).toLocaleLowerCase("tr");
}

function olaylariBagla() {
  $("#secim-kapsam").addEventListener("change", (olay) => {
    const deger = olay.target.value;
    filtre.bolge = deger.startsWith("SEHIR:")
      ? { tip: "SEHIR", sehir: Number(deger.split(":")[1]) }
      : { tip: deger };
    yenile();
  });
  $("#secim-tur").addEventListener("change", (olay) => {
    const deger = olay.target.value;
    filtre.tur = deger.startsWith("GRUP:")
      ? { tip: "GRUP", deger: deger.split(":")[1] }
      : deger.startsWith("TUR:")
        ? { tip: "TUR", deger: Number(deger.split(":")[1]) }
        : { tip: deger };
    yenile();
  });
  $("#secim-olcut").addEventListener("change", (olay) => {
    filtre.olcut = olay.target.value;
    yenile();
  });

  const basitAlanlar = [
    ["#secim-seviye", "seviye"],
    ["#secim-puanturu", "puanTuru"],
    ["#secim-dil", "dil"],
    ["#secim-ucret", "ucret"],
    ["#secim-ogretim", "ogretim"],
  ];
  for (const [secici, alan] of basitAlanlar) {
    $(secici).addEventListener("change", (olay) => {
      filtre[alan] = olay.target.value === "" ? null : Number(olay.target.value);
      yenile();
    });
  }

  $("#btn-sifirla").addEventListener("click", () => {
    filtre = varsayilanFiltre();
    $("#secim-program").value = filtre.program != null ? veri.programAdi(filtre.program) : "";
    $("#secim-takip").value = filtre.takip != null ? veri.universiteler[filtre.takip].ad : "";
    seciliUniversite = null;
    yenile();
  });
  $("#btn-csv").addEventListener("click", csvIndir);
  $("#btn-link").addEventListener("click", async () => {
    await navigator.clipboard.writeText(location.href);
    bildir("Bağlantı kopyalandı");
  });
  $("#btn-tema").addEventListener("click", temaDegistir);
  window.addEventListener("hashchange", () => {
    urldenOku();
    kontrolleriGuncelle();
    yenile(false);
  });
  window.addEventListener("resize", () => {
    clearTimeout(window.__yenidenCiz);
    window.__yenidenCiz = setTimeout(() => sonSonuc && karsilastirmaCiz(sonSonuc), 180);
  });
}

/* ------------------------------------------------------------------- akış */

function yenile(urlYaz = true) {
  ipucuGizle();
  sonSonuc = hesapla(veri, filtre);
  kontrolleriGuncelle();
  kpiCiz(sonSonuc);
  tabloCiz(sonSonuc);
  detayCiz();
  karsilastirmaCiz(sonSonuc);
  if (urlYaz) urlYaz_();
}

function kontrolleriGuncelle() {
  $("#secim-kapsam").value = filtre.bolge.tip === "SEHIR" ? `SEHIR:${filtre.bolge.sehir}` : filtre.bolge.tip;
  $("#secim-tur").value =
    filtre.tur.tip === "GRUP" ? `GRUP:${filtre.tur.deger}` : filtre.tur.tip === "TUR" ? `TUR:${filtre.tur.deger}` : filtre.tur.tip;
  $("#secim-olcut").value = filtre.olcut;
  $("#secim-seviye").value = filtre.seviye ?? "";
  $("#secim-puanturu").value = filtre.puanTuru ?? "";
  $("#secim-dil").value = filtre.dil ?? "";
  $("#secim-ucret").value = filtre.ucret ?? "";
  $("#secim-ogretim").value = filtre.ogretim ?? "";

  for (const cip of document.querySelectorAll("#yil-cipleri .cip")) {
    cip.setAttribute("aria-pressed", filtre.yillar[Number(cip.dataset.yil)] ? "true" : "false");
  }
  for (const cip of document.querySelectorAll("#on-ayar-listesi .cip")) {
    const onAyar = ON_AYARLAR.find((kayit) => kayit.kod === cip.dataset.onayar);
    const uyum =
      JSON.stringify(onAyar.bolge) === JSON.stringify(filtre.bolge) &&
      JSON.stringify(onAyar.tur) === JSON.stringify(filtre.tur);
    cip.setAttribute("aria-pressed", uyum ? "true" : "false");
  }

  const ekAdet = [filtre.seviye, filtre.puanTuru, filtre.dil, filtre.ucret, filtre.ogretim].filter((deger) => deger != null).length
    + (filtre.yillar.some((deger) => deger === 0) ? 1 : 0);
  const rozet = $("#ek-filtre-rozet");
  rozet.hidden = ekAdet === 0;
  rozet.textContent = ekAdet;

  $("#filtre-ozet").textContent = filtreOzeti();
}

function filtreOzeti() {
  const parcalar = [];
  parcalar.push(filtre.program != null ? veri.programAdi(filtre.program) : "Tüm programlar");
  parcalar.push(kapsamAdi());
  parcalar.push(OLCUT[filtre.olcut].ad + " sıralaması");
  const yillar = veri.meta.yillar.filter((_, indeks) => filtre.yillar[indeks]);
  parcalar.push(`${yillar[0]}–${yillar.at(-1)}`);
  return parcalar.join(" · ");
}

function kapsamAdi() {
  const bolgeAdi = {
    TR: "Türkiye geneli",
    IST: "İstanbul",
    HEPSI: "Tüm kapsam",
    KKTC: "KKTC",
    YURTDISI: "Yurt dışı",
  };
  const bolge = filtre.bolge.tip === "SEHIR" ? sehirBasligi(veri.meta.sehirler[filtre.bolge.sehir]) : bolgeAdi[filtre.bolge.tip];
  const turAdi =
    filtre.tur.tip === "GRUP"
      ? filtre.tur.deger === "devlet" ? "devlet" : "vakıf"
      : filtre.tur.tip === "TUR"
        ? (TUR_ETIKETI[veri.meta.uniTurleri[filtre.tur.deger]] ?? veri.meta.uniTurleri[filtre.tur.deger]).toLocaleLowerCase("tr")
        : filtre.tur.tip === "YURTICI_HEPSI" ? "devlet + vakıf" : "tüm türler";
  return `${bolge} · ${turAdi}`;
}

/* -------------------------------------------------------------------- kpi */

function kpiCiz(sonuc) {
  const ozet = sonuc.ozet;
  const yillar = veri.meta.yillar.filter((_, indeks) => filtre.yillar[indeks]);
  const kartlar = [
    { etiket: "Üniversite", deger: sayi(ozet.universite), alt: `${kapsamAdi()}` },
    { etiket: "Program (varyant)", deger: sayi(ozet.varyant), alt: `${sayi(ozet.kayit)} yıllık kayıt` },
    { etiket: "Toplam kontenjan", deger: sayi(ozet.kontenjan), alt: `${yillar[0]}–${yillar.at(-1)} toplamı` },
    { etiket: "Toplam yerleşen", deger: sayi(ozet.yerlesen), alt: `${kisaSayi(ozet.kontenjan - ozet.yerlesen)} boş kontenjan` },
    { etiket: "Genel doluluk", deger: yuzde(ozet.doluluk), alt: "yerleşen / kontenjan" },
  ];
  const kap = $("#kpi-serit");
  kap.textContent = "";
  for (const kart of kartlar) {
    const kutu = document.createElement("div");
    kutu.className = "kpi";
    kutu.innerHTML = `<div class="kpi-etiket"></div><div class="kpi-deger"></div><div class="kpi-alt"></div>`;
    kutu.querySelector(".kpi-etiket").textContent = kart.etiket;
    kutu.querySelector(".kpi-deger").textContent = kart.deger;
    kutu.querySelector(".kpi-alt").textContent = kart.alt;
    kap.append(kutu);
  }
}

/* ------------------------------------------------------------------ tablo */

function metrikDegeri(satir, yilIndeksi) {
  const hucre = satir.yillik[yilIndeksi];
  if (!hucre) return null;
  return filtre.olcut === "doluluk" ? hucre.doluluk : hucre.enBuyuk;
}

function metrikOrtalamasi(satir) {
  return filtre.olcut === "doluluk" ? satir.ortDoluluk : satir.ortPuan;
}

function metrikBicim(deger) {
  return filtre.olcut === "doluluk" ? yuzde(deger) : puan(deger);
}

function tabloCiz(sonuc) {
  const olcut = OLCUT[filtre.olcut];
  const yilIndeksleri = veri.meta.yillar.map((_, indeks) => indeks).filter((indeks) => filtre.yillar[indeks]);
  const { ilkler, takip } = gosterilecekSatirlar(sonuc, filtre.takip, AYAR.ilkN);

  $("#tablo-baslik").textContent = `${filtre.program != null ? veri.programAdi(filtre.program) : "Tüm programlar"} — İlk ${AYAR.ilkN}`;
  $("#tablo-aciklama").textContent = `${olcut.aciklama}. ${kapsamAdi()}.`;

  const bas = $("#tablo-bas");
  bas.innerHTML = "";
  const basSatir = document.createElement("tr");
  basSatir.append(
    hucre("th", "Sıra", "sira"),
    hucre("th", "Üniversite", "sol"),
    ...yilIndeksleri.map((indeks) => hucre("th", String(veri.meta.yillar[indeks]))),
    hucre("th", "Ortalama"),
    hucre("th", "Kontenjan"),
    hucre("th", "Yerleşen"),
    hucre("th", `${olcut.kisa} değişimi`, "grafik")
  );
  bas.append(basSatir);

  const govde = $("#tablo-govde");
  govde.innerHTML = "";

  if (!ilkler.length) {
    const bosSatir = document.createElement("tr");
    const bosHucre = hucre("td", "Seçilen filtrelerde kayıt bulunamadı.", "sol");
    bosHucre.colSpan = yilIndeksleri.length + 6;
    bosHucre.style.textAlign = "center";
    bosHucre.style.padding = "28px";
    bosSatir.append(bosHucre);
    govde.append(bosSatir);
    return;
  }

  for (const satir of ilkler) govde.append(satirCiz(satir, yilIndeksleri));

  if (takip) {
    const ayirac = document.createElement("tr");
    ayirac.className = "ayirac";
    const ayiracHucre = document.createElement("td");
    ayiracHucre.colSpan = yilIndeksleri.length + 6;
    const yazi = document.createElement("span");
    yazi.textContent = "• • •";
    ayiracHucre.append(yazi);
    ayirac.append(ayiracHucre);
    govde.append(ayirac);
    govde.append(satirCiz(takip, yilIndeksleri));
  }

  const takipAdi = filtre.takip != null ? veri.universiteler[filtre.takip].ad : null;
  $("#tablo-dipnot").textContent =
    `Bir üniversitenin aynı programdaki tüm varyantları (burslu, indirimli, ücretli, yabancı dilli) yıl bazında birleştirildi: ` +
    `kontenjan ve yerleşen toplandı, en büyük puan varyantların en yükseği alındı. ` +
    `Satır sonundaki mini grafikler kendi içinde ölçeklenir (değişimin şeklini gösterir); üniversiteler arası ölçekli karşılaştırma için alttaki büyük grafiği kullanın. ` +
    (takipAdi ? `${takipAdi} ilk ${AYAR.ilkN} dışında kalsa da gerçek sırasıyla ayrıca gösterilir.` : "");

  $("#tablo-lejant").innerHTML = "";
  const lejant = document.createElement("span");
  lejant.innerHTML = `<i style="background: var(--takip)"></i>`;
  lejant.append(document.createTextNode(takipAdi ?? "Takip edilen üniversite"));
  if (takipAdi) $("#tablo-lejant").append(lejant);
}

function satirCiz(satir, yilIndeksleri) {
  const takipMi = filtre.takip === satir.uni.indeks;
  const tr = document.createElement("tr");
  if (takipMi) tr.classList.add("takip-satir");
  tr.setAttribute("aria-selected", seciliUniversite === satir.uni.indeks ? "true" : "false");
  tr.addEventListener("click", () => {
    seciliUniversite = satir.uni.indeks;
    for (const diger of document.querySelectorAll("#tablo-govde tr")) diger.setAttribute("aria-selected", "false");
    tr.setAttribute("aria-selected", "true");
    detayCiz();
  });

  tr.append(hucre("td", satir.sira != null ? String(satir.sira) : "—", "sira"));

  const uniHucre = document.createElement("td");
  uniHucre.className = "sol uni";
  const ad = document.createElement("div");
  ad.className = "uni-ad";
  ad.textContent = satir.uni.ad;
  const alt = document.createElement("div");
  alt.className = "uni-alt";
  alt.textContent = `${sehirBasligi(satir.uni.sehir)} · ${TUR_ETIKETI[satir.uni.tur] ?? satir.uni.tur}`;
  uniHucre.append(ad, alt);
  tr.append(uniHucre);

  for (const yilIndeksi of yilIndeksleri) {
    const deger = metrikDegeri(satir, yilIndeksi);
    const td = hucre("td", deger == null ? "—" : metrikBicim(deger));
    if (deger == null) td.classList.add("bos-veri");
    else td.title = hucreBaslik(satir, yilIndeksi);
    tr.append(td);
  }

  tr.append(hucre("td", metrikBicim(metrikOrtalamasi(satir)), "ort"));
  tr.append(hucre("td", sayi(satir.toplamKontenjan)));
  tr.append(hucre("td", sayi(satir.toplamYerlesen)));

  const grafikHucre = document.createElement("td");
  grafikHucre.className = "grafik";
  grafikHucre.append(
    sparkline(
      yilIndeksleri.map((yilIndeksi) => ({
        yil: veri.meta.yillar[yilIndeksi],
        deger: metrikDegeri(satir, yilIndeksi),
        ipucu: ipucuIcerigi(satir, yilIndeksi),
      })),
      { renk: takipMi ? "var(--takip)" : "var(--vurgu-acik)", etiket: `${satir.uni.ad} yıllara göre değişim` }
    )
  );
  tr.append(grafikHucre);
  return tr;
}

function hucre(etiket, metin, sinif) {
  const dugum = document.createElement(etiket);
  if (sinif) dugum.className = sinif;
  dugum.textContent = metin;
  return dugum;
}

function hucreBaslik(satir, yilIndeksi) {
  const hucre = satir.yillik[yilIndeksi];
  if (!hucre) return "";
  return [
    `${veri.meta.yillar[yilIndeksi]} · ${satir.uni.ad}`,
    `Kontenjan: ${sayi(hucre.kontenjan)} · Yerleşen: ${sayi(hucre.yerlesen)}`,
    `Doluluk: ${yuzde(hucre.doluluk)}`,
    `En küçük: ${puan(hucre.enKucuk)} · En büyük: ${puan(hucre.enBuyuk)}`,
  ].join("\n");
}

/** Grafik noktalarının üzerinde açılan zengin ipucu. */
function ipucuIcerigi(satir, yilIndeksi) {
  const hucre = satir.yillik[yilIndeksi];
  if (!hucre) return null;
  const puanTurleri = [...new Set(hucre.kayitlar.map((i) => veri.meta.puanTurleri[veri.sutun.s[i]]))].join(", ");
  const varyantlar = [...new Set(hucre.kayitlar.map((i) => veri.varyantEtiketi(i)))];
  const satirlarHtml = [
    ["Yıl", veri.meta.yillar[yilIndeksi]],
    ["Puan türü", puanTurleri],
    ["Kontenjan", sayi(hucre.kontenjan)],
    ["Yerleşen", sayi(hucre.yerlesen)],
    ["Doluluk", yuzde(hucre.doluluk)],
    ["En küçük puan", puan(hucre.enKucuk)],
    ["En büyük puan", puan(hucre.enBuyuk)],
  ]
    .map(([etiket, deger]) => `<dt>${kacis(etiket)}</dt><dd>${kacis(String(deger))}</dd>`)
    .join("");
  const varyantHtml =
    varyantlar.length > 1
      ? `<div style="margin-top:6px;color:var(--murekkep-3)">${varyantlar.length} varyant birleştirildi</div>`
      : varyantlar.length === 1
        ? `<div style="margin-top:6px;color:var(--murekkep-3)">${kacis(varyantlar[0])}</div>`
        : "";
  return `<h4>${kacis(satir.uni.ad)}</h4><dl>${satirlarHtml}</dl>${varyantHtml}`;
}

function kacis(metin) {
  return String(metin).replace(/[&<>"]/g, (harf) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[harf]);
}

/* ------------------------------------------------------------------ detay */

function detayCiz() {
  const panel = $("#detay-panel");
  panel.innerHTML = "";

  const hedef =
    (seciliUniversite != null && sonSonuc.satirlar.find((satir) => satir.uni.indeks === seciliUniversite)) ||
    (filtre.takip != null && sonSonuc.satirlar.find((satir) => satir.uni.indeks === filtre.takip)) ||
    sonSonuc.satirlar[0];

  if (!hedef) {
    panel.innerHTML = `<p class="detay-bos">Detay için tablodan bir üniversite seçin.</p>`;
    return;
  }

  const yilIndeksleri = veri.meta.yillar.map((_, indeks) => indeks).filter((indeks) => filtre.yillar[indeks]);
  const kap = document.createElement("div");
  kap.className = "detay-ic";

  const baslik = document.createElement("div");
  baslik.className = "detay-baslik";
  const h3 = document.createElement("h3");
  h3.textContent = hedef.uni.ad;
  const alt = document.createElement("p");
  alt.className = "detay-alt";
  alt.textContent = `${sehirBasligi(hedef.uni.sehir)} · ${TUR_ETIKETI[hedef.uni.tur] ?? hedef.uni.tur} · ${
    hedef.sira != null ? `${hedef.sira}. sıra` : "sıralama dışı"
  }`;
  baslik.append(h3, alt);
  kap.append(baslik);

  const grafikKap = document.createElement("div");
  grafikKap.className = "detay-grafik";
  grafikKap.append(
    cizgiGrafik(
      [
        {
          ad: hedef.uni.ad,
          renk: filtre.takip === hedef.uni.indeks ? "var(--takip)" : "var(--vurgu-acik)",
          vurgulu: true,
          noktalar: yilIndeksleri.map((yilIndeksi) => ({
            yil: veri.meta.yillar[yilIndeksi],
            deger: metrikDegeri(hedef, yilIndeksi),
            ipucu: ipucuIcerigi(hedef, yilIndeksi),
          })),
        },
      ],
      {
        yillar: yilIndeksleri.map((indeks) => veri.meta.yillar[indeks]),
        genislik: 360,
        yukseklik: 190,
        solKenar: 46,
        eksenBicim: (deger) => (filtre.olcut === "doluluk" ? `${Math.round(deger)}%` : Math.round(deger)),
        enFazla: filtre.olcut === "doluluk" ? 155 : null,
        etiket: `${hedef.uni.ad} ${OLCUT[filtre.olcut].ad} değişimi`,
      }
    )
  );
  kap.append(grafikKap);

  const tablo = document.createElement("table");
  tablo.className = "detay-tablo";
  tablo.innerHTML =
    "<thead><tr><th>Yıl</th><th>Kont.</th><th>Yerl.</th><th>Doluluk</th><th>En küçük</th><th>En büyük</th></tr></thead>";
  const govde = document.createElement("tbody");
  for (const yilIndeksi of yilIndeksleri) {
    const hucreVerisi = hedef.yillik[yilIndeksi];
    const tr = document.createElement("tr");
    tr.append(hucre("td", String(veri.meta.yillar[yilIndeksi])));
    if (!hucreVerisi) {
      const bos = hucre("td", "program yok");
      bos.colSpan = 5;
      bos.className = "bos-veri";
      bos.style.textAlign = "center";
      tr.append(bos);
    } else {
      tr.append(
        hucre("td", sayi(hucreVerisi.kontenjan)),
        hucre("td", sayi(hucreVerisi.yerlesen)),
        hucre("td", yuzde(hucreVerisi.doluluk)),
        hucre("td", puan(hucreVerisi.enKucuk)),
        hucre("td", puan(hucreVerisi.enBuyuk))
      );
    }
    govde.append(tr);
  }
  tablo.append(govde);
  kap.append(tablo);

  const ozetSatir = document.createElement("p");
  ozetSatir.className = "detay-varyant";
  const ilkDeger = yilIndeksleri.map((indeks) => metrikDegeri(hedef, indeks)).find((deger) => deger != null);
  const sonDeger = [...yilIndeksleri].reverse().map((indeks) => metrikDegeri(hedef, indeks)).find((deger) => deger != null);
  const fark = ilkDeger != null && sonDeger != null ? sonDeger - ilkDeger : null;
  ozetSatir.innerHTML =
    `<strong>Ortalama ${OLCUT[filtre.olcut].kisa.toLocaleLowerCase("tr")}:</strong> ${metrikBicim(metrikOrtalamasi(hedef))} · ` +
    `<strong>dönem değişimi:</strong> <span class="yon ${fark > 0 ? "artis" : fark < 0 ? "azalis" : ""}">${degisim(fark)}</span>`;
  kap.append(ozetSatir);

  const varyantlar = [
    ...new Set(
      yilIndeksleri
        .flatMap((yilIndeksi) => hedef.yillik[yilIndeksi]?.kayitlar ?? [])
        .map((i) => veri.varyantEtiketi(i))
    ),
  ].sort(trSirala);
  if (varyantlar.length) {
    const kutu = document.createElement("div");
    kutu.className = "detay-varyant";
    kutu.innerHTML = `<strong>Kapsanan programlar (${varyantlar.length})</strong><ul>${varyantlar
      .map((ad) => `<li>${kacis(ad)}</li>`)
      .join("")}</ul>`;
    kap.append(kutu);
  }

  panel.append(kap);
}

/* --------------------------------------------------------- karşılaştırma */

function karsilastirmaCiz(sonuc) {
  const kap = $("#karsilastirma-grafik");
  kap.innerHTML = "";
  const lejantKap = $("#karsilastirma-lejant");
  lejantKap.innerHTML = "";

  const yilIndeksleri = veri.meta.yillar.map((_, indeks) => indeks).filter((indeks) => filtre.yillar[indeks]);
  const ilkler = sonuc.satirlar.slice(0, 7);
  const takipSatir =
    filtre.takip != null && !ilkler.some((satir) => satir.uni.indeks === filtre.takip)
      ? sonuc.satirlar.find((satir) => satir.uni.indeks === filtre.takip)
      : null;
  const gosterilecek = [...ilkler, takipSatir].filter(Boolean);

  if (!gosterilecek.length) {
    kap.innerHTML = `<p class="detay-bos">Gösterilecek veri yok.</p>`;
    return;
  }

  $("#karsilastirma-alt").textContent =
    `İlk ${ilkler.length} üniversite${takipSatir ? " + " + takipSatir.uni.ad : ""} · ${OLCUT[filtre.olcut].ad}`;

  const seriler = gosterilecek.map((satir, indeks) => ({
    ad: satir.uni.ad,
    renk: satir === takipSatir ? "var(--takip)" : SERI_RENKLERI[indeks % SERI_RENKLERI.length],
    vurgulu: satir === takipSatir,
    noktalar: yilIndeksleri.map((yilIndeksi) => ({
      yil: veri.meta.yillar[yilIndeksi],
      deger: metrikDegeri(satir, yilIndeksi),
      ipucu: ipucuIcerigi(satir, yilIndeksi),
    })),
  }));

  kap.append(
    cizgiGrafik(seriler, {
      yillar: yilIndeksleri.map((indeks) => veri.meta.yillar[indeks]),
      genislik: 1000,
      yukseklik: 340,
      eksenBicim: (deger) => (filtre.olcut === "doluluk" ? `${Math.round(deger)}%` : Math.round(deger)),
      enFazla: filtre.olcut === "doluluk" ? 155 : null,
      etiket: `İlk üniversitelerin ${OLCUT[filtre.olcut].ad} değişimi`,
    })
  );

  for (const seri of seriler) {
    const oge = document.createElement("span");
    const kutu = document.createElement("i");
    kutu.style.background = seri.renk;
    oge.append(kutu, document.createTextNode(seri.ad));
    lejantKap.append(oge);
  }
}

/* -------------------------------------------------------------------- csv */

function csvIndir() {
  const yilIndeksleri = veri.meta.yillar.map((_, indeks) => indeks).filter((indeks) => filtre.yillar[indeks]);
  const { ilkler, takip } = gosterilecekSatirlar(sonSonuc, filtre.takip, AYAR.ilkN);
  const basliklar = [
    "Sıra", "Üniversite", "Şehir", "Tür",
    ...yilIndeksleri.map((indeks) => String(veri.meta.yillar[indeks])),
    "Ortalama", "Toplam kontenjan", "Toplam yerleşen", "Genel doluluk %",
  ];
  const satirlar = [...ilkler, ...(takip ? [takip] : [])].map((satir) => [
    satir.sira ?? "",
    satir.uni.ad,
    satir.uni.sehir,
    TUR_ETIKETI[satir.uni.tur] ?? satir.uni.tur,
    ...yilIndeksleri.map((yilIndeksi) => sayiCsv(metrikDegeri(satir, yilIndeksi))),
    sayiCsv(metrikOrtalamasi(satir)),
    satir.toplamKontenjan,
    satir.toplamYerlesen,
    sayiCsv(satir.genelDoluluk),
  ]);

  const ustBilgi = [
    [`YKS Program Analiz — ${filtre.program != null ? veri.programAdi(filtre.program) : "Tüm programlar"}`],
    [filtreOzeti()],
    [],
  ];
  const icerik = [...ustBilgi, basliklar, ...satirlar]
    .map((satir) => satir.map(csvHucre).join(";"))
    .join("\r\n");

  const dosya = new Blob(["﻿" + icerik], { type: "text/csv;charset=utf-8" });
  const baglanti = document.createElement("a");
  baglanti.href = URL.createObjectURL(dosya);
  baglanti.download = `yks-${aramaAnahtari(filtre.program != null ? veri.programAdi(filtre.program) : "tum-programlar").replace(/ /g, "-")}-${filtre.olcut}.csv`;
  baglanti.click();
  URL.revokeObjectURL(baglanti.href);
  bildir("CSV indirildi");
}

const sayiCsv = (deger) => (deger == null ? "" : String(deger.toFixed ? deger.toFixed(2) : deger).replace(".", ","));
const csvHucre = (deger) => {
  const metin = String(deger ?? "");
  return /[";\r\n]/.test(metin) ? `"${metin.replace(/"/g, '""')}"` : metin;
};

/* -------------------------------------------------------------------- url */

function urlYaz_() {
  const parametreler = new URLSearchParams();
  if (filtre.program != null) parametreler.set("p", veri.programAdi(filtre.program));
  parametreler.set("b", filtre.bolge.tip === "SEHIR" ? `SEHIR:${filtre.bolge.sehir}` : filtre.bolge.tip);
  parametreler.set("t", filtre.tur.tip === "GRUP" ? `GRUP:${filtre.tur.deger}` : filtre.tur.tip === "TUR" ? `TUR:${filtre.tur.deger}` : filtre.tur.tip);
  parametreler.set("o", filtre.olcut);
  if (filtre.seviye != null) parametreler.set("s", filtre.seviye);
  if (filtre.puanTuru != null) parametreler.set("pt", filtre.puanTuru);
  if (filtre.dil != null) parametreler.set("d", filtre.dil);
  if (filtre.ucret != null) parametreler.set("u", filtre.ucret);
  if (filtre.ogretim != null) parametreler.set("og", filtre.ogretim);
  if (filtre.takip != null) parametreler.set("v", veri.universiteler[filtre.takip].ad);
  if (filtre.yillar.some((deger) => deger === 0)) {
    parametreler.set("y", veri.meta.yillar.filter((_, indeks) => filtre.yillar[indeks]).join(","));
  }
  history.replaceState(null, "", `#${parametreler.toString()}`);
}

function urldenOku() {
  if (!location.hash.length) return;
  const parametreler = new URLSearchParams(location.hash.slice(1));
  const program = parametreler.get("p");
  if (program) {
    const bulunan = veri.programAra(program);
    filtre.program = bulunan ? bulunan.indeks : null;
  }
  const bolge = parametreler.get("b");
  if (bolge) filtre.bolge = bolge.startsWith("SEHIR:") ? { tip: "SEHIR", sehir: Number(bolge.split(":")[1]) } : { tip: bolge };
  const tur = parametreler.get("t");
  if (tur) {
    filtre.tur = tur.startsWith("GRUP:")
      ? { tip: "GRUP", deger: tur.split(":")[1] }
      : tur.startsWith("TUR:")
        ? { tip: "TUR", deger: Number(tur.split(":")[1]) }
        : { tip: tur };
  }
  if (parametreler.get("o")) filtre.olcut = parametreler.get("o") === "doluluk" ? "doluluk" : "puan";
  const sayisal = { s: "seviye", pt: "puanTuru", d: "dil", u: "ucret", og: "ogretim" };
  for (const [anahtar, alan] of Object.entries(sayisal)) {
    const deger = parametreler.get(anahtar);
    filtre[alan] = deger == null || deger === "" ? null : Number(deger);
  }
  const takip = parametreler.get("v");
  if (takip) {
    const bulunan = veri.universiteAra(takip);
    filtre.takip = bulunan ? bulunan.indeks : null;
  }
  const yillar = parametreler.get("y");
  if (yillar) {
    const secilen = new Set(yillar.split(",").map(Number));
    filtre.yillar = new Uint8Array(veri.meta.yillar.map((yil) => (secilen.has(yil) ? 1 : 0)));
    if (!filtre.yillar.some(Boolean)) filtre.yillar.fill(1);
  }
  const programGirdi = $("#secim-program");
  if (programGirdi) programGirdi.value = filtre.program != null ? veri.programAdi(filtre.program) : "";
  const takipGirdi = $("#secim-takip");
  if (takipGirdi) takipGirdi.value = filtre.takip != null ? veri.universiteler[filtre.takip].ad : "";
}

/* -------------------------------------------------------------------- tema */

function temaKur() {
  const kayitli = localStorage.getItem("yks-tema");
  if (kayitli) document.documentElement.dataset.tema = kayitli;
}

function temaDegistir() {
  const simdiki = document.documentElement.dataset.tema;
  const koyuMu = simdiki === "koyu" || (simdiki === "sistem" && matchMedia("(prefers-color-scheme: dark)").matches);
  const yeni = koyuMu ? "acik" : "koyu";
  document.documentElement.dataset.tema = yeni;
  localStorage.setItem("yks-tema", yeni);
}

/* ---------------------------------------------------------------- bildirim */

let bildirimZaman = null;
function bildir(metin) {
  const kutu = $("#bildirim");
  kutu.textContent = metin;
  kutu.hidden = false;
  clearTimeout(bildirimZaman);
  bildirimZaman = setTimeout(() => (kutu.hidden = true), 2200);
}
