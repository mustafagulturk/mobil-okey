// Sunucu ayarları.
//
// Üretimde ayarlar ortam değişkenlerinden okunur (ortamdanAyarlar). Testler ise
// sunucuyu doğrudan bir Ayarlar nesnesiyle başlatır: rastgele port, bellekte veritabanı,
// milisaniyelik tur süreleri, taklit fetch ve test anahtarları. Böylece zamanlama ve dış
// servislere bağlı her şey testte kontrol edilebilir.

import type { AnahtarKaynagi } from "./reklam.ts";

export interface Ayarlar {
  /** Dinlenecek port. 0 verilirse işletim sistemi boş bir port seçer (testler için). */
  port: number;
  /** SQLite dosyasının yolu. ":memory:" verilirse veritabanı bellekte tutulur. */
  veritabaniYolu: string;
  /** Google Play'deki uygulama paket adı. */
  paketAdi: string;
  /** Açıksa "test-" ile başlayan satın alma jetonları Google'a sorulmadan kabul edilir. */
  satinAlmaTest: boolean;
  /** Google Play Developer API için servis hesabı JSON'u (yoksa gerçek satın alma doğrulanamaz). */
  googleServisHesabiJson: string | null;

  // Oyun zamanlamaları
  turSuresiMs: number;
  botGecikmeMs: number;
  sonrakiElMs: number;
  /** Hızlı oyunda ilk oyuncu oturduktan sonra botlarla başlamadan önce beklenen süre. */
  eslesmeBeklemeMs: number;

  // Bağlantı korumaları
  pingAraligiMs: number;
  /** Bir bağlantının saniyede gönderebileceği en fazla mesaj sayısı. */
  saniyeBasinaMesaj: number;
  enBuyukMesajBayt: number;

  /** Dış HTTP istekleri için kullanılan fetch (testte taklit edilir). */
  fetch: typeof fetch;
  /** AdMob doğrulama anahtarlarının kaynağı. Verilmezse Google'ın adresinden indirilir. */
  reklamAnahtarlari?: AnahtarKaynagi;
  /** Saat (testte günü ilerletmek için değiştirilebilir). */
  simdi: () => number;
  rastgele: () => number;
  /** Günlük yazma fonksiyonu (testte susturulur). */
  gunluk: (mesaj: string) => void;
}

export function varsayilanAyarlar(ek: Partial<Ayarlar> = {}): Ayarlar {
  return {
    port: 8080,
    veritabaniYolu: "./veri/okey.db",
    paketAdi: "dev.mustafagulturk.okey",
    satinAlmaTest: false,
    googleServisHesabiJson: null,
    turSuresiMs: 25_000,
    botGecikmeMs: 900,
    sonrakiElMs: 8_000,
    eslesmeBeklemeMs: 10_000,
    pingAraligiMs: 30_000,
    saniyeBasinaMesaj: 20,
    enBuyukMesajBayt: 8 * 1024,
    fetch: globalThis.fetch,
    simdi: Date.now,
    rastgele: Math.random,
    gunluk: (m) => console.log(`[${new Date().toISOString()}] ${m}`),
    ...ek,
  };
}

/** Ortam değişkenlerinden ayarları okur. Tanımlanmayanlar varsayılan değerini alır. */
export function ortamdanAyarlar(ortam: NodeJS.ProcessEnv = process.env): Ayarlar {
  return varsayilanAyarlar({
    port: Number(ortam.PORT ?? 8080),
    veritabaniYolu: ortam.VERITABANI ?? "./veri/okey.db",
    paketAdi: ortam.ANDROID_PAKET_ADI ?? "dev.mustafagulturk.okey",
    satinAlmaTest: ortam.SATIN_ALMA_TEST === "1",
    googleServisHesabiJson: ortam.GOOGLE_SERVIS_HESABI_JSON ?? null,
  });
}
