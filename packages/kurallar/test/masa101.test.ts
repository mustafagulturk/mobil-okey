import { describe, expect, it } from "vitest";
import { bot101Atis, bot101Hamlesi } from "../src/bot101.ts";
import { Masa101, type MasaGorunumu101 } from "../src/masa101.ts";
import { okeyiBul, sahteMi, tohumluRastgele } from "../src/tas.ts";

// Renkler: 0 kırmızı (k), 1 sarı (s), 2 mavi (m), 3 siyah.
const t = (renk: number, sayi: number, kopya = 0) => renk * 26 + (sayi - 1) * 2 + kopya;
const k = (sayi: number, kopya = 0) => t(0, sayi, kopya);
const s = (sayi: number, kopya = 0) => t(1, sayi, kopya);
const m = (sayi: number, kopya = 0) => t(2, sayi, kopya);
// Gösterge siyah 12 → okey siyah 13: jokerler 102 ve 103.
const GOSTERGE = t(3, 12);
const J1 = t(3, 13, 0);

/** 128'lik açılış: kırmızı 10-13, sarı 10-13, mavi 11-13. */
const ACILIS = [
  [k(10), k(11), k(12), k(13)],
  [s(10), s(11), s(12), s(13)],
  [m(11), m(12), m(13)],
];
const CIFTLER = [
  [k(2), k(2, 1)],
  [s(3), s(3, 1)],
  [m(4), m(4, 1)],
  [k(6), k(6, 1)],
  [s(7), s(7, 1)],
];

/**
 * Testler için elle kurulmuş masa: ellerini ve ortanın çekiliş sırasını biz veririz.
 * orta: ilk çekilecek taş başta. Verilmezse kalan taşlar (sırası önemsiz) ortaya konur.
 * readonly alanlar TypeScript'e göre salt okunurdur; testte durumu kurmak için doğrudan yazıyoruz.
 */
function ozelMasa(eller: number[][], orta?: number[], baslayan = 0): Masa101 {
  const masa = new Masa101(baslayan, tohumluRastgele(1));
  const yazilabilir = masa as unknown as { gosterge: number; okey: unknown };
  yazilabilir.gosterge = GOSTERGE;
  yazilabilir.okey = okeyiBul(GOSTERGE);
  eller.forEach((el, i) => masa.eller[i].splice(0, masa.eller[i].length, ...el));
  const kullanilan = new Set([...eller.flat(), GOSTERGE]);
  const kalan = orta
    ? [...orta].reverse() // orta.pop() ilk çekilecek taşı versin
    : Array.from({ length: 106 }, (_, i) => i).filter((id) => !kullanilan.has(id));
  masa.orta.splice(0, masa.orta.length, ...kalan);
  return masa;
}

/** Sıradakine ortadan çektirir ve çektiği taşı attırır. */
function cekAt(masa: Masa101) {
  const kol = masa.sira;
  expect(masa.hamle(kol, { tur: "cek", kaynak: "orta" })).toEqual({ tamam: true });
  return masa.hamle(kol, { tur: "at", tas: masa.eller[kol].at(-1)! });
}

describe("dağıtım", () => {
  it("başlayan 22, diğerleri 21 taş alır; ortada 20 taş, gösterge sahte okey değil", () => {
    for (let tohum = 0; tohum < 20; tohum++) {
      const masa = new Masa101(tohum % 4, tohumluRastgele(tohum));
      expect(masa.eller.map((e) => e.length)).toEqual([0, 1, 2, 3].map((k) => (k === tohum % 4 ? 22 : 21)));
      expect(masa.orta.length).toBe(20);
      expect(sahteMi(masa.gosterge)).toBe(false);
      const hepsi = [...masa.eller.flat(), ...masa.orta, masa.gosterge].sort((a, b) => a - b);
      expect(hepsi).toEqual(Array.from({ length: 106 }, (_, i) => i));
      expect(masa.sira).toBe(tohum % 4);
      expect(masa.asama).toBe("at");
    }
  });
});

describe("hamle kuralları", () => {
  it("sırası olmayan oynayamaz, başlayan önce atar, Okey'in bitir eylemi reddedilir", () => {
    const masa = new Masa101(0, tohumluRastgele(2));
    expect(masa.hamle(1, { tur: "cek", kaynak: "orta" })).toMatchObject({ tamam: false });
    expect(masa.hamle(0, { tur: "cek", kaynak: "orta" })).toMatchObject({ tamam: false });
    expect(masa.hamle(0, { tur: "bitir", tas: masa.eller[0][0] })).toMatchObject({ tamam: false });
    expect(masa.hamle(0, { tur: "at", tas: masa.eller[1][0] })).toMatchObject({ tamam: false });
    const tas = masa.eller[0][0];
    expect(masa.hamle(0, { tur: "at", tas })).toMatchObject({ tamam: true });
    expect(masa.hamle(1, { tur: "ac", perler: [] })).toMatchObject({ tamam: false }); // çekmeden açamaz
    expect(masa.hamle(1, { tur: "cek", kaynak: "yan" })).toEqual({ tamam: true });
    expect(masa.eller[1]).toContain(tas);
  });

  it("açılış 101'e ulaşmalı; açınca bilgi döner", () => {
    const masa = ozelMasa([[...ACILIS.flat(), k(5), s(2)], [m(1)], [m(2)], [m(3)]]);
    expect(masa.hamle(0, { tur: "ac", perler: ACILIS.slice(0, 2) })).toEqual({
      tamam: false,
      hata: "Açmak için en az 101 gerekir (92)",
    });
    expect(masa.hamle(0, { tur: "ac", perler: [[k(10), k(11), s(12)]] })).toEqual({ tamam: false, hata: "Geçersiz per" });
    expect(masa.hamle(0, { tur: "ac", perler: ACILIS })).toEqual({ tamam: true, bilgi: "128 ile açtın" });
    expect(masa.acma[0]).toBe("seri");
    expect(masa.acmaDegeri[0]).toBe(128);
    expect(masa.perler[0]).toHaveLength(3);
    expect(masa.eller[0]).toEqual([k(5), s(2)]);
  });

  it("elde en az bir taş kalmalı", () => {
    const masa = ozelMasa([ACILIS.flat(), [m(1)], [m(2)], [m(3)]]);
    expect(masa.hamle(0, { tur: "ac", perler: ACILIS })).toEqual({
      tamam: false,
      hata: "Atmak için elinde en az bir taş kalmalı",
    });
  });

  it("çift ve seri karışmaz; seri açan çift, çift açan seri açamaz", () => {
    const seriMasa = ozelMasa([[...ACILIS.flat(), ...CIFTLER[0], s(2)], [m(1)], [m(2)], [m(3)]]);
    expect(seriMasa.hamle(0, { tur: "ac", perler: [...ACILIS, CIFTLER[0]] })).toMatchObject({ tamam: false });
    expect(seriMasa.hamle(0, { tur: "ac", perler: ACILIS })).toMatchObject({ tamam: true });
    expect(seriMasa.hamle(0, { tur: "ac", perler: [CIFTLER[0]] })).toEqual({
      tamam: false,
      hata: "Seri açtın, çift açamazsın",
    });

    const ciftMasa = ozelMasa([[...CIFTLER.flat(), k(1), k(2), k(3), m(9)], [m(1)], [m(2)], [m(3)]]);
    expect(ciftMasa.hamle(0, { tur: "ac", perler: CIFTLER.slice(0, 4) })).toMatchObject({ tamam: false });
    expect(ciftMasa.hamle(0, { tur: "ac", perler: CIFTLER })).toEqual({ tamam: true, bilgi: "5 çift açtın" });
    expect(ciftMasa.hamle(0, { tur: "ac", perler: [[k(1), k(2), k(3)]] })).toEqual({
      tamam: false,
      hata: "Çift açtın, sadece çift açabilirsin",
    });
  });

  it("açtığı turda işleyemez, sonraki turda işler ve okey alır", () => {
    const okeyli = [[k(10), J1, k(12), k(13)], ACILIS[1], ACILIS[2]];
    const masa = ozelMasa([[...okeyli.flat(), k(9), k(11), s(2)], [m(1)], [m(2)], [m(3)]], [m(5), m(6), m(7), s(5)]);
    expect(masa.hamle(0, { tur: "ac", perler: okeyli })).toMatchObject({ tamam: true });
    expect(masa.hamle(0, { tur: "isle", tas: k(9), koltuk: 0, per: 0 })).toEqual({
      tamam: false,
      hata: "Açtığın turda işleyemezsin",
    });
    expect(masa.hamle(0, { tur: "at", tas: s(2) })).toEqual({ tamam: true });
    cekAt(masa);
    cekAt(masa);
    cekAt(masa);
    expect(masa.hamle(0, { tur: "cek", kaynak: "orta" })).toEqual({ tamam: true });
    expect(masa.hamle(0, { tur: "isle", tas: k(9), koltuk: 0, per: 1 })).toMatchObject({ tamam: false });
    expect(masa.hamle(0, { tur: "isle", tas: k(9), koltuk: 0, per: 0 })).toEqual({ tamam: true });
    expect(masa.hamle(0, { tur: "isle", tas: k(11), koltuk: 0, per: 0, okeyAl: true })).toEqual({
      tamam: true,
      bilgi: "Okeyi aldın",
    });
    expect(masa.perler[0][0].taslar).toEqual([k(9), k(10), k(11), k(12), k(13)]);
    expect(masa.eller[0]).toContain(J1);
  });

  it("açmamış oyuncu işleyemez", () => {
    const masa = ozelMasa([[...ACILIS.flat(), s(2), s(4)], [k(9), m(1)], [m(2)], [m(3)]], [m(5)]);
    masa.hamle(0, { tur: "ac", perler: ACILIS });
    masa.hamle(0, { tur: "at", tas: s(2) });
    masa.hamle(1, { tur: "cek", kaynak: "orta" });
    expect(masa.hamle(1, { tur: "isle", tas: k(9), koltuk: 0, per: 0 })).toEqual({
      tamam: false,
      hata: "İşlemek için önce açmalısın",
    });
  });
});

describe("yandan alınan taş", () => {
  // Koltuk 1, koltuk 0'ın attığı kırmızı 13 ile açabilir.
  const el1 = [k(10), k(11), k(12), ...ACILIS[1], s(5), m(10), m(11), m(12), m(13), m(5)];

  it("açmamış oyuncu açılışta yandan aldığı taşı kullanmalı", () => {
    const masa = ozelMasa([[k(13), s(2), s(4)], el1, [m(2)], [m(3)]]);
    masa.hamle(0, { tur: "at", tas: k(13) });
    expect(masa.hamle(1, { tur: "cek", kaynak: "yan" })).toEqual({ tamam: true });
    const yansiz = [[k(10), k(11), k(12)], ACILIS[1], [m(10), m(11), m(12), m(13)]];
    expect(masa.hamle(1, { tur: "ac", perler: yansiz })).toEqual({
      tamam: false,
      hata: "Yandan aldığın taşı açılışta kullanmalısın",
    });
    expect(masa.gorunum(1).yandanAlinan).toBe(k(13));
    const yanli = [[k(10), k(11), k(12), k(13)], ACILIS[1], [m(10), m(11), m(12), m(13)]];
    expect(masa.hamle(1, { tur: "ac", perler: yanli })).toMatchObject({ tamam: true });
    expect(masa.gorunum(1).yandanAlinan).toBeNull();
    expect(masa.hamle(1, { tur: "at", tas: m(5) })).toEqual({ tamam: true });
    expect(masa.cezalar[1]).toBe(0);
  });

  it("kullanmadan atarsa 101 ceza", () => {
    const masa = ozelMasa([[k(13), s(2), s(4)], el1, [m(2)], [m(3)]]);
    masa.hamle(0, { tur: "at", tas: k(13) });
    masa.hamle(1, { tur: "cek", kaynak: "yan" });
    expect(masa.hamle(1, { tur: "at", tas: m(5) })).toEqual({
      tamam: true,
      bilgi: "Yandan aldığın taşı kullanmadın: 101 ceza",
    });
    expect(masa.cezalar[1]).toBe(101);
  });
});

describe("cezalar", () => {
  it("işlek taş ve okey atmak 101 cezadır", () => {
    const masa = ozelMasa([[...ACILIS.flat(), s(2), s(4)], [k(9), m(1)], [J1, m(2)], [m(3)]], [s(5), s(6), s(8)]);
    masa.hamle(0, { tur: "ac", perler: ACILIS });
    masa.hamle(0, { tur: "at", tas: s(2) });
    masa.hamle(1, { tur: "cek", kaynak: "orta" });
    expect(masa.hamle(1, { tur: "at", tas: k(9) })).toEqual({ tamam: true, bilgi: "İşlek taş attın: 101 ceza" });
    masa.hamle(2, { tur: "cek", kaynak: "orta" });
    expect(masa.hamle(2, { tur: "at", tas: J1 })).toEqual({ tamam: true, bilgi: "Okey attın: 101 ceza" });
    expect(masa.cezalar).toEqual([0, 101, 101, 0]);
  });

  it("gösterge ilk atıştan önce gösterilir ve puandan 101 düşer", () => {
    const masa = ozelMasa([[t(3, 12, 1), s(2), s(4)], [m(1)], [m(2)], [m(3)]]);
    expect(masa.gostergeGosterebilir(1)).toBe(false); // sıra onda değil
    expect(masa.gostergeGosterebilir(0)).toBe(true);
    expect(masa.hamle(0, { tur: "gostergeGoster" })).toEqual({ tamam: true, bilgi: "Gösterge: -101" });
    expect(masa.gostergeGosterebilir(0)).toBe(false);
    expect(masa.cezalar[0]).toBe(-101);
  });
});

describe("puan hesabı", () => {
  it("normal bitiş: biten -101, çift açan kalanın 2 katı, açmamış 202", () => {
    // 0 açar; 1 çift açar; 2 ve 3 açmaz. Sonraki turda 0 kırmızı 9'u işleyip son taşı atar.
    const masa = ozelMasa(
      [[...ACILIS.flat(), k(5), s(5)], [...CIFTLER.flat(), m(9), s(1)], [k(1), s(2), m(3)], [m(5), m(6)]],
      [m(2), k(3), s(4), k(9)],
    );
    masa.hamle(0, { tur: "ac", perler: ACILIS });
    masa.hamle(0, { tur: "at", tas: k(5) });
    masa.hamle(1, { tur: "cek", kaynak: "orta" });
    expect(masa.hamle(1, { tur: "ac", perler: CIFTLER })).toMatchObject({ tamam: true });
    masa.hamle(1, { tur: "at", tas: m(2) });
    cekAt(masa);
    cekAt(masa);
    masa.hamle(0, { tur: "cek", kaynak: "orta" });
    expect(masa.hamle(0, { tur: "isle", tas: k(9), koltuk: 0, per: 0 })).toEqual({ tamam: true });
    expect(masa.hamle(0, { tur: "at", tas: s(5) })).toEqual({ tamam: true, bilgi: "Eli bitirdin" });
    expect(masa.sonuc).toEqual({
      tur: "bitti",
      koltuk: 0,
      okeyle: false,
      elden: false,
      puanlar: [-101, (9 + 1) * 2, 202, 202],
    });
    expect(masa.hamle(1, { tur: "cek", kaynak: "orta" })).toEqual({ tamam: false, hata: "El bitti" });
  });

  it("okeyle bitirmek ceza değil, x2 çarpandır; cezalar çarpansız eklenir", () => {
    const masa = ozelMasa(
      [[...ACILIS.flat(), J1, s(5), k(9)], [k(9, 1), m(1)], [m(2), m(4)], [m(3), m(6)]],
      [s(1), k(3), s(4), k(8)],
    );
    masa.hamle(0, { tur: "ac", perler: ACILIS });
    masa.hamle(0, { tur: "at", tas: s(5) });
    masa.hamle(1, { tur: "cek", kaynak: "orta" });
    expect(masa.hamle(1, { tur: "at", tas: k(9, 1) })).toMatchObject({ bilgi: "İşlek taş attın: 101 ceza" });
    cekAt(masa);
    cekAt(masa);
    masa.hamle(0, { tur: "cek", kaynak: "orta" });
    masa.hamle(0, { tur: "isle", tas: k(9), koltuk: 0, per: 0 });
    masa.hamle(0, { tur: "isle", tas: k(8), koltuk: 0, per: 0 });
    expect(masa.eller[0]).toEqual([J1]);
    expect(masa.hamle(0, { tur: "at", tas: J1 })).toEqual({ tamam: true, bilgi: "Eli bitirdin" });
    expect(masa.sonuc).toMatchObject({ tur: "bitti", koltuk: 0, okeyle: true, elden: false });
    expect(masa.sonuc!.puanlar).toEqual([-202, 202 * 2 + 101, 404, 404]);
    expect(masa.cezalar[0]).toBe(0);
  });

  it("elden bitirme: aynı turda açıp son taşı atmak x2", () => {
    const masa = ozelMasa([[...ACILIS.flat(), k(5)], [m(1)], [m(2)], [m(3)]]);
    masa.hamle(0, { tur: "ac", perler: ACILIS });
    masa.hamle(0, { tur: "at", tas: k(5) });
    expect(masa.sonuc).toEqual({ tur: "bitti", koltuk: 0, okeyle: false, elden: true, puanlar: [-202, 404, 404, 404] });
  });

  it("çift açıp elden okeyle bitirme: x2 x2 x2", () => {
    const masa = ozelMasa([[...CIFTLER.flat(), J1], [m(1)], [m(2)], [m(3)]]);
    masa.hamle(0, { tur: "ac", perler: CIFTLER });
    masa.hamle(0, { tur: "at", tas: J1 });
    expect(masa.sonuc).toMatchObject({ okeyle: true, elden: true, puanlar: [-808, 1616, 1616, 1616] });
  });

  it("orta biterse kimse bitirmeden el kapanır, çarpan 1", () => {
    const masa = ozelMasa([[...ACILIS.flat(), s(2), k(5)], [m(1)], [m(2)], [m(3)]], [m(5)]);
    masa.hamle(0, { tur: "ac", perler: ACILIS });
    masa.hamle(0, { tur: "at", tas: s(2) });
    cekAt(masa);
    expect(masa.sonuc).toEqual({ tur: "orta", puanlar: [5, 202, 202, 202] });
  });
});

describe("hile koruması", () => {
  it("görünümde başkalarının taşları ve ortanın sırası yok", () => {
    const masa = new Masa101(0, tohumluRastgele(4));
    masa.hamle(0, { tur: "at", tas: masa.eller[0][0] });
    masa.hamle(1, { tur: "cek", kaynak: "yan" });
    const g = masa.gorunum(2);
    expect(g.el).toEqual(masa.eller[2]);
    expect(g.yandanAlinan).toBeNull(); // sıradaki başkası
    expect(masa.gorunum(1).yandanAlinan).not.toBeNull();
    expect(g.ortaSayisi).toBe(20);
    expect(Object.keys(g)).not.toContain("orta");
    expect(Object.keys(g)).not.toContain("eller");
    // Görünümdeki taşlar: kendi elim, atılanlar, masadaki perler ve gösterge. Başka hiçbiri.
    const gorunebilir = new Set([...g.el, ...g.atilanlar.flat(), ...g.perler.flat().flatMap((p) => p.taslar), g.gosterge]);
    for (const id of [...masa.eller[0], ...masa.eller[1], ...masa.eller[3], ...masa.orta]) {
      expect(gorunebilir.has(id)).toBe(false);
    }
    // Görünüm kopyadır: üzerinde oynamak masayı değiştirmez.
    g.el.pop();
    expect(masa.eller[2]).toHaveLength(21);
  });
});

describe("bot101", () => {
  it("bot okeyi ve işlek taşı atmaz", () => {
    const masa = ozelMasa([[...ACILIS.flat(), s(2), s(4)], [J1, k(9), s(5), m(1)], [m(2)], [m(3)]], [s(8), s(9)]);
    masa.hamle(0, { tur: "ac", perler: ACILIS });
    masa.hamle(0, { tur: "at", tas: s(2) });
    expect(masa.hamle(1, { tur: "cek", kaynak: "orta" })).toEqual({ tamam: true });
    const g: MasaGorunumu101 = masa.gorunum(1);
    expect([s(5), m(1), s(8)]).toContain(bot101Atis(g));
  });

  it("4 bot 40 eli hiç reddedilen hamle olmadan bitirir; ellerin çoğunu biri bitirir", () => {
    let biten = 0;
    for (let tohum = 0; tohum < 40; tohum++) {
      const masa = new Masa101(tohum % 4, tohumluRastgele(tohum));
      let adim = 0;
      while (!masa.sonuc && adim++ < 2000) {
        const kol = masa.sira;
        const sonuc = masa.hamle(kol, bot101Hamlesi(masa.gorunum(kol)));
        expect(sonuc.tamam).toBe(true);
      }
      expect(masa.sonuc).not.toBeNull();
      if (masa.sonuc?.tur === "bitti") biten++;
      // Hiçbir taş kaybolmadı ya da çoğalmadı.
      const hepsi = [
        ...masa.eller.flat(),
        ...masa.atilanlar.flat(),
        ...masa.orta,
        ...masa.perler.flat().flatMap((p) => p.taslar),
        masa.gosterge,
      ].sort((a, b) => a - b);
      expect(hepsi).toEqual(Array.from({ length: 106 }, (_, i) => i));
    }
    expect(biten).toBeGreaterThan(20);
  });
});
