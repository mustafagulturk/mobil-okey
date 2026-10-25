// Bot101: 101 Okey'de boş koltuklarda ve süresi dolan oyuncunun yerine oynar.
// Her çağrıda tek eylem döndürür (çek, aç, işle, at); oda onu tekrar tekrar çağırır.
//
// Strateji basit ve açıklanabilir:
//  - Çekerken: yandaki taşı ancak bu turda kullanabilecekse (açılışa, işlemeye ya da yeni
//    bir pere sokabilecekse) alır, yoksa ortadan çeker. Böylece yandan alıp kullanmama
//    cezası hiç yazılmaz.
//  - Açmamışsa: acilisBul elin açılabildiğini söylüyorsa hemen açar (seri ya da çift).
//  - Açmışsa ve bu tur açmadıysa sırayla: yandan aldığı taşı kullanır, okey alır,
//    yeni per açar, taş işler. Her biri bir eylemdir; yapacak iş kalmayınca atar.
//  - Atarken: okeyi ve işlek taşı atmaz (ceza). Perlere girmeyen taşlardan, açmışsa gelecek
//    taşlarla kullanılma ihtimali en düşük (eşitlikte değeri büyük) olanı, açmamışsa elde
//    per olma ihtimali en düşük olanı atar.
// Bot sadece kendi görünümünü kullanır; yani gerçek bir oyuncunun bildiğinden fazlasını bilmez.

import { oncekiKoltuk } from "./masa.ts";
import type { AcikPer, Eylem101, MasaGorunumu101 } from "./masa101.ts";
import { type Deger, okeyMi, oyunDegeri } from "./tas.ts";
import {
  acilisBul,
  ciftAcilisi,
  enCokCift,
  enDegerliPerler,
  isle,
  islenebilirMi,
  perGecerli,
  seriAcilisi,
  tasDegeri,
} from "./yuzbir.ts";

export function bot101Hamlesi(g: MasaGorunumu101): Eylem101 {
  if (g.gostergeGosterebilir) return { tur: "gostergeGoster" };
  if (g.asama === "cek") return cekme(g);

  const acma = g.acma[g.koltuk];
  if (acma === null) {
    // Açmamış: açabiliyorsa aç. Yandan alınan taş varsa açılış onu içermek zorunda.
    const acilis = acilisBul(g.el, g.okey, g.yandanAlinan);
    if (acilis) return { tur: "ac", perler: acilis.perler };
  } else if (!g.buTurActi) {
    const eylem = acmisHamlesi(g, acma);
    if (eylem) return eylem;
  }
  return { tur: "at", tas: bot101Atis(g) };
}

/** Yandaki taş bu turda kullanılabiliyorsa yandan, değilse ortadan çeker. */
function cekme(g: MasaGorunumu101): Eylem101 {
  const yan = g.atilanlar[oncekiKoltuk(g.koltuk)].at(-1);
  if (yan === undefined) return { tur: "cek", kaynak: "orta" };
  if (g.ortaSayisi === 0) return { tur: "cek", kaynak: "yan" };
  const el = [...g.el, yan];
  const acma = g.acma[g.koltuk];
  let kullanilir: boolean;
  if (acma === null) kullanilir = acilisBul(el, g.okey, yan) !== null;
  else kullanilir = isleme(yan, masadakiPerler(g), g.okey) !== null || yeniPerler(el, g.okey, acma, yan) !== null;
  return { tur: "cek", kaynak: kullanilir ? "yan" : "orta" };
}

/** Açmış oyuncunun at'tan önceki işleri; yapacak iş yoksa null. */
function acmisHamlesi(g: MasaGorunumu101, acma: "seri" | "cift"): Eylem101 | null {
  const perler = masadakiPerler(g);
  const y = g.yandanAlinan;

  // 1) Yandan alınan taşı kullan: işle ya da onu içeren yeni per aç.
  if (y !== null) {
    const i = isleme(y, perler, g.okey);
    if (i) return i;
    const yeni = yeniPerler(g.el, g.okey, acma, y);
    if (yeni) return { tur: "ac", perler: yeni };
  }

  // 2) Okey al: elindeki taş, masadaki bir okeyin yerine geçiyorsa okeyi alır.
  for (const tas of g.el) {
    if (okeyMi(tas, g.okey)) continue;
    for (const p of perler) {
      if (isle(p.taslar, p.tur, tas, g.okey, true)) return { tur: "isle", tas, koltuk: p.koltuk, per: p.no, okeyAl: true };
    }
  }

  // 3) Yeni per aç (seri açan seri/grup, çift açan çift).
  const yeni = yeniPerler(g.el, g.okey, acma, null);
  if (yeni) return { tur: "ac", perler: yeni };

  // 4) İşle. Okeyi elde tutar (sonunda okey atarak bitirmek çift puandır); ama elde sadece
  //    okeyler kaldıysa birini işler ki son okeyi atarak bitirebilsin.
  if (g.el.length >= 2) {
    const sadeceOkey = g.el.every((id) => okeyMi(id, g.okey));
    for (const tas of g.el) {
      if (okeyMi(tas, g.okey) && !sadeceOkey) continue;
      for (const p of perler) {
        if (isle(p.taslar, p.tur, tas, g.okey, false)) return { tur: "isle", tas, koltuk: p.koltuk, per: p.no };
      }
    }
  }
  return null;
}

interface MasadakiPer extends AcikPer {
  koltuk: number;
  no: number;
}

function masadakiPerler(g: MasaGorunumu101): MasadakiPer[] {
  return g.perler.flatMap((ps, koltuk) => ps.map((p, no) => ({ ...p, koltuk, no })));
}

/** Taşı masadaki bir pere işleyen (uzatma ya da okey alma) eylem; yoksa null. */
function isleme(tas: number, perler: MasadakiPer[], okey: Deger): Eylem101 | null {
  for (const p of perler) {
    if (isle(p.taslar, p.tur, tas, okey, false)) return { tur: "isle", tas, koltuk: p.koltuk, per: p.no };
    if (!okeyMi(tas, okey) && isle(p.taslar, p.tur, tas, okey, true)) {
      return { tur: "isle", tas, koltuk: p.koltuk, per: p.no, okeyAl: true };
    }
  }
  return null;
}

/** Açmış oyuncunun elinden açabileceği yeni perler (elde en az bir taş kalır); yoksa null. */
function yeniPerler(el: number[], okey: Deger, acma: "seri" | "cift", zorunlu: number | null): number[][] | null {
  const perler = acma === "seri" ? seriAcilisi(el, okey, zorunlu)?.perler : ciftAcilisi(el, okey, zorunlu);
  return perler && perler.length > 0 ? perler : null;
}

/**
 * Atılacak taş. Süresi dolan oyuncu için de kullanılır: açma/işleme yapmaz, sadece
 * cezasız ve elden en az şey götüren taşı seçer.
 */
export function bot101Atis(g: MasaGorunumu101): number {
  const { el, okey } = g;
  if (el.length === 1) return el[0]; // son taş: atınca el biter (okey olsa bile ceza değil)
  const perler = g.perler.flat();
  const okeySiz = el.filter((id) => !okeyMi(id, okey));
  if (okeySiz.length === 0) return el[0]; // elde sadece okey var; ceza kaçınılmaz
  const cezasiz = okeySiz.filter((id) => !islenebilirMi(id, perler, okey));
  const adaylar = cezasiz.length > 0 ? cezasiz : okeySiz;

  // Hangi taşlar bir pere giriyor? Açma türüne (ya da açmamışsa hedefe) göre.
  const acma = g.acma[g.koltuk];
  const seri = acma !== "cift" ? enDegerliPerler(el, okey) : null;
  const ciftler = enCokCift(el, okey);
  const ciftHedef = acma === "cift" || (acma === null && ciftler.length >= 4 && (seri?.deger ?? 0) < 80);
  const isteYarar = new Set(ciftHedef ? ciftler.flat() : seri!.perler.flat());
  const bos = adaylar.filter((id) => !isteYarar.has(id));

  if (bos.length > 0) {
    // Açmış oyuncu: bitirmesi için kalan taşların masaya gitmesi gerekir. "Çıkışı" az olan
    // (hiçbir gelen taşla kullanılamayacak) taşı atar; eşitlikte büyük taşı (cezası yüksek).
    // Açmamışın cezası sabit (202); o yüzden per olma ihtimali düşük, değeri küçük taşı atar
    // (büyük taşlar 101'e ulaşmayı kolaylaştırır).
    const puan = (id: number) =>
      acma !== null
        ? tasDegeri(id, okey) - 10 * cikisSayisi(id, g, acma)
        : -20 * komsuSayisi(id, el, okey, ciftHedef) - tasDegeri(id, okey);
    return bos.reduce((a, b) => (puan(b) > puan(a) ? b : a));
  }

  // Her aday bir pere giriyor: atınca en az değer kaybettireni seç (nadir, pahalı yol).
  let enIyi = { tas: adaylar[0], kalan: -1 };
  for (const tas of adaylar) {
    const kalanEl = el.filter((id) => id !== tas);
    const kalan = ciftHedef ? enCokCift(kalanEl, okey).length * 100 : enDegerliPerler(kalanEl, okey).deger;
    if (kalan > enIyi.kalan) enIyi = { tas, kalan };
  }
  return enIyi.tas;
}

/**
 * Taşın elde kaç "yakın akrabası" var: aynı renkte ±2 içinde (12-13-1 dahil), aynı sayıda
 * farklı renk. Çift hedefleniyorsa eşi de sayılır (seride aynı taşın ikinci kopyası işe yaramaz).
 */
function komsuSayisi(tas: number, el: number[], okey: Deger, ciftHedef: boolean): number {
  const d = oyunDegeri(tas, okey);
  let n = 0;
  for (const id of el) {
    if (id === tas || okeyMi(id, okey)) continue;
    const e = oyunDegeri(id, okey);
    if (e.renk === d.renk && e.sayi === d.sayi) {
      if (ciftHedef) n++;
    } else if (e.renk === d.renk) {
      const yakin = Math.abs(e.sayi - d.sayi) <= 2;
      const birOnUc = Math.min(e.sayi, d.sayi) === 1 && Math.max(e.sayi, d.sayi) >= 12; // 12-13-1
      if (yakin || birOnUc) n++;
    } else if (e.sayi === d.sayi) n++;
  }
  return n;
}

/**
 * Açmış oyuncu için taşın "çıkışı": ortadan ya da yandan gelebilecek kaç taş onu bu elde
 * kullanılır yapar? Her taş türü için, henüz görünmeyen kopya sayısı kadar sayılır, eğer:
 *  - seri açtıysa: gelen taş, bu taş ve elden bir taşla yeni bir per olur ya da gelen taş
 *    masadaki bir pere işlenince bu taş da işlenebilir hale gelir (masada 3-4-5, elde 7, gelen 6);
 *  - çift açtıysa: gelen taş bu taşın eşidir.
 */
function cikisSayisi(tas: number, g: MasaGorunumu101, acma: "seri" | "cift"): number {
  const { okey } = g;
  const masadakiler = g.perler.flat();
  // Görünen taşlar: elim, masadaki perler, atılanlar ve gösterge.
  const gorunen = new Uint8Array(52);
  for (const id of [...g.el, ...masadakiler.flatMap((p) => p.taslar), ...g.atilanlar.flat(), g.gosterge]) {
    if (okeyMi(id, okey)) continue;
    const d = oyunDegeri(id, okey);
    gorunen[d.renk * 13 + d.sayi - 1]++;
  }
  const kendi = oyunDegeri(tas, okey);
  let n = 0;
  for (let k = 0; k < 52; k++) {
    const kalan = 2 - gorunen[k];
    if (kalan <= 0) continue;
    const renk = Math.floor(k / 13);
    const sayi = (k % 13) + 1;
    if (acma === "cift") {
      if (renk === kendi.renk && sayi === kendi.sayi) n += kalan;
      continue;
    }
    // Bu türün temsilcisi: okey türüyse sahte okey (normal kopyaları joker), değilse ilk kopya.
    const gelen = renk === okey.renk && sayi === okey.sayi ? 104 : renk * 26 + (sayi - 1) * 2;
    const yeniPer = g.el.some((h) => h !== tas && perGecerli([tas, h, gelen], okey) !== null);
    const zincir =
      !yeniPer &&
      masadakiler.some((p) => {
        const uzamis = isle(p.taslar, p.tur, gelen, okey, false);
        return uzamis !== null && isle(uzamis.per, p.tur, tas, okey, false) !== null;
      });
    if (yeniPer || zincir) n += kalan;
  }
  return n;
}
