// Capacitor yapılandırması: web uygulamasını (dist/) Android uygulamasına paketler.
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "dev.mustafagulturk.okey",
  appName: "Okey Salonu",
  webDir: "dist",
  server: {
    androidScheme: "https",
    // GELİŞTİRME AMAÇLI: yerel ağdaki sunucuya şifresiz ws:// ile bağlanabilmek için.
    // Yayındaki sunucu wss:// (TLS) kullanmalı; o zaman bu iki ayar kapatılabilir.
    cleartext: true,
  },
  android: {
    // GELİŞTİRME AMAÇLI: https://localhost'tan açılan sayfanın ws:// adrese bağlanmasına izin verir.
    allowMixedContent: true,
  },
  plugins: {
    // Satın alma onayı (acknowledge/consume) sunucuda yapılır; eklenti kendisi bitirmesin.
    NativePurchases: { autoFinishTransactions: false },
  },
};

export default config;
