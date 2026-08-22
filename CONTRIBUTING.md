# Katkı rehberi

Katkılar memnuniyetle karşılanır: hata bildirimi, veri düzeltmesi, yeni özellik ya da yalnızca dokümantasyon iyileştirmesi.

## Geliştirme ortamı

Derleme adımı ve paket yöneticisi yoktur. Gerekenler:

- **Python 3.10+** — veri boru hattı için (`pip install -r tools/requirements.txt`)
- **Node 18+** — testler için (harici bağımlılık yok)
- Statik dosya sunucusu — `python3 -m http.server 8765 --directory docs`

```bash
git clone https://github.com/HakanIST/yks-program-analiz.git
cd yks-program-analiz
python3 -m http.server 8765 --directory docs
```

## Değişiklik yapmadan önce

1. Sıralama, ortalama ya da birleştirme kurallarını etkileyen bir değişiklik yapıyorsanız önce bir **konu (issue)** açın; bu kurallar README'nin [Metodoloji](README.md#metodoloji) bölümünde tanımlıdır ve değişmeleri hâlinde orası da güncellenmelidir.
2. Arayüz değişikliklerinde açık ve koyu temanın ikisini de kontrol edin.
3. Harici JavaScript/CSS bağımlılığı eklemeyin. Panelin sıfır bağımlılıkla, tek bir statik dizinden çalışması bilinçli bir tercihtir.

## Testler

```bash
python3 tools/tests/groundtruth.py     # pandas ile beklenen sonuçları üretir
node tools/tests/ranking.test.mjs      # sıralama motorunu doğrular
```

Sıralama motoruna (`docs/assets/js/ranking.js`) dokunan her değişiklik testlerle birlikte gelmelidir. Yeni bir kural ekliyorsanız `tools/tests/groundtruth.py` içindeki `DURUMLAR` listesine bir senaryo ekleyin — böylece JavaScript hesabı bağımsız bir pandas hesabıyla karşılaştırılır.

## Kod biçimi

- Değişken, fonksiyon ve dosya adları Türkçe; yorumlar Türkçe.
- JavaScript: 2 boşluk girinti, ES modülleri, noktalı virgül.
- Python: 4 boşluk girinti, tip ipuçları, `argparse` ile CLI.
- Yorumlar "ne yaptığını" değil, **neden öyle yapıldığını** anlatmalı.

## Veri düzeltmeleri

Ham veride bir hata bulduysanız (yanlış kontenjan, eksik program, hatalı şehir eşlemesi) lütfen **Veri hatası** konu şablonunu kullanın ve şunları belirtin:

- Yıl, üniversite, program adı
- Kaynak kılavuzdaki doğru değer ve sayfa/bağlantı
- Etkilenen satır sayısı hakkında fikriniz varsa

Şehir eşlemesi düzeltmeleri `tools/normalize.py` içindeki `MANUEL_SEHIR` tablosuna eklenir.

## Sürüm ve dal düzeni

- `main` her zaman yayınlanabilir durumda olmalıdır; `docs/` dizini doğrudan GitHub Pages'e gider.
- Dal adları: `ozellik/kisa-aciklama`, `duzeltme/kisa-aciklama`, `veri/kisa-aciklama`.
- Kullanıcıya görünen her değişiklik `CHANGELOG.md` dosyasına işlenir.

## Pull request kontrol listesi

- [ ] Testler geçiyor (`node tools/tests/ranking.test.mjs`)
- [ ] Panel açık ve koyu temada kontrol edildi
- [ ] Metodoloji değiştiyse README güncellendi
- [ ] `CHANGELOG.md` güncellendi
- [ ] Üretilen veri dosyaları değiştiyse `tools/build_dataset.py` ile yeniden üretildi
