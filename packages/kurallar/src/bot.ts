// Bot: boş koltuklarda, bağlantısı kopan oyuncunun yerine ve süresi dolan hamlelerde oynar.
//
// Strateji basit ve açıklanabilir:
//  - Bitirebiliyorsa bitirir (okey atarak bitirmek daha çok puan getirdiği için önce onu dener).
//  - Yandaki taş elini iyileştiriyorsa yandan, yoksa ortadan çeker.
//  - Atarken, kalan 14 taşın "el puanı" en yüksek olacak taşı atar. Eşitlikte,
//    komşusu en az olan (işe yarama ihtimali en düşük) taşı seçer.
// Bot sadece kendi görünümünü kullanır; yani gerçek bir oyuncunun bildiğinden fazlasını bilmez.

import { bitisBul, elPuani } from "./el.ts";
import { type Eylem, type MasaGorunumu, oncekiKoltuk } from "./masa.ts";
import { type Deger, okeyMi, oyunDegeri } from "./tas.ts";

export function botHamlesi(g: MasaGorunumu): Eylem {
  if (g.gostergeGosterebilir) return { tur: "gostergeGoster" };

  if (g.asama === "cek") {
    const yan = g.atilanlar[oncekiKoltuk(g.koltuk)].at(-1);
    if (yan !== undefined && g.ortaSayisi > 0) {
      if (okeyMi(yan, g.okey)) return { tur: "cek", kaynak: "yan" };
      const simdi = elPuani(g.el, g.okey);
      const sonra = enIyiAtis(g.el.concat(yan), g.okey).puan;
      if (sonra > simdi) return { tur: "cek", kaynak: "yan" };
    }
    if (g.ortaSayisi === 0) return { tur: "cek", kaynak: "yan" };
    return { tur: "cek", kaynak: "orta" };
  }

  // Bitirebilir miyim? Önce okeyi atarak, sonra diğer taşlarla.
  const adaylar = [...new Set(g.el)].sort((a, b) => Number(okeyMi(b, g.okey)) - Number(okeyMi(a, g.okey)));
  for (const tas of adaylar) {
    if (bitisBul(g.el.filter((id) => id !== tas), g.okey)) return { tur: "bitir", tas };
  }
  return { tur: "at", tas: enIyiAtis(g.el, g.okey).tas };
}

function enIyiAtis(el: number[], okey: Deger): { tas: number; puan: number } {
  let enIyi = { tas: el[0], puan: -1, komsu: Infinity };
  const denenen = new Set<string>();
  for (const tas of el) {
    if (okeyMi(tas, okey)) continue; // okey asla atılmaz (bitirirken hariç)
    const d = oyunDegeri(tas, okey);
    const tur = `${d.renk}-${d.sayi}`;
    if (denenen.has(tur)) continue; // aynı taşın ikinci kopyasını tekrar hesaplama
    denenen.add(tur);
    const kalan = el.filter((id) => id !== tas);
    const puan = elPuani(kalan, okey);
    const komsu = komsuSayisi(tas, kalan, okey);
    if (puan > enIyi.puan || (puan === enIyi.puan && komsu < enIyi.komsu)) {
      enIyi = { tas, puan, komsu };
    }
  }
  return enIyi;
}

/** Taşın elde kaç "yakın akrabası" var: aynı renkte ±2 içinde ya da aynı sayıda farklı renk. */
function komsuSayisi(tas: number, el: number[], okey: Deger): number {
  const d = oyunDegeri(tas, okey);
  let n = 0;
  for (const id of el) {
    if (okeyMi(id, okey)) continue;
    const e = oyunDegeri(id, okey);
    if (e.renk === d.renk && e.sayi !== d.sayi && Math.abs(e.sayi - d.sayi) <= 2) n++;
    if (e.renk !== d.renk && e.sayi === d.sayi) n++;
    if (e.renk === d.renk && e.sayi === d.sayi) n++;
  }
  return n;
}
