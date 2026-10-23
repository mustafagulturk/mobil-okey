// Hesap: kayıt olmadan oynanabilen, cihaza bağlı hesaplar.
//
// İlk girişte sunucu bir oyuncu kimliği (UUID) ve 32 baytlık rastgele bir anahtar üretir.
// Telefon ikisini saklar ve sonraki girişlerde gönderir; anahtar aynı zamanda hesap
// kurtarma kodudur. Veritabanında anahtarın kendisi değil SHA-256 özeti tutulur: veritabanı
// sızsa bile kimse o özetle giriş yapamaz. Anahtar 256 bit rastgele olduğu için
// (parola gibi tahmin edilemez) yavaş bir özet fonksiyonuna (bcrypt vb.) gerek yoktur.
// Karşılaştırma timingSafeEqual ile yapılır ki cevap süresinden bilgi sızmasın.

import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { BASLANGIC_CIPI } from "@okey/kurallar";
import type { Veritabani } from "./veritabani.ts";

export function anahtarUret(): string {
  return randomBytes(32).toString("base64url");
}

export function ozet(metin: string): string {
  return createHash("sha256").update(metin).digest("hex");
}

export function anahtarDogruMu(anahtar: string, kayitliOzet: string): boolean {
  const a = Buffer.from(ozet(anahtar), "hex");
  const b = Buffer.from(kayitliOzet, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type GirisSonucu = { tamam: true; oyuncuId: string; anahtar: string; yeni: boolean } | { tamam: false; hata: string };

/**
 * oyuncuId ve anahtar yoksa yeni hesap açar, varsa doğrular.
 * Var olan hesapta gönderilen ad dikkate alınmaz (ad, adDegistir ile değişir).
 */
export function girisYap(
  vt: Veritabani,
  m: { ad: string; oyuncuId?: string; anahtar?: string },
  zaman: number,
): GirisSonucu {
  if (m.oyuncuId === undefined && m.anahtar === undefined) {
    const oyuncuId = randomUUID();
    const anahtar = anahtarUret();
    vt.oyuncuOlustur(oyuncuId, m.ad, ozet(anahtar), BASLANGIC_CIPI, zaman);
    return { tamam: true, oyuncuId, anahtar, yeni: true };
  }
  // Hangi bilginin yanlış olduğunu söylemiyoruz: "böyle bir hesap var" bilgisi de sızmasın.
  const hatali = { tamam: false, hata: "Giriş bilgileri hatalı" } as const;
  if (!m.oyuncuId || !m.anahtar) return hatali;
  const o = vt.oyuncuGetir(m.oyuncuId);
  if (!o || !anahtarDogruMu(m.anahtar, o.anahtar_ozeti)) return hatali;
  return { tamam: true, oyuncuId: o.id, anahtar: m.anahtar, yeni: false };
}
