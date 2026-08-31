/**
 * Kurum özelinde değiştirilebilen ayarlar.
 *
 * Bu proje Üsküdar Üniversitesi için hazırlandı; açık kaynak olduğu için
 * aşağıdaki üç satırı değiştiren herhangi bir kurum aynı paneli kendi
 * üniversitesi için kullanabilir.
 */
export const AYAR = {
  /** Sayfa başlığında ve sekme adında görünen kurum adı. */
  kurumAdi: "Üsküdar Üniversitesi",

  /** Sıralamada ilk 20'ye giremese bile her zaman ayrıca gösterilecek üniversite. */
  vurgulananUniversite: "ÜSKÜDAR ÜNİVERSİTESİ",

  /**
   * Program listesi açılışta yalnızca takip edilen üniversitede bulunan
   * programlarla sınırlansın mı? Kullanıcı arayüzdeki kutucukla tüm
   * programlara geçebilir; bu yalnızca başlangıç değeridir.
   */
  sadeceKurumProgramlari: true,

  /** Sayfa ilk açıldığında seçili gelen program. */
  varsayilanProgram: "Psikoloji",

  /**
   * Sayfa ilk açıldığında seçili gelen üniversite kapsamı.
   * Geçerli değerler (app.js içindeki ON_AYARLAR kodları):
   *   "tumu" | "devlet" | "vakif" | "ist" | "ist-devlet" | "ist-vakif"
   */
  varsayilanKapsam: "ist-vakif",

  /** Tabloda gösterilecek üniversite sayısı. */
  ilkN: 20,

  /**
   * İsteğe bağlı: fakülte/birim → program listesi. Kurum görünümünde hazır
   * "program kümesi" çipi olarak sunulur; fakülte yapısı ÖSYM verisinde
   * bulunmadığı için kurum kendisi tanımlar. Adlar kurum görünümündeki satır
   * adlarıyla aynı yazılır (Türkçe için ek yok, diğer diller parantez içinde);
   * büyük/küçük harf ve noktalama farkları yok sayılır.
   */
  fakulteler: {
    // Kaynak: uskudar.edu.tr/aday/bolumler (2026-08-31). Yalnızca YKS verisinde
    // kaydı olan programlar listelenir; "(Ön Lisans)" eki, aynı adla hem lisans
    // hem ön lisans sunulan bölümlerin SHMYO satırını işaret eder.
    "Tıp": ["Tıp", "Tıp (İngilizce)"],
    "Diş Hekimliği": ["Diş Hekimliği", "Diş Hekimliği (İngilizce)"],
    "MDBF": [
      "Adli Bilimler",
      "Adli Bilimler (İngilizce)",
      "Bilgisayar Mühendisliği (İngilizce)",
      "Biyomühendislik (İngilizce)",
      "Elektrik-Elektronik Mühendisliği (İngilizce)",
      "Endüstri Mühendisliği (İngilizce)",
      "Kimya Mühendisliği (İngilizce)",
      "Moleküler Biyoloji ve Genetik",
      "Moleküler Biyoloji ve Genetik (İngilizce)",
      "Yazılım Mühendisliği (İngilizce)",
    ],
    "İTBF": [
      "Felsefe",
      "İngilizce Mütercim ve Tercümanlık",
      "Psikoloji",
      "Psikoloji (İngilizce)",
      "Siyaset Bilimi ve Uluslararası İlişkiler",
      "Siyaset Bilimi ve Uluslararası İlişkiler (İngilizce)",
      "Sosyoloji",
      "Tarih",
      "Yönetim Bilişim Sistemleri",
    ],
    "İletişim": [
      "Çizgi Film ve Animasyon",
      "Gazetecilik",
      "Görsel İletişim Tasarımı",
      "Halkla İlişkiler ve Tanıtım",
      "Radyo, Televizyon ve Sinema",
      "Reklamcılık",
      "Yeni Medya ve İletişim",
      "Yeni Medya ve İletişim (İngilizce)",
    ],
    "SBF": [
      "Beslenme ve Diyetetik",
      "Çocuk Gelişimi",
      "Dil ve Konuşma Terapisi",
      "Ebelik",
      "Ergoterapi",
      "Fizyoterapi ve Rehabilitasyon",
      "Hemşirelik",
      "İş Sağlığı ve Güvenliği",
      "Odyoloji",
      "Ortez ve Protez",
      "Perfüzyon",
      "Sağlık Yönetimi",
      "Sosyal Hizmet",
    ],
    "SHMYO": [
      "Acil Durum ve Afet Yönetimi",
      "Ağız ve Diş Sağlığı",
      "Ameliyathane Hizmetleri",
      "Anestezi",
      "Biyomedikal Cihaz Teknolojisi",
      "Çevre Sağlığı",
      "Çocuk Gelişimi (Ön Lisans)",
      "Çocuk Koruma ve Bakım Hizmetleri",
      "Diş Protez Teknolojisi",
      "Diyaliz",
      "Eczane Hizmetleri",
      "Elektronörofizyoloji",
      "Engelli Bakımı ve Rehabilitasyon",
      "Evde Hasta Bakımı",
      "Fizyoterapi",
      "Gıda Teknolojisi",
      "İlk ve Acil Yardım",
      "İş Sağlığı ve Güvenliği (Ön Lisans)",
      "Laboratuvar Teknolojisi",
      "Nükleer Teknoloji ve Radyasyon Güvenliği",
      "Odyometri",
      "Optisyenlik",
      "Ortopedik Protez ve Ortez",
      "Otopsi Yardımcılığı",
      "Patoloji Laboratuvar Teknikleri",
      "Podoloji",
      "Radyoterapi",
      "Saç Bakımı ve Güzellik Hizmetleri",
      "Sağlık Bilgi Sistemleri Teknikerliği",
      "Sağlık Kurumları İşletmeciliği",
      "Sosyal Güvenlik",
      "Sosyal Hizmetler",
      "Tıbbi Dokümantasyon ve Sekreterlik",
      "Tıbbi Dokümantasyon ve Sekreterlik (İö)",
      "Tıbbi Görüntüleme Teknikleri",
      "Tıbbi Laboratuvar Teknikleri",
      "Tıbbi Tanıtım ve Pazarlama",
      "Tıbbi ve Aromatik Bitkiler",
      "Yaşlı Bakımı",
    ],
  },

  /** Kurum görünümünde doluluk eşiği (%); altındaki hücreler vurgulanır. */
  dolulukEsigi: 70,

  /** Kaynak kod bağlantısı (üst köşedeki ikon ve alt bant). */
  repo: "https://github.com/HakanIST/yks-program-analiz",

  /** JSON veri dizini (docs/ içine göre). */
  veriDizini: "data",
};
