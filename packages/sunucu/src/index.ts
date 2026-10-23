// Giriş noktası: ayarları ortam değişkenlerinden okur ve sunucuyu başlatır.
//
// SIGTERM/SIGINT gelince (Docker durdurma, Ctrl+C) sunucu düzgünce kapanır: odalar
// kapatılır, yarıda kalan ellerin girişi iade edilir, veritabanı kapatılır.

import { ortamdanAyarlar } from "./ayarlar.ts";
import { sunucuBaslat } from "./sunucu.ts";

const sunucu = await sunucuBaslat(ortamdanAyarlar());

for (const sinyal of ["SIGTERM", "SIGINT"] as const) {
  process.once(sinyal, async () => {
    console.log(`${sinyal} alındı, sunucu kapanıyor...`);
    await sunucu.kapat();
    process.exit(0);
  });
}
