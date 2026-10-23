import { describe, expect, it } from "vitest";
import { Oda, type OdaBaglami } from "../src/oda.ts";
import type { OyuncuKarti, SunucuMesaji } from "../src/protokol.ts";
import { tohumluRastgele } from "../src/tas.ts";
import { VARSAYILAN_ETIKET } from "../src/kozmetik.ts";

/** Sahte saat: zamanlayıcıları sırayla elle ilerletiriz. */
function sahteSaat() {
  let simdi = 0;
  let sayac = 0;
  const bekleyen = new Map<number, { an: number; fn: () => void }>();
  return {
    simdi: () => simdi,
    zamanla: (fn: () => void, ms: number) => {
      const id = ++sayac;
      bekleyen.set(id, { an: simdi + ms, fn });
      return () => bekleyen.delete(id);
    },
    /** En yakın zamanlayıcıyı çalıştırır. */
    ilerle(): boolean {
      let enYakin: [number, { an: number; fn: () => void }] | null = null;
      for (const g of bekleyen) if (!enYakin || g[1].an < enYakin[1].an) enYakin = g;
      if (!enYakin) return false;
      bekleyen.delete(enYakin[0]);
      simdi = enYakin[1].an;
      enYakin[1].fn();
      return true;
    },
    /** Saati ms ilerletir; bu arada vakti gelen zamanlayıcıları sırayla çalıştırır. */
    atla(ms: number) {
      const hedef = simdi + ms;
      for (;;) {
        let enYakin: [number, { an: number; fn: () => void }] | null = null;
        for (const g of bekleyen) if (g[1].an <= hedef && (!enYakin || g[1].an < enYakin[1].an)) enYakin = g;
        if (!enYakin) break;
        bekleyen.delete(enYakin[0]);
        simdi = enYakin[1].an;
        enYakin[1].fn();
      }
      simdi = hedef;
    },
  };
}

const kart = (id: string, ad: string): OyuncuKarti => ({ id, ad, seviye: 1, etiket: VARSAYILAN_ETIKET });

function kur(ek: Partial<OdaBaglami> = {}) {
  const saat = sahteSaat();
  const gelen = new Map<string, SunucuMesaji[]>();
  const oda = new Oda({
    kod: "ABCDE",
    salon: "caylak",
    giris: 100,
    rastgele: tohumluRastgele(7),
    simdi: saat.simdi,
    zamanla: saat.zamanla,
    gonder: (id, m) => gelen.set(id, [...(gelen.get(id) ?? []), m]),
    ...ek,
  });
  const son = (id: string) => [...(gelen.get(id) ?? [])].reverse().find((m) => m.t === "oda") as Extract<SunucuMesaji, { t: "oda" }>;
  return { oda, saat, gelen, son };
}

describe("oda", () => {
  it("sahip başlatınca boş koltuklara bot oturur ve el başlar", () => {
    const { oda, son } = kur();
    oda.otur(kart("a", "Ayla"));
    oda.otur(kart("b", "Berk"));
    expect(oda.basla("b")).toMatchObject({ tamam: false });
    expect(oda.basla("a")).toEqual({ tamam: true });
    const g = son("a").oda;
    expect(g.koltuklar.filter((k) => k.tur === "bot").length).toBe(2);
    expect(g.masa?.el.length).toBeGreaterThanOrEqual(14);
    // Başka oyuncunun taşları bana gelmez.
    const b = son("b").oda;
    expect(g.masa!.el.some((t) => b.masa!.el.includes(t))).toBe(false);
  });

  it("süre dolunca oyuncunun yerine oynanır, el sonunda çip dağıtılır, sonraki el başlar", () => {
    const dagitimlar: number[] = [];
    const { oda, saat, son } = kur({
      elBasinda: () => [],
      elSonunda: () => {
        dagitimlar.push(1);
        return { cipDegisimi: [0, 0, 0, 0], xp: [10, 10, 10, 10] };
      },
    });
    oda.otur(kart("a", "Ayla"));
    oda.basla("a");
    let n = 0;
    while (dagitimlar.length === 0 && n++ < 2000) saat.ilerle();
    expect(dagitimlar.length).toBe(1);
    expect(son("a").oda.sonEl).not.toBeNull();
    saat.ilerle(); // sonraki el
    expect(son("a").oda.elNo).toBe(2);
    expect(son("a").oda.oyunda).toBe(true);
    oda.kapat();
  });

  it("çipi yetmeyen oyuncu el başında masadan kalkar", () => {
    const { oda, gelen } = kur({ elBasinda: (ids) => ids.filter((id) => id === "b") });
    oda.otur(kart("a", "Ayla"));
    oda.otur(kart("b", "Berk"));
    oda.basla("a");
    expect(gelen.get("b")?.some((m) => m.t === "odadanCikti")).toBe(true);
    expect(oda.koltuklar.filter((k) => k.tur === "insan").length).toBe(1);
    oda.kapat();
  });

  it("el sürerken gelen oyuncu sonraki elde oturur, bağlantısı kopan için bot oynar", () => {
    const { oda, saat, son } = kur();
    oda.otur(kart("a", "Ayla"));
    oda.basla("a");
    oda.otur(kart("c", "Can"));
    expect(son("c").oda.benimKoltugum).toBeNull();
    oda.baglantiKoptu("a");
    let n = 0;
    while (son("c").oda.elNo < 2 && n++ < 3000) saat.ilerle();
    // a bağlı değildi, koltuğu boşaldı; c oturdu.
    expect(son("c").oda.benimKoltugum).not.toBeNull();
    expect(oda.koltuklar.some((k) => k.tur === "insan" && k.oyuncu.id === "a")).toBe(false);
    oda.kapat();
  });

  it("el arasında kopma, geri dönme ya da kalkma sonraki eli iptal etmez", () => {
    const { oda, saat, son } = kur();
    oda.otur(kart("a", "Ayla"));
    oda.basla("a");
    oda.otur(kart("b", "Berk")); // el sürerken gelen: bekleyen
    oda.baglantiKoptu("a");
    let n = 0;
    while (son("b").oda.sonEl === null && n++ < 3000) saat.ilerle();
    expect(son("b").oda.sonEl).not.toBeNull();
    // El arası: a geri döner, sonra tekrar kopar. Sonraki el yine de başlamalı.
    oda.yenidenBaglandi("a");
    oda.baglantiKoptu("a");
    saat.ilerle();
    expect(son("b").oda.elNo).toBe(2);
    expect(son("b").oda.oyunda).toBe(true);
    oda.kapat();
  });

  it("başka oyuncunun kopup geri dönmesi sıradaki oyuncunun süresini uzatmaz", () => {
    const { oda, saat } = kur({ turSuresiMs: 1_000, botGecikmeMs: 10 });
    oda.otur(kart("a", "Ayla"));
    oda.otur(kart("b", "Berk"));
    oda.basla("a");
    const a = oda.koltuklar.findIndex((k) => k.tur === "insan" && k.oyuncu.id === "a");
    let n = 0;
    while (oda.masa!.sira !== a && n++ < 1000) saat.ilerle();
    expect(oda.masa!.sira).toBe(a);
    const atilan = oda.masa!.atilanlar[a].length;
    // a hiç oynamıyor; b her 600 ms'de bir kopup geri geliyor. a'nın süresi yine de dolmalı.
    for (let i = 0; i < 4; i++) {
      saat.atla(600);
      oda.baglantiKoptu("b");
      oda.yenidenBaglandi("b");
    }
    expect(oda.masa!.atilanlar[a].length).toBeGreaterThan(atilan);
    oda.kapat();
  });

  it("son insan da giderse oda kapanır", () => {
    let kapandi = false;
    const { oda } = kur({ bosaldi: () => (kapandi = true) });
    oda.otur(kart("a", "Ayla"));
    oda.ayril("a");
    expect(kapandi).toBe(true);
  });
});
