/** Aranabilir açılır liste (1000+ program adı için basit ve hızlı). */

import { aramaAnahtari } from "./format.js";

export function combobox({ girdi, liste, kayitlar, secilince, bosMetin = "Sonuç yok", enFazla = 60 }) {
  let filtreli = kayitlar;
  let aktif = -1;
  let acik = false;

  function ac() {
    acik = true;
    liste.hidden = false;
    girdi.setAttribute("aria-expanded", "true");
  }

  function kapat() {
    acik = false;
    liste.hidden = true;
    girdi.setAttribute("aria-expanded", "false");
    aktif = -1;
  }

  function ciz() {
    liste.textContent = "";
    if (!filtreli.length) {
      const bos = document.createElement("li");
      bos.className = "bos";
      bos.textContent = bosMetin;
      liste.append(bos);
      return;
    }
    filtreli.slice(0, enFazla).forEach((kayit, indeks) => {
      const satir = document.createElement("li");
      satir.setAttribute("role", "option");
      satir.setAttribute("aria-selected", indeks === aktif ? "true" : "false");
      const ad = document.createElement("span");
      ad.textContent = kayit.etiket;
      satir.append(ad);
      if (kayit.aciklama) {
        const sayi = document.createElement("span");
        sayi.className = "sayi";
        sayi.textContent = kayit.aciklama;
        satir.append(sayi);
      }
      satir.addEventListener("mousedown", (olay) => {
        olay.preventDefault();
        sec(kayit);
      });
      liste.append(satir);
    });
  }

  function sec(kayit) {
    girdi.value = kayit.etiket;
    kapat();
    secilince(kayit);
  }

  function filtrele(metin) {
    const anahtar = aramaAnahtari(metin);
    if (!anahtar) {
      filtreli = kayitlar;
    } else {
      const kelimeler = anahtar.split(" ");
      const baslayan = [];
      const icerenler = [];
      for (const kayit of kayitlar) {
        if (!kelimeler.every((kelime) => kayit.anahtar.includes(kelime))) continue;
        (kayit.anahtar.startsWith(kelimeler[0]) ? baslayan : icerenler).push(kayit);
      }
      filtreli = [...baslayan, ...icerenler];
    }
    aktif = filtreli.length ? 0 : -1;
    ciz();
  }

  girdi.addEventListener("focus", () => {
    filtrele("");
    girdi.select();
    ac();
  });
  girdi.addEventListener("input", () => {
    filtrele(girdi.value);
    ac();
  });
  girdi.addEventListener("blur", () => setTimeout(kapat, 120));
  girdi.addEventListener("keydown", (olay) => {
    if (olay.key === "ArrowDown" || olay.key === "ArrowUp") {
      olay.preventDefault();
      if (!acik) {
        filtrele(girdi.value);
        ac();
      }
      const yon = olay.key === "ArrowDown" ? 1 : -1;
      aktif = Math.min(Math.max(0, aktif + yon), Math.min(filtreli.length, 60) - 1);
      ciz();
      liste.children[aktif]?.scrollIntoView({ block: "nearest" });
    } else if (olay.key === "Enter") {
      if (acik && filtreli[aktif]) {
        olay.preventDefault();
        sec(filtreli[aktif]);
      }
    } else if (olay.key === "Escape") {
      kapat();
    }
  });

  return {
    deger(etiket) {
      girdi.value = etiket ?? "";
    },
    kayitlariDegistir(yeni) {
      kayitlar = yeni;
      filtrele(girdi.value);
    },
  };
}
