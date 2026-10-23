// Sıralama: en yüksek seviyeli (toplam XP) ya da en çok çipi olan 50 oyuncu.
//
// Listenin altında oyuncunun kendi satırı ("ben") da döner; ilk 50'de olmasa bile
// kaçıncı olduğunu görür. Sıralama veritabanında indeksli sütunlarla yapılır.

import type { SiralamaSatiri } from "@okey/kurallar";
import { oyuncuKarti } from "./ilerleme.ts";
import type { OyuncuSatiri, Veritabani } from "./veritabani.ts";

export const SIRALAMA_UZUNLUGU = 50;

export function siralamaGetir(
  vt: Veritabani,
  tur: "seviye" | "cip",
  oyuncuId: string,
): { satirlar: SiralamaSatiri[]; ben: SiralamaSatiri | null } {
  const sutun = tur === "seviye" ? "xp" : "cip";
  const satir = (o: OyuncuSatiri, sira: number): SiralamaSatiri => ({ sira, oyuncu: oyuncuKarti(o), deger: o[sutun] });
  const satirlar = vt.enIyiler(sutun, SIRALAMA_UZUNLUGU).map((o, i) => satir(o, i + 1));
  const o = vt.oyuncuGetir(oyuncuId);
  const ben = o ? satir(o, vt.sira(sutun, o)) : null;
  return { satirlar, ben };
}
