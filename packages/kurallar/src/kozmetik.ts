// İsim etiketi süsleri: çerçeve, rozet ve unvan.
//
// Masa ve taşlar herkeste aynıdır; oyuncular sadece isim etiketlerini süsleyebilir.
// Süsler satılmaz, seviye atlayarak ve başarımlarla açılır. Yeni süs eklemek ya da
// görünümünü değiştirmek için sadece bu dosyayı düzenlemek yeter: telefon uygulaması
// renkleri ve simgeleri buradan okur.

export interface Istatistik {
  oynanan: number;
  kazanilan: number;
  cift: number;
  okeyAtarak: number;
  gosterge: number;
}

export type Kosul = { seviye: number } | { istatistik: keyof Istatistik; enAz: number } | { herkese: true };

export interface Cerceve {
  id: string;
  ad: string;
  kosul: Kosul;
  /** CSS kenarlık arka planı: düz renk ya da gradyan. */
  stil: string;
  parlak?: boolean; // hafif parıltı animasyonu
}

export interface Rozet {
  id: string;
  ad: string;
  simge: string; // emoji
  kosul: Kosul;
}

export interface Unvan {
  id: string;
  ad: string;
  kosul: Kosul;
  renk: string;
}

export const CERCEVELER: Cerceve[] = [
  { id: "sade", ad: "Sade", kosul: { herkese: true }, stil: "#5b6b63" },
  { id: "bronz", ad: "Bronz", kosul: { seviye: 5 }, stil: "linear-gradient(135deg,#8c5a2b,#d79a5c,#8c5a2b)" },
  { id: "gumus", ad: "Gümüş", kosul: { seviye: 10 }, stil: "linear-gradient(135deg,#8e9aa6,#eef2f5,#8e9aa6)" },
  { id: "altin", ad: "Altın", kosul: { seviye: 20 }, stil: "linear-gradient(135deg,#a8761c,#ffe08a,#a8761c)" },
  { id: "zumrut", ad: "Zümrüt", kosul: { seviye: 30 }, stil: "linear-gradient(135deg,#0d6b4b,#5fe0a8,#0d6b4b)" },
  { id: "yakut", ad: "Yakut", kosul: { istatistik: "kazanilan", enAz: 250 }, stil: "linear-gradient(135deg,#7a0f22,#ff6b81,#7a0f22)" },
  { id: "efsane", ad: "Efsane", kosul: { seviye: 50 }, stil: "conic-gradient(from 0deg,#ff5f6d,#ffc371,#47e5bc,#5f8bff,#c86bff,#ff5f6d)", parlak: true },
];

export const ROZETLER: Rozet[] = [
  { id: "yok", ad: "Rozet yok", simge: "", kosul: { herkese: true } },
  { id: "cay", ad: "İlk Çay", simge: "🍵", kosul: { istatistik: "kazanilan", enAz: 1 } },
  { id: "zar", ad: "Müdavim", simge: "🎲", kosul: { istatistik: "oynanan", enAz: 100 } },
  { id: "cift", ad: "Çift Ustası", simge: "👯", kosul: { istatistik: "cift", enAz: 10 } },
  { id: "joker", ad: "Okeyci", simge: "🃏", kosul: { istatistik: "okeyAtarak", enAz: 10 } },
  { id: "goz", ad: "Gözü Keskin", simge: "👁️", kosul: { istatistik: "gosterge", enAz: 25 } },
  { id: "tac", ad: "Taç", simge: "👑", kosul: { seviye: 40 } },
];

export const UNVANLAR: Unvan[] = [
  { id: "yok", ad: "", kosul: { herkese: true }, renk: "#c9d6cf" },
  { id: "acemi", ad: "Acemi", kosul: { herkese: true }, renk: "#c9d6cf" },
  { id: "mudavim", ad: "Müdavim", kosul: { seviye: 8 }, renk: "#9fd8ff" },
  { id: "usta", ad: "Usta", kosul: { seviye: 15 }, renk: "#ffd36b" },
  { id: "kurt", ad: "Masanın Kurdu", kosul: { istatistik: "kazanilan", enAz: 100 }, renk: "#ff9f6b" },
  { id: "aga", ad: "Kahvehane Ağası", kosul: { seviye: 35 }, renk: "#ffb3f0" },
];

export interface Etiket {
  cerceve: string;
  rozet: string;
  unvan: string;
}

export const VARSAYILAN_ETIKET: Etiket = { cerceve: "sade", rozet: "yok", unvan: "acemi" };

export function kosulSaglandiMi(k: Kosul, seviye: number, ist: Istatistik): boolean {
  if ("herkese" in k) return true;
  if ("seviye" in k) return seviye >= k.seviye;
  return ist[k.istatistik] >= k.enAz;
}

export function kosulMetni(k: Kosul): string {
  if ("herkese" in k) return "Herkese açık";
  if ("seviye" in k) return `Seviye ${k.seviye}`;
  const ad: Record<keyof Istatistik, string> = {
    oynanan: "el oyna",
    kazanilan: "el kazan",
    cift: "çift bitir",
    okeyAtarak: "okey atarak bitir",
    gosterge: "gösterge göster",
  };
  return `${k.enAz} kez ${ad[k.istatistik]}`;
}

/** Oyuncunun açtığı tüm süslerin kimlikleri. */
export function acikSusler(seviye: number, ist: Istatistik) {
  return {
    cerceve: CERCEVELER.filter((c) => kosulSaglandiMi(c.kosul, seviye, ist)).map((c) => c.id),
    rozet: ROZETLER.filter((r) => kosulSaglandiMi(r.kosul, seviye, ist)).map((r) => r.id),
    unvan: UNVANLAR.filter((u) => kosulSaglandiMi(u.kosul, seviye, ist)).map((u) => u.id),
  };
}

/** Seçilen etiket gerçekten açılmış mı? (Sunucu, istemcinin gönderdiği seçimi buna göre doğrular.) */
export function etiketGecerliMi(e: Etiket, seviye: number, ist: Istatistik): boolean {
  const a = acikSusler(seviye, ist);
  return a.cerceve.includes(e.cerceve) && a.rozet.includes(e.rozet) && a.unvan.includes(e.unvan);
}
