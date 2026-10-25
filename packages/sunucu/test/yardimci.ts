// Test yardımcıları: sunucuyu bellekte veritabanı ve rastgele portla başlatır,
// gerçek WebSocket istemcileriyle konuşur.

import type { IstemciMesaji, SunucuMesaji } from "@okey/kurallar";
import WebSocket from "ws";
import { type Ayarlar, varsayilanAyarlar } from "../src/ayarlar.ts";
import { type CalisanSunucu, sunucuBaslat } from "../src/sunucu.ts";

export async function testSunucusu(ek: Partial<Ayarlar> = {}): Promise<CalisanSunucu & { adres: string }> {
  const s = await sunucuBaslat(
    varsayilanAyarlar({
      port: 0,
      veritabaniYolu: ":memory:",
      turSuresiMs: 2_000,
      turSuresi101Ms: 2_000,
      botGecikmeMs: 1,
      sonrakiElMs: 60_000,
      eslesmeBeklemeMs: 100,
      gunluk: () => {},
      ...ek,
    }),
  );
  return { ...s, adres: `ws://127.0.0.1:${s.port}` };
}

type Mesaj<T extends SunucuMesaji["t"]> = Extract<SunucuMesaji, { t: T }>;

export class TestIstemcisi {
  readonly gelenler: SunucuMesaji[] = [];
  /** Ham metin olarak gelen mesajlar (hile koruması testinde aranır). */
  readonly hamGelenler: string[] = [];
  /** bekle() ile alınmış mesajların sırası; her mesaj bir kez alınır. */
  private readonly alinan = new Set<number>();
  private bekleyen: (() => void) | null = null;
  kapandi = false;

  private constructor(readonly ws: WebSocket) {
    ws.on("message", (veri) => {
      const metin = veri.toString();
      this.hamGelenler.push(metin);
      this.gelenler.push(JSON.parse(metin));
      this.bekleyen?.();
    });
    ws.on("close", () => {
      this.kapandi = true;
      this.bekleyen?.();
    });
  }

  static async baglan(adres: string): Promise<TestIstemcisi> {
    const ws = new WebSocket(adres);
    await new Promise((tamam, hata) => {
      ws.once("open", tamam);
      ws.once("error", hata);
    });
    return new TestIstemcisi(ws);
  }

  /** Bağlanır ve giriş yapar (bilgi verilmezse yeni hesap açar). */
  static async girisYap(adres: string, ek: Partial<Extract<IstemciMesaji, { t: "giris" }>> = {}) {
    const i = await TestIstemcisi.baglan(adres);
    i.gonder({ t: "giris", ad: "Deneme", surum: 1, ...ek });
    const h = await i.bekle("hosgeldin");
    return { i, h };
  }

  gonder(m: IstemciMesaji | Record<string, unknown>) {
    this.ws.send(JSON.stringify(m));
  }

  gonderHam(veri: string) {
    this.ws.send(veri);
  }

  /** Henüz alınmamış mesajlar arasında t türünde (ve koşulu sağlayan) ilk mesajı bekler. Farklı türlerin geliş sırası önemli değildir. */
  async bekle<T extends SunucuMesaji["t"]>(t: T, kosul: (m: Mesaj<T>) => boolean = () => true, sureMs = 5_000): Promise<Mesaj<T>> {
    const bitis = Date.now() + sureMs;
    for (;;) {
      for (let n = 0; n < this.gelenler.length; n++) {
        const m = this.gelenler[n];
        if (this.alinan.has(n) || m.t !== t || !kosul(m as Mesaj<T>)) continue;
        // Aynı türden daha eski mesajlar da alınmış sayılır (sıra bozulmasın).
        for (let k = 0; k <= n; k++) if (this.gelenler[k].t === t) this.alinan.add(k);
        return m as Mesaj<T>;
      }
      if (this.kapandi) throw new Error(`Bağlantı kapandı, "${t}" gelmedi`);
      const kalan = bitis - Date.now();
      if (kalan <= 0) throw new Error(`"${t}" mesajı ${sureMs} ms içinde gelmedi`);
      await new Promise<void>((tamam) => {
        const z = setTimeout(tamam, kalan);
        this.bekleyen = () => {
          clearTimeout(z);
          tamam();
        };
      });
      this.bekleyen = null;
    }
  }

  kapat() {
    this.ws.close();
  }
}
