// Ekran görüntüsü betiği: çalışan Vite dev sunucusunu (npm run dev) telefon boyutunda
// açar, önizleme verisiyle online ekranları gezer, antrenman modunda bir el oynar
// (sürükle-bırak dahil) ve görüntüleri kaydeder.
//
//   CHROMIUM_YOLU=/yol/chrome node betikler/ekran-goruntusu.mjs [klasör] [genişlik] [yükseklik]
import { mkdirSync } from "node:fs";
import { tarayiciAc } from "./tarayici.mjs";

const [klasor = "ekran", w = "844", h = "390"] = process.argv.slice(2);
const ADRES = process.env.ADRES ?? "http://localhost:5173/";
mkdirSync(klasor, { recursive: true });
const onek = `${w}x${h}-`;

const tarayici = await tarayiciAc();
const p = await tarayici.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
p.on("pageerror", (e) => console.log("SAYFA HATASI:", e.message));
const foto = (ad) => p.screenshot({ path: `${klasor}/${onek}${ad}.png` });
const bekle = (ms) => p.waitForTimeout(ms);

// 1) Giriş (kayıtlı hesap yok)
await p.goto(ADRES);
await bekle(800);
await foto("1-giris");

// 2) Online ekranlar, sahte veriyle (?onizleme=1)
await p.goto(`${ADRES}?onizleme=1`);
await bekle(900);
await foto("2-lobi");
for (const [dugme, ad] of [["Mağaza", "5-magaza"], ["Etiket", "6-profil"], ["Görevler", "7-gorevler"], ["Sıralama", "8-siralama"], ["Ayarlar", "9-ayarlar"]]) {
  await p.click(`.menu-dugmesi:has-text('${dugme}')`);
  await bekle(600);
  await foto(ad);
  await p.click("[aria-label='Geri']");
  await bekle(300);
}
await p.click("text=Oda Kur");
await bekle(600);
await foto("10-bekleme-odasi");
await p.click("text=Ayrıl");
await bekle(400);

// 3) Antrenman: bir el oyna
await p.click("text=Antrenman");
await p.waitForSelector(".istaka");

/** Fareyle (dokunmatikteki gibi) sürükleyip bırakır; bırakmadan önce ara() çağrılır. */
async function surukle(kaynak, hedef, ara) {
  const a = await kaynak.boundingBox();
  const c = await hedef.boundingBox();
  await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await p.mouse.down();
  await p.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 10 });
  if (ara) await ara();
  await p.mouse.up();
}

let tur = 0;
const sinir = Date.now() + 8 * 60_000;
while (Date.now() < sinir) {
  if (await p.$(".sonuc")) {
    await bekle(700);
    await foto("4-sonuc");
    break;
  }
  if (await p.$(".deste--cekilebilir")) {
    await p.click(".deste--cekilebilir");
    await bekle(250);
    continue;
  }
  if (await p.$(".atma-alani--aktif")) {
    tur++;
    if (tur === 2) {
      const ilk = await p.$(".istaka .tas");
      await surukle(ilk, await p.$('[data-yuva="29"]'), () => foto("3b-masa-surukleme"));
      await bekle(300);
    }
    if (tur === 3) {
      await p.click("text=Seri Diz");
      await bekle(400);
      await foto("3-masa");
    }
    const taslar = await p.$$(".istaka .tas");
    if (tur % 2 === 0) {
      await taslar.at(-1).click();
      await p.click("button:has-text('At')");
    } else {
      await surukle(taslar.at(-1), await p.$(".atma-alani"));
    }
    await bekle(250);
    continue;
  }
  await bekle(200);
}
await tarayici.close();
console.log("Ekran görüntüleri:", klasor);
