import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BASLANGIC_CIPI } from "@okey/kurallar";
import { testSunucusu, TestIstemcisi } from "./yardimci.ts";

let sunucu: Awaited<ReturnType<typeof testSunucusu>>;
beforeEach(async () => {
  sunucu = await testSunucusu({ saniyeBasinaMesaj: 20 });
});
afterEach(async () => {
  await sunucu.kapat();
});

describe("hesap", () => {
  it("bilgisiz girişte yeni hesap açar; veritabanında anahtarın sadece özeti durur", async () => {
    const { i, h } = await TestIstemcisi.girisYap(sunucu.adres, { ad: "Ayla" });
    expect(h.oyuncuId).toMatch(/^[0-9a-f-]{36}$/);
    expect(h.anahtar.length).toBeGreaterThanOrEqual(43);
    expect(h.profil).toMatchObject({ ad: "Ayla", cip: BASLANGIC_CIPI, seviye: 1, gunlukHediyeAlinabilir: true });
    const satir = sunucu.vt.oyuncuGetir(h.oyuncuId)!;
    expect(satir.anahtar_ozeti).toMatch(/^[0-9a-f]{64}$/);
    expect(satir.anahtar_ozeti).not.toContain(h.anahtar);
    expect(sunucu.vt.cipHareketleri(h.oyuncuId)).toEqual([expect.objectContaining({ miktar: BASLANGIC_CIPI, sebep: "baslangic" })]);
    i.kapat();
  });

  it("doğru anahtarla tekrar girer, yanlış anahtarı reddeder", async () => {
    const { i, h } = await TestIstemcisi.girisYap(sunucu.adres);
    i.kapat();

    const { i: i2, h: h2 } = await TestIstemcisi.girisYap(sunucu.adres, { oyuncuId: h.oyuncuId, anahtar: h.anahtar });
    expect(h2.oyuncuId).toBe(h.oyuncuId);
    i2.kapat();

    const i3 = await TestIstemcisi.baglan(sunucu.adres);
    i3.gonder({ t: "giris", ad: "Deneme", surum: 1, oyuncuId: h.oyuncuId, anahtar: "yanlis-anahtar-yanlis-anahtar" });
    expect((await i3.bekle("hata")).mesaj).toBe("Giriş bilgileri hatalı");
    i3.gonder({ t: "salonlar" });
    expect((await i3.bekle("hata")).mesaj).toBe("Önce giriş yapmalısın");
    i3.kapat();
  });

  it("aynı hesap ikinci cihazdan girince eski bağlantı kapanır", async () => {
    const { i, h } = await TestIstemcisi.girisYap(sunucu.adres);
    const { i: i2 } = await TestIstemcisi.girisYap(sunucu.adres, { oyuncuId: h.oyuncuId, anahtar: h.anahtar });
    await expect(i.bekle("pong")).rejects.toThrow(/kapandı/);
    i2.gonder({ t: "ping" });
    await i2.bekle("pong");
    i2.kapat();
  });

  it("geçersiz mesajlara Türkçe hata döner", async () => {
    const { i } = await TestIstemcisi.girisYap(sunucu.adres);
    i.gonderHam("{bozuk json");
    expect((await i.bekle("hata")).mesaj).toMatch(/JSON/);
    i.gonder({ t: "uydurma" });
    expect((await i.bekle("hata")).mesaj).toBe("Bilinmeyen mesaj türü");
    i.gonderHam(JSON.stringify({ t: "hizliOyun", salon: "saray" }));
    expect((await i.bekle("hata")).mesaj).toBe("salon geçersiz");
    i.gonder({ t: "adDegistir", ad: "x" });
    expect((await i.bekle("hata")).mesaj).toBe("Ad en az 2 harf olmalı");
    i.gonder({ t: "hamle", eylem: { tur: "at", tas: 999 } });
    expect((await i.bekle("hata")).mesaj).toMatch(/eylem\.tas/);
    i.gonderHam(JSON.stringify({ t: "sohbet", metin: "a".repeat(9000) }));
    expect((await i.bekle("hata")).mesaj).toBe("Mesaj çok büyük");
    i.gonder({ t: "ping" });
    await i.bekle("pong"); // bağlantı hâlâ açık
    i.kapat();
  });

  it("hız sınırını aşan mesajlar işlenmez", async () => {
    const { i } = await TestIstemcisi.girisYap(sunucu.adres);
    for (let n = 0; n < 30; n++) i.gonder({ t: "ping" });
    expect((await i.bekle("hata")).mesaj).toBe("Çok hızlı mesaj gönderiyorsun");
    await new Promise((r) => setTimeout(r, 100));
    expect(i.gelenler.filter((m) => m.t === "pong").length).toBeLessThan(20);
    i.kapat();
  });

  it("ad ve etiket değiştirir; açılmamış süs reddedilir", async () => {
    const { i } = await TestIstemcisi.girisYap(sunucu.adres);
    i.gonder({ t: "adDegistir", ad: "Yeni Ad" });
    expect((await i.bekle("profil")).profil.ad).toBe("Yeni Ad");
    i.gonder({ t: "etiketSec", cerceve: "altin", rozet: "yok", unvan: "acemi" });
    expect((await i.bekle("hata")).mesaj).toBe("Bu süsü henüz açmadın");
    i.gonder({ t: "etiketSec", cerceve: "sade", rozet: "yok", unvan: "yok" });
    expect((await i.bekle("profil")).profil.etiket.unvan).toBe("yok");
    i.kapat();
  });

  it("hesap silinince tüm veri gider ve eski bilgilerle girilemez", async () => {
    const { i, h } = await TestIstemcisi.girisYap(sunucu.adres);
    i.gonder({ t: "hesapSil" });
    await i.bekle("hesapSilindi");
    await expect(i.bekle("pong")).rejects.toThrow(/kapandı/);
    expect(sunucu.vt.oyuncuGetir(h.oyuncuId)).toBeUndefined();
    expect(sunucu.vt.cipHareketleri(h.oyuncuId)).toEqual([]);

    const i2 = await TestIstemcisi.baglan(sunucu.adres);
    i2.gonder({ t: "giris", ad: "Deneme", surum: 1, oyuncuId: h.oyuncuId, anahtar: h.anahtar });
    expect((await i2.bekle("hata")).mesaj).toBe("Giriş bilgileri hatalı");
    i2.kapat();
  });

  it("GET /saglik çalışır", async () => {
    const c = await fetch(`http://127.0.0.1:${sunucu.port}/saglik`);
    expect(await c.json()).toEqual({ durum: "ok" });
  });
});
