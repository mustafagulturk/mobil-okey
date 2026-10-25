// YerelBaglanti: antrenman modu. Kurallar paketindeki Oda sınıfı telefonda çalışır;
// sunucuya hiç gidilmez. Oda, sunucuda nasıl kullanılıyorsa burada da öyle kullanılır:
// zamanlayıcı olarak setTimeout, "gonder" olarak da doğrudan uygulamanın dinleyicileri.
//
// Sadece masa ile ilgili mesajlar (hamle, sohbet, basla, odadanAyril) işlenir;
// çip, görev gibi şeyler antrenmanda yoktur. Antrenman Okey ya da 101 oynanabilir.
import { type IstemciMesaji, type OyunTuru, type OyuncuKarti, Oda, type SunucuMesaji } from "@okey/kurallar";
import { type Baglanti, Yayinci } from "./baglanti.ts";

export class YerelBaglanti extends Yayinci implements Baglanti {
  private oda: Oda | null = null;

  constructor(
    private readonly ben: OyuncuKarti,
    private readonly oyun: OyunTuru = "okey",
  ) {
    super();
  }

  /** Dinleyiciler bağlandıktan sonra çağrılır: odayı kurar, oyuncuyu oturtur, eli başlatır. */
  baslat() {
    this.oda = new Oda({
      kod: "ANTRN",
      salon: "antrenman",
      oyun: this.oyun,
      giris: 0,
      rastgele: Math.random,
      simdi: Date.now,
      zamanla: (fn, ms) => {
        const z = setTimeout(fn, ms);
        return () => clearTimeout(z);
      },
      gonder: (oyuncuId, mesaj) => {
        if (oyuncuId === this.ben.id) this.ilet(mesaj);
      },
      // Antrenmanda acele yok; 101'de açma ve işleme için daha da uzun.
      turSuresiMs: this.oyun === "101" ? 60_000 : 30_000,
      botGecikmeMs: 850,
      sonrakiElMs: 12_000,
    });
    this.oda.otur(this.ben);
    this.oda.basla(this.ben.id);
    this.durumYay("bagli");
  }

  gonder(mesaj: IstemciMesaji) {
    const oda = this.oda;
    if (!oda) return;
    switch (mesaj.t) {
      case "hamle": {
        const s = oda.hamle(this.ben.id, mesaj.eylem);
        if (!s.tamam) this.ilet({ t: "hata", mesaj: s.hata });
        break;
      }
      case "sohbet":
        oda.sohbet(this.ben.id, mesaj.metin);
        break;
      case "basla": {
        const s = oda.basla(this.ben.id);
        if (!s.tamam) this.ilet({ t: "hata", mesaj: s.hata });
        break;
      }
      case "odadanAyril":
        this.kapat();
        this.ilet({ t: "odadanCikti", sebep: null });
        break;
      default:
        // Antrenmanda olmayan özellikler (mağaza, sıralama...) sessizce yok sayılır.
        break;
    }
  }

  kapat() {
    this.oda?.kapat();
    this.oda = null;
  }

  /**
   * Oda mesajları senkron üretir (ör. hamle() içinde yayinla()). Mesajı bir sonraki
   * mikro göreve bırakmak, arayüzün bir olayı işlerken yenisini almasını önler;
   * sunucudan gelen mesajlarla aynı "asenkron" davranışı taklit eder.
   */
  private ilet(mesaj: SunucuMesaji) {
    queueMicrotask(() => this.mesajYay(mesaj));
  }
}
