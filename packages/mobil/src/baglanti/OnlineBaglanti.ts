// OnlineBaglanti: WebSocket ile gerçek oyun sunucusu.
//
//  - Bağlanınca hemen "giris" mesajı gönderir (hesap varsa oyuncuId + anahtar ile).
//  - Bağlantı koparsa artan aralıklarla (1, 2, 4 ... en fazla 15 sn) yeniden bağlanır
//    ve tekrar giriş yapar; sunucu oyuncu bir odadaysa odanın son halini yeniden gönderir.
//  - 20 saniyede bir "ping" atar. Uzun süre "pong" gelmezse bağlantıyı ölü sayar
//    (telefon uykudan uyanınca ya da Wi-Fi değişince soket sessizce ölebilir).
import { type IstemciMesaji, PROTOKOL_SURUMU, type SunucuMesaji } from "@okey/kurallar";
import { type Baglanti, Yayinci } from "./baglanti.ts";

const PING_ARALIGI = 20_000;
const OLU_SURE = 45_000;

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
  private sonMesaj = 0;
  /** Bağlantı yokken gönderilen mesajlar (ör. "salonlar") bağlanınca gider. */
  private kuyruk: IstemciMesaji[] = [];

  constructor(
    private readonly url: string,
    private giris: GirisBilgisi,
  ) {
    super();
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
    this.soket?.close();
    this.soket = null;
  }

  private baglan() {
    if (this.kapatildi) return;
    this.durumYay("baglaniyor");
    let soket: WebSocket;
    try {
      soket = new WebSocket(this.url);
    } catch {
      this.yenidenBaglan();
      return;
    }
    this.soket = soket;

    soket.onopen = () => {
      this.deneme = 0;
      this.sonMesaj = Date.now();
      const { ad, oyuncuId, anahtar } = this.giris;
      soket.send(JSON.stringify({ t: "giris", ad, surum: PROTOKOL_SURUMU, oyuncuId, anahtar } satisfies IstemciMesaji));
      for (const m of this.kuyruk.splice(0)) soket.send(JSON.stringify(m));
      this.pingBaslat();
      this.durumYay("bagli");
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
      this.temizle();
      if (!this.kapatildi) {
        this.durumYay("koptu");
        this.yenidenBaglan();
      }
    };
    // onerror'dan sonra her zaman onclose gelir; yeniden bağlanma orada yapılır.
    soket.onerror = () => {};
  }

  private yenidenBaglan() {
    if (this.kapatildi || this.yenidenZamanlayici) return;
    const bekle = Math.min(15_000, 1000 * 2 ** this.deneme++);
    this.yenidenZamanlayici = setTimeout(() => {
      this.yenidenZamanlayici = null;
      this.baglan();
    }, bekle);
  }

  /** Kopuk görünen bağlantıyı beklemeden hemen yeniden dener (ör. "Tekrar dene" düğmesi). */
  simdiDene() {
    if (this.soket || this.kapatildi) return;
    if (this.yenidenZamanlayici) clearTimeout(this.yenidenZamanlayici);
    this.yenidenZamanlayici = null;
    this.deneme = 0;
    this.baglan();
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
  }
}
