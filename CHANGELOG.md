# Değişiklik günlüğü

Bu proje [Semantik Sürümleme](https://semver.org/lang/tr/) kullanır.

## [1.2.0] — 2026-08-28

Kurum görünümü: bir üniversitenin tüm programlarının yıllara göre tablosu (#3).

### Eklendi
- **Kurum görünümü** sekmesi (`#g=kurum`): takip edilen üniversitenin her bölümü bir satır; yıllara göre seçili ölçüt, dönem ortalaması, kontenjan, yerleşen, son iki yıl farkı, seçili kapsamdaki gerçek sıra (`11 / 16`) ve mini trend. Öğretim dili farklı olan programlar ayrı satırdır (ÖSYM adlandırması: `X`, `X (İngilizce)`); satıra tıklayınca o programın üniversite karşılaştırmasına geçilir.
- **Program kümesi** çipleri: tüm programlar, `config.js`'teki `fakulteler` haritasından gelen birimler (örnek: MDBF) ve satır kutucuklarıyla elle seçim; seçim bağlantıda saklanır (`k=`, `ps=`).
- **Doluluk eşiği** (varsayılan `AYAR.dolulukEsigi` = 70): eşiğin altındaki hücreler ve ortalamalar vurgulanır, özet kartında eşik altı program sayısı; bağlantıda `e=`.
- Toplam satırı (kümedeki programların toplam yerleşen / toplam kontenjan) ve küme ≤ 10 programsa hepsini tek grafikte gösteren çizgi grafik.
- Kurum görünümü için CSV dışa aktarımı (öğretim dili, sıra ve son iki yıl farkı sütunlarıyla, toplam satırı dahil).
- Sıralama motoru: saf `kurumTablosu()` ve `kurumToplami()`; 4 yeni test (31 toplam).
- Grafik paletine 9. ve 10. renk (10 seriye kadar tekrarsız).

## [1.1.0] — 2026-08-28

Türkçe ve İngilizce bölümlerin ayrı raporlanabilmesi (#1).

### Eklendi
- Program listesinde birden fazla dilde sunulan programlar için dil varyantları ayrı madde olarak listelenir (ör. `Moleküler Biyoloji ve Genetik (İngilizce)`); seçilince öğretim dili filtresi otomatik uygulanır. Yalın ad "tüm diller" anlamına gelir; burs/ücret varyantları eskisi gibi birleşik kalır.
- Birleşik görünümde birden fazla öğretim dili varsa tablo başlığının altında görünür uyarı ve dil bazına geçiş çipleri; dil filtresi açıkken geri dönüş çipi.
- Üniversite detay panelinde **öğretim diline göre kırılım** tablosu (yıl × dil: kontenjan, yerleşen, doluluk / en büyük puan, dönem toplamı ve ortalaması) ve "Yalnızca …" kısayolları.
- Sıralama tablosunda birden fazla dili kapsayan satırlarda `Türkçe + İngilizce` rozeti.
- CSV dışa aktarımına `Öğretim dili` sütunu; dosya adı ve başlık dil filtresini içerir.
- Sıralama motoru: `ozet.diller`, satır bazında `diller` ve saf `dilKirilimi()` fonksiyonu; pandas çapraz doğrulamasına dil filtreli iki senaryo.

### Düzeltildi
- CI'daki "üretilen veri depodakiyle aynı mı" kontrolü `meta.json` içindeki üretim tarihini (`uretim`) yok sayar; önceden yalnızca verinin üretildiği gün geçebiliyordu.

### Değiştirildi
- Tablo dipnotu ve README, veri kaynağının ÖSYM ilk yerleştirme olduğunu ve ek yerleştirme ile sonradan eklenen ek kontenjanların dahil olmadığını açıkça belirtir (kurum içi tablolarla küçük farkların nedeni).
- Tablo başlığı, filtre özeti ve program kutusu dil filtresi açıkken `(İngilizce)` ekini gösterir.

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
