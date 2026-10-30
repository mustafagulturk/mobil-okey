// 101 masasının arayüz kararları (Aç düğmesi, işleme hedefleri, ceza uyarıları, dizme) için testler.
import { describe, expect, it } from "vitest";
import { type AcikPer, type MasaGorunumu101, okeyiBul, perGecerli } from "@okey/kurallar";
import { acmaDugmesi, atisUyarisi, diz101, islemeHedefleri, yanUyarisi } from "../src/ekranlar/masa101/yardimci101.ts";
import { dizilisiYerlestir } from "../src/yardimci/istaka.ts";

/** Taş kimliği: renk (0 kırmızı, 1 sarı, 2 mavi, 3 siyah), sayı, kopya. */
const t = (renk: number, sayi: number, kopya = 0) => renk * 26 + (sayi - 1) * 2 + kopya;
const [K, S, M, Y] = [0, 1, 2, 3];
const GOSTERGE = t(M, 6); // okey: mavi 7
const OKEY = okeyiBul(GOSTERGE);
const OKEY_TASI = t(M, 7);
const per = (taslar: number[]): AcikPer => ({ tur: perGecerli(taslar, OKEY)!.tur, taslar: perGecerli(taslar, OKEY)!.sirali });

// 106 ile açılabilen el: kırmızı 10-13 (46) + sarı 8-10 (27) + 11'ler (33)
const ACILIR = [t(K, 10), t(K, 11), t(K, 12), t(K, 13), t(S, 8), t(S, 9), t(S, 10), t(M, 11), t(Y, 11), t(S, 11)];
const DIGER = [t(K, 2), t(S, 3), t(M, 4), t(Y, 6), t(M, 1), t(K, 5), t(S, 1), t(Y, 2), t(M, 13, 1), t(K, 7), t(S, 5), t(Y, 7)];

function masa(d: Partial<MasaGorunumu101> = {}): MasaGorunumu101 {
  return {
    oyun: "101",
    koltuk: 0,
    el: [...ACILIR, ...DIGER],
    tasSayilari: [22, 21, 21, 21],
    atilanlar: [[], [], [], []],
    ortaSayisi: 20,
    gosterge: GOSTERGE,
    okey: OKEY,
    sira: 0,
    asama: "at",
    gostergeGosterebilir: false,
    gostergeGosteren: null,
    acma: [null, null, null, null],
    acmaDegeri: [null, null, null, null],
    perler: [[], [], [], []],
    yandanAlinan: null,
    buTurActi: false,
    cezalar: [0, 0, 0, 0],
    sonuc: null,
    ...d,
  };
}

describe("Aç düğmesi", () => {
  it("101'i geçen eli değeriyle gösterir; taş çekmeden basılamaz", () => {
    const hazir = acmaDugmesi(masa(), true);
    expect(hazir.durum).toBe("hazir");
    expect(hazir.etiket).toBe("Aç · 106");
    expect(acmaDugmesi(masa(), false)).toEqual({ durum: "bekle", etiket: "Aç · 106" });
  });

  it("yetmeyen elde ne kadar kaldığını yazar", () => {
    const d = acmaDugmesi(masa({ el: DIGER }), true);
    expect(d.durum).toBe("yetersiz");
    expect(d.etiket).toMatch(/^(Aç \d+\/101|Çift \d\/5)$/);
  });

  it("açtıktan sonra aynı türden yeni per önerir ve elde atacak taş bırakır", () => {
    const el = [t(K, 3), t(K, 4), t(K, 5), t(Y, 9)];
    const d = acmaDugmesi(masa({ el, acma: ["seri", null, null, null] }), true);
    expect(d.durum).toBe("hazir");
    expect(d.durum === "hazir" && d.perler.flat()).toHaveLength(3);
  });
});

describe("işleme", () => {
  const masadaPer = masa({
    el: [t(S, 5), t(Y, 7), t(K, 2)],
    acma: ["seri", null, null, "seri"],
    perler: [[], [], [], [per([t(S, 4), OKEY_TASI, t(S, 6)]), per([t(Y, 8), t(Y, 9), t(Y, 10)])]],
  });

  it("okeyin yerine geçen taşla okey almayı tercih eder", () => {
    expect(islemeHedefleri(masadaPer, t(S, 5))).toEqual([expect.objectContaining({ koltuk: 3, per: 0, okeyAl: true })]);
  });

  it("seriyi uzatan taşı bulur, işlenmeyen taş için hedef yoktur", () => {
    expect(islemeHedefleri(masadaPer, t(Y, 7))).toEqual([expect.objectContaining({ koltuk: 3, per: 1, okeyAl: false })]);
    expect(islemeHedefleri(masadaPer, t(K, 2))).toEqual([]);
  });

  it("açtığım turda ve açmamışken işleme kapalıdır", () => {
    expect(islemeHedefleri({ ...masadaPer, buTurActi: true }, t(Y, 7))).toEqual([]);
    expect(islemeHedefleri({ ...masadaPer, acma: [null, null, null, "seri"] }, t(Y, 7))).toEqual([]);
  });
});

describe("ceza uyarıları", () => {
  const m = masa({ perler: [[], [], [], [per([t(Y, 8), t(Y, 9), t(Y, 10)])]] });

  it("işlek taş, okey ve kullanılmamış yan taş için uyarır", () => {
    expect(atisUyarisi(m, t(Y, 7))).toMatch(/işlek/);
    expect(atisUyarisi({ ...m, el: [...m.el, OKEY_TASI] }, OKEY_TASI)).toMatch(/Okey/);
    expect(atisUyarisi({ ...m, yandanAlinan: t(K, 2) }, t(K, 2))).toMatch(/Yandan/);
    expect(atisUyarisi(m, t(K, 2))).toBeNull();
  });

  it("son taşla bitirirken okey ve işlek taş serbesttir", () => {
    expect(atisUyarisi({ ...m, el: [OKEY_TASI] }, OKEY_TASI)).toBeNull();
  });

  it("yandaki taşla açılamıyorsa uyarır", () => {
    const cek = masa({ el: DIGER.slice(0, 11), asama: "cek" });
    expect(yanUyarisi(cek, t(K, 9))).toMatch(/açamıyorsun/);
    const acilir = masa({ el: ACILIR.concat(DIGER).slice(0, 21), asama: "cek" });
    expect(yanUyarisi(acilir, t(K, 9))).toBeNull(); // kırmızı 9-13'e girer
  });
});

describe("101 dizme", () => {
  it("22 taşın hepsini iki sıralık istakaya yerleştirir, değerli perler başta", () => {
    const el = [...ACILIR, ...DIGER];
    const y = dizilisiYerlestir(diz101(el, OKEY, "seri"));
    expect(y.filter((x) => x !== null).sort((a, b) => a! - b!)).toEqual([...el].sort((a, b) => a - b));
    expect(y.slice(0, 4)).toEqual([t(K, 10), t(K, 11), t(K, 12), t(K, 13)]);
  });
});
