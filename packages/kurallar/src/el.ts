// El çözümleme: el bitti mi, taşlar nasıl gruplanır?
//
// Okey'de el iki şekilde biter:
//  1) Seri: 14 taşın tamamı "per"lere ayrılır. Per ya aynı renkte ardışık en az 3 taş
//     (3-4-5, 11-12-13, 12-13-1), ya da aynı sayıda farklı renkte 3 veya 4 taştır.
//     13-1-2 geçersizdir: 1 sadece 13'ün arkasına gelebilir.
//  2) Çift: 14 taş 7 tane aynı taş çiftine ayrılır.
// Okey taşları (joker) her taşın yerine geçebilir.
//
// Algoritma geri izleme (backtracking): elde kalan "en küçük" taşı al, o taşı içeren
// bütün olası perleri dene, kalanı aynı şekilde çöz. Bir taşı içeren per sayısı az
// olduğu ve en fazla 2 joker bulunduğu için 15 taşta milisaniyeler sürer.

import { type Deger, okeyMi, oyunDegeri } from "./tas.ts";

export type Per = number[]; // taş id'leri, sıralı

export interface Bitis {
  tur: "seri" | "cift";
  perler: Per[];
}

/** Taşları türe göre kovalara ayırır: anahtar = renk*13 + (sayi-1). */
function kovala(taslar: number[], okey: Deger) {
  const kovalar: number[][] = Array.from({ length: 52 }, () => []);
  const jokerler: number[] = [];
  for (const id of taslar) {
    if (okeyMi(id, okey)) jokerler.push(id);
    else {
      const d = oyunDegeri(id, okey);
      kovalar[d.renk * 13 + d.sayi - 1].push(id);
    }
  }
  return { kovalar, jokerler };
}

const anahtar = (renk: number, sayi: number) => renk * 13 + sayi - 1;

/**
 * Taşları perlere ayırır. tamami=true ise tüm taşların kullanılması gerekir
 * (el bitti mi kontrolü). false ise en çok taşı perlere koyan dizilişi bulur
 * ve artan taşları ayrıca döndürür (otomatik dizme ve bot için).
 */
export function perlereAyir(
  taslar: number[],
  okey: Deger,
  tamami: boolean,
): { perler: Per[]; artan: number[] } | null {
  const { kovalar, jokerler } = kovala(taslar, okey);
  let enIyi: { perler: Per[]; artan: number[] } | null = null;
  let enIyiKullanilan = -1;
  let adim = 0;
  const ADIM_SINIRI = 200_000; // olası en kötü durumda bile telefonu kilitlememek için

  const perler: Per[] = [];
  const artan: number[] = [];
  let kullanilan = 0;

  function kalanTaslar() {
    let n = jokerler.length;
    for (const k of kovalar) n += k.length;
    return n;
  }

  function ara(): boolean {
    if (++adim > ADIM_SINIRI) return false;
    // Kalan taşların hepsi perlere girse bile mevcut en iyiyi geçemiyorsak dur.
    if (!tamami && kullanilan + kalanTaslar() <= enIyiKullanilan) return false;

    const ilk = kovalar.findIndex((k) => k.length > 0);
    if (ilk === -1) {
      // Gerçek taş kalmadı; jokerler tek başına per olamaz.
      if (tamami && jokerler.length > 0) return false;
      if (kullanilan > enIyiKullanilan) {
        enIyiKullanilan = kullanilan;
        enIyi = { perler: perler.map((p) => [...p]), artan: [...artan, ...jokerler] };
      }
      return tamami;
    }

    const renk = Math.floor(ilk / 13);
    const sayi = (ilk % 13) + 1;
    const tas = kovalar[ilk].pop()!;

    for (const per of buTasinPerleri(tas, renk, sayi)) {
      perler.push(per.taslar);
      kullanilan += per.taslar.length;
      const bitti = ara();
      kullanilan -= per.taslar.length;
      perler.pop();
      per.geriAl();
      if (bitti) {
        kovalar[ilk].push(tas);
        return true;
      }
    }

    if (!tamami) {
      // Bu taşı hiçbir pere koymadan devam et.
      artan.push(tas);
      ara();
      artan.pop();
    }
    kovalar[ilk].push(tas);
    return false;
  }

  /**
   * Verilen taşı içeren perleri üretir. Her per üretildiğinde kullandığı taşlar
   * kovalardan alınmış olur; geriAl() onları yerine koyar.
   */
  function* buTasinPerleri(tas: number, renk: number, sayi: number) {
    // 1) Aynı sayı, farklı renk (3 veya 4 taş).
    const digerRenkler = [0, 1, 2, 3].filter((r) => r !== renk);
    // Her diğer renk için: 0 = yok, 1 = gerçek taş, 2 = joker
    for (let secim = 0; secim < 27; secim++) {
      const s = [secim % 3, Math.floor(secim / 3) % 3, Math.floor(secim / 9)];
      const boyut = 1 + s.filter((x) => x > 0).length;
      if (boyut < 3) continue;
      const jokerSay = s.filter((x) => x === 2).length;
      if (jokerSay > jokerler.length) continue;
      if (s.some((x, i) => x === 1 && kovalar[anahtar(digerRenkler[i], sayi)].length === 0)) continue;
      const alinan: number[] = [tas];
      s.forEach((x, i) => {
        if (x === 1) alinan.push(kovalar[anahtar(digerRenkler[i], sayi)].pop()!);
      });
      const gercekler = alinan.slice(1);
      const jokerAlinan = jokerler.splice(jokerler.length - jokerSay, jokerSay);
      yield {
        taslar: [...alinan, ...jokerAlinan],
        geriAl: () => {
          for (const id of gercekler) {
            const d = oyunDegeri(id, okey);
            kovalar[anahtar(d.renk, d.sayi)].push(id);
          }
          jokerler.push(...jokerAlinan);
        },
      };
    }

    // 2) Aynı renk, ardışık. Konumlar 1..14; 14 numaralı konum, 13'ten sonra gelen 1'dir.
    // Taş, 1 ise hem 1. hem 14. konumda olabilir.
    const konumlar = sayi === 1 ? [1, 14] : [sayi];
    for (const konum of konumlar) {
      for (let bas = Math.max(1, konum - 12); bas <= konum; bas++) {
        // Konumdan önceki kısım: bas..konum-1. 'ilk' taş seçildiği için bu renkte daha
        // küçük gerçek taş kalmadı; ancak konum 14 ise önceki kısım 2..13 olabilir.
        for (let son = Math.max(konum, bas + 2); son <= Math.min(14, bas + 12); son++) {
          if (bas === 1 && son === 14) continue;
          yield* seriDoldur(tas, renk, konum, bas, son);
        }
      }
    }
  }

  /** bas..son arasındaki konumları gerçek taş veya jokerle doldurmanın her yolunu dener. */
  function* seriDoldur(tas: number, renk: number, konum: number, bas: number, son: number) {
    const konumListesi: number[] = [];
    for (let p = bas; p <= son; p++) if (p !== konum) konumListesi.push(p);
    const secilen: number[] = [];

    function* doldur(i: number): Generator<{ taslar: number[]; geriAl: () => void }> {
      if (i === konumListesi.length) {
        const sirali = [...secilen];
        sirali.splice(konum - bas, 0, tas);
        // Taşlar şu an kovalardan alınmış durumda. Üretici kaldığı yerden devam
        // ettiğinde (aşağıdaki pop/push satırları) yerlerine konur; o yüzden geriAl boş.
        yield { taslar: sirali, geriAl: () => {} };
        return;
      }
      const p = konumListesi[i];
      const deger = p === 14 ? 1 : p;
      const kova = kovalar[anahtar(renk, deger)];
      if (kova.length > 0) {
        const id = kova.pop()!;
        secilen.push(id);
        yield* doldur(i + 1);
        secilen.pop();
        kova.push(id);
      }
      if (jokerler.length > 0) {
        const j = jokerler.pop()!;
        secilen.push(j);
        yield* doldur(i + 1);
        secilen.pop();
        jokerler.push(j);
      }
    }
    yield* doldur(0);
  }

  ara();
  return enIyi;
}

/** 14 taş 7 çifte ayrılıyor mu? Joker, eşi olmayan taşın eşi olabilir; iki joker de bir çifttir. */
export function ciftlereAyir(taslar: number[], okey: Deger): { perler: Per[]; artan: number[] } {
  const { kovalar, jokerler } = kovala(taslar, okey);
  const perler: Per[] = [];
  const tekler: number[] = [];
  const j = [...jokerler];
  for (const k of kovalar) {
    const kopya = [...k];
    while (kopya.length >= 2) perler.push([kopya.pop()!, kopya.pop()!]);
    tekler.push(...kopya);
  }
  const artan: number[] = [];
  for (const t of tekler) {
    if (j.length > 0) perler.push([t, j.pop()!]);
    else artan.push(t);
  }
  while (j.length >= 2) perler.push([j.pop()!, j.pop()!]);
  artan.push(...j);
  return { perler, artan };
}

/** Elin geri kalan 14 taşı bitmiş bir el mi? Çift bitiş daha çok puan getirdiği için önce ona bakılır. */
export function bitisBul(taslar: number[], okey: Deger): Bitis | null {
  if (taslar.length !== 14) return null;
  // Hızlı ön kontrol: perlere en fazla kaç taş girer? 14 değilse seri bitiş imkânsız.
  const cift = ciftlereAyir(taslar, okey);
  if (cift.artan.length === 0) return { tur: "cift", perler: cift.perler };
  if (seriKapsama(taslar, okey) < 14) return null;
  const seri = perlereAyir(taslar, okey, true);
  if (seri) return { tur: "seri", perler: seri.perler };
  return null;
}

/**
 * Otomatik dizme: perleri yan yana, aralarında boşluk bırakarak istakaya yerleştirir.
 * Dönen dizi istakadaki yuvaların sırasıdır; null boş yuva demektir.
 */
export function diz(taslar: number[], okey: Deger, tur: "seri" | "cift", yuvaSayisi: number): (number | null)[] {
  const sonuc = tur === "cift" ? ciftlereAyir(taslar, okey) : perlereAyir(taslar, okey, false)!;
  const yuvalar: (number | null)[] = [];
  for (const per of sonuc.perler) {
    yuvalar.push(...per, null);
  }
  const artan = [...sonuc.artan].sort((a, b) => siralamaAnahtari(a, okey) - siralamaAnahtari(b, okey));
  yuvalar.push(...artan);
  // Fazla boşlukları sondan kırp, sığmıyorsa boşlukları azalt.
  while (yuvalar.length > yuvaSayisi) {
    const bos = yuvalar.lastIndexOf(null);
    if (bos === -1) break;
    yuvalar.splice(bos, 1);
  }
  while (yuvalar.length < yuvaSayisi) yuvalar.push(null);
  return yuvalar;
}

function siralamaAnahtari(id: number, okey: Deger): number {
  if (okeyMi(id, okey)) return 1000;
  const d = oyunDegeri(id, okey);
  return d.renk * 13 + d.sayi;
}

/**
 * Elin ne kadar "hazır" olduğunu ölçer: perlere girebilecek en fazla taş sayısı.
 * Bot her hamlede bunu 15 kez hesapladığı için perlereAyir yerine hızlı bir sürüm
 * kullanır: taşları sadece "hangi türden kaç tane" olarak tutar ve aynı ara durumu
 * ikinci kez hesaplamamak için sonuçları ezberler (memoization / dinamik programlama).
 */
export function elPuani(taslar: number[], okey: Deger): number {
  const seriPuan = seriKapsama(taslar, okey);
  const cift = ciftlereAyir(taslar, okey);
  // Çiftler daha kolay toplandığı için çift puanını biraz kırpıyoruz; 5+ çift olunca öne geçsin.
  const ciftPuan = cift.perler.length >= 5 ? cift.perler.length * 2 : 0;
  return Math.max(seriPuan, ciftPuan);
}

/** Perlere girebilecek en fazla taş sayısı. */
export function seriKapsama(taslar: number[], okey: Deger): number {
  const sayac = new Uint8Array(52);
  let joker = 0;
  for (const id of taslar) {
    if (okeyMi(id, okey)) joker++;
    else {
      const d = oyunDegeri(id, okey);
      sayac[d.renk * 13 + d.sayi - 1]++;
    }
  }
  return enCokKapsama(sayac, joker);
}

// Ezber tablosu çağrılar arasında paylaşılır: bot 15 farklı atışı denerken eller birbirine
// çok benzediği için ara sonuçların çoğu tekrar kullanılır. Bellek şişmesin diye sınırlı.
const ezber = new Map<string, number>();
const EZBER_SINIRI = 300_000;

function enCokKapsama(sayac: Uint8Array, baslangicJoker: number): number {
  if (ezber.size > EZBER_SINIRI) ezber.clear();
  let joker = baslangicJoker;

  function cozum(): number {
    const ilk = sayac.findIndex((x) => x > 0);
    if (ilk === -1) return 0;
    const anahtarMetni = String.fromCharCode(...sayac, joker);
    const bilinen = ezber.get(anahtarMetni);
    if (bilinen !== undefined) return bilinen;

    const renk = Math.floor(ilk / 13);
    const sayi = (ilk % 13) + 1;
    sayac[ilk]--;
    // Seçenek 1: bu taş hiçbir pere girmez.
    let enIyi = cozum();

    // Seçenek 2: aynı sayı, farklı renk grubu.
    const diger = [0, 1, 2, 3].filter((r) => r !== renk);
    for (let secim = 0; secim < 27; secim++) {
      const s = [secim % 3, Math.floor(secim / 3) % 3, Math.floor(secim / 9)];
      const boyut = 1 + s.filter((x) => x > 0).length;
      const j = s.filter((x) => x === 2).length;
      if (boyut < 3 || j > joker) continue;
      if (s.some((x, i) => x === 1 && sayac[diger[i] * 13 + sayi - 1] === 0)) continue;
      s.forEach((x, i) => x === 1 && sayac[diger[i] * 13 + sayi - 1]--);
      joker -= j;
      enIyi = Math.max(enIyi, boyut + cozum());
      joker += j;
      s.forEach((x, i) => x === 1 && sayac[diger[i] * 13 + sayi - 1]++);
    }

    // Seçenek 3: aynı renk seri. Taş serinin ilk gerçek taşıdır; öncesi sadece jokerle dolabilir.
    // Her konum için gerçek taş ya da joker kullanılabilir; ikisi de denenir.
    const uzat = (bas: number, p: number, sonSinir: number, yon: 1 | -1, uzunluk: number) => {
      if (uzunluk >= 3) enIyi = Math.max(enIyi, uzunluk + cozum());
      if (yon === 1 ? p > sonSinir : p < sonSinir) return;
      const k = renk * 13 + (p === 14 ? 1 : p) - 1;
      if (sayac[k] > 0) {
        sayac[k]--;
        uzat(bas, p + yon, sonSinir, yon, uzunluk + 1);
        sayac[k]++;
      }
      if (joker > 0) {
        joker--;
        uzat(bas, p + yon, sonSinir, yon, uzunluk + 1);
        joker++;
      }
    };
    for (let once = 0; once <= Math.min(joker, sayi - 1); once++) {
      const bas = sayi - once;
      joker -= once;
      // 1 ile başlayan seri 13'e kadar, diğerleri 13'ten sonra 1'e (konum 14) kadar uzayabilir.
      uzat(bas, sayi + 1, Math.min(bas === 1 ? 13 : 14, bas + 12), 1, once + 1);
      joker += once;
    }
    // 12-13-1 gibi 1'in sonda olduğu seriler: 1'i sona koy, geriye doğru uzat.
    if (sayi === 1) uzat(14, 13, 2, -1, 1);

    sayac[ilk]++;
    ezber.set(anahtarMetni, enIyi);
    return enIyi;
  }
  return cozum();
}
