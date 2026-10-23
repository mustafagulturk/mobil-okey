// Ödüllü reklam (AdMob) için ince bir arayüz.
//
// Ödülü TELEFON vermez: AdMob, reklam izlenince sunucunun SSV (sunucu taraflı
// doğrulama) adresine imzalı bir istek atar, sunucu çipi verir ve güncel profili
// gönderir. Telefon sadece reklamı gösterir; userId olarak oyuncuId'yi iletir ki
// sunucu ödülü kime vereceğini bilsin.
//
// İki uygulaması var: AdMobReklam (telefon) ve TestReklam (tarayıcı: 2 sn bekleyen
// sahte pencere; sunucuya SSV isteği gitmediği için ödül de gelmez).
import { Capacitor } from "@capacitor/core";
import { AdMob, AdmobConsentStatus } from "@capacitor-community/admob";

/** Google'ın herkese açık test reklam birimi. Gerçek kimlik VITE_ADMOB_ODULLU ile verilir. */
const TEST_ODULLU_BIRIM = "ca-app-pub-3940256099942544/5224354917";
const ODULLU_BIRIM = import.meta.env.VITE_ADMOB_ODULLU || TEST_ODULLU_BIRIM;

export interface Reklam {
  /** true ise gerçek reklam ağı kullanılıyor; false ise tarayıcı taklidi (ödül gelmez). */
  readonly gercek: boolean;
  /** Uygulama açılışında bir kez: SDK'yı başlatır, gerekiyorsa (AB) izin formunu gösterir. */
  hazirla(): Promise<void>;
  /** Reklamı gösterir. Kullanıcı sonuna kadar izlediyse true. */
  odulluGoster(oyuncuId: string): Promise<boolean>;
}

class AdMobReklam implements Reklam {
  readonly gercek = true;
  private hazir = false;

  async hazirla() {
    if (this.hazir) return;
    await AdMob.initialize({ initializeForTesting: ODULLU_BIRIM === TEST_ODULLU_BIRIM });
    // UMP (Kullanıcı Mesajlaşma Platformu): AB/İngiltere kullanıcılarından reklam izni zorunlu.
    try {
      const bilgi = await AdMob.requestConsentInfo();
      if (bilgi.isConsentFormAvailable && bilgi.status === AdmobConsentStatus.REQUIRED) {
        await AdMob.showConsentForm();
      }
    } catch (e) {
      console.warn("Reklam izni alınamadı", e);
    }
    this.hazir = true;
  }

  async odulluGoster(oyuncuId: string) {
    await this.hazirla();
    await AdMob.prepareRewardVideoAd({
      adId: ODULLU_BIRIM,
      isTesting: ODULLU_BIRIM === TEST_ODULLU_BIRIM,
      ssv: { userId: oyuncuId },
    });
    const odul = await AdMob.showRewardVideoAd();
    return Boolean(odul && odul.amount >= 0);
  }
}

class TestReklam implements Reklam {
  readonly gercek = false;
  async hazirla() {}
  async odulluGoster() {
    // Arayüz 2 saniyelik "reklam" penceresini kendisi gösterir; burada sadece bekleriz.
    await new Promise((r) => setTimeout(r, 2000));
    return true;
  }
}

export const reklam: Reklam = Capacitor.isNativePlatform() ? new AdMobReklam() : new TestReklam();
