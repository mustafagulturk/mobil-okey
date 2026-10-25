import { describe, expect, it } from "vitest";
import { type Deger, okeyiBul, sahteMi, tohumluRastgele, yeniDeste } from "../src/tas.ts";
import {
  acilisBul,
  ciftGecerli,
  enCokCift,
  enDegerliPerler,
  isle,
  islenebilirMi,
  kalanPuan,
  perGecerli,
} from "../src/yuzbir.ts";

// Renkler: 0 kırmızı (k), 1 sarı (s), 2 mavi (m), 3 siyah.
const t = (renk: number, sayi: number, kopya = 0) => renk * 26 + (sayi - 1) * 2 + kopya;
// Testlerde okey siyah 13: jokerler 102 ve 103; sahte okeyler (104, 105) siyah 13 sayılır.
const OKEY: Deger = { renk: 3, sayi: 13 };
const J1 = t(3, 13, 0);
const J2 = t(3, 13, 1);
const k = (sayi: number, kopya = 0) => t(0, sayi, kopya);
const s = (sayi: number, kopya = 0) => t(1, sayi, kopya);
const m = (sayi: number, kopya = 0) => t(2, sayi, kopya);

describe("perGecerli", () => {
  it("seri: aynı renk ardışık; 12-13-1 geçerli, 13-1-2 geçersiz", () => {
    expect(perGecerli([k(1), k(2), k(3)], OKEY)).toMatchObject({ tur: "seri", deger: 6 });
    expect(perGecerli([k(12), k(13), k(1)], OKEY)).toMatchObject({ tur: "seri", deger: 26 });
    expect(perGecerli([k(11), k(12), k(13), k(1)], OKEY)?.deger).toBe(37);
    expect(perGecerli([k(13), k(1), k(2)], OKEY)).toBeNull();
    expect(perGecerli([k(1), k(2), s(3)], OKEY)).toBeNull();
    expect(perGecerli([k(1), k(2)], OKEY)).toBeNull();
  });

  it("seri en fazla 13 taş", () => {
    const hepsi = Array.from({ length: 13 }, (_, i) => k(i + 1));
    expect(perGecerli(hepsi, OKEY)?.deger).toBe(91);
    expect(perGecerli([...hepsi, J1], OKEY)).toBeNull();
  });

  it("grup: aynı sayı, 3-4 farklı renk", () => {
    expect(perGecerli([k(5), s(5), m(5)], OKEY)).toMatchObject({ tur: "grup", deger: 15 });
    expect(perGecerli([k(5), s(5), m(5), t(3, 5)], OKEY)?.deger).toBe(20);
    expect(perGecerli([k(5), k(5, 1), s(5)], OKEY)).toBeNull();
  });

  it("joker temsil ettiği taşın değerini alır, en değerli yorum seçilir", () => {
    const p = perGecerli([k(5), J1, k(7)], OKEY)!;
    expect(p).toMatchObject({ tur: "seri", deger: 18 });
    expect(p.sirali).toEqual([k(5), J1, k(7)]);
    // 12-13'e joker: 11-12-13 (36) 12-13-1'den (26) değerli.
    expect(perGecerli([k(12), k(13), J1], OKEY)).toMatchObject({ deger: 36, sirali: [J1, k(12), k(13)] });
    // Tek gerçek taş + iki joker: 1 için en değerlisi 12-13-1.
    expect(perGecerli([J1, J2, k(1)], OKEY)?.deger).toBe(26);
    expect(perGecerli([J1, J2, s(13)], OKEY)).toMatchObject({ tur: "grup", deger: 39 });
    expect(perGecerli([k(4), s(4), J1], OKEY)).toMatchObject({ tur: "grup", deger: 12 });
    expect(perGecerli([J1, J2, J1], OKEY)).toBeNull();
  });

  it("sahte okey, okey taşının değerinde normal taştır", () => {
    expect(perGecerli([t(3, 11), t(3, 12), 104], OKEY)).toMatchObject({ tur: "seri", deger: 36 });
  });
});

describe("ciftGecerli", () => {
  it("aynı taşın iki kopyası ya da okeyli çift", () => {
    expect(ciftGecerli([k(5), k(5, 1)], OKEY)?.deger).toBe(10);
    expect(ciftGecerli([k(5), s(5)], OKEY)).toBeNull();
    expect(ciftGecerli([J1, k(5)], OKEY)).toMatchObject({ deger: 10, sirali: [k(5), J1] });
    expect(ciftGecerli([J1, J2], OKEY)?.deger).toBe(0);
    expect(ciftGecerli([104, 105], OKEY)?.deger).toBe(26);
    expect(ciftGecerli([k(5), k(5)], OKEY)).toBeNull();
  });
});

describe("isle", () => {
  it("seriyi iki uçtan uzatır, 13'ün arkasına 1 gelir ama 1'in önüne 13 gelmez", () => {
    expect(isle([k(3), k(4), k(5)], "seri", k(6), OKEY, false)?.per).toEqual([k(3), k(4), k(5), k(6)]);
    expect(isle([k(3), k(4), k(5)], "seri", k(2), OKEY, false)?.per).toEqual([k(2), k(3), k(4), k(5)]);
    expect(isle([k(3), k(4), k(5)], "seri", k(7), OKEY, false)).toBeNull();
    expect(isle([k(11), k(12), k(13)], "seri", k(1), OKEY, false)?.per).toEqual([k(11), k(12), k(13), k(1)]);
    expect(isle([k(1), k(2), k(3)], "seri", k(13), OKEY, false)).toBeNull();
    // Okey de işlenebilir.
    expect(isle([k(3), k(4), k(5)], "seri", J1, OKEY, false)).not.toBeNull();
  });

  it("3'lü grup 4'lü olur, 4'lüye ve aynı renge işlenmez, çifte hiç işlenmez", () => {
    expect(isle([k(5), s(5), m(5)], "grup", t(3, 5), OKEY, false)).not.toBeNull();
    expect(isle([k(5), s(5), m(5), t(3, 5)], "grup", k(5, 1), OKEY, false)).toBeNull();
    expect(isle([k(5), s(5), m(5)], "grup", k(5, 1), OKEY, false)).toBeNull();
    expect(isle([k(5), s(5), m(5)], "seri", t(3, 5), OKEY, false)).toBeNull(); // tür korunur
    expect(isle([k(5), k(5, 1)], "cift", J1, OKEY, false)).toBeNull();
  });

  it("okey alma: taş okeyin tam yerine geçerse okey işleyene geçer", () => {
    expect(isle([k(5), J1, k(7)], "seri", k(6), OKEY, true)).toEqual({ per: [k(5), k(6), k(7)], alinanOkey: J1 });
    expect(isle([k(5), J1, k(7)], "seri", k(8), OKEY, true)).toBeNull();
    expect(isle([k(5), s(5), J1], "grup", m(5), OKEY, true)?.alinanOkey).toBe(J1);
    expect(isle([k(5), s(5), J1], "grup", k(5, 1), OKEY, true)).toBeNull();
    expect(isle([k(5), s(5), m(5)], "grup", t(3, 5), OKEY, true)).toBeNull(); // okey yok
    expect(isle([J1, k(12), k(13)], "seri", k(1), OKEY, true)).toBeNull(); // 11 yerine 1 olmaz
  });

  it("islenebilirMi: okey hiçbir zaman işlek sayılmaz", () => {
    const masa = [{ tur: "seri" as const, taslar: [k(3), k(4), k(5)] }];
    expect(islenebilirMi(k(6), masa, OKEY)).toBe(true);
    expect(islenebilirMi(s(6), masa, OKEY)).toBe(false);
    expect(islenebilirMi(J1, masa, OKEY)).toBe(false);
  });
});

/**
 * Kaba kuvvet: taşların her alt kümesinin per olup olmadığını önceden hesaplar, sonra
 * "maske -> o taşlarla elde edilebilecek en büyük değer" tablosunu doldurur. 2^n * 2^n'e
 * yakın iş yaptığı için sadece küçük ellerde kullanılır; enDegerliPerler'i bununla sınarız.
 */
function kabaKuvvet(el: number[], okey: Deger, zorunlu: number | null): number | null {
  const n = el.length;
  const tam = (1 << n) - 1;
  const perDegeri = new Int32Array(1 << n).fill(-1);
  for (let maske = 1; maske <= tam; maske++) {
    const taslar = el.filter((_, i) => maske & (1 << i));
    if (taslar.length >= 3) perDegeri[maske] = perGecerli(taslar, okey)?.deger ?? -1;
  }
  const enIyi = new Int32Array(1 << n);
  for (let maske = 1; maske <= tam; maske++) {
    const ilk = maske & -maske;
    let d = enIyi[maske ^ ilk]; // ilk taş elde kalır
    for (let alt = maske; alt > 0; alt = (alt - 1) & maske) {
      if (alt & ilk && perDegeri[alt] >= 0) d = Math.max(d, perDegeri[alt] + enIyi[maske ^ alt]);
    }
    enIyi[maske] = d;
  }
  if (zorunlu === null) return enIyi[tam];
  const z = 1 << el.indexOf(zorunlu);
  let d = -1;
  for (let alt = tam; alt > 0; alt = (alt - 1) & tam) {
    if (alt & z && perDegeri[alt] >= 0) d = Math.max(d, perDegeri[alt] + enIyi[tam ^ alt]);
  }
  return d >= 0 ? d : null;
}

/** Sonucun gerçekten elden açılabilir olduğunu doğrular: ayrık, elde var, her biri geçerli. */
function seciminDegeri(el: number[], perler: number[][], okey: Deger): number {
  const hepsi = perler.flat();
  expect(new Set(hepsi).size).toBe(hepsi.length);
  for (const id of hepsi) expect(el).toContain(id);
  return perler.reduce((top, p) => top + perGecerli(p, okey)!.deger, 0);
}

describe("enDegerliPerler", () => {
  it("basit eller", () => {
    expect(enDegerliPerler([k(3), k(4), k(5), s(9), m(9), k(9), m(1)], OKEY).deger).toBe(39);
    expect(enDegerliPerler([k(12), k(13), k(1)], OKEY).deger).toBe(26);
    expect(enDegerliPerler([k(11), k(12), k(13), k(1)], OKEY).deger).toBe(37);
    expect(enDegerliPerler([k(13), k(1), k(2)], OKEY).deger).toBe(0);
    // 12-13-1 ile 1-2-3 aynı 1'i paylaşamaz; iki 1 varsa ikisi de olur.
    expect(enDegerliPerler([k(12), k(13), k(1), k(2), k(3)], OKEY).deger).toBe(26); // 12-13-1, 2-3 artar
    expect(enDegerliPerler([k(12), k(13), k(1), k(1, 1), k(2), k(3)], OKEY).deger).toBe(32);
    expect(enDegerliPerler([], OKEY)).toEqual({ perler: [], deger: 0 });
    expect(enDegerliPerler([J1, J2], OKEY).deger).toBe(0);
  });

  it("küçük rastgele ellerde kaba kuvvetle aynı sonucu verir", () => {
    // Per çıkma ihtimali yüksek olsun diye dar bir havuz: 3 renk, 1-4 ve 11-13, iki kopya, jokerler, sahte okey.
    const havuz = [J1, J2, 104];
    for (const renk of [0, 1, 2]) for (const sayi of [1, 2, 3, 4, 11, 12, 13]) havuz.push(t(renk, sayi), t(renk, sayi, 1));
    const rastgele = tohumluRastgele(7);
    for (let deneme = 0; deneme < 300; deneme++) {
      const n = 6 + Math.floor(rastgele() * 5); // 6-10 taş
      const el = yeniDesteden(havuz, rastgele).slice(0, n);
      const secim = enDegerliPerler(el, OKEY);
      expect(secim.deger).toBe(kabaKuvvet(el, OKEY, null));
      expect(seciminDegeri(el, secim.perler, OKEY)).toBe(secim.deger);

      // Zorunlu taş: o taşı bir pere koyan en iyi seçim.
      const zorunlu = el[Math.floor(rastgele() * n)];
      const zorunluSecim = enDegerliPerler(el, OKEY, zorunlu);
      expect(zorunluSecim?.deger ?? null).toBe(kabaKuvvet(el, OKEY, zorunlu));
      if (zorunluSecim) {
        expect(zorunluSecim.perler.flat()).toContain(zorunlu);
        expect(seciminDegeri(el, zorunluSecim.perler, OKEY)).toBe(zorunluSecim.deger);
      }
    }
  });

  it("22 taşlık elde hızlıdır", () => {
    let toplam = 0;
    const N = 200;
    for (let tohum = 0; tohum < N; tohum++) {
      const deste = yeniDeste(tohumluRastgele(tohum));
      const gosterge = deste.find((id) => !sahteMi(id))!;
      const okey = okeyiBul(gosterge);
      const el = deste.filter((id) => id !== gosterge).slice(0, 22);
      const once = performance.now();
      const secim = enDegerliPerler(el, okey);
      toplam += performance.now() - once;
      expect(seciminDegeri(el, secim.perler, okey)).toBe(secim.deger);
    }
    expect(toplam / N).toBeLessThan(20);
  });
});

function yeniDesteden(havuz: number[], rastgele: () => number): number[] {
  const a = [...havuz];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rastgele() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

describe("enCokCift", () => {
  it("eşler ve okeyle tamamlanan tekler", () => {
    const ciftler = enCokCift([k(5), k(5, 1), s(2), m(9), J1], OKEY);
    expect(ciftler).toHaveLength(2);
    expect(ciftler).toContainEqual([m(9), J1]); // okey en değerli tekin eşi olur
    // Zorunlu taş önceliklidir.
    expect(enCokCift([k(5), k(5, 1), s(2), m(9), J1], OKEY, s(2))).toContainEqual([s(2), J1]);
    expect(enCokCift([J1, J2], OKEY)).toEqual([[J1, J2]]);
  });
});

describe("acilisBul", () => {
  const seri101 = [k(10), k(11), k(12), k(13), s(10), s(11), s(12), s(13), m(11), m(12), m(13)]; // 46+46+36

  it("101'i geçen eli seri açar, artanı elde bırakır", () => {
    const a = acilisBul([...seri101, s(2), m(5)], OKEY)!;
    expect(a).toMatchObject({ tur: "seri", deger: 128 });
    expect(a.perler.flat().sort()).toEqual([...seri101].sort());
  });

  it("101'e yetmeyen el açılamaz", () => {
    expect(acilisBul([k(10), k(11), k(12), k(13), s(10), s(11), s(12), s(13), s(2), m(5)], OKEY)).toBeNull();
  });

  it("bütün taşlar pere giriyorsa en az kayıpla bir taşı elde bırakır", () => {
    const a = acilisBul(seri101, OKEY)!;
    expect(a.perler.flat()).toHaveLength(10);
    expect(a.deger).toBe(118); // bir 10'u elde tutar
  });

  it("5 çift ile çift açar", () => {
    const el = [k(2), k(2, 1), s(3), s(3, 1), m(4), m(4, 1), k(6), k(6, 1), s(7), J1, m(13), k(1)];
    const a = acilisBul(el, OKEY)!;
    expect(a.tur).toBe("cift");
    expect(a.deger).toBe(5);
    expect(a.perler).toContainEqual([m(13), J1]); // okey en değerli tekin eşi
  });

  it("yandan alınan taş açılışa girmeli", () => {
    expect(acilisBul([...seri101, s(2), m(5)], OKEY, s(2))).toBeNull();
    const a = acilisBul([...seri101, m(10), s(2)], OKEY, m(10))!;
    expect(a.perler.flat()).toContain(m(10));
    expect(a.deger).toBe(138);
  });
});

describe("kalanPuan", () => {
  it("taş değerlerinin toplamı; okey, okey taşının değerini sayar", () => {
    expect(kalanPuan([k(5), s(1), J1], OKEY)).toBe(5 + 1 + 13);
  });
});
