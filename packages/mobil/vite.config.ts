// Vite yapılandırması. Derlenen dosyalar dist/ klasörüne gider; Capacitor bu klasörü
// Android uygulamasının içine kopyalar (bkz. capacitor.config.ts → webDir).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import paket from "./package.json" with { type: "json" };

export default defineConfig({
  plugins: [react()],
  // Ayarlar ekranında görünen sürüm numarası package.json'dan gelir.
  define: { __UYGULAMA_SURUMU__: JSON.stringify(paket.version) },
  // Uygulama telefonda dosyadan değil Capacitor'un yerel sunucusundan açılır;
  // göreli yollar her iki durumda da çalışır.
  base: "./",
  server: { port: 5173 },
  build: { outDir: "dist", target: "es2022", chunkSizeWarningLimit: 900 },
});
