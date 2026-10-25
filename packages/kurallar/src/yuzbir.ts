// 101 Okey: per kontrolü, puan hesabı ve en iyi açılışı bulma.
//
// 101'de taşlar Okey'deki gibidir (106 taş, gösterge, okey), ama amaç farklıdır:
//  - Oyuncu elindeki perleri masaya "açar". İlk açılışta perlerin toplam değeri en az 101
//    olmalıdır (seri açma) ya da en az 5 çift açılmalıdır (çift açma).
//  - Açan oyuncu sonraki turlarda yeni per açabilir ve masadaki perlere taş "işleyebilir".
//  - Elindeki bütün taşları bitiren oyuncu eli kazanır, diğerleri elinde kalan taşların
//    toplamı kadar ceza puanı yazar. Maçın sonunda en az puanı olan kazanır.
//
// Bir taşın değeri üstündeki sayıdır. Okey (joker), yerine geçtiği taşın değerini alır.
// Sahte okey, okey taşının değerini alan normal bir taştır.

import { type Deger, okeyMi, oyunDegeri } from "./tas.ts";

export type PerTuru = "seri" | "grup" | "cift";

export interface PerBilgisi {
  tur: PerTuru;
  /** Perin puan değeri (jokerler temsil ettikleri taş kadar sayılır). */
  deger: number;
  /** Ekranda gösterilecek sıra: jokerler yerine geçtikleri konumda. */
  sirali: number[];
}

/** 101'de ilk açılış için gereken en az değer ve çift sayısı. */
export const ACMA_SINIRI = 101;
export const CIFT_ACMA_SINIRI = 5;

/** Taş değeri: 1-13. Joker için bilinmez; per içinde konumundan hesaplanır. */
export function tasDegeri(id: number, okey: Deger): number {
  return oyunDegeri(id, okey).sayi;
}

/**
 * Taşlar geçerli bir seri (aynı renk ardışık) ya da grup (aynı sayı farklı renk) mu?
 * Birden çok yorum varsa (ör. jokerin başa mı sona mı konacağı) değeri en yüksek olanı döner.
 */
export function perGecerli(taslar: number[], okey: Deger): PerBilgisi | null {
  if (taslar.length < 3 || new Set(taslar).size !== taslar.length) return null;
  const jokerler = taslar.filter((id) => okeyMi(id, okey));
  const gercekler = taslar.filter((id) => !okeyMi(id, okey));
  if (gercekler.length === 0) return null;
  const adaylar = [grupYorumu(gercekler, jokerler, okey), seriYorumu(gercekler, jokerler, okey)].filter(
    (x): x is PerBilgisi => x !== null,
  );
  if (adaylar.length === 0) return null;
  return adaylar.reduce((a, b) => (b.deger > a.deger ? b : a));
}

function grupYorumu(gercekler: number[], jokerler: number[], okey: Deger): PerBilgisi | null {
  const n = gercekler.length + jokerler.length;
  if (n > 4) return null;
  const d = gercekler.map((id) => oyunDegeri(id, okey));
  if (d.some((x) => x.sayi !== d[0].sayi)) return null;
  if (new Set(d.map((x) => x.renk)).size !== d.length) return null;
  const sirali = [...gercekler].sort((a, b) => oyunDegeri(a, okey).renk - oyunDegeri(b, okey).renk);
  return { tur: "grup", deger: d[0].sayi * n, sirali: [...sirali, ...jokerler] };
}

/**
 * Seri konumları 1..14'tür; 14, 13'ten sonra gelen 1'dir (12-13-1). 13-1-2 geçersizdir,
 * bu yüzden bir seri en fazla 13 taştır ve 1 ile 14'ü aynı anda içeremez.
 */
function seriYorumu(gercekler: number[], jokerler: number[], okey: Deger): PerBilgisi | null {
  const n = gercekler.length + jokerler.length;
  if (n > 13) return null;
  const d = gercekler.map((id) => oyunDegeri(id, okey));
  if (d.some((x) => x.renk !== d[0].renk)) return null;
  if (new Set(d.map((x) => x.sayi)).size !== d.length) return null;

  let enIyi: PerBilgisi | null = null;
  // 1 varsa hem başta (1) hem sonda (14) denenir.
  const birVar = d.some((x) => x.sayi === 1);
  for (const birKonumu of birVar ? [1, 14] : [1]) {
    const konum = (sayi: number) => (sayi === 1 ? birKonumu : sayi);
    const konumlar = d.map((x) => konum(x.sayi));
    const enKucuk = Math.min(...konumlar);
    const enBuyuk = Math.max(...konumlar);
    if (enBuyuk - enKucuk + 1 > n) continue;
    // Pencere [bas, bas+n-1]: bütün gerçek taşları içermeli ve 1..14 içinde kalmalı.
    // n <= 13 olduğu için 1'de başlayan pencere en fazla 13'e uzanır; 13-1-2 böylece dışarıda kalır.
    for (let bas = Math.max(1, enBuyuk - n + 1); bas <= enKucuk && bas + n - 1 <= 14; bas++) {
      let deger = 0;
      const sirali: number[] = [];
      const kalanJoker = [...jokerler];
      for (let p = bas; p < bas + n; p++) {
        deger += p === 14 ? 1 : p;
        const i = konumlar.indexOf(p);
        sirali.push(i === -1 ? kalanJoker.pop()! : gercekler[i]);
      }
      if (!enIyi || deger > enIyi.deger) enIyi = { tur: "seri", deger, sirali };
    }
  }
  return enIyi;
}

/** İki taş çift mi? Aynı renk ve sayı, ya da biri (veya ikisi) okey. */
export function ciftGecerli(taslar: number[], okey: Deger): PerBilgisi | null {
  if (taslar.length !== 2 || taslar[0] === taslar[1]) return null;
  const [a, b] = taslar;
  const ja = okeyMi(a, okey);
  const jb = okeyMi(b, okey);
  if (!ja && !jb) {
    const da = oyunDegeri(a, okey);
    const db = oyunDegeri(b, okey);
    if (da.renk !== db.renk || da.sayi !== db.sayi) return null;
  }
  const gercek = ja ? b : a;
  const deger = ja && jb ? 0 : tasDegeri(gercek, okey) * 2;
  return { tur: "cift", deger, sirali: ja && !jb ? [b, a] : [a, b] };
}

/**
 * Masadaki pere bir taş işlenebilir mi? İki yol vardır:
 *  - uzatma: taş pere eklenir (seri uzar, 3'lü grup 4'lü olur),
 *  - okey alma: taş, perdeki okeyin yerine geçtiği taşın ta kendisiyse okeyle yer değiştirir
 *    ve okey işleyenin eline geçer.
 * Çiftlere taş işlenmez.
 */
export function isle(
  per: number[],
  tur: PerTuru,
  tas: number,
  okey: Deger,
  okeyAl: boolean,
): { per: number[]; alinanOkey: number | null } | null {
  if (tur === "cift") return null;
  if (!okeyAl) {
    const yeni = perGecerli([...per, tas], okey);
    if (!yeni || yeni.tur !== tur) return null;
    return { per: yeni.sirali, alinanOkey: null };
  }
  if (okeyMi(tas, okey)) return null;
  const mevcut = perGecerli(per, okey);
  if (!mevcut) return null;
  for (let i = 0; i < mevcut.sirali.length; i++) {
    const j = mevcut.sirali[i];
    if (!okeyMi(j, okey)) continue;
    const aday = [...mevcut.sirali];
    aday[i] = tas;
    const yeni = perGecerli(aday, okey);
    // Taş jokerin TAM yerine oturmalı: aynı tür, aynı değer (seride aynı pencere,
    // grupta aynı sayı demektir).
    if (yeni && yeni.tur === tur && yeni.deger === mevcut.deger) return { per: yeni.sirali, alinanOkey: j };
  }
  return null;
}

/** Bu taş masadaki perlerden birine işlenebilir mi? (İşlek taş atmak cezalıdır.) */
export function islenebilirMi(tas: number, perler: { taslar: number[]; tur: PerTuru }[], okey: Deger): boolean {
  if (okeyMi(tas, okey)) return false;
  return perler.some(
    (p) => isle(p.taslar, p.tur, tas, okey, false) !== null || isle(p.taslar, p.tur, tas, okey, true) !== null,
  );
}

// ---------------- En değerli perler ----------------

export interface PerSecimi {
  perler: number[][];
  /** Perlerin toplam değeri. */
  deger: number;
}

/** Taş türü: renk*13 + (sayı-1), 0-51. Okeyler (jokerler) ayrı bir tür: 52. */
const JOKER = 52;
const YOK = -Infinity;

function turu(id: number, okey: Deger): number {
  if (okeyMi(id, okey)) return JOKER;
  const d = oyunDegeri(id, okey);
  return d.renk * 13 + d.sayi - 1;
}

/**
 * Elden açılabilecek, birbirinden ayrık (aynı taşı iki kez kullanmayan) geçerli perlerin
 * toplam değerini en büyük yapan seçimi bulur. Seri açma ve botun "hangi taş işe yarıyor"
 * sorusu buna dayanır.
 *
 * Algoritma: el.ts'deki seriKapsama ile aynı fikir. Taşları "hangi türden kaç tane" diye
 * tutarız (sayac). Her adımda en küçük türdeki taşı ("ilk") ele alırız; iki seçenek vardır:
 *  a) ilk hiçbir pere girmez (elde kalır),
 *  b) ilk, onu içeren bir perin parçası olur. Bu perleri tek tek üretip kalanını aynı
 *     şekilde çözeriz.
 * ilk en küçük tür olduğu için ondan küçük türlerin hepsi tükenmiştir. Bu yüzden:
 *  - grupta ilk'in ortakları sadece daha büyük renklerden (ya da jokerden) gelebilir,
 *  - seride ilk'ten küçük konumlar sadece jokerle doldurulabilir. Tek istisna 1'dir:
 *    1, 13'ün arkasında (konum 14) da durabilir, o zaman solundaki 2..13 gerçek taş olabilir.
 * Aynı sayac durumuna farklı yollardan gelinebilir (ör. iki kopyadan birini atlamak);
 * sonucu ezberleyip tekrar hesaplamayız (dinamik programlama). Durum sayısı küçüktür
 * çünkü her türden en fazla 2 taş, toplam en fazla 2 joker vardır.
 *
 * zorunluTas verilirse (yandan alınan taş) sadece o taşı bir pere koyan seçimler sayılır;
 * hiçbiri yoksa null döner. Bunun için durumda bir bayrak daha tutarız: "zorunlu tür bir
 * pere girdi mi?".
 */
export function enDegerliPerler(taslar: number[], okey: Deger): PerSecimi;
export function enDegerliPerler(taslar: number[], okey: Deger, zorunluTas: number | null): PerSecimi | null;
export function enDegerliPerler(taslar: number[], okey: Deger, zorunluTas: number | null = null): PerSecimi | null {
  if (zorunluTas !== null && !taslar.includes(zorunluTas)) return null;
  const sayac = new Uint8Array(53);
  const kovalar: number[][] = Array.from({ length: 53 }, () => []);
  for (const id of taslar) {
    const k = turu(id, okey);
    sayac[k]++;
    kovalar[k].push(id);
  }
  const zorunluTur = zorunluTas === null ? -1 : turu(zorunluTas, okey);
  if (zorunluTas !== null) {
    // Yeniden kurarken kovadan ilk çıkan (pop) zorunlu taşın kendisi olsun.
    const kova = kovalar[zorunluTur];
    kova.splice(kova.indexOf(zorunluTas), 1);
    kova.push(zorunluTas);
  }
  let kullanildi = zorunluTas === null;

  /** Durum -> bu durumdan elde edilebilecek en büyük değer ve ilk taşın girdiği per (türler). */
  const ezber = new Map<string, { deger: number; per: number[] | null }>();
  const anahtar = () => String.fromCharCode(...sayac) + (kullanildi ? "1" : "0");

  /** Sayacın şu anki durumundan elde edilebilecek en büyük toplam değer. */
  function coz(): number {
    let ilk = 0;
    while (ilk < JOKER && sayac[ilk] === 0) ilk++;
    // Gerçek taş kalmadı; jokerler tek başına per olamaz.
    if (ilk === JOKER) return kullanildi ? 0 : YOK;
    const a = anahtar();
    const bilinen = ezber.get(a);
    if (bilinen) return bilinen.deger;

    const renk = Math.floor(ilk / 13);
    const sayi = (ilk % 13) + 1;
    let enIyi = YOK;
    let enIyiPer = null as number[] | null;

    // a) ilk elde kalır.
    sayac[ilk]--;
    enIyi = coz();

    // b) ilk bir pere girer. sayac[ilk] yukarıda zaten bir eksildi; perin diğer taşları da
    //    sayactan alınmış durumdayken dene() kalanı çözer.
    const per: number[] = [ilk];
    const dene = (deger: number) => {
      const onceki = kullanildi;
      if (per.includes(zorunluTur)) kullanildi = true;
      const toplam = deger + coz();
      kullanildi = onceki;
      if (toplam > enIyi) {
        enIyi = toplam;
        enIyiPer = [...per];
      }
    };

    // Grup: aynı sayı. Ortaklar daha büyük renklerden; ayrıca jokerler. 3 ya da 4 taş.
    const ortaklar = [0, 1, 2, 3].map((r) => r * 13 + sayi - 1).filter((k) => k > ilk && sayac[k] > 0);
    for (let maske = 0; maske < 1 << ortaklar.length; maske++) {
      const secilen = ortaklar.filter((_, i) => maske & (1 << i));
      for (const k of secilen) sayac[k]--;
      per.push(...secilen);
      const enFazlaJoker = Math.min(sayac[JOKER], 3 - secilen.length);
      for (let j = 0; j <= enFazlaJoker; j++) {
        // j joker eklenmiş durumda: boyut = 1 + secilen + j
        if (j > 0) {
          sayac[JOKER]--;
          per.push(JOKER);
        }
        if (per.length >= 3) dene(sayi * per.length);
      }
      // Eklenen jokerleri ve ortakları geri koy.
      while (per.length > 1) {
        const k = per.pop()!;
        sayac[k]++;
      }
    }

    // Seri: ilk bir konuma oturur; pencere önce sola, sonra sağa uzatılır.
    for (const konum of sayi === 1 ? [1, 14] : [sayi]) {
      seriUzat(renk, konum, per, dene);
    }

    sayac[ilk]++;
    ezber.set(a, { deger: enIyi, per: enIyiPer });
    return enIyi;
  }

  /**
   * ilk'i (per[0]) içeren, konumu verilen her seriyi üretir. Pencere [bas, son] taşları per
   * dizisinde soldan sağa tutulur; her konum ya o türün gerçek taşıyla ya da jokerle dolar.
   * Kural: en fazla 13 taş ve 1..14'ün ikisi birden olmaz (13-1-2 geçersiz).
   */
  function seriUzat(renk: number, konum: number, per: number[], dene: (deger: number) => void) {
    let bas = konum;
    let son = konum;
    let deger = konum === 14 ? 1 : konum;
    const uygun = (b: number, s: number) => b >= 1 && s <= 14 && s - b + 1 <= 13;
    const konumTuru = (q: number) => renk * 13 + (q === 14 ? 0 : q - 1);

    /** q konumunu gerçek taşla ya da jokerle doldurup devam(), sonra geri alır. */
    const doldur = (q: number, solaMi: boolean, devam: () => void) => {
      for (const k of [konumTuru(q), JOKER]) {
        if (sayac[k] === 0) continue;
        sayac[k]--;
        if (solaMi) per.unshift(k);
        else per.push(k);
        const d = q === 14 ? 1 : q;
        deger += d;
        devam();
        deger -= d;
        if (solaMi) per.shift();
        else per.pop();
        sayac[k]++;
      }
    };

    const saga = () => {
      if (per.length >= 3) dene(deger);
      if (!uygun(bas, son + 1)) return;
      son++;
      doldur(son, false, saga);
      son--;
    };
    const sola = () => {
      saga(); // sol uç burada kalsın
      if (!uygun(bas - 1, son)) return;
      bas--;
      doldur(bas, true, sola);
      bas++;
    };
    // per şu an sadece [ilk]; seri türleri ilk'in arkasına/önüne eklenip çıkarılır.
    sola();
  }

  const deger = coz();
  if (deger === YOK) return null;

  // Ezberdeki kararları baştan oynayıp türleri taş kimliklerine çevir.
  const perler: number[][] = [];
  kullanildi = zorunluTas === null;
  for (;;) {
    let ilk = 0;
    while (ilk < JOKER && sayac[ilk] === 0) ilk++;
    if (ilk === JOKER) break;
    const kayit = ezber.get(anahtar())!;
    if (!kayit.per) {
      sayac[ilk]--; // bu taş elde kalıyor
      continue;
    }
    const ids = kayit.per.map((k) => {
      sayac[k]--;
      if (k === zorunluTur) kullanildi = true;
      return kovalar[k].pop()!;
    });
    perler.push(perGecerli(ids, okey)!.sirali);
  }
  return { perler, deger };
}

// ---------------- Çiftler ----------------

/**
 * Elden açılabilecek en çok çift. Aynı türden iki taş bir çifttir; okey eşi olmayan
 * taşın eşi olur (önce zorunlu taş, sonra en değerli tekler), iki okey de bir çifttir.
 */
export function enCokCift(taslar: number[], okey: Deger, zorunluTas: number | null = null): number[][] {
  const kovalar = new Map<number, number[]>();
  const jokerler: number[] = [];
  for (const id of taslar) {
    const k = turu(id, okey);
    if (k === JOKER) jokerler.push(id);
    else kovalar.set(k, [...(kovalar.get(k) ?? []), id]);
  }
  const ciftler: number[][] = [];
  const tekler: number[] = [];
  for (const k of kovalar.values()) {
    if (k.length >= 2) ciftler.push([k[0], k[1]]);
    else tekler.push(k[0]);
  }
  const oncelik = (id: number) => (id === zorunluTas ? 100 : tasDegeri(id, okey));
  tekler.sort((a, b) => oncelik(b) - oncelik(a));
  for (const t of tekler) {
    if (!jokerler.length) break;
    ciftler.push([t, jokerler.pop()!]);
  }
  if (jokerler.length === 2) ciftler.push([jokerler[0], jokerler[1]]);
  return ciftler;
}

// ---------------- Açılış ----------------

export interface Acilis {
  tur: "seri" | "cift";
  perler: number[][];
  deger: number; // seri açmada toplam değer, çift açmada çift sayısı
}

/**
 * Seri/grup olarak açılabilecek en değerli perler, elde atmak için en az bir taş
 * bırakarak. Bütün taşlar perlere giriyorsa, hangi taşı elde tutmanın en az değer
 * kaybettirdiğine tek tek bakılır (nadir bir durum, el çok küçükken olur).
 */
export function seriAcilisi(el: number[], okey: Deger, zorunluTas: number | null = null): PerSecimi | null {
  const secim = enDegerliPerler(el, okey, zorunluTas);
  if (!secim || secim.perler.flat().length < el.length) return secim;
  let enIyi: PerSecimi | null = null;
  const denenen = new Set<number>();
  for (const t of el) {
    if (t === zorunluTas || denenen.has(turu(t, okey))) continue;
    denenen.add(turu(t, okey));
    const aday = enDegerliPerler(
      el.filter((id) => id !== t),
      okey,
      zorunluTas,
    );
    if (aday && (!enIyi || aday.deger > enIyi.deger)) enIyi = aday;
  }
  return enIyi;
}

/** Çift olarak açılabilecek en çok çift, elde en az bir taş bırakarak. */
export function ciftAcilisi(el: number[], okey: Deger, zorunluTas: number | null = null): number[][] | null {
  let ciftler = enCokCift(el, okey, zorunluTas);
  if (ciftler.flat().length >= el.length) {
    // Hepsi çift: zorunlu taşı içermeyen en düşük değerli çifti elde bırak.
    const birakilabilir = ciftler.filter((c) => !c.includes(zorunluTas ?? -1));
    if (birakilabilir.length === 0) return null;
    const enKucuk = birakilabilir.reduce((a, b) =>
      ciftGecerli(b, okey)!.deger < ciftGecerli(a, okey)!.deger ? b : a,
    );
    ciftler = ciftler.filter((c) => c !== enKucuk);
  }
  if (zorunluTas !== null && !ciftler.flat().includes(zorunluTas)) return null;
  return ciftler;
}

/**
 * Elin ilk açılışa yetip yetmediğini söyler ve açılacak perleri önerir.
 * Elde atmak için en az bir taş kalır. zorunluTas: yandan alınan taş; açılışta kullanılmalıdır.
 *
 * İkisi de mümkünse: çift açanın cezası iki katına çıktığı için, seri açınca elde kalan
 * taşların değeri, çift açınca kalanın iki katından fazla değilse seri açılır.
 */
export function acilisBul(el: number[], okey: Deger, zorunluTas: number | null = null): Acilis | null {
  const seri = seriAcilisi(el, okey, zorunluTas);
  const seriOlur = seri !== null && seri.deger >= ACMA_SINIRI;
  const ciftler = ciftAcilisi(el, okey, zorunluTas);
  const ciftOlur = ciftler !== null && ciftler.length >= CIFT_ACMA_SINIRI;

  const kalan = (perler: number[][]) => {
    const kullanilan = new Set(perler.flat());
    return kalanPuan(
      el.filter((id) => !kullanilan.has(id)),
      okey,
    );
  };
  if (seriOlur && (!ciftOlur || kalan(seri.perler) <= 2 * kalan(ciftler))) {
    return { tur: "seri", perler: seri.perler, deger: seri.deger };
  }
  if (ciftOlur) return { tur: "cift", perler: ciftler, deger: ciftler.length };
  return null;
}

/** Elde kalan taşların ceza değeri (okey, yerine geçtiği taşın, yani okey taşının değerini sayar). */
export function kalanPuan(el: number[], okey: Deger): number {
  return el.reduce((t, id) => t + tasDegeri(id, okey), 0);
}
