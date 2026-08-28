/**
 * SVG çizgi grafikler — harici kütüphane yok.
 *
 * İki bileşen var:
 *   sparkline()  – tablo satırlarının yanındaki minik trend çizgisi
 *   cizgiGrafik() – eksenli, ızgaralı, çok serili büyük grafik
 *
 * Ortak kural: değer arttıkça çizgi yukarı çıkar (en büyük puan ve doluluk
 * oranında "yukarı" her zaman "daha iyi" demektir). Veri olmayan yıllarda çizgi
 * sıfıra düşmez, kırılır.
 */

const NS = "http://www.w3.org/2000/svg";

export const SERI_RENKLERI = [
  "var(--seri-1)", "var(--seri-2)", "var(--seri-3)", "var(--seri-4)",
  "var(--seri-5)", "var(--seri-6)", "var(--seri-7)", "var(--seri-8)",
  "var(--seri-9)", "var(--seri-10)",
];

function el(ad, ozellikler = {}) {
  const dugum = document.createElementNS(NS, ad);
  for (const [anahtar, deger] of Object.entries(ozellikler)) {
    if (deger != null) dugum.setAttribute(anahtar, deger);
  }
  return dugum;
}

/** Kesintili seriyi kesintisiz parçalara böler. */
function parcalar(noktalar) {
  const cikti = [];
  let aktif = [];
  for (const nokta of noktalar) {
    if (nokta.deger == null) {
      if (aktif.length) cikti.push(aktif);
      aktif = [];
    } else {
      aktif.push(nokta);
    }
  }
  if (aktif.length) cikti.push(aktif);
  return cikti;
}

function olcek(min, max, uzunluk, tersi = false) {
  const aralik = max - min || 1;
  return (deger) => {
    const oran = (deger - min) / aralik;
    return tersi ? uzunluk - oran * uzunluk : oran * uzunluk;
  };
}

/** Eksende okunaklı adımlar (1-2-5 ailesi). */
function guzelAdimlar(min, max, hedefAdet = 5) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const hamAdim = (max - min) / hedefAdet;
  const buyukluk = Math.pow(10, Math.floor(Math.log10(hamAdim)));
  const oran = hamAdim / buyukluk;
  const adim = (oran >= 5 ? 10 : oran >= 2 ? 5 : oran >= 1 ? 2 : 1) * buyukluk;
  const alt = Math.floor(min / adim) * adim;
  const ust = Math.ceil(max / adim) * adim;
  const adimlar = [];
  for (let deger = alt; deger <= ust + adim * 0.001; deger += adim) adimlar.push(Number(deger.toFixed(6)));
  return { alt, ust, adimlar };
}

/* ------------------------------------------------------------------ ipucu */

let ipucuDugum = null;

export function ipucuGoster(html, olay) {
  if (!ipucuDugum) ipucuDugum = document.getElementById("ipucu");
  ipucuDugum.innerHTML = html;
  ipucuDugum.hidden = false;
  const kutu = ipucuDugum.getBoundingClientRect();
  const bosluk = 14;
  let x = olay.clientX + bosluk;
  let y = olay.clientY + bosluk;
  if (x + kutu.width > window.innerWidth - 8) x = olay.clientX - kutu.width - bosluk;
  if (y + kutu.height > window.innerHeight - 8) y = olay.clientY - kutu.height - bosluk;
  ipucuDugum.style.left = `${Math.max(8, x)}px`;
  ipucuDugum.style.top = `${Math.max(8, y)}px`;
}

export function ipucuGizle() {
  if (!ipucuDugum) ipucuDugum = document.getElementById("ipucu");
  ipucuDugum.hidden = true;
}

/* -------------------------------------------------------------- sparkline */

/**
 * @param {{yil:number, deger:number|null, ipucu?:string}[]} noktalar
 */
export function sparkline(noktalar, secenekler = {}) {
  const genislik = secenekler.genislik ?? 118;
  const yukseklik = secenekler.yukseklik ?? 34;
  const bosluk = 5;
  const renk = secenekler.renk ?? "var(--vurgu-acik)";

  const svg = el("svg", {
    class: "grafik",
    viewBox: `0 0 ${genislik} ${yukseklik}`,
    width: genislik,
    height: yukseklik,
    role: "img",
    "aria-label": secenekler.etiket ?? "Yıllara göre değişim",
  });

  const degerler = noktalar.filter((nokta) => nokta.deger != null).map((nokta) => nokta.deger);
  if (!degerler.length) return svg;

  const min = secenekler.min ?? Math.min(...degerler);
  const max = secenekler.max ?? Math.max(...degerler);
  const xOlcek = (indeks) =>
    bosluk + (indeks / Math.max(1, noktalar.length - 1)) * (genislik - bosluk * 2);
  const yOlcek = olcek(min, max, yukseklik - bosluk * 2, true);
  const y = (deger) => bosluk + yOlcek(deger);

  const konumlu = noktalar.map((nokta, indeks) => ({ ...nokta, x: xOlcek(indeks), yy: nokta.deger == null ? null : y(nokta.deger) }));

  for (const parca of parcalar(konumlu.map((nokta) => ({ ...nokta, deger: nokta.deger })))) {
    const d = parca.map((nokta, i) => `${i ? "L" : "M"}${nokta.x.toFixed(1)},${nokta.yy.toFixed(1)}`).join(" ");
    svg.append(el("path", { d, class: "seri-cizgi", stroke: renk, "stroke-width": 1.8 }));
  }

  konumlu.forEach((nokta, indeks) => {
    if (nokta.yy == null) return;
    const sonMu = indeks === konumlu.length - 1 || konumlu.slice(indeks + 1).every((sonraki) => sonraki.yy == null);
    svg.append(el("circle", { cx: nokta.x, cy: nokta.yy, r: sonMu ? 3 : 2, fill: renk, class: "seri-nokta" }));
    if (nokta.ipucu) {
      const hedef = el("circle", { cx: nokta.x, cy: nokta.yy, r: 8, class: "nokta-hedef" });
      hedef.addEventListener("mouseenter", (olay) => ipucuGoster(nokta.ipucu, olay));
      hedef.addEventListener("mousemove", (olay) => ipucuGoster(nokta.ipucu, olay));
      hedef.addEventListener("mouseleave", ipucuGizle);
      svg.append(hedef);
    }
  });

  return svg;
}

/* ------------------------------------------------------------ büyük grafik */

/**
 * @param {{ad:string, renk?:string, noktalar:{yil:number, deger:number|null, ipucu?:string}[], vurgulu?:boolean}[]} seriler
 */
export function cizgiGrafik(seriler, secenekler = {}) {
  const genislik = secenekler.genislik ?? 820;
  const yukseklik = secenekler.yukseklik ?? 320;
  const kenar = { ust: 16, sag: 18, alt: 34, sol: secenekler.solKenar ?? 56 };
  const alanG = genislik - kenar.sol - kenar.sag;
  const alanY = yukseklik - kenar.ust - kenar.alt;

  const svg = el("svg", {
    class: "grafik",
    viewBox: `0 0 ${genislik} ${yukseklik}`,
    preserveAspectRatio: "xMidYMid meet",
    role: "img",
    "aria-label": secenekler.etiket ?? "Yıllara göre değişim grafiği",
  });

  const yillar = secenekler.yillar ?? [];
  const tumDegerler = seriler.flatMap((seri) => seri.noktalar.filter((n) => n.deger != null).map((n) => n.deger));
  if (!tumDegerler.length) {
    const bosYazi = el("text", {
      x: genislik / 2, y: yukseklik / 2, class: "eksen-yazi", "text-anchor": "middle",
    });
    bosYazi.textContent = "Seçilen filtrelerde veri yok";
    svg.append(bosYazi);
    return svg;
  }

  let min = Math.min(...tumDegerler);
  let max = Math.max(...tumDegerler);
  const pay = (max - min) * 0.12 || Math.abs(max) * 0.05 || 1;
  const { alt, ust, adimlar } = guzelAdimlar(
    secenekler.sifirdanBasla ? Math.min(0, min) : min - pay,
    secenekler.enFazla != null ? Math.min(max + pay, secenekler.enFazla) : max + pay,
    5
  );

  const x = (indeks) => kenar.sol + (yillar.length <= 1 ? alanG / 2 : (indeks / (yillar.length - 1)) * alanG);
  const yOlcek = olcek(alt, ust, alanY, true);
  const y = (deger) => kenar.ust + yOlcek(deger);

  // ızgara + y ekseni
  for (const adim of adimlar) {
    const yy = y(adim);
    svg.append(el("line", { x1: kenar.sol, x2: kenar.sol + alanG, y1: yy, y2: yy, class: "izgara" }));
    const yazi = el("text", { x: kenar.sol - 9, y: yy + 3.5, class: "eksen-yazi", "text-anchor": "end" });
    yazi.textContent = (secenekler.eksenBicim ?? ((deger) => deger))(adim);
    svg.append(yazi);
  }

  // x ekseni
  svg.append(
    el("line", { x1: kenar.sol, x2: kenar.sol + alanG, y1: kenar.ust + alanY, y2: kenar.ust + alanY, class: "eksen-cizgi" })
  );
  yillar.forEach((yil, indeks) => {
    const yazi = el("text", { x: x(indeks), y: kenar.ust + alanY + 19, class: "eksen-yazi", "text-anchor": "middle" });
    yazi.textContent = yil;
    svg.append(yazi);
  });

  // seriler
  seriler.forEach((seri, seriIndeks) => {
    const renk = seri.renk ?? SERI_RENKLERI[seriIndeks % SERI_RENKLERI.length];
    const kalinlik = seri.vurgulu ? 3 : 2;
    const konumlu = seri.noktalar.map((nokta, indeks) => ({
      ...nokta,
      x: x(indeks),
      yy: nokta.deger == null ? null : y(nokta.deger),
    }));

    for (const parca of parcalar(konumlu)) {
      const d = parca.map((nokta, i) => `${i ? "L" : "M"}${nokta.x.toFixed(1)},${nokta.yy.toFixed(1)}`).join(" ");
      svg.append(el("path", { d, class: "seri-cizgi", stroke: renk, "stroke-width": kalinlik }));
    }

    konumlu.forEach((nokta) => {
      if (nokta.yy == null) return;
      svg.append(el("circle", { cx: nokta.x, cy: nokta.yy, r: seri.vurgulu ? 4.5 : 3.6, fill: renk, class: "seri-nokta" }));
      if (nokta.ipucu) {
        const hedef = el("circle", { cx: nokta.x, cy: nokta.yy, r: 13, class: "nokta-hedef" });
        hedef.addEventListener("mouseenter", (olay) => ipucuGoster(nokta.ipucu, olay));
        hedef.addEventListener("mousemove", (olay) => ipucuGoster(nokta.ipucu, olay));
        hedef.addEventListener("mouseleave", ipucuGizle);
        svg.append(hedef);
      }
    });
  });

  return svg;
}
