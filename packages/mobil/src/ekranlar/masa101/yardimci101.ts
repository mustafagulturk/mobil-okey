// 101 masasının arayüz kararları: hangi düğme ne yazar, taş nereye işlenir, hangi hamle
// ceza getirir. Kuralların kendisi kurallar paketindedir (yuzbir.ts, masa101.ts); burada
// sadece o fonksiyonlarla oyuncuya önceden ipucu ve uyarı üretilir. Son sözü her zaman
// motor (sunucu ya da antrenmanda telefondaki Oda) söyler.
//
// Fonksiyonlar saftır: masa görünümünü alır, sonuç döndürür; React'ten habersizdir.
import {
  ACMA_SINIRI,
  type Acilis,
  acilisBul,
  CIFT_ACMA_SINIRI,
  ciftGecerli,
  type Deger,
  enCokCift,
  enDegerliPerler,
  isle,
  islenebilirMi,
  type MasaGorunumu101,
  okeyMi,
  oyunDegeri,
  perGecerli,
  type PerTuru,
} from "@okey/kurallar";

/** Masadaki bir per, sahibinin koltuğu ve sırasıyla (isle eylemi bu ikisiyle yapılır). */
export interface MasadakiPer {
  koltuk: number;
  per: number;
  tur: PerTuru;
  taslar: number[];
}

export function masadakiPerler(masa: MasaGorunumu101): MasadakiPer[] {
  return masa.perler.flatMap((perler, koltuk) => perler.map((p, per) => ({ koltuk, per, tur: p.tur, taslar: p.taslar })));
}

// ---------------------------------------------------------------------------
// Aç düğmesi
// ---------------------------------------------------------------------------

export type AcmaDugmesi =
  /** Basılabilir (sıra bende ve taş çekmişsem): perler gönderilir. */
  | { durum: "hazir"; etiket: string; perler: number[][]; acilis: Acilis | null }
  /** Elde açılacak per var ama şu an basılamaz (taş çekmedim ya da sıra bende değil). */
  | { durum: "bekle"; etiket: string }
  /** Yeterli değil: ne kadar kaldığını gösterir. */
  | { durum: "yetersiz"; etiket: string };

/**
 * Açmamışken: elden en iyi açılış (101 değer ya da 5 çift). Yandan alınan taş varsa
 * açılışta kullanılmalıdır (acilisBul bunu arar). Açmışken: aynı türden yeni perler
 * ("Per aç"): seri açan seri/grup, çift açan çift açar. Elde atmak için en az bir taş kalır.
 */
export function acmaDugmesi(masa: MasaGorunumu101, atabilir: boolean): AcmaDugmesi {
  const ben = masa.koltuk;
  const tur = masa.acma[ben];
  if (tur === null) {
    const a = acilisBul(masa.el, masa.okey, masa.yandanAlinan);
    if (a) {
      const etiket = a.tur === "seri" ? `Aç · ${a.deger}` : `Çift aç · ${a.deger}`;
      return atabilir ? { durum: "hazir", etiket, perler: a.perler, acilis: a } : { durum: "bekle", etiket };
    }
    // Yetmiyor: seri değeriyle çift sayısından hangisi sınıra daha yakınsa onu göster.
    const seri = enDegerliPerler(masa.el, masa.okey).deger;
    const cift = enCokCift(masa.el, masa.okey).length;
    return seri / ACMA_SINIRI >= cift / CIFT_ACMA_SINIRI
      ? { durum: "yetersiz", etiket: `Aç ${seri}/${ACMA_SINIRI}` }
      : { durum: "yetersiz", etiket: `Çift ${cift}/${CIFT_ACMA_SINIRI}` };
  }
  const perler = yeniPerler(masa.el, masa.okey, tur);
  if (perler.length === 0) return { durum: "yetersiz", etiket: tur === "cift" ? "Çift aç" : "Per aç" };
  const etiket = tur === "cift" ? `Çift aç · ${perler.length}` : `Per aç · ${perler.length}`;
  return atabilir ? { durum: "hazir", etiket, perler, acilis: null } : { durum: "bekle", etiket };
}

/** Açmış oyuncunun elinden açabileceği yeni perler (en az bir taş elde kalır). */
function yeniPerler(el: number[], okey: Deger, tur: "seri" | "cift"): number[][] {
  let perler = tur === "cift" ? enCokCift(el, okey) : enDegerliPerler(el, okey).perler;
  if (perler.flat().length >= el.length) {
    // Bütün taşlar perlere giriyor: en değersiz per elde kalır (son taşı atıp bitirmek için).
    const deger = (p: number[]) => (tur === "cift" ? (ciftGecerli(p, okey)?.deger ?? 0) : (perGecerli(p, okey)?.deger ?? 0));
    const enKucuk = perler.reduce((a, b) => (deger(b) < deger(a) ? b : a));
    perler = perler.filter((p) => p !== enKucuk);
  }
  return perler;
}

// ---------------------------------------------------------------------------
// İşleme
// ---------------------------------------------------------------------------

/**
 * Bu taş masadaki hangi perlere işlenebilir? Okey alma (taş perdeki okeyin yerine geçer,
 * okey ele gelir) mümkünse o tercih edilir: oyuncu için her zaman daha kârlıdır.
 */
export function islemeHedefleri(masa: MasaGorunumu101, tas: number): (MasadakiPer & { okeyAl: boolean })[] {
  if (!islemeAcik(masa)) return [];
  // Uzatmada taş elden eksilir; atmak için elde bir taş kalmalı. Okey almada el küçülmez.
  const uzatilir = masa.el.length >= 2;
  return masadakiPerler(masa).flatMap((p): (MasadakiPer & { okeyAl: boolean })[] => {
    if (isle(p.taslar, p.tur, tas, masa.okey, true)) return [{ ...p, okeyAl: true }];
    if (uzatilir && isle(p.taslar, p.tur, tas, masa.okey, false)) return [{ ...p, okeyAl: false }];
    return [];
  });
}

/** İşleme şu an açık mı? (Açmış olmalıyım, açtığım turda işleyemem, taşı çekmiş olmalıyım.) */
export function islemeAcik(masa: MasaGorunumu101): boolean {
  return masa.sonuc === null && masa.sira === masa.koltuk && masa.asama === "at" && masa.acma[masa.koltuk] !== null && !masa.buTurActi;
}

// ---------------------------------------------------------------------------
// Ceza uyarıları (101 ceza yazılan hamleler)
// ---------------------------------------------------------------------------

/**
 * Bu taşı atmak ceza getirir mi? Getirirse oyuncuya gösterilecek sebep. Kullanılmamış yan
 * taşın cezası her atışta yazılır; okey ve işlek taş ise son taşla bitirirken serbesttir.
 */
export function atisUyarisi(masa: MasaGorunumu101, tas: number): string | null {
  if (masa.yandanAlinan !== null) return "Yandan aldığın taşı henüz kullanmadın.";
  if (masa.el.length <= 1) return null;
  if (okeyMi(tas, masa.okey)) return "Okey atıyorsun.";
  if (islenebilirMi(tas, masadakiPerler(masa), masa.okey)) return "Bu taş masadaki bir pere işlenebilir (işlek taş).";
  return null;
}

/**
 * Yandaki taşı almak riskli mi? Yandan alınan taş o tur kullanılmalıdır: açmamışsam
 * açılışta, açmışsam bir perde ya da işleyerek. Kullanamayacaksam uyarı metni döner.
 */
export function yanUyarisi(masa: MasaGorunumu101, yanTas: number | null): string | null {
  if (yanTas === null) return null;
  const { el, okey } = masa;
  const tur = masa.acma[masa.koltuk];
  if (tur === null) {
    return acilisBul([...el, yanTas], okey, yanTas) ? null : "Bu taşla elini açamıyorsun.";
  }
  // Açmışım: masadaki bir pere işlenebiliyor mu?
  if (masadakiPerler(masa).some((p) => isle(p.taslar, p.tur, yanTas, okey, false) || isle(p.taslar, p.tur, yanTas, okey, true))) return null;
  // Elle yeni bir per kuruyor mu?
  if (tur === "cift") {
    if (el.some((t) => ciftGecerli([t, yanTas], okey))) return null;
  } else if (enDegerliPerler([...el, yanTas], okey).perler.some((p) => p.includes(yanTas))) {
    return null;
  }
  return "Bu taşı bu tur kullanamıyorsun.";
}

// ---------------------------------------------------------------------------
// Otomatik dizme (101'e göre)
// ---------------------------------------------------------------------------

/**
 * 101'de amaç taş sayısı değil per DEĞERİDİR: "Seri Diz" değeri en yüksek perleri, "Çift
 * Diz" çiftleri yan yana koyar; artan taşlar renk ve sayıya göre sıralanır. Dönen dizi
 * istakadaki yuvaların sırasıdır (null: boşluk); iki sıraya bölmek dizilisiYerlestir'in işi.
 */
export function diz101(el: number[], okey: Deger, tur: "seri" | "cift"): (number | null)[] {
  const perler = tur === "cift" ? enCokCift(el, okey) : enDegerliPerler(el, okey).perler;
  const kullanilan = new Set(perler.flat());
  const anahtar = (id: number) => (okeyMi(id, okey) ? 1000 : oyunDegeri(id, okey).renk * 13 + oyunDegeri(id, okey).sayi);
  const artan = el.filter((t) => !kullanilan.has(t)).sort((a, b) => anahtar(a) - anahtar(b));
  // Değerli perler başa; çiftlerde boşluk yerine iki çift yan yana sığsın diye çift çift.
  const sirali = tur === "cift" ? perler : [...perler].sort((a, b) => (perGecerli(b, okey)?.deger ?? 0) - (perGecerli(a, okey)?.deger ?? 0));
  return [...sirali.flatMap((p) => [...p, null]), ...artan];
}

/** Rozet metni: "Seri 112", "Çift 5". */
export function acmaRozeti(masa: MasaGorunumu101, koltuk: number): string | null {
  const tur = masa.acma[koltuk];
  if (tur === null) return null;
  const deger = masa.acmaDegeri[koltuk];
  return `${tur === "cift" ? "Çift" : "Seri"} ${deger ?? ""}`.trim();
}
