// Ödüllü reklam: AdMob Sunucu Taraflı Doğrulama (SSV).
//
// Oyuncu reklamı sonuna kadar izleyince ödülü telefon değil AdMob bildirir: AdMob
// sunucumuzdaki /reklam-odulu adresine imzalı bir GET isteği yollar. Telefon "izledim"
// diyerek çip alamaz, çünkü imzayı sadece Google'ın özel anahtarı üretebilir.
//
// Doğrulama:
//  - Sorgu dizgesinin son iki parametresi signature ve key_id'dir.
//  - İmzalanan mesaj, sorgu dizgesinin "&signature=" öncesindeki kısmıdır (olduğu gibi,
//    URL çözümlemesi yapılmadan).
//  - İmza ECDSA P-256 / SHA-256, DER biçiminde, base64url kodlu.
//  - Açık anahtarlar Google'ın yayımladığı listeden key_id ile seçilir (önbellekte tutulur).
// Sonra: user_id = oyuncuId, transaction_id benzersiz olmalı (aynı reklam iki kez ödül
// vermez) ve oyuncunun günlük reklam sınırı aşılmamalı.

import { createPublicKey, type KeyObject, verify } from "node:crypto";
import { bugun, GUNLUK_REKLAM_SINIRI, REKLAM_ODULU } from "@okey/kurallar";
import type { Veritabani } from "./veritabani.ts";

const ANAHTAR_ADRESI = "https://www.gstatic.com/admob/reward/verifier-keys.json";
const ONBELLEK_SURESI_MS = 24 * 3600_000;

/** key_id -> açık anahtar. yenile=true ise önbellek atlanır (yeni bir key_id görüldüğünde). */
export type AnahtarKaynagi = (yenile?: boolean) => Promise<Map<string, KeyObject>>;

/** Google'ın yayımladığı AdMob doğrulama anahtarlarını indirir ve önbellekte tutar. */
export function admobAnahtarKaynagi(fetchFn: typeof fetch, simdi: () => number = Date.now): AnahtarKaynagi {
  let onbellek: { anahtarlar: Map<string, KeyObject>; zaman: number } | null = null;
  return async (yenile = false) => {
    // Sık yenilemeyi engelle: sahte key_id'lerle Google'a istek yağdırılamasın.
    const taze = onbellek && simdi() - onbellek.zaman < (yenile ? 60_000 : ONBELLEK_SURESI_MS);
    if (onbellek && taze) return onbellek.anahtarlar;
    const cevap = await fetchFn(ANAHTAR_ADRESI);
    if (!cevap.ok) throw new Error(`AdMob anahtarları alınamadı (${cevap.status})`);
    const j = (await cevap.json()) as { keys: { keyId: number | string; pem: string }[] };
    const anahtarlar = new Map(j.keys.map((k) => [String(k.keyId), createPublicKey(k.pem)]));
    onbellek = { anahtarlar, zaman: simdi() };
    return anahtarlar;
  };
}

/** Sorgu dizgesinin (soru işareti hariç) AdMob tarafından imzalandığını doğrular. */
export async function ssvImzasiDogruMu(sorgu: string, kaynak: AnahtarKaynagi): Promise<boolean> {
  const params = new URLSearchParams(sorgu);
  const imza = params.get("signature");
  const anahtarId = params.get("key_id");
  if (!imza || !anahtarId) return false;
  const i = sorgu.startsWith("signature=") ? 0 : sorgu.indexOf("&signature=");
  if (i === -1) return false;
  const mesaj = Buffer.from(sorgu.slice(0, i));

  let anahtar = (await kaynak()).get(anahtarId);
  if (!anahtar) anahtar = (await kaynak(true)).get(anahtarId);
  if (!anahtar) return false;
  try {
    return verify("sha256", mesaj, { key: anahtar, dsaEncoding: "der" }, Buffer.from(imza, "base64url"));
  } catch {
    return false; // bozuk imza biçimi
  }
}

export interface ReklamCevabi {
  durum: number;
  govde: { durum: string; mesaj?: string };
}

/** /reklam-odulu isteğini işler; başarılı ödülde odulVerildi(oyuncuId) çağrılır. */
export async function reklamOdulunuIsle(
  sorgu: string,
  vt: Veritabani,
  kaynak: AnahtarKaynagi,
  simdi: number,
  odulVerildi: (oyuncuId: string) => void,
): Promise<ReklamCevabi> {
  let gecerli: boolean;
  try {
    gecerli = await ssvImzasiDogruMu(sorgu, kaynak);
  } catch {
    // Anahtarlar indirilemedi: AdMob'un tekrar denemesi için 5xx dön.
    return { durum: 503, govde: { durum: "hata", mesaj: "Anahtarlar alınamadı" } };
  }
  if (!gecerli) return { durum: 403, govde: { durum: "hata", mesaj: "İmza geçersiz" } };

  const params = new URLSearchParams(sorgu);
  const oyuncuId = params.get("user_id");
  const islemId = params.get("transaction_id");
  // AdMob panelindeki "doğrula" düğmesi user_id'siz istek atar; 200 dönüp yok sayıyoruz.
  if (!oyuncuId || !islemId) return { durum: 200, govde: { durum: "yoksayildi" } };

  const s = vt.reklamOduluVer(islemId, oyuncuId, bugun(simdi), REKLAM_ODULU, GUNLUK_REKLAM_SINIRI, simdi);
  if (s === "verildi") odulVerildi(oyuncuId);
  // Tekrar ve sınır durumlarında da 200 dönüyoruz: istek işlendi, AdMob tekrar denemesin.
  return { durum: 200, govde: { durum: s } };
}
