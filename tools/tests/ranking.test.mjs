/**
 * Sıralama motorunun düğüm (Node) altında çalıştırılan testleri.
 *
 * Tarayıcı olmadan çalışabilmesi için `fetch` diskten okuyacak şekilde
 * değiştirilir. Beklenen değerler `tools/tests/expected.json` dosyasından
 * gelir; o dosyayı bağımsız bir pandas hesabı üretir (bkz. groundtruth.py).
 *
 * Çalıştırma:  node tools/tests/ranking.test.mjs
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

globalThis.fetch = async (yol) => {
  const tamYol = path.join(kok, "docs", yol);
  const icerik = await readFile(tamYol, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(icerik) };
};

const { veriYukle } = await import(path.join(kok, "docs/assets/js/data.js"));
const { hesapla, gosterilecekSatirlar, dilKirilimi, kurumTablosu, kurumToplami } = await import(path.join(kok, "docs/assets/js/ranking.js"));

const veri = await veriYukle("data");

function filtreKur(secenekler = {}) {
  return {
    program: null,
    seviye: null,
    puanTuru: null,
    dil: null,
    ucret: null,
    ogretim: null,
    yillar: new Uint8Array(veri.meta.yillar.length).fill(1),
    bolge: { tip: "TR" },
    tur: { tip: "YURTICI_HEPSI" },
    olcut: "puan",
    takip: null,
    ...secenekler,
  };
}

const programIndeksi = (ad) => veri.programAra(ad).indeks;
const uniIndeksi = (ad) => veri.universiteAra(ad).indeks;

let basarili = 0;
let basarisiz = 0;

function test(ad, govde) {
  try {
    govde();
    basarili++;
    console.log(`  ✓ ${ad}`);
  } catch (hata) {
    basarisiz++;
    console.error(`  ✗ ${ad}\n    ${hata.message}`);
  }
}

console.log("veri seti:", veri.n, "kayıt,", veri.universiteler.length, "üniversite,", veri.programlar.length, "program");

/* ------------------------------------------------------------------ temel */

test("yıllar artan sırada", () => {
  const yillar = veri.meta.yillar;
  assert.deepEqual(yillar, [...yillar].sort((a, b) => a - b));
});

test("program adlarında burs/dil eki kalmamış", () => {
  const kirli = veri.programlar.filter((program) =>
    /\((Burslu|Ücretli|%\d+ İndirimli|İngilizce|İÖ)\)/.test(program.ad)
  );
  assert.equal(kirli.length, 0, `temizlenmemiş: ${kirli.slice(0, 3).map((p) => p.ad).join(", ")}`);
});

test("kılavuz adlandırması kanonikleşmiş (Fakültesi/Yüksekokulu eki kalmamış)", () => {
  const ekli = veri.programlar.filter((program) => /\s(Fakültesi|Yüksekokulu)(\s|$)/.test(program.ad));
  assert.equal(ekli.length, 0, `ek taşıyan ad: ${ekli.slice(0, 3).map((p) => p.ad).join(", ")}`);
});

test("yalnızca yazımda ayrışan program adı kalmamış", () => {
  const anahtar = (ad) =>
    ad.replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase().replace(/[^0-9a-zçğıöşü]/g, "");
  const gorulen = new Map();
  const cakisan = [];
  for (const program of veri.programlar) {
    const k = anahtar(program.ad);
    if (gorulen.has(k)) cakisan.push(`${gorulen.get(k)} ~ ${program.ad}`);
    else gorulen.set(k, program.ad);
  }
  assert.equal(cakisan.length, 0, cakisan.slice(0, 3).join(" | "));
});

test("adlandırması değişen programda seri bölünmüyor (Diş Hekimliği 2021–2026)", () => {
  // Kaynakta 2021–2022'de "Diş Hekimliği Fakültesi", 2023'ten sonra "Diş Hekimliği".
  const sonuc = hesapla(
    veri,
    filtreKur({ program: programIndeksi("Diş Hekimliği"), bolge: { tip: "HEPSI" }, tur: { tip: "HEPSI" } })
  );
  const satir = sonuc.satirlar.find((s) => s.uni.indeks === uniIndeksi("ÜSKÜDAR ÜNİVERSİTESİ"));
  assert.ok(satir, "Üsküdar Diş Hekimliği satırı yok");
  const dolu = satir.yillik.filter(Boolean).length;
  assert.equal(dolu, veri.meta.yillar.length, `${dolu} yılda veri var, ${veri.meta.yillar.length} bekleniyordu`);
});

test("Üsküdar Üniversitesi bulunuyor ve İstanbul'da", () => {
  const uni = veri.universiteAra("ÜSKÜDAR ÜNİVERSİTESİ");
  assert.ok(uni, "üniversite bulunamadı");
  assert.equal(uni.sehir, "İSTANBUL");
  assert.equal(uni.turGrubu, "vakif");
});

/* -------------------------------------------------------------- sıralama */

test("puan sıralaması azalan ve eşitlikte kontenjana göre", () => {
  const sonuc = hesapla(veri, filtreKur({ program: programIndeksi("Psikoloji") }));
  for (let i = 1; i < sonuc.satirlar.length; i++) {
    const onceki = sonuc.satirlar[i - 1];
    const simdiki = sonuc.satirlar[i];
    if (onceki.ortPuan == null || simdiki.ortPuan == null) continue;
    assert.ok(
      onceki.ortPuan > simdiki.ortPuan ||
        (onceki.ortPuan === simdiki.ortPuan && onceki.toplamKontenjan >= simdiki.toplamKontenjan),
      `sıra bozuk: ${onceki.uni.ad} (${onceki.ortPuan}) < ${simdiki.uni.ad} (${simdiki.ortPuan})`
    );
  }
});

test("doluluk sıralamasında eşitlik kontenjanla çözülüyor", () => {
  const sonuc = hesapla(veri, filtreKur({ program: programIndeksi("Psikoloji"), olcut: "doluluk" }));
  const esitler = sonuc.satirlar.filter((satir, i) => i > 0 && satir.ortDoluluk === sonuc.satirlar[i - 1].ortDoluluk);
  for (const satir of esitler) {
    const oncekiIndeks = sonuc.satirlar.indexOf(satir) - 1;
    assert.ok(sonuc.satirlar[oncekiIndeks].toplamKontenjan >= satir.toplamKontenjan);
  }
});

test("sıra numaraları 1'den başlayıp kesintisiz artıyor", () => {
  const sonuc = hesapla(veri, filtreKur({ program: programIndeksi("Psikoloji") }));
  const siralar = sonuc.satirlar.map((satir) => satir.sira).filter((sira) => sira != null);
  assert.deepEqual(siralar, siralar.map((_, i) => i + 1));
});

/* ---------------------------------------------------------------- kapsam */

test("İstanbul vakıf kapsamı yalnızca İstanbul vakıflarını getiriyor", () => {
  const sonuc = hesapla(
    veri,
    filtreKur({ program: programIndeksi("Psikoloji"), bolge: { tip: "IST" }, tur: { tip: "GRUP", deger: "vakif" } })
  );
  assert.ok(sonuc.satirlar.length > 0);
  for (const satir of sonuc.satirlar) {
    assert.equal(satir.uni.sehir, "İSTANBUL");
    assert.equal(satir.uni.turGrubu, "vakif");
  }
});

test("devlet kapsamında vakıf üniversitesi yok", () => {
  const sonuc = hesapla(veri, filtreKur({ program: programIndeksi("Psikoloji"), tur: { tip: "GRUP", deger: "devlet" } }));
  assert.ok(sonuc.satirlar.every((satir) => satir.uni.turGrubu === "devlet"));
});

test("kapsam daraldıkça üniversite sayısı azalıyor", () => {
  const genis = hesapla(veri, filtreKur({ program: programIndeksi("Psikoloji") })).ozet.universite;
  const dar = hesapla(
    veri,
    filtreKur({ program: programIndeksi("Psikoloji"), bolge: { tip: "IST" }, tur: { tip: "GRUP", deger: "vakif" } })
  ).ozet.universite;
  assert.ok(dar < genis, `${dar} < ${genis} bekleniyordu`);
});

/* ------------------------------------------------------ takip edilen kurum */

test("Üsküdar ilk 20 dışındaysa gerçek sırasıyla ayrıca geliyor", () => {
  const uskudar = uniIndeksi("ÜSKÜDAR ÜNİVERSİTESİ");
  const sonuc = hesapla(veri, filtreKur({ program: programIndeksi("Psikoloji"), takip: uskudar }));
  const { ilkler, takip, takipIcerde } = gosterilecekSatirlar(sonuc, uskudar, 20);
  assert.equal(ilkler.length, 20);
  if (!takipIcerde) {
    assert.ok(takip, "takip satırı gelmedi");
    assert.ok(takip.sira > 20, `gerçek sıra 20'den büyük olmalı, ${takip.sira} geldi`);
    const listedekiSira = sonuc.satirlar.findIndex((satir) => satir.uni.indeks === uskudar) + 1;
    assert.equal(takip.sira, listedekiSira, "gösterilen sıra gerçek sıra değil");
  }
});

/* ------------------------------------------------------------- toplamlar */

test("özet toplamları filtreyle birlikte değişiyor", () => {
  const tum = hesapla(veri, filtreKur({ program: programIndeksi("Psikoloji") })).ozet;
  const ist = hesapla(
    veri,
    filtreKur({ program: programIndeksi("Psikoloji"), bolge: { tip: "IST" }, tur: { tip: "GRUP", deger: "vakif" } })
  ).ozet;
  assert.ok(ist.kontenjan < tum.kontenjan);
  assert.ok(ist.yerlesen < tum.yerlesen);
  assert.ok(tum.doluluk > 0 && tum.doluluk <= 150);
});

test("yıl filtresi toplamları düşürüyor", () => {
  const hepsi = hesapla(veri, filtreKur({ program: programIndeksi("Psikoloji") })).ozet;
  const yillar = new Uint8Array(veri.meta.yillar.length);
  yillar[yillar.length - 1] = 1;
  const tekYil = hesapla(veri, filtreKur({ program: programIndeksi("Psikoloji"), yillar })).ozet;
  assert.ok(tekYil.kontenjan < hepsi.kontenjan);
  assert.ok(tekYil.kayit < hepsi.kayit);
});

/* ------------------------------------------------------------ dil ayrımı */

const mbg = () => programIndeksi("Moleküler Biyoloji ve Genetik");
const istVakif = { bolge: { tip: "IST" }, tur: { tip: "GRUP", deger: "vakif" } };
const dilIndeksi = (ad) => veri.meta.diller.indexOf(ad);

test("çok dilli program dil listesini taşıyor (MBG: Türkçe + İngilizce)", () => {
  const program = veri.programlar[mbg()];
  assert.ok(program.diller.includes(dilIndeksi("Türkçe")), "Türkçe yok");
  assert.ok(program.diller.includes(dilIndeksi("İngilizce")), "İngilizce yok");
  const kurum = veri.universiteProgramlari(uniIndeksi("ÜSKÜDAR ÜNİVERSİTESİ"));
  assert.deepEqual([...kurum.get(mbg())].sort(), [dilIndeksi("Türkçe"), dilIndeksi("İngilizce")].sort());
});

test("birleşik görünümde özet ve satır birden fazla dil bildiriyor", () => {
  const sonuc = hesapla(veri, filtreKur({ program: mbg(), ...istVakif }));
  assert.ok(sonuc.ozet.diller.length > 1, "özet tek dil bildirdi");
  const satir = sonuc.satirlar.find((s) => s.uni.indeks === uniIndeksi("ÜSKÜDAR ÜNİVERSİTESİ"));
  assert.deepEqual(satir.diller, [dilIndeksi("Türkçe"), dilIndeksi("İngilizce")]);
});

test("dil filtresi Üsküdar MBG'yi ayrı bölümlere ayırıyor (2026)", () => {
  // MDBF'nin raporlama talebi: TR ve İNG bölümlerinin doluluğu ayrı ayrı okunabilmeli.
  const sonYil = veri.meta.yillar.indexOf(2026);
  const uskudar = uniIndeksi("ÜSKÜDAR ÜNİVERSİTESİ");
  const oku = (dil) =>
    hesapla(veri, filtreKur({ program: mbg(), dil, ...istVakif })).satirlar.find((s) => s.uni.indeks === uskudar).yillik[sonYil];
  const tr = oku(dilIndeksi("Türkçe"));
  const ing = oku(dilIndeksi("İngilizce"));
  assert.deepEqual([tr.kontenjan, tr.yerlesen], [49, 38]);
  assert.deepEqual([ing.kontenjan, ing.yerlesen], [74, 46]);
  assert.ok(tr.doluluk > 70 && ing.doluluk < 70, "TR %70 üstünde, İNG altında olmalı");
  const birlesik = oku(null);
  assert.equal(birlesik.kontenjan, tr.kontenjan + ing.kontenjan);
  assert.equal(birlesik.yerlesen, tr.yerlesen + ing.yerlesen);
});

test("dilKirilimi birleşik satırla ve dil filtreli hesapla ile tutarlı", () => {
  const uskudar = uniIndeksi("ÜSKÜDAR ÜNİVERSİTESİ");
  const birlesik = hesapla(veri, filtreKur({ program: mbg(), ...istVakif })).satirlar.find((s) => s.uni.indeks === uskudar);
  const kirilim = dilKirilimi(veri, birlesik);
  assert.equal(kirilim.length, 2);
  for (const dil of kirilim) {
    const ayri = hesapla(veri, filtreKur({ program: mbg(), dil: dil.dil, ...istVakif })).satirlar.find((s) => s.uni.indeks === uskudar);
    assert.equal(dil.toplamKontenjan, ayri.toplamKontenjan, `${dil.ad} kontenjan`);
    assert.equal(dil.toplamYerlesen, ayri.toplamYerlesen, `${dil.ad} yerleşen`);
    assert.ok(Math.abs(dil.ortDoluluk - ayri.ortDoluluk) < 1e-9, `${dil.ad} ortalama doluluk`);
    dil.yillik.forEach((h, yil) => {
      const beklenen = ayri.yillik[yil];
      if (!h) return assert.equal(beklenen, null);
      assert.equal(h.kontenjan, beklenen.kontenjan);
      assert.equal(h.enBuyuk, beklenen.enBuyuk);
    });
  }
  birlesik.yillik.forEach((h, yil) => {
    if (!h) return;
    const toplam = kirilim.reduce((t, dil) => t + (dil.yillik[yil]?.kontenjan ?? 0), 0);
    assert.equal(toplam, h.kontenjan, `${veri.meta.yillar[yil]} kırılım toplamı`);
  });
});

test("tek dilli programda kırılım tek satır, özet tek dil", () => {
  const sonuc = hesapla(veri, filtreKur({ program: mbg(), dil: dilIndeksi("İngilizce"), ...istVakif }));
  assert.deepEqual(sonuc.ozet.diller, [dilIndeksi("İngilizce")]);
  for (const satir of sonuc.satirlar) assert.equal(dilKirilimi(veri, satir).length, 1);
});

/* --------------------------------------------------------- kurum görünümü */

test("kurum tablosu: Üsküdar'ın MBG Türkçe ve İngilizce bölümleri ayrı satır", () => {
  const uskudar = uniIndeksi("ÜSKÜDAR ÜNİVERSİTESİ");
  const sonuc = kurumTablosu(veri, filtreKur({ ...istVakif, olcut: "doluluk", takip: uskudar }), uskudar);
  const etiketler = sonuc.satirlar.map((s) => s.etiket);
  assert.ok(etiketler.includes("Moleküler Biyoloji ve Genetik"), "Türkçe satır yok");
  assert.ok(etiketler.includes("Moleküler Biyoloji ve Genetik (İngilizce)"), "İngilizce satır yok");
  // Üsküdar Bilgisayar Mühendisliğini yalnızca İngilizce sunuyor: tek satır, dil ekli
  assert.ok(etiketler.includes("Bilgisayar Mühendisliği (İngilizce)"));
  assert.ok(!etiketler.includes("Bilgisayar Mühendisliği"), "İngilizce-only programda yalın satır olmamalı");
  const sonYil = veri.meta.yillar.indexOf(2026);
  const tr = sonuc.satirlar.find((s) => s.etiket === "Moleküler Biyoloji ve Genetik").satir.yillik[sonYil];
  const ing = sonuc.satirlar.find((s) => s.etiket === "Moleküler Biyoloji ve Genetik (İngilizce)").satir.yillik[sonYil];
  assert.deepEqual([tr.kontenjan, tr.yerlesen, ing.kontenjan, ing.yerlesen], [49, 38, 74, 46]);
});

test("kurum tablosu: sıra ve son 2 yıl farkı dil filtreli hesapla ile aynı", () => {
  const uskudar = uniIndeksi("ÜSKÜDAR ÜNİVERSİTESİ");
  const filtre = filtreKur({ ...istVakif, olcut: "doluluk", takip: uskudar });
  const sonuc = kurumTablosu(veri, filtre, uskudar);
  const satir = sonuc.satirlar.find((s) => s.etiket === "Moleküler Biyoloji ve Genetik (İngilizce)");
  const ayri = hesapla(veri, { ...filtre, program: mbg(), dil: dilIndeksi("İngilizce") });
  const beklenen = ayri.satirlar.find((s) => s.uni.indeks === uskudar);
  assert.equal(satir.sira, beklenen.sira);
  assert.equal(satir.siralanan, ayri.ozet.siralanan);
  const y = veri.meta.yillar.length;
  const fark = beklenen.yillik[y - 1].doluluk - beklenen.yillik[y - 2].doluluk;
  assert.ok(Math.abs(satir.sonFark - fark) < 1e-9, `son fark ${satir.sonFark} ≠ ${fark}`);
});

test("kurum tablosu: toplam satırı yıl bazında kontenjan/yerleşen toplamıdır", () => {
  const uskudar = uniIndeksi("ÜSKÜDAR ÜNİVERSİTESİ");
  const sonuc = kurumTablosu(veri, filtreKur({ ...istVakif, olcut: "doluluk", takip: uskudar }), uskudar);
  const mdbf = new Set(["Moleküler Biyoloji ve Genetik", "Moleküler Biyoloji ve Genetik (İngilizce)", "Yazılım Mühendisliği (İngilizce)"]);
  const secilen = sonuc.satirlar.filter((s) => mdbf.has(s.etiket));
  assert.equal(secilen.length, 3);
  const toplam = kurumToplami(secilen, veri.meta.yillar.length);
  const sonYil = veri.meta.yillar.indexOf(2026);
  const kontenjan = secilen.reduce((t, s) => t + s.satir.yillik[sonYil].kontenjan, 0);
  const yerlesen = secilen.reduce((t, s) => t + s.satir.yillik[sonYil].yerlesen, 0);
  assert.equal(toplam.yillik[sonYil].kontenjan, kontenjan);
  assert.equal(toplam.yillik[sonYil].yerlesen, yerlesen);
  assert.ok(Math.abs(toplam.yillik[sonYil].doluluk - (yerlesen / kontenjan) * 100) < 1e-9);
});

test("kurum tablosu: kurum kapsam dışındaysa satır yok, üniversite seçilmemişse boş", () => {
  const uskudar = uniIndeksi("ÜSKÜDAR ÜNİVERSİTESİ");
  const devlet = kurumTablosu(veri, filtreKur({ tur: { tip: "GRUP", deger: "devlet" }, takip: uskudar }), uskudar);
  assert.equal(devlet.satirlar.length, 0);
  assert.equal(devlet.toplam.kontenjan, 0);
  assert.equal(kurumTablosu(veri, filtreKur(), null).satirlar.length, 0);
});

/* --------------------------------------------- pandas ile çapraz doğrulama */

const beklenenYol = path.join(kok, "tools/tests/expected.json");
let beklenen = null;
try {
  beklenen = JSON.parse(await readFile(beklenenYol, "utf8"));
} catch {
  console.log("  (expected.json yok — çapraz doğrulama atlandı; üretmek için: python3 tools/tests/groundtruth.py)");
}

if (beklenen) {
  for (const durum of beklenen.durumlar) {
    test(`pandas ile aynı: ${durum.ad}`, () => {
      const sonuc = hesapla(
        veri,
        filtreKur({
          program: programIndeksi(durum.program),
          bolge: durum.bolge,
          tur: durum.tur,
          olcut: durum.olcut,
          dil: durum.dil != null ? dilIndeksi(durum.dil) : null,
        })
      );
      assert.equal(sonuc.ozet.universite, durum.ozet.universite, "üniversite sayısı");
      assert.equal(sonuc.ozet.kontenjan, durum.ozet.kontenjan, "toplam kontenjan");
      assert.equal(sonuc.ozet.yerlesen, durum.ozet.yerlesen, "toplam yerleşen");
      const alan = durum.olcut === "doluluk" ? "ortDoluluk" : "ortPuan";
      const ilk10 = sonuc.satirlar.slice(0, 10).map((satir) => [satir.uni.ad, satir[alan]]);
      assert.deepEqual(
        ilk10.map(([ad]) => ad),
        durum.ilk10.map(([ad]) => ad),
        "ilk 10 üniversite sırası"
      );
      // Ortalamalar kayan nokta toplama sırasından ötürü son basamakta ayrışabilir.
      ilk10.forEach(([ad, deger], indeks) => {
        const fark = Math.abs(deger - durum.ilk10[indeks][1]);
        assert.ok(fark < 0.001, `${ad}: ${deger} ≠ ${durum.ilk10[indeks][1]} (fark ${fark})`);
      });
    });
  }
}

console.log(`\n${basarili} başarılı, ${basarisiz} başarısız`);
process.exit(basarisiz ? 1 : 0);
