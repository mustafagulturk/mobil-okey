// Mağaza: Google Play satın almalarının sunucuda doğrulanması.
//
// Telefon, Google Play'den aldığı satın alma jetonunu sunucuya gönderir. Telefona
// güvenilmez: çip ancak sunucu jetonu Google Play Developer API'ye sorup "ödendi"
// cevabını aldıktan sonra verilir. Akış:
//   1. Ürün CIP_PAKETLERI'nde var mı? Jeton daha önce kullanıldı mı?
//   2. Servis hesabı anahtarıyla RS256 imzalı bir JWT üret, Google'dan erişim jetonu al
//      (bir saat geçerli, önbellekte tutulur). Ek kütüphane yok, sadece node:crypto.
//   3. purchases.products.get ile satın almayı sor: purchaseState 0 (ödendi) olmalı.
//   4. Çipi ver ve jetonu kaydet (tek transaction; jeton benzersiz indeksli olduğu için
//      aynı anda gelen iki istekten sadece biri çip alır).
//   5. Ürün henüz tüketilmediyse Google'a "tüketildi" de ki oyuncu tekrar satın alabilsin.
//
// Geliştirme için SATIN_ALMA_TEST=1 iken "test-" ile başlayan jetonlar Google'a
// sorulmadan kabul edilir. Üretimde bu mod kapalı olmalıdır (açılışta loglanır).

import { createSign } from "node:crypto";
import { CIP_PAKETLERI } from "@okey/kurallar";
import { ozet } from "./hesap.ts";
import type { Veritabani } from "./veritabani.ts";

const KAPSAM = "https://www.googleapis.com/auth/androidpublisher";
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

export interface ServisHesabi {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

/** purchases.products.get cevabının bizi ilgilendiren kısmı. */
export interface UrunSatinAlma {
  purchaseState?: number; // 0: ödendi, 1: iptal, 2: beklemede
  consumptionState?: number; // 0: tüketilmedi, 1: tüketildi
  orderId?: string;
}

/** Google Play Developer API ile konuşan küçük istemci. */
export class GooglePlayIstemcisi {
  private erisim: { jeton: string; bitis: number } | null = null;

  constructor(
    private readonly hesap: ServisHesabi,
    private readonly paketAdi: string,
    private readonly fetchFn: typeof fetch,
    private readonly simdi: () => number = Date.now,
  ) {}

  /** OAuth erişim jetonu: servis hesabının imzaladığı JWT karşılığında alınır, süresi bitene kadar önbellekte. */
  async erisimJetonu(): Promise<string> {
    if (this.erisim && this.erisim.bitis > this.simdi() + 60_000) return this.erisim.jeton;
    const tokenUri = this.hesap.token_uri ?? "https://oauth2.googleapis.com/token";
    const an = Math.floor(this.simdi() / 1000);
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const govde = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
      iss: this.hesap.client_email,
      scope: KAPSAM,
      aud: tokenUri,
      iat: an,
      exp: an + 3600,
    })}`;
    const imza = createSign("RSA-SHA256").update(govde).sign(this.hesap.private_key, "base64url");
    const cevap = await this.fetchFn(tokenUri, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${govde}.${imza}`,
      }).toString(),
    });
    if (!cevap.ok) throw new Error(`Google erişim jetonu alınamadı (${cevap.status})`);
    const j = (await cevap.json()) as { access_token: string; expires_in: number };
    this.erisim = { jeton: j.access_token, bitis: this.simdi() + j.expires_in * 1000 };
    return j.access_token;
  }

  private adres(urunId: string, jeton: string) {
    return `${API}/${encodeURIComponent(this.paketAdi)}/purchases/products/${encodeURIComponent(urunId)}/tokens/${encodeURIComponent(jeton)}`;
  }

  /** Satın almayı Google'a sorar. Google jetonu tanımıyorsa null döner. */
  async satinAlmaGetir(urunId: string, jeton: string): Promise<UrunSatinAlma | null> {
    const cevap = await this.fetchFn(this.adres(urunId, jeton), {
      headers: { authorization: `Bearer ${await this.erisimJetonu()}` },
    });
    if (cevap.status === 400 || cevap.status === 404 || cevap.status === 410) return null;
    if (!cevap.ok) throw new Error(`Google satın alma sorgusu başarısız (${cevap.status})`);
    return (await cevap.json()) as UrunSatinAlma;
  }

  async tuket(urunId: string, jeton: string): Promise<void> {
    const cevap = await this.fetchFn(`${this.adres(urunId, jeton)}:consume`, {
      method: "POST",
      headers: { authorization: `Bearer ${await this.erisimJetonu()}` },
    });
    if (!cevap.ok) throw new Error(`Google tüketme isteği başarısız (${cevap.status})`);
  }
}

export type SatinAlmaSonucu = { tamam: true; cip: number } | { tamam: false; hata: string };

export class Magaza {
  constructor(
    private readonly vt: Veritabani,
    private readonly google: GooglePlayIstemcisi | null,
    private readonly testModu: boolean,
    private readonly simdi: () => number,
    private readonly gunluk: (m: string) => void,
  ) {}

  async satinAl(oyuncuId: string, urunId: string, jeton: string): Promise<SatinAlmaSonucu> {
    const paket = CIP_PAKETLERI.find((p) => p.urunId === urunId);
    if (!paket) return { tamam: false, hata: "Böyle bir ürün yok" };
    const jetonOzeti = ozet(jeton);
    const kullanildi = { tamam: false, hata: "Bu satın alma daha önce kullanıldı" } as const;
    if (this.vt.satinAlmaVarMi(jetonOzeti)) return kullanildi;

    let tuketilmeli = false;
    if (this.testModu && jeton.startsWith("test-")) {
      // Geliştirme modu: Google'a sorulmaz.
    } else if (!this.google) {
      return { tamam: false, hata: "Mağaza şu an kullanılamıyor" };
    } else {
      let s: UrunSatinAlma | null;
      try {
        s = await this.google.satinAlmaGetir(urunId, jeton);
      } catch (e) {
        this.gunluk(`Satın alma doğrulanamadı: ${(e as Error).message}`);
        return { tamam: false, hata: "Satın alma şu an doğrulanamadı, biraz sonra tekrar dene" };
      }
      if (!s) return { tamam: false, hata: "Satın alma bulunamadı" };
      if (s.purchaseState === 2) return { tamam: false, hata: "Ödeme henüz tamamlanmadı" };
      if (s.purchaseState !== 0) return { tamam: false, hata: "Satın alma iptal edilmiş" };
      tuketilmeli = s.consumptionState === 0;
    }

    if (!this.vt.satinAlmaKaydet(jetonOzeti, oyuncuId, urunId, paket.cip, this.simdi())) return kullanildi;
    this.gunluk(`Satın alma: ${oyuncuId} ${urunId} +${paket.cip}`);

    if (tuketilmeli && this.google) {
      // Tüketme başarısız olsa bile çip bir kez verildi; jeton kayıtlı olduğu için tekrar verilmez.
      await this.google.tuket(urunId, jeton).catch((e) => this.gunluk(`Tüketme başarısız: ${(e as Error).message}`));
    }
    return { tamam: true, cip: paket.cip };
  }
}
