#!/usr/bin/env node
// Okey Salonu mağaza görsellerini HTML kaynaklarından PNG olarak üretir.
// Kullanım: bash docs/magaza/kaynak/uret.sh   (playwright-core'u depo dışına kurar)
// veya playwright-core zaten çözülebiliyorsa: node docs/magaza/kaynak/uret.cjs
const fs = require('fs');
const path = require('path');

function playwrightYukle() {
  const adaylar = [process.env.OKEY_PW_CORE, 'playwright-core', 'playwright'].filter(Boolean);
  for (const a of adaylar) { try { return require(a); } catch {} }
  console.error('playwright-core bulunamadı. "bash docs/magaza/kaynak/uret.sh" ile çalıştırın.');
  process.exit(1);
}

function chromiumBul() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const kok = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!fs.existsSync(kok)) return undefined;
  const dizinler = fs.readdirSync(kok).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse();
  for (const d of dizinler) {
    const p = path.join(kok, d, 'chrome-linux64', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

const KAYNAK = __dirname;
const CIKTI = path.resolve(KAYNAK, '..');
const ISLER = [
  // Play: öne çıkan görsel = 24-bit PNG (alfasız); simge = 32-bit PNG (RGBA).
  { html: 'one-cikan-gorsel.html', png: 'one-cikan-gorsel.png', w: 1024, h: 500, rgba: false },
  { html: 'simge.html', png: 'simge-512.png', w: 512, h: 512, rgba: true },
];

(async () => {
  const { chromium } = playwrightYukle();
  const browser = await chromium.launch({ executablePath: chromiumBul() });
  try {
    for (const is of ISLER) {
      const page = await browser.newPage({ viewport: { width: is.w, height: is.h }, deviceScaleFactor: 1 });
      await page.goto('file://' + path.join(KAYNAK, is.html));
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      const hedef = path.join(CIKTI, is.png);
      const ham = await page.screenshot({ clip: { x: 0, y: 0, width: is.w, height: is.h } });
      if (!is.rgba) { fs.writeFileSync(hedef, ham); console.log('yazıldı:', path.relative(process.cwd(), hedef)); await page.close(); continue; }
      // Chromium opak görüntüyü 24-bit RGB yazar; Play 32-bit PNG istediği için
      // tarayıcının canvas kodlayıcısıyla RGBA (alfa = 255) olarak yeniden kodla.
      const rgba = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        return c.toDataURL('image/png').split(',')[1];
      }, ham.toString('base64'));
      fs.writeFileSync(hedef, Buffer.from(rgba, 'base64'));
      console.log('yazıldı:', path.relative(process.cwd(), hedef));
      await page.close();
    }
  } finally {
    await browser.close();
  }
})();
