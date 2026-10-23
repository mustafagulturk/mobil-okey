import { generateKeyPairSync, createVerify, sign } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { BASLANGIC_CIPI, GUNLUK_HEDIYE, GUNLUK_REKLAM_SINIRI, REKLAM_ODULU } from "@okey/kurallar";
import { GooglePlayIstemcisi, Magaza } from "../src/magaza.ts";
import { kufurMaskele } from "../src/sohbet.ts";
import { Veritabani } from "../src/veritabani.ts";
import { testSunucusu, TestIstemcisi } from "./yardimci.ts";

let sunucu: Awaited<ReturnType<typeof testSunucusu>> | null = null;
afterEach(async () => {
  await sunucu?.kapat();
  sunucu = null;
});

describe("günlük hediye, görevler, sıralama", () => {
  it("günlük hediye günde bir kez alınır, ertesi gün yenilenir", async () => {
    let saat = Date.UTC(2026, 9, 23, 10);
    sunucu = await testSunucusu({ simdi: () => saat });
    const { i } = await TestIstemcisi.girisYap(sunucu.adres);
    i.gonder({ t: "gunlukHediye" });
    const p = (await i.bekle("profil")).profil;
    expect(p.cip).toBe(BASLANGIC_CIPI + GUNLUK_HEDIYE);
    expect(p.gunlukHediyeAlinabilir).toBe(false);
    i.gonder({ t: "gunlukHediye" });
    expect((await i.bekle("hata")).mesaj).toMatch(/zaten aldın/);

    saat += 24 * 3600_000;
    i.gonder({ t: "gunlukHediye" });
    expect((await i.bekle("profil")).profil.cip).toBe(BASLANGIC_CIPI + 2 * GUNLUK_HEDIYE);
    i.kapat();
  });

  it("görevler listelenir, tamamlanmamış görevin ödülü alınamaz", async () => {
    sunucu = await testSunucusu();
    const { i } = await TestIstemcisi.girisYap(sunucu.adres);
    i.gonder({ t: "gorevler" });
    const g = (await i.bekle("gorevler")).gorevler;
    expect(g).toHaveLength(3);
    i.gonder({ t: "gorevOdulu", gorevId: g[0].id });
    expect((await i.bekle("hata")).mesaj).toBe("Görev henüz tamamlanmadı");
    i.kapat();
  });

  it("sıralama ilk 50'yi ve oyuncunun kendi satırını döner", async () => {
    sunucu = await testSunucusu({ satinAlmaTest: true });
    const { i: zengin } = await TestIstemcisi.girisYap(sunucu.adres, { ad: "Zengin" });
    zengin.gonder({ t: "satinAlma", urunId: "cip_100k", satinAlmaJetonu: "test-sira" });
    await zengin.bekle("profil");
    const { i, h } = await TestIstemcisi.girisYap(sunucu.adres, { ad: "Ben" });
    i.gonder({ t: "siralama", tur: "cip" });
    const s = await i.bekle("siralama");
    expect(s.satirlar[0]).toMatchObject({ sira: 1, oyuncu: { ad: "Zengin" }, deger: BASLANGIC_CIPI + 100_000 });
    expect(s.ben).toMatchObject({ sira: 2, oyuncu: { id: h.oyuncuId }, deger: BASLANGIC_CIPI });
    expect(JSON.stringify(s)).not.toMatch(/anahtar/);
    i.kapat();
    zengin.kapat();
  });
});

describe("mağaza", () => {
  it("test modunda 'test-' jetonu kabul edilir, aynı jeton ikinci kez reddedilir", async () => {
    sunucu = await testSunucusu({ satinAlmaTest: true });
    const { i, h } = await TestIstemcisi.girisYap(sunucu.adres);
    i.gonder({ t: "satinAlma", urunId: "cip_25k", satinAlmaJetonu: "test-123" });
    expect((await i.bekle("profil")).profil.cip).toBe(BASLANGIC_CIPI + 25_000);
    i.gonder({ t: "satinAlma", urunId: "cip_25k", satinAlmaJetonu: "test-123" });
    expect((await i.bekle("hata")).mesaj).toBe("Bu satın alma daha önce kullanıldı");
    i.gonder({ t: "satinAlma", urunId: "cip_sonsuz", satinAlmaJetonu: "test-456" });
    expect((await i.bekle("hata")).mesaj).toBe("Böyle bir ürün yok");
    i.gonder({ t: "satinAlma", urunId: "cip_25k", satinAlmaJetonu: "gercek-jeton" });
    expect((await i.bekle("hata")).mesaj).toBe("Mağaza şu an kullanılamıyor");
    expect(sunucu.vt.oyuncuGetir(h.oyuncuId)!.cip).toBe(BASLANGIC_CIPI + 25_000);
    i.kapat();
  });

  it("test modu kapalıyken 'test-' jetonu kabul edilmez", async () => {
    sunucu = await testSunucusu({ satinAlmaTest: false });
    const { i } = await TestIstemcisi.girisYap(sunucu.adres);
    i.gonder({ t: "satinAlma", urunId: "cip_25k", satinAlmaJetonu: "test-123" });
    expect((await i.bekle("hata")).mesaj).toBe("Mağaza şu an kullanılamıyor");
    i.kapat();
  });

  it("Google Play ile doğrular: imzalı JWT, satın alma sorgusu ve tüketme", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const istekler: { url: string; init?: RequestInit }[] = [];
    const sahteFetch = (async (url: string, init?: RequestInit) => {
      istekler.push({ url, init });
      if (url.endsWith("/token")) return Response.json({ access_token: "erisim-1", expires_in: 3600 });
      if (url.endsWith(":consume")) return new Response("", { status: 204 });
      if (url.includes("/tokens/iptal")) return Response.json({ purchaseState: 1 });
      return Response.json({ purchaseState: 0, consumptionState: 0 });
    }) as typeof fetch;
    const google = new GooglePlayIstemcisi(
      { client_email: "sunucu@proje.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) as string },
      "dev.mustafagulturk.okey",
      sahteFetch,
    );
    const vt = new Veritabani(":memory:");
    vt.oyuncuOlustur("o1", "Ayla", "ozet", 0, 0);
    const magaza = new Magaza(vt, google, false, () => 0, () => {});

    expect(await magaza.satinAl("o1", "cip_100k", "jeton-1")).toEqual({ tamam: true, cip: 100_000 });
    expect(await magaza.satinAl("o1", "cip_100k", "jeton-1")).toMatchObject({ tamam: false });
    expect(await magaza.satinAl("o1", "cip_25k", "iptal")).toEqual({ tamam: false, hata: "Satın alma iptal edilmiş" });
    expect(vt.oyuncuGetir("o1")!.cip).toBe(100_000);

    // Erişim jetonu bir kez alınır, sonra önbellekten kullanılır.
    expect(istekler.filter((x) => x.url.endsWith("/token"))).toHaveLength(1);
    const jwt = new URLSearchParams(istekler[0].init!.body as string).get("assertion")!;
    const [b, y, imza] = jwt.split(".");
    expect(createVerify("RSA-SHA256").update(`${b}.${y}`).verify(publicKey, imza, "base64url")).toBe(true);
    expect(JSON.parse(Buffer.from(y, "base64url").toString())).toMatchObject({
      iss: "sunucu@proje.iam.gserviceaccount.com",
      scope: "https://www.googleapis.com/auth/androidpublisher",
    });
    expect(istekler[1].url).toBe(
      "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/dev.mustafagulturk.okey/purchases/products/cip_100k/tokens/jeton-1",
    );
    expect(istekler[2]).toMatchObject({ url: istekler[1].url + ":consume", init: { method: "POST" } });
    vt.kapat();
  });
});

describe("ödüllü reklam (AdMob SSV)", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const imzala = (sorgu: string, anahtarId = "42") =>
    `${sorgu}&signature=${sign("sha256", Buffer.from(sorgu), { key: privateKey, dsaEncoding: "der" }).toString("base64url")}&key_id=${anahtarId}`;
  const sorgu = (oyuncuId: string, islem: string) =>
    `ad_network=5450213213286189855&ad_unit=1234&reward_amount=1&reward_item=cip&timestamp=1700000000000&transaction_id=${islem}&user_id=${oyuncuId}`;

  it("geçerli imzayla ödül verir; geçersiz imzayı ve tekrarı reddeder; günlük sınırı uygular", async () => {
    sunucu = await testSunucusu({ reklamAnahtarlari: async () => new Map([["42", publicKey]]) });
    const { i, h } = await TestIstemcisi.girisYap(sunucu.adres);
    const istek = (q: string) => fetch(`http://127.0.0.1:${sunucu!.port}/reklam-odulu?${q}`);

    const c = await istek(imzala(sorgu(h.oyuncuId, "islem-1")));
    expect(c.status).toBe(200);
    expect(await c.json()).toEqual({ durum: "verildi" });
    expect((await i.bekle("bildirim")).metin).toMatch(/Reklam ödülü/);
    const p = (await i.bekle("profil")).profil;
    expect(p.cip).toBe(BASLANGIC_CIPI + REKLAM_ODULU);
    expect(p.kalanReklamHakki).toBe(GUNLUK_REKLAM_SINIRI - 1);

    // Aynı işlem kimliği tekrar gelirse ödül yok.
    expect(await (await istek(imzala(sorgu(h.oyuncuId, "islem-1")))).json()).toEqual({ durum: "tekrar" });

    // İmzadan sonra değiştirilen sorgu (başka işlem kimliği) reddedilir.
    const sahte = imzala(sorgu(h.oyuncuId, "islem-2")).replace("islem-2", "islem-3");
    expect((await istek(sahte)).status).toBe(403);
    // Bilinmeyen anahtar ve imzasız istek reddedilir.
    expect((await istek(imzala(sorgu(h.oyuncuId, "islem-4"), "99"))).status).toBe(403);
    expect((await istek(sorgu(h.oyuncuId, "islem-5"))).status).toBe(403);

    for (let n = 2; n <= GUNLUK_REKLAM_SINIRI; n++) await istek(imzala(sorgu(h.oyuncuId, `gun-${n}`)));
    expect(await (await istek(imzala(sorgu(h.oyuncuId, "fazla")))).json()).toEqual({ durum: "sinir" });
    expect(sunucu.vt.oyuncuGetir(h.oyuncuId)!.cip).toBe(BASLANGIC_CIPI + GUNLUK_REKLAM_SINIRI * REKLAM_ODULU);
    i.kapat();
  });
});

describe("sohbet filtresi", () => {
  it("küfürleri maskeler, masum kelimelere dokunmaz", () => {
    expect(kufurMaskele("oha amk ne şans")).toBe("oha *** ne şans");
    expect(kufurMaskele("SİKTİR git, orospuluk yapma")).toBe("*** git, *** yapma");
    expect(kufurMaskele("çok sıkıcı bir el, götürdün yine")).toBe("çok sıkıcı bir el, götürdün yine");
  });
});
