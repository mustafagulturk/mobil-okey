// Çip ekonomisi, seviyeler ve görevler. Sayıları değiştirmek için tek yer burası.
//
// Kurallar (Okey):
//  - Her el başında masadaki herkes salonun giriş çipini ortaya koyar; eli bitiren hepsini alır.
//  - El berabere biterse (orta tükenirse) herkes çipini geri alır.
// Kurallar (101):
//  - Çip el başına değil MAÇ başına alınır: maç başında herkes salonun girişini bir kez koyar
//    (miktar Okey'deki el girişiyle aynıdır, bkz. MAC101_GIRIS_CARPANI).
//  - Pot 4 x giriştir (bot koltukları da sanal olarak koyar). Maç sonunda toplam puanı en
//    düşük olan potu alır; eşitlikte pot paylaşılır, bölünemeyen artık ilk kazanana gider.
// Her iki oyunda da:
//  - Çip mağazadan satın alınabilir, günlük hediye, ödüllü reklam, görev ve seviye
//    ödülleriyle kazanılır. Çip oyuncular arasında aktarılamaz ve paraya çevrilemez.

export const BASLANGIC_CIPI = 5_000;
export const GUNLUK_HEDIYE = 1_000;
export const REKLAM_ODULU = 250;
export const GUNLUK_REKLAM_SINIRI = 10;

export interface Salon {
  id: SalonId;
  ad: string;
  giris: number; // her elde ortaya konan çip
  enAzCip: number; // masaya oturmak için gereken en az çip
  enFazlaCip: number | null; // zengin oyuncular çaylak masasına inmesin diye üst sınır
}

export const SALON_IDLERI = ["caylak", "kahvehane", "usta", "aga"] as const;
export type SalonId = (typeof SALON_IDLERI)[number];

export const SALONLAR: Salon[] = [
  { id: "caylak", ad: "Çaylak Masası", giris: 100, enAzCip: 100, enFazlaCip: 10_000 },
  { id: "kahvehane", ad: "Kahvehane", giris: 500, enAzCip: 1_000, enFazlaCip: 100_000 },
  { id: "usta", ad: "Ustalar Salonu", giris: 2_500, enAzCip: 10_000, enFazlaCip: null },
  { id: "aga", ad: "Ağalar Konağı", giris: 10_000, enAzCip: 50_000, enFazlaCip: null },
];

/**
 * 101'de maç başına alınan giriş = salon girişi x bu çarpan. Bilerek 1: bir 101 maçı
 * (4 el) Okey'deki tek elle aynı çipi riske atar, salonların çip aralıkları iki oyunda
 * da aynı anlamı taşır.
 */
export const MAC101_GIRIS_CARPANI = 1;

export function salonBul(id: SalonId): Salon {
  return SALONLAR.find((s) => s.id === id)!;
}

/** Oyuncu bu salona oturabilir mi? Oturamıyorsa sebebini döndürür. */
export function salonaUygunMu(salon: Salon, cip: number): { uygun: true } | { uygun: false; sebep: string } {
  if (cip < salon.enAzCip) return { uygun: false, sebep: `Bu salon için en az ${salon.enAzCip} çip gerekir` };
  if (salon.enFazlaCip !== null && cip > salon.enFazlaCip)
    return { uygun: false, sebep: `Bu salon en fazla ${salon.enFazlaCip} çipi olanlar için` };
  return { uygun: true };
}

// --- Mağaza (Google Play uygulama içi ürünleri) ---
// Ürün kimlikleri Play Console'da aynen bu adlarla "tüketilebilir ürün" olarak açılmalı.
// Fiyat Play Console'da belirlenir; burada sadece kaç çip verdiği yazılır.
export interface CipPaketi {
  urunId: string;
  cip: number;
  etiket?: string; // "En çok satan" gibi
}

export const CIP_PAKETLERI: CipPaketi[] = [
  { urunId: "cip_25k", cip: 25_000 },
  { urunId: "cip_100k", cip: 100_000, etiket: "En çok tercih edilen" },
  { urunId: "cip_500k", cip: 500_000 },
  { urunId: "cip_2m", cip: 2_000_000, etiket: "En avantajlı" },
];

// --- Deneyim puanı (XP) ve seviye ---
export const XP = {
  elOynadi: 10,
  elKazandi: 40,
  ciftBitis: 20,
  okeyAtarakBitis: 20,
  gostergeGosterdi: 5,
} as const;

/** 101'de XP maç sonunda bir kez verilir; maç Okey'deki bir elden uzun sürdüğü için daha cömerttir. */
export const XP101 = {
  macOynadi: 30,
  macKazandi: 100,
  /** Maç içinde bitirdiği her el için. */
  elBitirdi: 15,
  /** Okey atarak bitirdiği her el için (elBitirdi'ye ek). */
  okeyleBitirdi: 10,
} as const;

/**
 * 101 maç sonu pot dağıtımı: koltuk başına pottan alınan çip (giriş düşülmeden).
 * Pot = koltukSayisi x giriş, kazananlar arasında eşit bölünür; artık ilk kazanana gider.
 */
export function macPotuDagit(giris: number, kazananlar: number[], koltukSayisi = 4): number[] {
  const pot = giris * koltukSayisi;
  const pay = Math.floor(pot / kazananlar.length);
  const artik = pot - pay * kazananlar.length;
  const alinan = Array.from({ length: koltukSayisi }, () => 0);
  kazananlar.forEach((k, i) => (alinan[k] = pay + (i === 0 ? artik : 0)));
  return alinan;
}

/** Seviye n'den n+1'e geçmek için gereken XP. Seviye ilerledikçe yavaşça artar. */
export function seviyeXp(seviye: number): number {
  return 100 + (seviye - 1) * 50;
}

/** Toplam XP'den seviyeyi ve seviye içi ilerlemeyi hesaplar. Seviye 1'den başlar. */
export function seviyeHesapla(toplamXp: number): { seviye: number; mevcut: number; gereken: number } {
  let seviye = 1;
  let kalan = toplamXp;
  while (kalan >= seviyeXp(seviye)) {
    kalan -= seviyeXp(seviye);
    seviye++;
  }
  return { seviye, mevcut: kalan, gereken: seviyeXp(seviye) };
}

/** Seviye atlayınca verilen çip ödülü. */
export function seviyeOdulu(yeniSeviye: number): number {
  return yeniSeviye * 250;
}

// --- Günlük görevler ---
// Sunucu her oyuncuya günde 3 görev seçer. Sayaçlar Okey'de el sonunda, 101'de maç sonunda
// güncellenir (101 maçı "oynanan" ve "kazanilan" sayaçlarını birer artırır).
export type GorevSayaci = "oynanan" | "kazanilan" | "cift" | "okeyAtarak" | "gosterge";

export interface GorevTanimi {
  id: string;
  metin: string;
  sayac: GorevSayaci;
  hedef: number;
  odulCip: number;
  odulXp: number;
}

export const GOREVLER: GorevTanimi[] = [
  { id: "oyna5", metin: "5 el oyna", sayac: "oynanan", hedef: 5, odulCip: 500, odulXp: 30 },
  { id: "oyna15", metin: "15 el oyna", sayac: "oynanan", hedef: 15, odulCip: 1_500, odulXp: 80 },
  { id: "kazan2", metin: "2 el kazan", sayac: "kazanilan", hedef: 2, odulCip: 800, odulXp: 50 },
  { id: "kazan5", metin: "5 el kazan", sayac: "kazanilan", hedef: 5, odulCip: 2_000, odulXp: 120 },
  { id: "cift1", metin: "Çift bitir", sayac: "cift", hedef: 1, odulCip: 1_200, odulXp: 60 },
  { id: "okey1", metin: "Okey atarak bitir", sayac: "okeyAtarak", hedef: 1, odulCip: 1_200, odulXp: 60 },
  { id: "gosterge1", metin: "Gösterge göster", sayac: "gosterge", hedef: 1, odulCip: 300, odulXp: 20 },
];

export const GUNLUK_GOREV_SAYISI = 3;

/** Güne ve oyuncuya göre her zaman aynı 3 görevi seçer (sunucu yeniden başlasa da değişmez). */
export function gunlukGorevler(oyuncuId: string, gun: string): GorevTanimi[] {
  let h = 2166136261;
  for (const c of oyuncuId + gun) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const havuz = [...GOREVLER];
  const secilen: GorevTanimi[] = [];
  while (secilen.length < GUNLUK_GOREV_SAYISI) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    secilen.push(havuz.splice(h % havuz.length, 1)[0]);
  }
  return secilen;
}

/** Türkiye saatine göre bugünün tarihi (YYYY-AA-GG). Günlük hediye ve görevler gece yarısı yenilenir. */
export function bugun(zaman = Date.now()): string {
  return new Date(zaman + 3 * 3600_000).toISOString().slice(0, 10);
}
