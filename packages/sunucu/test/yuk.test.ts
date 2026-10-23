// Yük testinin kısa sürümü: 12 sanal oyuncu, 20 el. Tam sürümü: npm run yuk-testi
import { describe, expect, it } from "vitest";
import { yukTestiCalistir } from "../araclar/yuk-testi.ts";

describe("yük ve dayanıklılık", () => {
  it("12 oyuncu 20 el oynar; hile, kopma ve kötü niyetli mesajlara rağmen değişmezler bozulmaz", async () => {
    const r = await yukTestiCalistir({ oyuncuSayisi: 12, hedefEl: 20, zamanAsimiMs: 18_000, kopmaOlasiligi: 0.05, tohum: 3, ayrintili: false });
    expect(r.ihlaller).toEqual({});
    expect(r.bitenEl).toBeGreaterThanOrEqual(20);
    expect(r.kotuNiyetliMesaj).toBeGreaterThan(0);
    expect(r.hamleGecikmesi.adet).toBeGreaterThan(0);
  }, 30_000);
});
