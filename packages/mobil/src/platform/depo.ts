// Kalıcı küçük veriler (hesap bilgisi, ayarlar). Telefonda Capacitor Preferences
// (Android SharedPreferences), tarayıcıda otomatik olarak localStorage kullanılır.
import { Preferences } from "@capacitor/preferences";

export async function oku<T>(anahtar: string): Promise<T | null> {
  try {
    const { value } = await Preferences.get({ key: anahtar });
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export async function yaz<T>(anahtar: string, deger: T): Promise<void> {
  await Preferences.set({ key: anahtar, value: JSON.stringify(deger) });
}

export async function sil(anahtar: string): Promise<void> {
  await Preferences.remove({ key: anahtar });
}

// --- Uygulamanın sakladığı kayıtlar ---

/** Sunucunun ilk girişte verdiği kimlik. Anahtar aynı zamanda hesap kurtarma kodudur. */
export interface Hesap {
  oyuncuId: string;
  anahtar: string;
  ad: string;
}

export interface Ayarlar {
  ses: boolean;
  titresim: boolean;
  /** Boşsa varsayılan sunucu adresi kullanılır. */
  sunucuUrl: string;
}

export const VARSAYILAN_AYARLAR: Ayarlar = { ses: true, titresim: true, sunucuUrl: "" };

export const DEPO = { hesap: "okey.hesap", ayarlar: "okey.ayarlar" } as const;

/**
 * Kurtarma kodu: başka cihazda aynı hesaba girmek için oyuncuId ve anahtarın birleşimi.
 * (Sunucudaki giriş mesajı ikisini birden ister.)
 */
export function kurtarmaKodu(h: Hesap): string {
  return `${h.oyuncuId}:${h.anahtar}`;
}

export function kurtarmaKodunuCoz(kod: string): { oyuncuId: string; anahtar: string } | null {
  const temiz = kod.trim();
  const i = temiz.indexOf(":");
  if (i === -1) return null;
  const oyuncuId = temiz.slice(0, i);
  const anahtar = temiz.slice(i + 1);
  if (!/^[0-9a-f-]{36}$/i.test(oyuncuId) || anahtar.length < 16) return null;
  return { oyuncuId, anahtar };
}
