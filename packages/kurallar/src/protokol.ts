// Telefon ile sunucu arasındaki WebSocket mesajları.
//
// Her mesaj JSON'dur ve "t" alanı mesajın türünü söyler. İstemciden gelen her mesaj
// sunucuda zod şemasıyla doğrulanır: yanlış türde, eksik ya da fazla uzun alan içeren
// mesaj işlenmeden reddedilir. Sunucudan gelen mesajların sadece tipleri vardır
// (sunucu güvenilir taraftır).

import { z } from "zod";
import { SALON_IDLERI, type SalonId } from "./ekonomi.ts";
import type { Etiket, Istatistik } from "./kozmetik.ts";
import type { ElSonucu, MasaGorunumu } from "./masa.ts";
import type { ElSonucu101, MacDurumu, MasaGorunumu101 } from "./masa101.ts";

export const OYUN_TURLERI = ["okey", "101"] as const;
export type OyunTuru = (typeof OYUN_TURLERI)[number];
const oyun = z.enum(OYUN_TURLERI).default("okey");

const ad = z
  .string()
  .trim()
  .min(2, "Ad en az 2 harf olmalı")
  .max(16, "Ad en fazla 16 harf olabilir")
  .regex(/^[\p{L}\p{N} _.-]+$/u, "Adda sadece harf, rakam, boşluk ve . _ - olabilir");

const tas = z.number().int().min(0).max(105);

export const eylemSemasi = z.discriminatedUnion("tur", [
  z.object({ tur: z.literal("cek"), kaynak: z.enum(["orta", "yan"]) }),
  z.object({ tur: z.literal("at"), tas }),
  z.object({ tur: z.literal("bitir"), tas }),
  z.object({ tur: z.literal("gostergeGoster") }),
  // 101
  z.object({ tur: z.literal("ac"), perler: z.array(z.array(tas).min(2).max(13)).min(1).max(11) }),
  z.object({
    tur: z.literal("isle"),
    tas,
    koltuk: z.number().int().min(0).max(3),
    per: z.number().int().min(0).max(40),
    okeyAl: z.boolean().optional(),
  }),
]);

export const istemciMesajiSemasi = z.discriminatedUnion("t", [
  // Hesap. İlk girişte oyuncuId/anahtar yoktur; sunucu üretip "hosgeldin" ile döner.
  // Telefon bunları saklar ve sonraki girişlerde gönderir. Anahtar, hesap kurtarma kodudur.
  // surum: istemcinin protokol sürümü; sunucu eski uygulamadan güncelleme ister.
  z.object({ t: z.literal("giris"), ad, surum: z.number().int().optional(), oyuncuId: z.string().uuid().optional(), anahtar: z.string().min(16).max(128).optional() }),
  z.object({ t: z.literal("adDegistir"), ad }),
  z.object({ t: z.literal("etiketSec"), cerceve: z.string().max(32), rozet: z.string().max(32), unvan: z.string().max(32) }),
  z.object({ t: z.literal("hesapSil") }),

  // Salon ve oda
  z.object({ t: z.literal("salonlar") }),
  z.object({ t: z.literal("hizliOyun"), salon: z.enum(SALON_IDLERI), oyun }),
  z.object({ t: z.literal("odaKur"), salon: z.enum(SALON_IDLERI), oyun }),
  z.object({ t: z.literal("odayaKatil"), kod: z.string().trim().toUpperCase().length(5) }),
  z.object({ t: z.literal("odadanAyril") }),
  z.object({ t: z.literal("basla") }),

  // Oyun
  z.object({ t: z.literal("hamle"), eylem: eylemSemasi }),
  z.object({ t: z.literal("sohbet"), metin: z.string().trim().min(1).max(120) }),

  // İlerleme ve ödüller
  z.object({ t: z.literal("siralama"), tur: z.enum(["seviye", "cip"]) }),
  z.object({ t: z.literal("gorevler") }),
  z.object({ t: z.literal("gorevOdulu"), gorevId: z.string().max(32) }),
  z.object({ t: z.literal("gunlukHediye") }),

  // Mağaza: Google Play'den dönen satın alma jetonu sunucuda Google'a sorularak doğrulanır.
  z.object({ t: z.literal("satinAlma"), urunId: z.string().max(64), satinAlmaJetonu: z.string().min(1).max(4096) }),

  z.object({ t: z.literal("ping") }),
]);

export type IstemciMesaji = z.infer<typeof istemciMesajiSemasi>;

// ---------------- Sunucudan gelen mesajlar ----------------

export interface Profil {
  id: string;
  ad: string;
  cip: number;
  xp: number;
  seviye: number;
  seviyeIlerleme: { mevcut: number; gereken: number };
  etiket: Etiket;
  istatistik: Istatistik;
  gunlukHediyeAlinabilir: boolean;
  kalanReklamHakki: number;
}

/** Masada ya da sıralamada başkalarına görünen oyuncu bilgisi. */
export interface OyuncuKarti {
  id: string;
  ad: string;
  seviye: number;
  etiket: Etiket;
}

export type KoltukGorunumu =
  | { tur: "bos" }
  | { tur: "insan"; oyuncu: OyuncuKarti; bagli: boolean }
  | { tur: "bot"; ad: string };

export interface ElOzeti {
  sonuc: ElSonucu | ElSonucu101;
  /** 101: bu elle maç bitti mi? (Çip ve XP sadece maç sonunda dağıtılır.) Okey'de her zaman true. */
  macBitti: boolean;
  /** Her koltuğun bu eldeki çip değişimi (kazanan +, diğerleri -; berabere 0). */
  cipDegisimi: number[];
  /** Her koltuğun kazandığı XP (botlar için 0). */
  xp: number[];
  /** Sonraki elin ne zaman başlayacağı (ms, Date.now() cinsinden). */
  sonrakiEl: number | null;
}

export interface OdaGorunumu {
  kod: string;
  oyun: OyunTuru;
  salon: SalonId | "antrenman";
  giris: number;
  sahipId: string | null;
  koltuklar: KoltukGorunumu[];
  benimKoltugum: number | null;
  oyunda: boolean;
  masa: MasaGorunumu | MasaGorunumu101 | null;
  /** 101 maç puan tablosu; Okey'de null. */
  mac: MacDurumu | null;
  /** Sıradaki oyuncunun hamle süresinin bittiği an (ms). */
  turBitis: number | null;
  /**
   * Mesaj gönderildiği anda kalan hamle süresi (ms) ve toplam süre. Telefonun saati
   * sunucununkinden farklı olabileceği için geri sayım turBitis yerine bununla yapılır.
   */
  turKalanMs: number | null;
  turSuresiMs: number;
  sonEl: ElOzeti | null;
  /** Odada oynanan el sayısı. */
  elNo: number;
}

export interface SohbetMesaji {
  koltuk: number;
  ad: string;
  metin: string;
  zaman: number;
}

export interface SalonBilgisi {
  id: SalonId;
  /** Salondaki oyuncu sayısı oyun türüne göre. */
  oyuncuSayisi101?: number;
  ad: string;
  giris: number;
  enAzCip: number;
  enFazlaCip: number | null;
  oyuncuSayisi: number;
}

export interface GorevDurumu {
  id: string;
  metin: string;
  ilerleme: number;
  hedef: number;
  odulCip: number;
  odulXp: number;
  alindi: boolean;
}

export interface SiralamaSatiri {
  sira: number;
  oyuncu: OyuncuKarti;
  deger: number; // seviye sıralamasında toplam XP, çip sıralamasında çip
}

export type SunucuMesaji =
  | { t: "hosgeldin"; oyuncuId: string; anahtar: string; profil: Profil }
  | { t: "profil"; profil: Profil }
  | { t: "salonlar"; salonlar: SalonBilgisi[] }
  | { t: "oda"; oda: OdaGorunumu }
  | { t: "odadanCikti"; sebep: string | null }
  | { t: "sohbet"; mesaj: SohbetMesaji }
  | { t: "sohbetGecmisi"; mesajlar: SohbetMesaji[] }
  | { t: "siralama"; tur: "seviye" | "cip"; satirlar: SiralamaSatiri[]; ben: SiralamaSatiri | null }
  | { t: "gorevler"; gorevler: GorevDurumu[] }
  | { t: "bildirim"; tur: "bilgi" | "basari" | "seviye"; metin: string }
  | { t: "hata"; mesaj: string }
  | { t: "hesapSilindi" }
  | { t: "pong" };

/** Sunucu, istemci sürümü bundan eskiyse güncelleme ister. */
export const PROTOKOL_SURUMU = 1;
