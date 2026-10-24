// Mağaza (Google Play Billing) için ince bir arayüz.
//
// Uygulamanın geri kalanı sadece bu dosyadaki Magaza arayüzünü bilir. Satın alma
// eklentisi değişirse sadece bu dosya değişir. İki uygulaması var:
//  - PlayMagazasi: telefonda @capgo/native-purchases ile gerçek Google Play.
//  - TestMagazasi: tarayıcıda ya da eklenti yokken; "test-..." jetonu üretir.
//    Sunucu SATIN_ALMA_TEST=1 ile çalışıyorsa bu jetonları kabul eder.
//
// Akış: urunleriGetir() → satinAl(urunId) → dönen jeton {t:"satinAlma"} ile sunucuya
// gönderilir. Sunucu jetonu Google'a sorar, çipi verir ve satın almayı TÜKETİR
// (consume); böylece aynı paket tekrar alınabilir. Telefon tüketme yapmaz.
import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";
import { CIP_PAKETLERI } from "@okey/kurallar";
import { DEPO, oku, yaz } from "./depo.ts";

/**
 * Sunucunun aynı jeton ikinci kez geldiğinde döndürdüğü hata metni
 * (packages/sunucu/src/magaza.ts). Açılışta yeniden gönderilen satın almalarda bu
 * hata beklenen bir durumdur; kullanıcıya gösterilmez.
 */
export const ZATEN_KULLANILDI = "Bu satın alma daha önce kullanıldı";

export interface MagazaUrunu {
  urunId: string;
  /** Play'in yerel para birimiyle biçimlediği fiyat ("₺49,99"). */
  fiyat: string;
}

export interface SatinAlmaSonucu {
  urunId: string;
  jeton: string;
}

export interface Magaza {
  /** Gerçek ödeme mi alınıyor? (Arayüzde "test" uyarısı göstermek için.) */
  readonly gercek: boolean;
  kullanilabilirMi(): Promise<boolean>;
  urunleriGetir(): Promise<MagazaUrunu[]>;
  /** Kullanıcı vazgeçerse null döner. */
  satinAl(urunId: string, oyuncuId: string): Promise<SatinAlmaSonucu | null>;
  /** Önceden ödenmiş ama sunucuya ulaşamamış (tüketilmemiş) satın almalar. */
  bekleyenler(): Promise<SatinAlmaSonucu[]>;
  /** Sunucunun çipini verdiği jetonu bu telefonda "tüketildi" olarak işaretler (bir daha gönderilmez). */
  tuketildiSay(jeton: string): Promise<void>;
}

/** Tüketildi sayılan jetonlar (en son 50 tane) Preferences'ta saklanır. */
async function tuketilenler(): Promise<string[]> {
  return (await oku<string[]>(DEPO.tuketilenJetonlar)) ?? [];
}

async function jetonuTuketildiSay(jeton: string) {
  const liste = await tuketilenler();
  if (!liste.includes(jeton)) await yaz(DEPO.tuketilenJetonlar, [...liste, jeton].slice(-50));
}

const URUN_IDLERI = CIP_PAKETLERI.map((p) => p.urunId);

class PlayMagazasi implements Magaza {
  readonly gercek = true;

  async kullanilabilirMi() {
    try {
      return (await NativePurchases.isBillingSupported()).isBillingSupported;
    } catch {
      return false;
    }
  }

  async urunleriGetir(): Promise<MagazaUrunu[]> {
    const { products } = await NativePurchases.getProducts({
      productIdentifiers: URUN_IDLERI,
      productType: PURCHASE_TYPE.INAPP,
    });
    return products.map((p) => ({ urunId: p.identifier, fiyat: p.priceString }));
  }

  async satinAl(urunId: string, oyuncuId: string): Promise<SatinAlmaSonucu | null> {
    try {
      const islem = await NativePurchases.purchaseProduct({
        productIdentifier: urunId,
        productType: PURCHASE_TYPE.INAPP,
        // Play'deki siparişi hesaba bağlar; sunucu doğrularken karşılaştırabilir.
        appAccountToken: oyuncuId.replace(/-/g, "").slice(0, 64),
        // Onaylama ve tüketme sunucuda yapılır (çip verildikten SONRA).
        isConsumable: false,
        autoAcknowledgePurchases: false,
      });
      if (!islem.purchaseToken) throw new Error("Satın alma jetonu gelmedi");
      return { urunId, jeton: islem.purchaseToken };
    } catch (e) {
      if (vazgectiMi(e)) return null;
      throw e;
    }
  }

  async bekleyenler(): Promise<SatinAlmaSonucu[]> {
    try {
      const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP });
      const tuketilen = await tuketilenler();
      return purchases
        .filter((p) => p.purchaseToken && URUN_IDLERI.includes(p.productIdentifier) && !tuketilen.includes(p.purchaseToken))
        .map((p) => ({ urunId: p.productIdentifier, jeton: p.purchaseToken! }));
    } catch {
      return [];
    }
  }

  tuketildiSay = jetonuTuketildiSay;
}

function vazgectiMi(e: unknown): boolean {
  const m = String((e as { message?: string })?.message ?? e).toLowerCase();
  return m.includes("cancel") || m.includes("iptal");
}

/** Tarayıcıda geliştirme için sahte mağaza. Fiyatlar örnek amaçlıdır. */
class TestMagazasi implements Magaza {
  readonly gercek = false;
  private static FIYATLAR: Record<string, string> = {
    cip_25k: "₺29,99",
    cip_100k: "₺89,99",
    cip_500k: "₺349,99",
    cip_2m: "₺1.099,99",
  };

  async kullanilabilirMi() {
    return true;
  }

  async urunleriGetir() {
    return URUN_IDLERI.map((urunId) => ({ urunId, fiyat: TestMagazasi.FIYATLAR[urunId] ?? "₺—" }));
  }

  async satinAl(urunId: string): Promise<SatinAlmaSonucu> {
    await new Promise((r) => setTimeout(r, 600)); // ödeme penceresi hissi
    const rastgele = crypto.getRandomValues(new Uint32Array(2)).join("");
    return { urunId, jeton: `test-${rastgele}` };
  }

  async bekleyenler() {
    return [];
  }

  tuketildiSay = jetonuTuketildiSay;
}

export const magaza: Magaza = Capacitor.isPluginAvailable("NativePurchases") && Capacitor.isNativePlatform()
  ? new PlayMagazasi()
  : new TestMagazasi();
