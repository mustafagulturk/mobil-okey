// Ardışık iki masa görünümünün farkından "ne oldu?" sorusunun cevabı.
// Sunucu hamleleri ayrı ayrı bildirmez, sadece yeni durumu gönderir; uçuş
// animasyonları için olayları buradan çıkarırız:
//   - bir koltuğun atılanlar dizisi uzadıysa: o koltuk taş attı,
//   - kısaldıysa: sağındaki (sıradaki) oyuncu o yığından ("yan") çekti,
//   - ortaSayisi azaldıysa: taş sayısı artan (ve yandan çekmeyen) oyuncu ortadan çekti.
import type { MasaGorunumu } from "@okey/kurallar";

export type MasaOlayi =
  | { tur: "at"; koltuk: number; tas: number }
  | { tur: "cek"; kaynak: "yan"; koltuk: number; yigin: number; tas: number }
  | { tur: "cek"; kaynak: "orta"; koltuk: number; tas: number | null };

export function olaylariCikar(a: MasaGorunumu, b: MasaGorunumu): MasaOlayi[] {
  const cekenler: MasaOlayi[] = [];
  const atanlar: MasaOlayi[] = [];
  const yandanCeken = new Set<number>();
  const n = b.atilanlar.length;

  for (let k = 0; k < n; k++) {
    const eski = a.atilanlar[k] ?? [];
    const yeni = b.atilanlar[k] ?? [];
    if (yeni.length === eski.length + 1) {
      atanlar.push({ tur: "at", koltuk: k, tas: yeni[yeni.length - 1] });
    } else if (yeni.length === eski.length - 1) {
      const ceken = (k + 1) % n;
      yandanCeken.add(ceken);
      cekenler.push({ tur: "cek", kaynak: "yan", koltuk: ceken, yigin: k, tas: eski[eski.length - 1] });
    } else if (yeni.length === eski.length + 2) {
      // Süre dolunca bir oyuncu yandan çekip aynı anda atabilir; ya da iki atış birden.
      atanlar.push({ tur: "at", koltuk: k, tas: yeni[yeni.length - 1] });
    }
  }

  if (b.ortaSayisi < a.ortaSayisi) {
    let kalan = a.ortaSayisi - b.ortaSayisi;
    for (let k = 0; k < n && kalan > 0; k++) {
      if (yandanCeken.has(k)) continue;
      const atti = atanlar.filter((o) => o.koltuk === k).length;
      const artis = b.tasSayilari[k] - a.tasSayilari[k] + atti;
      if (artis <= 0) continue;
      kalan--;
      let tas: number | null = null;
      if (k === b.koltuk) {
        const eldekiler = new Set(a.el);
        tas = b.el.find((t) => !eldekiler.has(t)) ?? null;
      }
      cekenler.push({ tur: "cek", kaynak: "orta", koltuk: k, tas });
    }
  }
  // Önce çekiş, sonra atış (süre dolunca ikisi birden gelir).
  return [...cekenler, ...atanlar];
}
