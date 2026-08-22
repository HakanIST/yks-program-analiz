/** Biçimlendirme yardımcıları (tümü tr-TR). */

const tamsayiBicim = new Intl.NumberFormat("tr-TR");
const puanBicim = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const yuzdeBicim = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const sayi = (deger) => (deger == null || Number.isNaN(deger) ? "—" : tamsayiBicim.format(deger));
export const puan = (deger) => (deger == null || Number.isNaN(deger) ? "—" : puanBicim.format(deger));
export const yuzde = (deger) => (deger == null || Number.isNaN(deger) ? "—" : yuzdeBicim.format(deger) + "%");

/** Türkçe alfabetik sıralama için karşılaştırıcı. */
export const trSirala = new Intl.Collator("tr", { sensitivity: "base", numeric: true }).compare;

/** Arama için: büyük/küçük ve aksan farklarını yok sayan anahtar. */
export function aramaAnahtari(metin) {
  return metin
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (harf) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[harf])
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** 12.345 -> "12,3 bin" gibi kısa gösterim (KPI alt satırları için). */
export function kisaSayi(deger) {
  if (deger == null) return "—";
  if (Math.abs(deger) >= 1e6) return puanBicim.format(deger / 1e6) + " mn";
  if (Math.abs(deger) >= 1e4) return tamsayiBicim.format(Math.round(deger / 1e3)) + " bin";
  return tamsayiBicim.format(deger);
}

/** Değişim yönü etiketi: +12,40 / −3,10 */
export function degisim(deger, ondalik = 2) {
  if (deger == null || Number.isNaN(deger)) return "—";
  const bicim = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: ondalik, maximumFractionDigits: ondalik });
  const isaret = deger > 0 ? "+" : deger < 0 ? "−" : "";
  return isaret + bicim.format(Math.abs(deger));
}
