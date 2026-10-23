// Oda görünümüyle ilgili küçük yardımcılar.
import type { OdaGorunumu } from "@okey/kurallar";

/** Koltuktaki oyuncunun adı (insan, bot ya da boş). */
export function koltukAdi(oda: OdaGorunumu, k: number): string {
  const kol = oda.koltuklar[k];
  return kol.tur === "insan" ? kol.oyuncu.ad : kol.tur === "bot" ? kol.ad : "—";
}
