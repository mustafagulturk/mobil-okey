# @okey/sunucu

Okey oyununun sunucusu: WebSocket üzerinden oyun, hesaplar, odalar ve hızlı eşleştirme,
çip ekonomisi, günlük görevler, sıralama, Google Play satın alma doğrulama ve AdMob
ödüllü reklam doğrulama (SSV).

Oyun kuralları ve oda akışı `@okey/kurallar` paketindedir; sunucu onları ağa ve
veritabanına bağlar. Node 22, TypeScript (tsx ile derlemeden çalışır), `ws` ve Node'un
yerleşik `node:sqlite` modülü kullanılır.

## Çalıştırma

```bash
# depo kökünde
npm install
npm run dev:sunucu                 # tsx watch ile geliştirme
SATIN_ALMA_TEST=1 npm run dev:sunucu   # "test-" satın alma jetonlarını kabul eder

npx vitest run                     # testler
npx tsc -p packages/sunucu --noEmit
```

Docker (depo kökünden):

```bash
docker build -f packages/sunucu/Dockerfile -t okey-sunucu .
docker run -p 8080:8080 -v okey-veri:/veri okey-sunucu
```

Ücretsiz kurulum (Render.com, kart gerekmez) için depo kökündeki `render.yaml` ve adım adım
rehber: [`docs/SUNUCU_KURULUM.md`](../../docs/SUNUCU_KURULUM.md). Sunucu düz HTTP dinler,
portu `PORT` ortam değişkeninden alır; TLS'yi (https/wss) barındırma servisi sonlandırır.
WebSocket bağlantısı her yolda kabul edilir; uygulama `/ws` kullanır.

## Ortam değişkenleri

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `PORT` | `8080` | HTTP ve WebSocket portu |
| `VERITABANI` | `./veri/okey.db` | SQLite dosyası (klasör yoksa oluşturulur; Docker'da `/veri/okey.db`) |
| `ANDROID_PAKET_ADI` | `dev.mustafagulturk.okey` | Google Play paket adı |
| `GOOGLE_SERVIS_HESABI_JSON` | (yok) | Play Developer API erişimi olan servis hesabının JSON anahtarı (dosya içeriği) |
| `SATIN_ALMA_TEST` | (kapalı) | `1` ise `test-` ile başlayan jetonlar Google'a sorulmadan kabul edilir. **Üretimde kapalı olmalı.** |

## HTTP uçları

| Uç | Açıklama |
| --- | --- |
| `GET /saglik` | `{"durum":"ok"}` |
| `GET /reklam-odulu` | AdMob SSV geri çağrısı. AdMob panelinde ödüllü reklam biriminin "sunucu taraflı doğrulama" adresi olarak verilir; uygulama reklamı yüklerken `user_id` olarak oyuncu kimliğini göndermelidir. |

WebSocket mesajlarının sözleşmesi `packages/kurallar/src/protokol.ts` dosyasındadır.

## Dosyalar

| Dosya | Görevi |
| --- | --- |
| `src/index.ts` | Giriş noktası, SIGTERM ile düzgün kapanış |
| `src/sunucu.ts` | `sunucuBaslat(ayarlar)`: HTTP + WebSocket + modülleri bağlar |
| `src/ayarlar.ts` | Ayarlar ve ortam değişkenleri |
| `src/baglanti.ts` | Tek bağlantı: boyut/hız sınırı, JSON + zod doğrulama, mesaj yönlendirme |
| `src/veritabani.ts` | Şema ve sorgular; çip işlemleri transaction içinde, denetim izi `cip_hareketleri` |
| `src/hesap.ts` | Cihaz hesabı: UUID + rastgele anahtar (sadece SHA-256 özeti saklanır) |
| `src/salon.ts` | Odalar, hızlı eşleştirme, oda kodları, el başı/sonu çip işlemleri |
| `src/ilerleme.ts` | Profil, XP/seviye, istatistik, görevler, günlük hediye |
| `src/siralama.ts` | Seviye ve çip sıralaması |
| `src/magaza.ts` | Google Play satın alma doğrulama ve tüketme |
| `src/reklam.ts` | AdMob SSV imza doğrulama ve ödül |
| `src/sohbet.ts` | Basit küfür filtresi |
