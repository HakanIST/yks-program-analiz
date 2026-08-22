# Değişiklik günlüğü

Bu proje [Semantik Sürümleme](https://semver.org/lang/tr/) kullanır.

## [1.0.0] — 2026-08-22

İlk sürüm.

### Düzeltildi
- Kılavuzlar arası adlandırma farkları yüzünden bölünen program serileri birleştirildi: 2021–2022'deki `X Fakültesi` / `X Yüksekokulu` adları yalın program adına indirgendi, yalnızca yazımda ayrışan adlar (`UOLP-SUNY` ~ `UOLP-Suny`) tek yazıma toplandı. Temel program sayısı 1.005'ten 929'a indi, 1.564 kayıt etkilendi.

### Eklendi
- 2021–2026 YKS ilk yerleştirme verisiyle (128.832 kayıt, 239 üniversite, 1.005 temel program) çalışan statik analiz paneli.
- Program seçimi, üniversite kapsamı (Türkiye geneli / İstanbul / il / KKTC / yurt dışı), üniversite türü, yıl, seviye, puan türü, öğretim dili, ücret-burs ve öğretim şekli filtreleri.
- En Büyük Puan ve Doluluk Oranı ölçütleri; doluluk sıralamasında eşitliğin kontenjanla çözülmesi.
- İlk 20 sıralaması, satır içi trend grafikleri, üniversite detay paneli ve çok serili karşılaştırma grafiği.
- Takip edilen üniversitenin ilk 20 dışında kalsa da gerçek sırasıyla gösterilmesi.
- Filtrelere göre dinamik kategori özeti (üniversite, varyant, kontenjan, yerleşen, genel doluluk).
- Paylaşılabilir bağlantı (URL durumu), CSV dışa aktarımı, açık/koyu tema.
- Kuruma özel ayarlar tek dosyada (`docs/assets/js/config.js`): kurum adı, vurgulanan üniversite, varsayılan program, varsayılan kapsam, liste uzunluğu ve program listesinin kurumla sınırlanması. Varsayılan kapsam İstanbul – Vakıf.
- Sayfa başlığında ve tarayıcı sekmesinde kurum adı.
- Program listesi varsayılan olarak takip edilen kurumun programlarıyla sınırlı; kutucukla tüm programlara genişletilebilir.
- Ham veriden JSON üreten Python boru hattı ve pandas ile çapraz doğrulanan Node test paketi.
