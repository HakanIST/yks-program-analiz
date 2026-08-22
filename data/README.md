# Veri

## Kaynak

ÖSYM *Yükseköğretim Programları ve Kontenjanları Kılavuzu* eklerinde yayımlanan
**ilk yerleştirme** sonuçları, 2021–2026 dönemi. Ek yerleştirme sonuçları bu veri
setinde yer almaz.

## Dosyalar

| Dosya | Açıklama |
|---|---|
| `raw/yks-ham.csv.gz` | Ham veri, gzip'li CSV, 128.832 satır (başlık hariç), UTF-8 |

Panelin okuduğu JSON dosyaları bu ham veriden üretilir ve `docs/data/` altında
bulunur; sürüm bilgisi `docs/data/VERSION.json` içindedir.

## Alanlar

| Sütun | Tür | Açıklama |
|---|---|---|
| `YIL` | tam sayı | Yerleştirme yılı (2021–2026) |
| `LİSANS/ÖN LİSANS` | metin | Programın seviyesi |
| `ÜNİVERSİTE TÜRÜ` | metin | `DEVLET`, `VAKIF`, `VAKIF MYO`, `KKTC`, `KKTC VAKIF`, `YURTDISI *` |
| `ÜNİVERSİTE` | metin | Kılavuzdaki tam ad; şehir çoğu kayıtta parantez içinde |
| `BÖLÜM/PROGRAM ADI` | metin | Program adı; dil, burs ve öğretim şekli parantez içinde |
| `PUAN TÜRÜ` | metin | `SAY`, `EA`, `SÖZ`, `DİL`, `TYT` |
| `KONTENJAN` | tam sayı | İlan edilen kontenjan |
| `YERLEŞEN` | tam sayı | Yerleşen aday sayısı (ek kontenjanla %100'ü aşabilir) |
| `DOLULUK ORANI %` | ondalık | `YERLEŞEN / KONTENJAN × 100` — türetilebilir olduğu için JSON'da saklanmaz |
| `EN KÜÇÜK PUAN` | ondalık / `--` | Programa yerleşen en düşük puan; `--` = yerleşen yok |
| `EN BÜYÜK PUAN` | ondalık / `--` | Programa yerleşen en yüksek puan; `--` = yerleşen yok |

## Bilinen veri özellikleri

- **`--` değerleri:** 3.865 satırda puan alanları `--`; bu satırlarda yerleşen sayısı sıfırdır. Ortalamalara katılmaz, grafikte çizgi kırılır.
- **%100'ü aşan doluluk:** 46.360 satırda doluluk oranı %100'ün üzerindedir (en yüksek %150). Kaynak veriden olduğu gibi alınmıştır.
- **Yıllar arası adlandırma değişikliği:** 2021–2022 kılavuzlarında `Tıp Fakültesi`, `Diş Hekimliği Fakültesi`, `Hemşirelik Yüksekokulu` gibi fakülte adları kullanılmış; 2023'ten itibaren yalın program adına (`Tıp`, `Diş Hekimliği`, `Hemşirelik`) geçilmiş. Ayrıca `UOLP-SUNY` ~ `UOLP-Suny` gibi yazım farkları var. Boru hattı bunları tek kanonik ada indirger (76 ad, 1.564 kayıt); ayrıntı README'nin Metodoloji bölümünde.
- **Yinelenen üniversite adı:** `İZMİR KAVRAM MESLEK YÜKSEKOKULU` kaynakta bir yıl çift boşlukla yazılmış; boşluklar sadeleştirilerek tek kurum olarak birleştirilir.
- **Şehri adından çözülemeyen kurumlar:** `GEBZE TEKNİK ÜNİVERSİTESİ` (Kocaeli) ve `TÜRK-JAPON BİLİM VE TEKNOLOJİ ÜNİVERSİTESİ` (İstanbul) `tools/normalize.py` içinde elle eşlenmiştir.

## Yeniden üretme

```bash
python3 -m pip install -r tools/requirements.txt
python3 tools/build_dataset.py --girdi data/raw/yks-ham.csv.gz
```

Yeni bir yıl eklendiğinde aynı sütun başlıklarıyla hazırlanmış xlsx/csv dosyası
`--girdi` olarak verilir; yıl sayısı ve program listesi otomatik genişler.

## Lisans

Veri, ÖSYM tarafından kamuya açık olarak yayımlanan kılavuz eklerinden
derlenmiştir; veriye ilişkin haklar kaynağına aittir. Depodaki kod MIT lisanslıdır.
