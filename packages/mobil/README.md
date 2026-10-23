# @okey/mobil — Okey Salonu Android uygulaması

React 18 + Vite 6 + TypeScript ile yazılmış arayüz, Capacitor 8 ile Android uygulamasına
paketlenir. Oyun kuralları `@okey/kurallar` paketinden gelir; sunucuyla tüm iletişim
`kurallar/src/protokol.ts` içindeki JSON mesajlarıyla (WebSocket) yapılır.

## Çalıştırma

```bash
# depo kökünde
npm install

# 1) Tarayıcıda geliştirme (telefonu yatay boyutta açın: ör. 844x390)
npm run dev -w @okey/mobil            # http://localhost:5173

# Sunucuyla birlikte (ayrı terminalde):
SATIN_ALMA_TEST=1 PORT=8080 npm run dev -w @okey/sunucu
```

- Sunucu adresi: `.env` içindeki `VITE_SUNUCU_URL` (bkz. `.env.example`). Boşsa tarayıcıda
  `ws://<sayfanın adresi>:8080/ws`, Android emülatöründe `ws://10.0.2.2:8080/ws` kullanılır.
  Uygulama içinden de değiştirilebilir: Giriş → Gelişmiş ya da Ayarlar → Sunucu.
- **Sunucu olmadan:** `http://localhost:5173/?onizleme=1` lobi, mağaza, profil, görevler ve
  sıralamayı örnek verilerle gösterir. "Antrenman" ise her zaman çalışır (botlara karşı, çevrim dışı).
- Testler: `npm test -w @okey/mobil` (istaka yerleşimi). Tip denetimi: `npx tsc -p packages/mobil --noEmit`.

### Android

```bash
npm run sync -w @okey/mobil           # web'i derler, android/ klasörüne kopyalar (cap sync)
cd packages/mobil/android
./gradlew assembleDebug               # debug APK (debug anahtarıyla imzalı)
./gradlew bundleRelease -PsurumAdi=1.0.0 -PsurumKodu=3 -PadmobUygulamaId=ca-app-pub-xxx~yyy
```

- Release imzası ortam değişkenlerinden okunur: `OKEY_KEYSTORE_DOSYASI`, `OKEY_KEYSTORE_SIFRESI`,
  `OKEY_ANAHTAR_ADI`, `OKEY_ANAHTAR_SIFRESI`. Yoksa release derlemesi imzasız çıkar.
- `admobUygulamaId` verilmezse Google'ın **test** AdMob kimliği kullanılır. Ödüllü reklam birimi
  web tarafında `VITE_ADMOB_ODULLU` ile verilir (boşsa test birimi).
- Ekran yatay kilitlidir (`sensorLandscape`). `ws://` ile yerel ağdaki sunucuya bağlanabilmek için
  `capacitor.config.ts` içinde `cleartext` ve `allowMixedContent` açıktır; yayındaki sunucu `wss://`
  kullanmalı.
- Simge ve açılış ekranı `kaynak/*.svg` dosyalarından üretilir:
  `CHROMIUM_YOLU=/yol/chrome npm run simgeler -w @okey/mobil`.

## Temayı nasıl değiştiririm?

Bütün renkler, yazı tipi, köşe yuvarlaklıkları, gölgeler, taş ve masa ölçüleri **tek dosyada**:
[`src/tema.css`](src/tema.css). Bileşenler (`src/stil.css`) sabit renk yazmaz, sadece bu
değişkenleri kullanır. Örnekler:

| İstek | Değişken |
| --- | --- |
| Çuhayı laciverde çevir | `--masa-cuha`, `--masa-cuha-koyu`, `--masa-cuha-gradyan` |
| Taşlar daha beyaz olsun | `--tas-zemin`, `--tas-kenar` |
| Taş rakam renkleri | `--tas-kirmizi`, `--tas-sari`, `--tas-mavi`, `--tas-siyah` |
| Altın vurgu yerine bakır | `--renk-altin*`, `--gradyan-altin` |
| Daha köşeli tasarım | `--kose*`, `--tas-kose` |
| İstakadaki taş boyu | `--tas-en` (genişlik; boy bundan hesaplanır) |

Yazı tipini değiştirmek için `@fontsource/<yazi-tipi>` paketini kurup `src/main.tsx` içindeki
import satırlarını ve `--yazi-tipi` değişkenini güncelleyin (yazı tipi uygulamaya gömülür,
internetsiz çalışır).

## Yeni süs (çerçeve / rozet / unvan) nasıl eklenir?

Sadece `packages/kurallar/src/kozmetik.ts` düzenlenir; uygulama süsleri oradan okur:

```ts
// CERCEVELER dizisine:
{ id: "lacivert", ad: "Lacivert", kosul: { seviye: 25 }, stil: "linear-gradient(135deg,#1b2a6b,#6f8cff,#1b2a6b)" },
// parlak: true eklenirse etikette hafif parıltı animasyonu oynar.

// ROZETLER dizisine (simge bir emoji):
{ id: "kahve", ad: "Kahve Tiryakisi", simge: "☕", kosul: { istatistik: "oynanan", enAz: 500 } },

// UNVANLAR dizisine:
{ id: "efendi", ad: "Masa Efendisi", kosul: { seviye: 45 }, renk: "#9fffe0" },
```

`kosul`: `{ seviye: n }`, `{ istatistik: "kazanilan" | "oynanan" | ..., enAz: n }` ya da
`{ herkese: true }`. Kilit metni (`kosulMetni`) ve sunucudaki doğrulama otomatik çalışır.
İsim etiketi bileşeni `src/bilesenler/IsimEtiketi.tsx`'tir (masa, lobi, sıralamada aynı bileşen).

## Mimari

```
Ekranlar ──useOyun()──► OyunSaglayici (React context + useReducer)
                              │  gonder(IstemciMesaji)
                              ▼
                     Baglanti arayüzü (src/baglanti/baglanti.ts)
              ┌───────────────┼──────────────────┐
     OnlineBaglanti      YerelBaglanti       OnizlemeBaglanti
     (WebSocket,         (kurallar'daki      (?onizleme=1,
     yeniden bağlanma,    Oda sınıfı          sahte sunucu)
     ping, tekrar giriş)  telefonda: antrenman)
              └──── SunucuMesaji ──► indirgeyici (src/durum/durum.ts) ──► yeni durum
```

- **Durum tek yerde değişir:** `durum.ts` içindeki `indirgeyici`. Sunucu mesajı da, ekran
  değişimi de bir `Islem`dir.
- **Online ve antrenman aynı masa ekranını kullanır;** fark sadece mesajın hangi `Baglanti`ya gittiğidir.
- **İstaka düzeni sadece telefonda tutulur** (`src/yardimci/istaka.ts`, saf fonksiyonlar):
  sunucu sadece eldeki taşları bilir; telefon gelen elle yuvaları eşitler.
- **Sürükle-bırak** kütüphanesizdir (`ekranlar/masa/Istaka.tsx`): Pointer Events + parmağı izleyen
  "hayalet" taş + bırakılan noktada `elementFromPoint`.
- **Platform arayüzleri:** Google Play Billing `src/platform/magaza.ts`, AdMob `src/platform/reklam.ts`
  arkasındadır; eklenti değişirse tek dosya değişir. Tarayıcıda ikisinin de test uygulaması devreye girer
  (test satın alma jetonu `test-…`, 2 sn'lik sahte reklam — sahte reklamda ödül gelmez).
- **Ödülleri sunucu verir:** satın almada Play jetonu sunucuya gider, sunucu doğrular ve tüketir;
  reklamda AdMob sunucuya SSV isteği atar (`userId = oyuncuId`). Telefon sadece güncel profili bekler.

## Dosya yapısı

```
packages/mobil/
├── index.html, vite.config.ts, capacitor.config.ts, tsconfig.json, .env.example
├── src/
│   ├── main.tsx, Uygulama.tsx     giriş noktası, ekran seçimi
│   ├── tema.css                   ← TEMA: bütün renk/ölçü değişkenleri
│   ├── stil.css                   bileşen stilleri (sadece tema değişkenlerini kullanır)
│   ├── durum/                     durum.ts (reducer), OyunSaglayici.tsx (context, bağlantılar), ayar.ts
│   ├── baglanti/                  Baglanti arayüzü + Online / Yerel / Önizleme uygulamaları
│   ├── platform/                  magaza.ts, reklam.ts, depo.ts (Preferences), cihaz.ts, ses.ts
│   ├── bilesenler/                Tas, IsimEtiketi, Pencere, Bildirimler, Simge, Ortak
│   ├── ekranlar/                  Giris, Lobi, BeklemeOdasi, Magaza, Profil, Ayarlar, Gorevler, Siralama
│   │   └── masa/                  MasaEkrani, Istaka (sürükle-bırak), OyuncuYeri, SonucPenceresi, SohbetPaneli
│   └── yardimci/                  istaka.ts (yuva düzeni), bicim.ts (1.250.000 / 1,2 Mn), oda.ts, kancalar.ts
├── test/                          istaka.test.ts
├── kaynak/                        simge ve açılış ekranı SVG kaynakları
├── betikler/                      simgeleri-uret.mjs, ekran-goruntusu.mjs (Playwright)
└── android/                       Capacitor Android projesi (imzalama: app/build.gradle)
```
