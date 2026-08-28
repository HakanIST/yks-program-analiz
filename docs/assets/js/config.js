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
  },

  /** Kurum görünümünde doluluk eşiği (%); altındaki hücreler vurgulanır. */
  dolulukEsigi: 70,

  /** Kaynak kod bağlantısı (üst köşedeki ikon ve alt bant). */
  repo: "https://github.com/HakanIST/yks-program-analiz",

  /** JSON veri dizini (docs/ içine göre). */
  veriDizini: "data",
};
