// Sunucuyu kuran fonksiyon: HTTP + WebSocket + veritabanı + modüller.
//
// sunucuBaslat(ayarlar) her şeyi birbirine bağlar ve çalışan sunucuyu döndürür.
// index.ts bunu ortam değişkenleriyle çağırır; testler ise rastgele port, bellekte
// veritabanı ve kısa sürelerle çağırır. Böylece testler gerçek WebSocket istemcileriyle
// sunucunun tamamını uçtan uca dener.
//
// HTTP uçları:
//   GET /saglik        -> {durum:"ok"} (Docker/yük dengeleyici sağlık kontrolü)
//   GET /reklam-odulu  -> AdMob ödüllü reklam doğrulama geri çağrısı (reklam.ts)
// Diğer her şey WebSocket bağlantısıdır (yol fark etmez).

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { REKLAM_ODULU, type SunucuMesaji } from "@okey/kurallar";
import { WebSocketServer } from "ws";
import type { Ayarlar } from "./ayarlar.ts";
import { Baglanti, type SunucuBaglami } from "./baglanti.ts";
import { profilOlustur } from "./ilerleme.ts";
import { GooglePlayIstemcisi, Magaza, type ServisHesabi } from "./magaza.ts";
import { admobAnahtarKaynagi, reklamOdulunuIsle } from "./reklam.ts";
import { SalonYoneticisi } from "./salon.ts";
import { Veritabani } from "./veritabani.ts";

export interface CalisanSunucu {
  port: number;
  vt: Veritabani;
  kapat: () => Promise<void>;
}

export async function sunucuBaslat(ayarlar: Ayarlar): Promise<CalisanSunucu> {
  const vt = new Veritabani(ayarlar.veritabaniYolu);
  const cevrimici = new Map<string, Baglanti>();

  const gonder = (oyuncuId: string, m: SunucuMesaji) => cevrimici.get(oyuncuId)?.gonder(m);
  const profilGonder = (oyuncuId: string) => {
    const profil = profilOlustur(vt, oyuncuId, ayarlar.simdi());
    if (profil) gonder(oyuncuId, { t: "profil", profil });
  };

  // Mağaza: servis hesabı yoksa sadece test modu çalışır.
  let google: GooglePlayIstemcisi | null = null;
  if (ayarlar.googleServisHesabiJson) {
    const hesap = JSON.parse(ayarlar.googleServisHesabiJson) as ServisHesabi;
    google = new GooglePlayIstemcisi(hesap, ayarlar.paketAdi, ayarlar.fetch);
  }
  ayarlar.gunluk(
    ayarlar.satinAlmaTest
      ? "UYARI: Satın alma TEST modu AÇIK ('test-' jetonları doğrulanmadan kabul edilir). Üretimde kapatın!"
      : "Satın alma test modu kapalı (üretim).",
  );
  if (!google) ayarlar.gunluk("GOOGLE_SERVIS_HESABI_JSON tanımlı değil: gerçek satın almalar doğrulanamaz.");

  const baglam: SunucuBaglami = {
    ayarlar,
    vt,
    cevrimici,
    profilGonder,
    salon: new SalonYoneticisi({ vt, ayarlar, gonder, profilGonder }),
    magaza: new Magaza(vt, google, ayarlar.satinAlmaTest, ayarlar.simdi, ayarlar.gunluk),
  };
  const anahtarKaynagi = ayarlar.reklamAnahtarlari ?? admobAnahtarKaynagi(ayarlar.fetch);

  const reklamOdulu = async (sorgu: string, res: ServerResponse) => {
    const c = await reklamOdulunuIsle(sorgu, vt, anahtarKaynagi, ayarlar.simdi(), (oyuncuId) => {
      gonder(oyuncuId, { t: "bildirim", tur: "basari", metin: `Reklam ödülü: +${REKLAM_ODULU} çip` });
      profilGonder(oyuncuId);
    });
    json(res, c.durum, c.govde);
  };

  const http = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? "/";
    const soru = url.indexOf("?");
    const yol = soru === -1 ? url : url.slice(0, soru);
    if (req.method === "GET" && yol === "/saglik") return json(res, 200, { durum: "ok" });
    if (req.method === "GET" && yol === "/reklam-odulu") {
      // İmza ham sorgu dizgesi üzerinden doğrulanır, bu yüzden URL çözümlenmeden verilir.
      reklamOdulu(soru === -1 ? "" : url.slice(soru + 1), res).catch((e) => {
        ayarlar.gunluk(`Reklam ödülü hatası: ${(e as Error).message}`);
        json(res, 500, { durum: "hata" });
      });
      return;
    }
    json(res, 404, { durum: "bulunamadi" });
  });

  // maxPayload, 8 KB sınırının üstünde bir güvenlik ağıdır: 8-64 KB arası mesajlara
  // Türkçe hata döneriz, daha büyüğünde ws bağlantıyı doğrudan keser.
  const wss = new WebSocketServer({ server: http, maxPayload: 64 * 1024 });
  const baglantilar = new Set<Baglanti>();
  wss.on("connection", (ws) => {
    const b = new Baglanti(ws, baglam);
    baglantilar.add(b);
    ws.on("close", () => baglantilar.delete(b));
  });

  // Ölü bağlantı avı: her turda ping atılır, önceki ping'e pong gelmeyen kapatılır.
  const pingZamanlayici = setInterval(() => baglantilar.forEach((b) => b.pingAt()), ayarlar.pingAraligiMs);

  await new Promise<void>((tamam) => http.listen(ayarlar.port, tamam));
  const port = (http.address() as AddressInfo).port;
  ayarlar.gunluk(`Okey sunucusu ${port} portunda çalışıyor`);

  let kapandi = false;
  return {
    port,
    vt,
    async kapat() {
      if (kapandi) return;
      kapandi = true;
      clearInterval(pingZamanlayici);
      baglam.salon.kapat(); // zamanlayıcıları durdurur, yarım ellerin girişini iade eder
      for (const ws of wss.clients) ws.close(1001, "Sunucu kapanıyor");
      await new Promise<void>((tamam) => wss.close(() => tamam()));
      await new Promise<void>((tamam) => {
        http.close(() => tamam());
        http.closeAllConnections();
      });
      vt.kapat();
      ayarlar.gunluk("Sunucu kapandı");
    },
  };
}

function json(res: ServerResponse, durum: number, govde: unknown) {
  res.writeHead(durum, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(govde));
}
