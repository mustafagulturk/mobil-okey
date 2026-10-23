import { describe, expect, it } from "vitest";
import { bitisBul, diz, perlereAyir } from "../src/el.ts";
import { type Deger, okeyiBul } from "../src/tas.ts";

// Testlerde taşı okunur yazmak için: t("k5") = kırmızı 5'in ilk kopyası, t("k5'") ikinci kopyası.
const HARF: Record<string, number> = { k: 0, s: 1, m: 2, y: 3 };
function t(ad: string): number {
  if (ad === "sahte") return 104;
  if (ad === "sahte'") return 105;
  const ikinci = ad.endsWith("'");
  const temiz = ikinci ? ad.slice(0, -1) : ad;
  const renk = HARF[temiz[0]];
  const sayi = Number(temiz.slice(1));
  return renk * 26 + (sayi - 1) * 2 + (ikinci ? 1 : 0);
}
const el = (s: string) => s.split(" ").map(t);
// Okey: siyah 13 (gösterge siyah 12). Böylece testlerde jokerler "y13" ve "y13'".
const OKEY: Deger = okeyiBul(t("y12"));

describe("okey bulma", () => {
  it("göstergenin bir fazlası okeydir, 13'ün okeyi 1'dir", () => {
    expect(okeyiBul(t("k7"))).toEqual({ renk: 0, sayi: 8 });
    expect(okeyiBul(t("m13"))).toEqual({ renk: 2, sayi: 1 });
  });
});

describe("seri bitiş", () => {
  it("seri ve gruplardan oluşan eli kabul eder", () => {
    const b = bitisBul(el("k1 k2 k3 k4 s5 m5 y5 k9 k10 k11 m12 m13 m1 y7"), OKEY);
    expect(b).toBeNull(); // y7 açıkta
    const b2 = bitisBul(el("k1 k2 k3 k4 s5 m5 y5 k9 k10 k11 m11 m12 m13 m1"), OKEY);
    expect(b2?.tur).toBe("seri");
    expect(b2?.perler.flat().length).toBe(14);
  });

  it("12-13-1 geçerli, 13-1-2 geçersiz", () => {
    expect(bitisBul(el("k12 k13 k1 s3 s4 s5 m7 m8 m9 y2 y3 y4 y5 y6"), OKEY)).not.toBeNull();
    expect(bitisBul(el("k13 k1 k2 s3 s4 s5 m7 m8 m9 y2 y3 y4 y5 y6"), OKEY)).toBeNull();
  });

  it("okey eksik taşın yerine geçer", () => {
    // kırmızı 3 yok, yerine okey (y13)
    expect(bitisBul(el("k1 k2 y13 s3 s4 s5 m7 m8 m9 y2 y3 y4 y5 y6"), OKEY)?.tur).toBe("seri");
    // iki okey: biri seride biri grupta
    expect(bitisBul(el("k1 y13 k3 s7 m7 y13' k9 k10 k11 m2 m3 m4 m5 m6"), OKEY)?.tur).toBe("seri");
  });

  it("sahte okey, okeyin değerini (siyah 13) alır", () => {
    expect(bitisBul(el("y11 y12 sahte k3 k4 k5 m7 m8 m9 s2 s3 s4 s5 s6"), OKEY)?.tur).toBe("seri");
  });

  it("aynı renkten iki taş grupta kullanılamaz", () => {
    expect(bitisBul(el("k5 k5' s5 m1 m2 m3 m7 m8 m9 y2 y3 y4 y5 y6"), OKEY)).toBeNull();
  });
});

describe("çift bitiş", () => {
  it("7 çift", () => {
    expect(bitisBul(el("k1 k1' s4 s4' m9 m9' y2 y2' k13 k13' s1 s1' m6 m6'"), OKEY)?.tur).toBe("cift");
  });
  it("okey eşsiz taşa eş olur", () => {
    expect(bitisBul(el("k1 k1' s4 s4' m9 m9' y2 y2' k13 k13' s1 s1' m6 y13"), OKEY)?.tur).toBe("cift");
  });
});

describe("dizme", () => {
  it("perleri öne koyar, 30 yuvayı doldurur", () => {
    const y = diz(el("k1 k2 k3 s5 m5 y5 k9 m11 s2 y8 y9 k12 m3 s10 s11"), OKEY, "seri", 30);
    expect(y.length).toBe(30);
    expect(y.filter((x) => x !== null).length).toBe(15);
  });
  it("en çok taşı pere koyar", () => {
    const r = perlereAyir(el("k1 k2 k3 k4 k5 s5 m5 y9"), OKEY, false)!;
    expect(r.artan.length).toBe(1);
  });
});

describe("hızlı kapsama hesabı", () => {
  it("yavaş ve kesin arama ile aynı sonucu verir", async () => {
    const { seriKapsama } = await import("../src/el.ts");
    const { yeniDeste, tohumluRastgele, okeyiBul: ob } = await import("../src/tas.ts");
    for (let tohum = 0; tohum < 150; tohum++) {
      const deste = yeniDeste(tohumluRastgele(tohum)).filter((x) => x < 104);
      const okey = ob(deste[0]);
      const el14 = deste.slice(1, 15);
      const kesin = perlereAyir(el14, okey, false)!;
      expect(seriKapsama(el14, okey)).toBe(14 - kesin.artan.length);
    }
  });
});
