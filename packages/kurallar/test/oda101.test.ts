import { describe, expect, it } from "vitest";
import { type ElSonuBilgisi, type MacSonuBilgisi, Oda, type OdaBaglami } from "../src/oda.ts";
import { MAC_EL_SAYISI } from "../src/masa101.ts";
import type { OdaGorunumu, OyuncuKarti, SohbetMesaji, SunucuMesaji } from "../src/protokol.ts";
import { tohumluRastgele } from "../src/tas.ts";
import { VARSAYILAN_ETIKET } from "../src/kozmetik.ts";
import { sahteSaat } from "./sahteSaat.ts";

const kart = (id: string, ad: string): OyuncuKarti => ({ id, ad, seviye: 1, etiket: VARSAYILAN_ETIKET });

/** 101 odası kurar; elBasinda ve elSonunda çağrılarını kaydeder. */
function kur(ek: Partial<OdaBaglami> = {}) {
  const saat = sahteSaat();
  const gelen = new Map<string, SunucuMesaji[]>();
  const elBasindaCagrilari: string[][] = [];
  const elSonundaCagrilari: ElSonuBilgisi[] = [];
  const oda = new Oda({
    kod: "YUZBR",
    salon: "caylak",
    oyun: "101",
    giris: 100,
    rastgele: tohumluRastgele(11),
    simdi: saat.simdi,
    zamanla: saat.zamanla,
    gonder: (id, m) => gelen.set(id, [...(gelen.get(id) ?? []), m]),
    botGecikmeMs: 10,
    elBasinda: (insanlar) => {
      elBasindaCagrilari.push(insanlar);
      return [];
    },
    elSonunda: (bilgi) => {
      elSonundaCagrilari.push(bilgi);
      return { cipDegisimi: [300, -100, -100, -100], xp: [130, 30, 30, 30] };
    },
    ...ek,
  });
  const odalar = (id: string) =>
    (gelen.get(id) ?? []).flatMap((m) => (m.t === "oda" ? [m.oda] : ([] as OdaGorunumu[])));
  const son = (id: string) => odalar(id).at(-1)!;
  const sohbet = (id: string) =>
    (gelen.get(id) ?? []).flatMap((m) => (m.t === "sohbet" ? [m.mesaj] : ([] as SohbetMesaji[])));
  /** Koşul sağlanana kadar zamanlayıcıları çalıştırır (sonsuz döngüye karşı sınırlı). */
  const ilerleKadar = (kosul: () => boolean) => {
    for (let n = 0; !kosul(); n++) {
      if (n > 50_000 || !saat.ilerle()) throw new Error("koşul hiç sağlanmadı");
    }
  };
  return { oda, saat, son, odalar, sohbet, ilerleKadar, elBasindaCagrilari, elSonundaCagrilari };
}

describe("101 odası", () => {
  it("1 insan + 3 bot bir maçı (4 el) baştan sona oynar", () => {
    const t = kur();
    t.oda.otur(kart("a", "Ayla"));
    expect(t.oda.basla("a")).toEqual({ tamam: true });
    expect(t.oda.turSuresi).toBe(45_000); // 101'in varsayılan hamle süresi
    expect(t.son("a").oyun).toBe("101");
    expect(t.son("a").masa).toMatchObject({ oyun: "101" });

    // Ayla hiç oynamaz: her hamlesinde süresi dolar, yerine çekilip atılır.
    t.ilerleKadar(() => t.elSonundaCagrilari.length > 0);

    // Çip girişi sadece maç başında, dağıtım sadece maç sonunda.
    expect(t.elBasindaCagrilari).toEqual([["a"]]);
    expect(t.elSonundaCagrilari).toHaveLength(1);
    const bilgi = t.elSonundaCagrilari[0] as MacSonuBilgisi;
    expect(bilgi.oyun).toBe("101");
    expect(bilgi.oyuncular.filter((x) => x !== null)).toEqual(["a"]);
    expect(bilgi.eller).toHaveLength(MAC_EL_SAYISI);

    // Puan tablosu: 4 satır, toplamlar satırların toplamı, kazananlar en düşük toplam.
    const mac = bilgi.mac;
    expect(mac.puanlar).toHaveLength(MAC_EL_SAYISI);
    expect(mac.puanlar.every((satir) => satir.length === 4)).toBe(true);
    const toplam = [0, 1, 2, 3].map((k) => mac.puanlar.reduce((t, satir) => t + satir[k], 0));
    expect(mac.toplam).toEqual(toplam);
    const enDusuk = Math.min(...toplam);
    expect(mac.kazananlar).toEqual([0, 1, 2, 3].filter((k) => toplam[k] === enDusuk));
    bilgi.eller.forEach((e, i) => expect(e.puanlar).toEqual(mac.puanlar[i]));

    // Ara ellerin özeti: maç bitmedi, çip/XP sıfır. Son elde maç bitti ve dağıtım görünür.
    const ozetler = new Map<number, OdaGorunumu>();
    for (const g of t.odalar("a")) if (g.sonEl) ozetler.set(g.elNo, g);
    expect([...ozetler.keys()]).toEqual([1, 2, 3, 4]);
    for (const el of [1, 2, 3]) {
      expect(ozetler.get(el)!.sonEl).toMatchObject({ macBitti: false, cipDegisimi: [0, 0, 0, 0], xp: [0, 0, 0, 0] });
      expect(ozetler.get(el)!.mac!.puanlar).toHaveLength(el);
    }
    expect(ozetler.get(4)!.sonEl).toMatchObject({ macBitti: true, cipDegisimi: [300, -100, -100, -100] });
    expect(ozetler.get(4)!.mac!.kazananlar).toEqual(mac.kazananlar);

    // Her elde başlayan koltuk bir sağa kayar (el başındaki ilk görünümde sıra başlayandadır).
    const baslayanlar = [1, 2, 3, 4].map((el) => t.odalar("a").find((g) => g.elNo === el && g.masa)!.masa!.sira);
    baslayanlar.forEach((b, i) => expect(b).toBe((baslayanlar[0] + i) % 4));

    // Sohbette maçın sonucu duyurulur.
    expect(t.sohbet("a").some((m) => m.koltuk === -1 && /^Maç(ı| berabere)/.test(m.metin))).toBe(true);
    expect(t.sohbet("a").some((m) => /için süre doldu/.test(m.metin))).toBe(true);

    // Sonraki el yeni bir maçtır: giriş yeniden alınır, tablo boştur.
    t.ilerleKadar(() => t.son("a").elNo === 5);
    expect(t.elBasindaCagrilari).toHaveLength(2);
    expect(t.son("a").mac).toMatchObject({ elNo: 1, puanlar: [], toplam: [0, 0, 0, 0], kazananlar: null });
    t.oda.kapat();
  });

  it("maç sürerken gelen bekler; kalkanın koltuğunda bot oynar, puanı koltukta kalır", () => {
    const t = kur();
    t.oda.otur(kart("a", "Ayla"));
    t.oda.otur(kart("b", "Berk"));
    t.oda.basla("a");
    const bKoltugu = t.son("b").benimKoltugum!;
    expect(t.oda.potAcik).toBe(true);

    // İlk el bitsin; el arasında Can gelir, Berk kalkar.
    t.ilerleKadar(() => t.son("a").sonEl !== null);
    t.oda.otur(kart("c", "Can"));
    t.oda.ayril("b");
    expect(t.oda.potAcik).toBe(true); // maç sürüyor, giriş henüz dağıtılmadı

    // Maçın 2-4. elleri: Can bekler, Berk'in koltuğu Berk'e yazılı kalır.
    t.ilerleKadar(() => t.son("a").elNo === 2);
    expect(t.son("c").benimKoltugum).toBeNull();
    t.ilerleKadar(() => t.elSonundaCagrilari.length > 0);
    expect(t.elBasindaCagrilari).toHaveLength(1);
    expect(t.elSonundaCagrilari[0].oyuncular[bKoltugu]).toBe("b");
    expect(t.son("c").benimKoltugum).toBeNull();
    expect(t.oda.potAcik).toBe(false);

    // Yeni maç: Berk'in yeri boşalır, Can oturur ve girişini öder.
    t.ilerleKadar(() => t.son("a").elNo === 5);
    expect(t.son("c").benimKoltugum).not.toBeNull();
    expect(t.elBasindaCagrilari[1].sort()).toEqual(["a", "c"]);
    t.oda.kapat();
  });

  it("Okey odası maç tutmaz: her el özeti maç sonu sayılır", () => {
    const t = kur({ oyun: undefined, turSuresiMs: 1_000 });
    t.oda.otur(kart("a", "Ayla"));
    t.oda.basla("a");
    expect(t.oda.turSuresi).toBe(1_000);
    expect(t.son("a")).toMatchObject({ oyun: "okey", mac: null });
    t.ilerleKadar(() => t.elSonundaCagrilari.length > 0);
    expect(t.elSonundaCagrilari[0].oyun).toBe("okey");
    expect(t.son("a").sonEl!.macBitti).toBe(true);
    // Okey'de 101 eylemleri reddedilir.
    t.ilerleKadar(() => t.son("a").elNo === 2);
    expect(t.oda.hamle("a", { tur: "ac", perler: [[1, 2, 3]] })).toMatchObject({ tamam: false });
    t.oda.kapat();
  });
});
