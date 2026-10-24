// OnlineBaglanti: WebSocket ile gerçek oyun sunucusu.
//
//  - Bağlanınca hemen "giris" mesajı gönderir (hesap varsa oyuncuId + anahtar ile).
//  - Bağlantı koparsa artan aralıklarla (1, 2, 4 ... en fazla 30 sn) yeniden bağlanır
//    ve tekrar giriş yapar; sunucu oyuncu bir odadaysa odanın son halini yeniden gönderir.
//  - Durum: ilk ULASILAMADI_SURE boyunca "baglaniyor" (sunucu uyanıyor olabilir), sonra
//    bağlanana kadar "koptu" (arayüz "Sunucuya ulaşılamadı" der). Denemeler arka planda
//    sürer; bağlanınca durum kendiliğinden "bagli" olur. Arada bir "baglaniyor"a dönüp
//    ekranı titretmez.
//  - Tek bir deneme DENEME_ZAMAN_ASIMI içinde açılmazsa bırakılıp yeniden denenir
//    (erişilemeyen bir IP'de soket dakikalarca "bağlanıyor"da kalabilir). Süre uzun
//    tutuldu: ücretsiz sunucular (Render) uykudan 30-50 sn'de uyanır.
//  - 20 saniyede bir "ping" atar. Uzun süre "pong" gelmezse bağlantıyı ölü sayar
//    (telefon uykudan uyanınca ya da Wi-Fi değişince soket sessizce ölebilir).
import { type IstemciMesaji, PROTOKOL_SURUMU, type SunucuMesaji } from "@okey/kurallar";
import { type Baglanti, type BaglantiDurumu, Yayinci } from "./baglanti.ts";

const PING_ARALIGI = 20_000;
const OLU_SURE = 45_000;
/** Bu süre içinde bağlanamazsak arayüze "ulaşılamadı" deriz (denemeler sürer). */
export const ULASILAMADI_SURE = 7_000;
const DENEME_ZAMAN_ASIMI = 40_000;
const EN_UZUN_BEKLEME = 30_000;

export interface GirisBilgisi {
  ad: string;
  oyuncuId?: string;
  anahtar?: string;
}

export class OnlineBaglanti extends Yayinci implements Baglanti {
  private soket: WebSocket | null = null;
  private deneme = 0;
  private kapatildi = false;
  private yenidenZamanlayici: ReturnType<typeof setTimeout> | null = null;
  private pingZamanlayici: ReturnType<typeof setInterval> | null = null;
  private ulasilamadiZamanlayici: ReturnType<typeof setTimeout> | null = null;
  private denemeZamanlayici: ReturnType<typeof setTimeout> | null = null;
  /** Arayüze en son bildirilen durum (aynısını tekrar yaymamak için). */
  private durum: BaglantiDurumu | null = null;
  private sonMesaj = 0;
  /** Bağlantı yokken gönderilen mesajlar (ör. "salonlar") bağlanınca gider. */
  private kuyruk: IstemciMesaji[] = [];

  constructor(
    private readonly url: string,
    private giris: GirisBilgisi,
  ) {
    super();
    this.ulasilamadiSay();
    this.baglan();
  }

  /** Sunucu "hosgeldin" ile yeni kimlik verince sonraki yeniden bağlanmalarda kullanılır. */
  girisGuncelle(giris: GirisBilgisi) {
    this.giris = giris;
  }

  gonder(mesaj: IstemciMesaji) {
    if (this.soket?.readyState === WebSocket.OPEN) this.soket.send(JSON.stringify(mesaj));
    else if (mesaj.t !== "ping" && mesaj.t !== "hamle") this.kuyruk.push(mesaj);
  }

  kapat() {
    this.kapatildi = true;
    this.temizle();
    if (this.ulasilamadiZamanlayici) clearTimeout(this.ulasilamadiZamanlayici);
    this.ulasilamadiZamanlayici = null;
    this.soket?.close();
    this.soket = null;
  }

  private baglan() {
    if (this.kapatildi) return;
    // "koptu" (ulaşılamadı) gösteriliyorsa her denemede "baglaniyor"a dönülmez.
    if (this.durum !== "koptu") this.durumBildir("baglaniyor");
    let soket: WebSocket;
    try {
      soket = new WebSocket(this.url);
    } catch {
      // Geçersiz adres: beklemenin anlamı yok, hemen "ulaşılamadı" de.
      this.durumBildir("koptu");
      this.yenidenBaglan();
      return;
    }
    this.soket = soket;
    // Takılı kalan denemeyi bırak; onclose yeniden dener.
    this.denemeZamanlayici = setTimeout(() => {
      if (this.soket === soket && soket.readyState === WebSocket.CONNECTING) soket.close();
    }, DENEME_ZAMAN_ASIMI);

    soket.onopen = () => {
      if (this.denemeZamanlayici) clearTimeout(this.denemeZamanlayici);
      this.denemeZamanlayici = null;
      if (this.ulasilamadiZamanlayici) clearTimeout(this.ulasilamadiZamanlayici);
      this.ulasilamadiZamanlayici = null;
      this.deneme = 0;
      this.sonMesaj = Date.now();
      const { ad, oyuncuId, anahtar } = this.giris;
      soket.send(JSON.stringify({ t: "giris", ad, surum: PROTOKOL_SURUMU, oyuncuId, anahtar } satisfies IstemciMesaji));
      for (const m of this.kuyruk.splice(0)) soket.send(JSON.stringify(m));
      this.pingBaslat();
      this.durumBildir("bagli");
    };

    soket.onmessage = (olay) => {
      this.sonMesaj = Date.now();
      let mesaj: SunucuMesaji;
      try {
        mesaj = JSON.parse(String(olay.data));
      } catch {
        return;
      }
      this.mesajYay(mesaj);
    };

    soket.onclose = () => {
      if (this.soket !== soket) return;
      this.soket = null;
      const bagliydi = this.durum === "bagli";
      this.temizle();
      if (!this.kapatildi) {
        // Kurulu bir bağlantı koptuysa: kısa bir süre "baglaniyor", sonra "ulaşılamadı".
        if (bagliydi) {
          this.durumBildir("baglaniyor");
          this.ulasilamadiSay();
        }
        this.yenidenBaglan();
      }
    };
    // onerror'dan sonra her zaman onclose gelir; yeniden bağlanma orada yapılır.
    soket.onerror = () => {};
  }

  private yenidenBaglan() {
    if (this.kapatildi || this.yenidenZamanlayici) return;
    const bekle = Math.min(EN_UZUN_BEKLEME, 1000 * 2 ** this.deneme++);
    this.yenidenZamanlayici = setTimeout(() => {
      this.yenidenZamanlayici = null;
      this.baglan();
    }, bekle);
  }

  /** Kopuk görünen bağlantıyı beklemeden hemen yeniden dener (ör. "Tekrar dene" düğmesi). */
  simdiDene() {
    if (this.kapatildi || this.soket?.readyState === WebSocket.OPEN) return;
    // Süren (belki takılı) bir deneme varsa bırak; onclose'u beklemeden yenisini başlat.
    const eski = this.soket;
    this.soket = null;
    eski?.close();
    this.temizle();
    this.deneme = 0;
    this.durumBildir("baglaniyor");
    this.ulasilamadiSay();
    this.baglan();
  }

  private durumBildir(d: BaglantiDurumu) {
    if (this.durum === d) return;
    this.durum = d;
    this.durumYay(d);
  }

  /** ULASILAMADI_SURE içinde bağlanılamazsa durumu "koptu" yapar. */
  private ulasilamadiSay() {
    if (this.ulasilamadiZamanlayici) clearTimeout(this.ulasilamadiZamanlayici);
    this.ulasilamadiZamanlayici = setTimeout(() => {
      this.ulasilamadiZamanlayici = null;
      if (!this.kapatildi && this.durum !== "bagli") this.durumBildir("koptu");
    }, ULASILAMADI_SURE);
  }

  private pingBaslat() {
    this.pingZamanlayici = setInterval(() => {
      if (Date.now() - this.sonMesaj > OLU_SURE) {
        this.soket?.close(); // onclose yeniden bağlanır
        return;
      }
      this.gonder({ t: "ping" });
    }, PING_ARALIGI);
  }

  private temizle() {
    if (this.pingZamanlayici) clearInterval(this.pingZamanlayici);
    this.pingZamanlayici = null;
    if (this.yenidenZamanlayici) clearTimeout(this.yenidenZamanlayici);
    this.yenidenZamanlayici = null;
    if (this.denemeZamanlayici) clearTimeout(this.denemeZamanlayici);
    this.denemeZamanlayici = null;
  }
}
