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
const { hesapla, gosterilecekSatirlar } = await import(path.join(kok, "docs/assets/js/ranking.js"));

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
