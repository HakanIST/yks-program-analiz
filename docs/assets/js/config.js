/**
 * Kurum özelinde değiştirilebilen ayarlar.
 *
 * Bu proje Üsküdar Üniversitesi için hazırlandı; açık kaynak olduğu için
 * aşağıdaki üç satırı değiştiren herhangi bir kurum aynı paneli kendi
 * üniversitesi için kullanabilir.
 */
export const AYAR = {
  /** Sıralamada ilk 20'ye giremese bile her zaman ayrıca gösterilecek üniversite. */
  vurgulananUniversite: "ÜSKÜDAR ÜNİVERSİTESİ",

  /** Sayfa ilk açıldığında seçili gelen program. */
  varsayilanProgram: "Psikoloji",

  /** Tabloda gösterilecek üniversite sayısı. */
  ilkN: 20,

  /** Kaynak kod bağlantısı (üst köşedeki ikon ve alt bant). */
  repo: "https://github.com/HakanIST/yks-program-analiz",

  /** JSON veri dizini (docs/ içine göre). */
  veriDizini: "data",
};
