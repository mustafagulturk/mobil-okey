import { afterEach, describe, expect, it } from "vitest";
import { BASLANGIC_CIPI, type SunucuMesaji } from "@okey/kurallar";
import { testSunucusu, TestIstemcisi } from "./yardimci.ts";

type OdaMesaji = Extract<SunucuMesaji, { t: "oda" }>;

let sunucu: Awaited<ReturnType<typeof testSunucusu>> | null = null;
afterEach(async () => {
  await sunucu?.kapat();
  sunucu = null;
});

describe("salon ve oda", () => {
  it("hızlı oyunda masaya oturur, botlarla el başlar ve giriş çipi düşer", async () => {
    sunucu = await testSunucusu();
    const { i, h } = await TestIstemcisi.girisYap(sunucu.adres);
    i.gonder({ t: "hizliOyun", salon: "caylak" });
    const oda = await i.bekle("oda", (m) => m.oda.masa !== null);
    expect(oda.oda.benimKoltugum).not.toBeNull();
    expect(oda.oda.koltuklar.filter((k) => k.tur === "bot").length).toBe(3);
    expect((await i.bekle("profil")).profil.cip).toBe(BASLANGIC_CIPI - 100);
    expect(sunucu.vt.cipHareketleri(h.oyuncuId).at(-1)).toMatchObject({ miktar: -100, sebep: "el_girisi" });

    i.gonder({ t: "salonlar" });
    const s = await i.bekle("salonlar");
    expect(s.salonlar.find((x) => x.id === "caylak")!.oyuncuSayisi).toBe(1);

    i.gonder({ t: "hizliOyun", salon: "caylak" });
    expect((await i.bekle("hata")).mesaj).toMatch(/Zaten bir masadasın/);
    i.gonder({ t: "odadanAyril" });
    await i.bekle("odadanCikti");
    i.kapat();
  });

  it("salonun çip aralığı dışındaki oyuncu oturamaz", async () => {
    sunucu = await testSunucusu({ satinAlmaTest: true });
    const { i } = await TestIstemcisi.girisYap(sunucu.adres);
    i.gonder({ t: "hizliOyun", salon: "usta" });
    expect((await i.bekle("hata")).mesaj).toBe("Bu salon için en az 10000 çip gerekir");
    i.gonder({ t: "satinAlma", urunId: "cip_25k", satinAlmaJetonu: "test-aralik" });
    expect((await i.bekle("profil")).profil.cip).toBe(BASLANGIC_CIPI + 25_000);
    i.gonder({ t: "hizliOyun", salon: "caylak" });
    expect((await i.bekle("hata")).mesaj).toBe("Bu salon en fazla 10000 çipi olanlar için");
    i.gonder({ t: "odaKur", salon: "usta" });
    await i.bekle("oda");
    i.kapat();
  });

  it("hiçbir oyuncuya başka bir oyuncunun eli gitmez", async () => {
    sunucu = await testSunucusu({ turSuresiMs: 30 });
    const { i: a } = await TestIstemcisi.girisYap(sunucu.adres, { ad: "Ayla" });
    const { i: b } = await TestIstemcisi.girisYap(sunucu.adres, { ad: "Berk" });
    a.gonder({ t: "hizliOyun", salon: "caylak" });
    await a.bekle("oda");
    b.gonder({ t: "hizliOyun", salon: "caylak" });
    const ga = await a.bekle("oda", (m) => m.oda.masa !== null);
    const gb = await b.bekle("oda", (m) => m.oda.masa !== null);
    expect(ga.oda.kod).toBe(gb.oda.kod);
    // Süresi dolan hamleler ve botlar bir süre oynasın.
    await new Promise((r) => setTimeout(r, 400));

    for (const [ist, digeri] of [
      [a, b],
      [b, a],
    ] as const) {
      const odalar = ist.gelenler.filter((m): m is OdaMesaji => m.t === "oda");
      const benim = odalar.at(-1)!.oda.benimKoltugum;
      for (const m of odalar) {
        if (m.oda.masa) expect(m.oda.masa.koltuk).toBe(benim);
      }
      for (const ham of ist.hamGelenler) {
        expect(ham).not.toMatch(/"eller"|"orta"|"deste"/);
      }
      // Aynı anda iki oyuncunun elleri kesişmez.
      const benimEl = odalar.at(-1)!.oda.masa!.el;
      const onunEl = digeri.gelenler.filter((m): m is OdaMesaji => m.t === "oda").at(-1)!.oda.masa!.el;
      expect(benimEl.filter((t) => onunEl.includes(t))).toEqual([]);
    }
    a.kapat();
    b.kapat();
  });

  it("el sonunda çip, XP ve istatistik işlenir", async () => {
    sunucu = await testSunucusu({ turSuresiMs: 1, eslesmeBeklemeMs: 10 });
    const { i } = await TestIstemcisi.girisYap(sunucu.adres);
    i.gonder({ t: "hizliOyun", salon: "caylak" });
    const son = await i.bekle("oda", (m) => m.oda.sonEl !== null, 20_000);
    const p = (await i.bekle("profil", (m) => m.profil.istatistik.oynanan === 1)).profil;
    const koltuk = son.oda.benimKoltugum!;
    const sonuc = son.oda.sonEl!.sonuc;
    const beklenen =
      sonuc.tur === "berabere" ? BASLANGIC_CIPI : sonuc.koltuk === koltuk ? BASLANGIC_CIPI + 300 : BASLANGIC_CIPI - 100;
    expect(p.cip).toBe(beklenen);
    expect(son.oda.sonEl!.cipDegisimi[koltuk]).toBe(beklenen - BASLANGIC_CIPI);
    expect(p.xp).toBeGreaterThanOrEqual(10);
    expect(son.oda.sonEl!.xp[koltuk]).toBe(p.xp);
    i.gonder({ t: "gorevler" });
    const g = await i.bekle("gorevler");
    expect(g.gorevler).toHaveLength(3);
    const oyna = g.gorevler.find((x) => x.id === "oyna5" || x.id === "oyna15");
    if (oyna) expect(oyna.ilerleme).toBe(1);
    i.kapat();
  }, 30_000);

  it("özel oda: kodla katılınır, oyunu sadece sahibi başlatır", async () => {
    sunucu = await testSunucusu();
    const { i: a } = await TestIstemcisi.girisYap(sunucu.adres, { ad: "Ayla" });
    const { i: b } = await TestIstemcisi.girisYap(sunucu.adres, { ad: "Berk" });
    a.gonder({ t: "odaKur", salon: "kahvehane" });
    const kod = (await a.bekle("oda")).oda.kod;
    expect(kod).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);

    b.gonder({ t: "odayaKatil", kod: "zzzzz" });
    expect((await b.bekle("hata")).mesaj).toBe("Bu kodla bir masa bulunamadı");
    b.gonder({ t: "odayaKatil", kod: kod.toLowerCase() });
    await b.bekle("oda");
    b.gonder({ t: "basla" });
    expect((await b.bekle("hata")).mesaj).toBe("Oyunu sadece masa sahibi başlatabilir");
    a.gonder({ t: "basla" });
    const g = await b.bekle("oda", (m) => m.oda.masa !== null);
    expect(g.oda.koltuklar.filter((k) => k.tur === "insan").length).toBe(2);
    a.kapat();
    b.kapat();
  });

  it("bağlantısı kopan oyuncu tekrar girince masasına döner", async () => {
    sunucu = await testSunucusu();
    const { i, h } = await TestIstemcisi.girisYap(sunucu.adres);
    i.gonder({ t: "odaKur", salon: "caylak" });
    await i.bekle("oda");
    i.gonder({ t: "basla" });
    const once = await i.bekle("oda", (m) => m.oda.masa !== null);
    i.kapat();
    await new Promise((r) => setTimeout(r, 50));

    const { i: i2 } = await TestIstemcisi.girisYap(sunucu.adres, { oyuncuId: h.oyuncuId, anahtar: h.anahtar });
    const sonra = await i2.bekle("oda");
    expect(sonra.oda.kod).toBe(once.oda.kod);
    expect(sonra.oda.benimKoltugum).toBe(once.oda.benimKoltugum);
    expect(sonra.oda.masa).not.toBeNull();
    await i2.bekle("sohbetGecmisi");
    i2.kapat();
  });

  it("sohbet küfürleri maskeler ve saniyede bir mesaja izin verir", async () => {
    sunucu = await testSunucusu();
    const { i } = await TestIstemcisi.girisYap(sunucu.adres);
    i.gonder({ t: "sohbet", metin: "selam" });
    expect((await i.bekle("hata")).mesaj).toBe("Bir masada değilsin");
    await new Promise((r) => setTimeout(r, 1000));
    i.gonder({ t: "odaKur", salon: "caylak" });
    await i.bekle("oda");
    i.gonder({ t: "sohbet", metin: "Selam AMK naber" });
    expect((await i.bekle("sohbet", (m) => m.mesaj.koltuk !== -1)).mesaj.metin).toBe("Selam *** naber");
    i.gonder({ t: "sohbet", metin: "tekrar" });
    expect((await i.bekle("hata")).mesaj).toMatch(/saniyede en fazla bir/);
    i.kapat();
  });
});
