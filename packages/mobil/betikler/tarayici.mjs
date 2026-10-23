// Betiklerin ortak tarayıcı başlatıcısı (Playwright + Chromium).
// Chromium yolu CHROMIUM_YOLU ortam değişkeninden okunur; yoksa Playwright'ın kendi
// indirdiği tarayıcı kullanılır (`npx playwright-core install chromium`).
import { chromium } from "playwright-core";

export function tarayiciAc() {
  return chromium.launch({ executablePath: process.env.CHROMIUM_YOLU || undefined });
}
