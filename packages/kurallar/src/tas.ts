// Taşlar ve deste.
//
// Okey'de 106 taş vardır: 4 renk x 1-13 x 2 kopya = 104 taş + 2 sahte okey.
// Her taşı 0-105 arası bir sayıyla (id) temsil ediyoruz. Böylece ağ üzerinden
// sadece sayı gönderilir, iki kopya birbirinden ayrılabilir ve hile yapmak için
// "uydurma taş" göndermek işe yaramaz (sunucu id'nin oyuncunun elinde olup
// olmadığına bakar).

export const RENKLER = ["kirmizi", "sari", "mavi", "siyah"] as const;
export type Renk = (typeof RENKLER)[number];

export const TAS_SAYISI = 106;
export const SAHTE_OKEYLER = [104, 105] as const;

/** Bir taşın görünen değeri. */
export interface Deger {
  renk: number; // 0-3, RENKLER içindeki sıra
  sayi: number; // 1-13
}

export function sahteMi(id: number): boolean {
  return id >= 104;
}

/** Taşın üstünde yazan değer (sahte okey için null). */
export function yuzDegeri(id: number): Deger | null {
  if (sahteMi(id)) return null;
  return { renk: Math.floor(id / 26), sayi: Math.floor((id % 26) / 2) + 1 };
}

/** Göstergeden okey taşını bulur: aynı renk, bir büyük sayı. 13'ün okeyi 1'dir. */
export function okeyiBul(gosterge: number): Deger {
  const d = yuzDegeri(gosterge);
  if (!d) throw new Error("Sahte okey gösterge olamaz");
  return { renk: d.renk, sayi: d.sayi === 13 ? 1 : d.sayi + 1 };
}

/** Taş bu elde joker (okey) mi? Sahte okey joker DEĞİLDİR, okeyin yerine geçen normal taştır. */
export function okeyMi(id: number, okey: Deger): boolean {
  const d = yuzDegeri(id);
  return d !== null && d.renk === okey.renk && d.sayi === okey.sayi;
}

/** Taşın oyundaki değeri: sahte okey, okey taşının değerini alır. */
export function oyunDegeri(id: number, okey: Deger): Deger {
  return yuzDegeri(id) ?? okey;
}

export function tasAdi(id: number): string {
  const d = yuzDegeri(id);
  return d ? `${RENKLER[d.renk]} ${d.sayi}` : "sahte okey";
}

/** Fisher-Yates karıştırma. Rastgele sayı üreticisi dışarıdan verilir ki testlerde tekrar üretilebilsin. */
export function karistir<T>(dizi: T[], rastgele: () => number): T[] {
  const a = [...dizi];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rastgele() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function yeniDeste(rastgele: () => number): number[] {
  return karistir(
    Array.from({ length: TAS_SAYISI }, (_, i) => i),
    rastgele,
  );
}

/** Testler için tohumlu rastgele sayı üreticisi (mulberry32). */
export function tohumluRastgele(tohum: number): () => number {
  let t = tohum >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
