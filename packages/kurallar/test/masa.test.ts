import { describe, expect, it } from "vitest";
import { botHamlesi } from "../src/bot.ts";
import { Masa } from "../src/masa.ts";
import { sahteMi, tohumluRastgele } from "../src/tas.ts";

describe("dağıtım", () => {
  it("başlayan 15, diğerleri 14 taş alır; 106 taşın hepsi bir yerde", () => {
    const m = new Masa(2, tohumluRastgele(1));
    expect(m.eller.map((e) => e.length)).toEqual([14, 14, 15, 14]);
    expect(m.orta.length).toBe(106 - 57 - 1);
    const hepsi = [...m.eller.flat(), ...m.orta, m.gosterge].sort((a, b) => a - b);
    expect(hepsi).toEqual(Array.from({ length: 106 }, (_, i) => i));
    expect(sahteMi(m.gosterge)).toBe(false);
  });
});

describe("hamle kuralları", () => {
  it("sırası olmayan oynayamaz, çekmeden atamaz, elinde olmayan taşı atamaz", () => {
    const m = new Masa(0, tohumluRastgele(2));
    expect(m.hamle(1, { tur: "cek", kaynak: "orta" })).toMatchObject({ tamam: false });
    expect(m.hamle(0, { tur: "cek", kaynak: "orta" })).toMatchObject({ tamam: false }); // 15 taşla önce atar
    expect(m.hamle(0, { tur: "at", tas: m.eller[1][0] })).toMatchObject({ tamam: false });
    const tas = m.eller[0][0];
    expect(m.hamle(0, { tur: "at", tas })).toEqual({ tamam: true });
    expect(m.sira).toBe(1);
    // Koltuk 1'in yanı koltuk 0'ın attığı taştır.
    expect(m.hamle(1, { tur: "cek", kaynak: "yan" })).toEqual({ tamam: true });
    expect(m.eller[1]).toContain(tas);
  });

  it("bitmemiş elle bitiremez", () => {
    const m = new Masa(0, tohumluRastgele(3));
    expect(m.hamle(0, { tur: "bitir", tas: m.eller[0][0] })).toEqual({ tamam: false, hata: "Elin henüz bitmedi" });
  });

  it("görünüm başkalarının taşlarını içermez", () => {
    const m = new Masa(0, tohumluRastgele(4));
    const g = m.gorunum(1);
    expect(g.el).toEqual(m.eller[1]);
    const json = JSON.stringify(g);
    expect(json).not.toContain("orta\":["); // destenin kendisi yok, sadece sayısı
    for (const tas of m.eller[0]) {
      if (!m.eller[1].includes(tas)) expect(g.el).not.toContain(tas);
    }
  });
});

describe("botlarla tam oyun", () => {
  it("4 bot 30 eli kuralsız hamle yapmadan bitirir", () => {
    let kazanan = 0;
    for (let tohum = 0; tohum < 30; tohum++) {
      const m = new Masa(tohum % 4, tohumluRastgele(tohum));
      let adim = 0;
      while (!m.sonuc && adim++ < 500) {
        const k = m.sira;
        const s = m.hamle(k, botHamlesi(m.gorunum(k)));
        expect(s).toEqual({ tamam: true });
      }
      expect(m.sonuc).not.toBeNull();
      if (m.sonuc?.tur === "kazanan") kazanan++;
    }
    // Botlar ellerin çoğunu bitirebilmeli (orta bitip berabere kalmamalı).
    expect(kazanan).toBeGreaterThan(15);
  });
});
