// Uygulama simgesini ve açılış ekranını kaynak/*.svg dosyalarından üretir ve
// android/app/src/main/res altına yazar. Simgeyi değiştirmek için SVG'yi düzenleyip:
//   CHROMIUM_YOLU=/yol/chrome node betikler/simgeleri-uret.mjs
// SVG'ler Chromium ile çizilir (ImageMagick'in SVG desteği her makinede yok).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tarayiciAc } from "./tarayici.mjs";

const kok = join(dirname(fileURLToPath(import.meta.url)), "..");
const res = join(kok, "android/app/src/main/res");
const onSvg = readFileSync(join(kok, "kaynak/simge-on.svg"), "utf8");
const acilisSvg = readFileSync(join(kok, "kaynak/acilis.svg"), "utf8");
const ZEMIN = "#0d5a3d"; // res/values/ic_launcher_background.xml ile aynı olmalı
const yaziTipi = pathToFileURL(createRequire(import.meta.url).resolve("@fontsource/nunito/files/nunito-latin-900-normal.woff2"));
const yogunluklar = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const tarayici = await tarayiciAc();
const sayfa = await tarayici.newPage();

/** Verilen HTML gövdesini w x h boyutunda PNG olarak kaydeder. */
async function ciz(govde, w, h, cikti, seffaf = false) {
  const dosya = join(tmpdir(), "okey-simge.html");
  writeFileSync(
    dosya,
    `<!doctype html><style>
      @font-face { font-family: Nunito; font-weight: 900; src: url(${yaziTipi}); }
      html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: transparent; }
      svg { display: block; }
    </style>${govde}`,
  );
  await sayfa.setViewportSize({ width: w, height: h });
  await sayfa.goto(pathToFileURL(dosya).href);
  await sayfa.evaluate(() => document.fonts.ready);
  mkdirSync(dirname(cikti), { recursive: true });
  await sayfa.screenshot({ path: cikti, omitBackground: seffaf });
}

const svgBoyutlu = (svg, boyut) => svg.replace("<svg ", `<svg width="${boyut}" height="${boyut}" `);

for (const [ad, k] of Object.entries(yogunluklar)) {
  // Adaptive icon ön katmanı: 108 dp, şeffaf.
  const on = Math.round(108 * k);
  await ciz(svgBoyutlu(onSvg, on), on, on, join(res, `mipmap-${ad}/ic_launcher_foreground.png`), true);

  // Eski Android'ler için tek parça simge: 48 dp kare (yuvarlatılmış) ve daire.
  // Adaptive icon'da 108 dp'nin ortadaki 72 dp'si görünür; aynı kırpmayı burada yapıyoruz.
  const s = Math.round(48 * k);
  const ic = (yaricap) =>
    `<div style="position:relative;width:${s}px;height:${s}px;border-radius:${yaricap};overflow:hidden;background:${ZEMIN}">
       <div style="position:absolute;left:${-s / 4}px;top:${-s / 4}px">${svgBoyutlu(onSvg, (s * 108) / 72)}</div>
     </div>`;
  await ciz(ic("22%"), s, s, join(res, `mipmap-${ad}/ic_launcher.png`), true);
  await ciz(ic("50%"), s, s, join(res, `mipmap-${ad}/ic_launcher_round.png`), true);
}

// Açılış ekranı: Capacitor'un beklediği boyutlarda, yatay ve dikey.
const acilislar = {
  "drawable/splash.png": [480, 320],
  "drawable-land-mdpi/splash.png": [480, 320],
  "drawable-land-hdpi/splash.png": [800, 480],
  "drawable-land-xhdpi/splash.png": [1280, 720],
  "drawable-land-xxhdpi/splash.png": [1600, 960],
  "drawable-land-xxxhdpi/splash.png": [1920, 1280],
  "drawable-port-mdpi/splash.png": [320, 480],
  "drawable-port-hdpi/splash.png": [480, 800],
  "drawable-port-xhdpi/splash.png": [720, 1280],
  "drawable-port-xxhdpi/splash.png": [960, 1600],
  "drawable-port-xxxhdpi/splash.png": [1280, 1920],
};
for (const [yol, [w, h]] of Object.entries(acilislar)) {
  const kisa = Math.min(w, h);
  await ciz(
    `<div style="position:fixed;inset:0">${acilisSvg.replace("<svg ", '<svg width="100%" height="100%" ')}</div>
     <div style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${kisa * 0.02}px">
       ${svgBoyutlu(onSvg, kisa * 0.5)}
       <div style="margin-top:${-kisa * 0.08}px;font:900 ${kisa * 0.085}px Nunito;color:#f6efe0">Okey <span style="color:#e9b949">Salonu</span></div>
     </div>`,
    w,
    h,
    join(res, yol),
  );
}

await tarayici.close();
console.log("Simgeler ve açılış ekranları üretildi:", res);
