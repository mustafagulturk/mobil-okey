# Oyun sunucusunu ücretsiz kurma

Telefondaki uygulama online oyun için bir sunucuya bağlanır. Sunucu bir yerde çalışmıyorsa
uygulama "Online salon yakında" ya da "Sunucuya ulaşılamadı" der; o sırada sadece
**antrenman** (botlara karşı, internetsiz) oynanabilir.

Bu rehber sunucuyu **kredi kartı vermeden, ücretsiz** olarak [Render.com](https://render.com)
üzerinde kurmayı adım adım anlatır. Sonunda telefon `wss://...onrender.com/ws` adresine
bağlanacak.

> **Önce bil: ücretsiz planın iki sınırı var**
>
> 1. **Uyku:** 15 dakika kimse bağlanmazsa sunucu uyur. Biri uygulamayı açınca 30-50 saniyede
>    uyanır. Uygulama bu sırada "Sunucu uyanıyor olabilir, bekleniyor…" yazar ve kendiliğinden
>    tekrar dener; bağlanınca lobiye geçer.
> 2. **Veriler kalıcı değil:** Ücretsiz planda disk yoktur. SQLite veritabanı (hesaplar, çipler,
>    seviyeler, sıralama) sunucu **her yeniden başladığında, uykudan her uyandığında ve her yeni
>    sürüm kurulduğunda sıfırlanır**. Telefondaki kayıtlı hesap sunucuda bulunamazsa uygulama
>    o oyuncu için yeni bir hesap açar. Bu, arkadaşlarla test etmek için yeterlidir; gerçek
>    yayın (Google Play) için kalıcı diskli bir sunucu gerekir (aşağıda "Kalıcı veri" bölümü).

## Render ile kurulum (yaklaşık 10 dakika)

Gerekenler: GitHub hesabın ve bu deponun GitHub'da olması. `render.yaml` dosyası deponun
kökündedir ve Render'a neyi nasıl kuracağını söyler (Blueprint).

> `render.yaml` hangi dalda ise o dalı seçmelisin. Dosya `main` dalını izleyecek şekilde
> ayarlı; bu değişiklikler henüz başka bir daldaysa önce `main`'e birleştir (merge).

### 1. Render'a GitHub ile gir

1. <https://render.com> adresine git, sağ üstteki **Get Started** (ya da **Sign In**) düğmesine bas.
2. **GitHub** seçeneğini seç. GitHub "Render'a izin verilsin mi?" diye sorar: **Authorize Render**.
3. Render e-posta doğrulaması isteyebilir: gelen postadaki bağlantıya tıkla.
4. Kart bilgisi **istenmez**; ücretsiz plan için gerekmez. Bir şey satın alma ekranı çıkarsa geç.

### 2. Blueprint'ten depoyu seç

1. Render panelinde (Dashboard) sağ üstteki **+ New** düğmesine bas, listeden **Blueprint**'i seç.
2. "Connect a repository" ekranında depon görünmüyorsa **Configure account** (ya da
   **Connect GitHub**) bağlantısına bas. GitHub'da açılan sayfada:
   - **Only select repositories** seç, listeden bu depoyu (ör. `mobil-okey`) seç,
   - **Install** / **Save** de. Render ekranına geri dönersin.
3. Listede depo görünür: yanındaki **Connect** düğmesine bas.
4. Açılan formda:
   - **Blueprint Name:** `okey` (istediğin bir ad),
   - **Branch:** `main` (render.yaml'ın olduğu dal),
   - Aşağıda Render dosyayı okuyup kuracaklarını listeler: **okey-sunucu** — *Web Service*,
     *Docker*, *Free*.
   - `GOOGLE_SERVIS_HESABI_JSON` için değer sorar: **boş bırak** (Google Play satın alma
     doğrulaması içindir, şimdilik gerekmez). Buraya yanlış/yarım bir JSON yapıştırırsan
     sunucu açılmaz.
5. **Deploy Blueprint** (ya da **Apply**) düğmesine bas.

### 3. Kurulumun bitmesini bekle

1. Panelde **okey-sunucu** servisine tıkla. **Events / Logs** sekmesinde Docker imajının
   derlendiğini görürsün (ilk seferde 3-6 dakika).
2. Bittiğinde günlükte şuna benzer satırlar çıkar:
   ```
   Satın alma test modu kapalı (üretim).
   Okey sunucusu 10000 portunda çalışıyor
   ```
   ve sayfanın üstünde yeşil **Live** yazar. (Portu Render verir; sunucu `PORT` ortam
   değişkenini okur, bir şey ayarlamana gerek yok.)
3. Hata alırsan (kırmızı **Failed**): Logs'taki son satırlara bak. En sık sebep
   `GOOGLE_SERVIS_HESABI_JSON`'a geçersiz bir değer girilmesidir: **Environment** sekmesinden
   sil ve **Manual Deploy > Deploy latest commit** de.

### 4. Adresi bul ve dene

1. Servis sayfasının en üstünde, adın altında servisin adresi yazar, ör.
   `https://okey-sunucu.onrender.com`. (Ad doluysa Render sonuna ek koyar:
   `https://okey-sunucu-x1y2.onrender.com`. **Kendi adresini** kopyala.)
2. Tarayıcıda bu adresin sonuna `/saglik` ekleyip aç:
   `https://okey-sunucu.onrender.com/saglik` → `{"durum":"ok"}` görmelisin. (Sunucu uyuyorsa
   ilk açılış 30-50 sn sürebilir.)
3. Telefonun bağlanacağı **WebSocket adresini** türet:
   - baştaki `https://` yerine `wss://` yaz,
   - sona `/ws` ekle.

   | Render'ın verdiği | Telefona girilecek |
   | --- | --- |
   | `https://okey-sunucu.onrender.com` | `wss://okey-sunucu.onrender.com/ws` |

   Render şifrelemeyi (TLS) kendisi yapar; sunucu içeride düz HTTP dinler. Bu yüzden telefon
   `wss://` (şifreli) ile bağlanır, ayrıca sertifika kurmana gerek yoktur.

### 5. Hemen dene (yeni APK beklemeden)

Telefondaki uygulamada giriş ekranındaki **Gelişmiş** (yeni sürümde **Sunucu adresim var**)
bağlantısına dokun, **Sunucu adresi** alanına `wss://okey-sunucu.onrender.com/ws` yaz,
**Kaydet**'e bas ve **Oyna** de. (Yeni sürüm `https://okey-sunucu.onrender.com` yazsan da
kendisi `wss://.../ws` adresine çevirir.) Lobideyken Ayarlar > Sunucu bölümünden de
değiştirebilirsin.

### 6. Adresi uygulamaya kalıcı olarak göm (GitHub değişkeni)

Böylece herkesin telefonunda uygulama bu sunucuya kendiliğinden bağlanır.

1. GitHub'da deponu aç, üstteki **Settings** sekmesine gir (göremiyorsan depo sahibi
   hesabıyla girmelisin).
2. Soldaki menüde **Secrets and variables** > **Actions**.
3. Açılan sayfada **Variables** sekmesine geç (Secrets değil!), **New repository variable**.
4. **Name:** `SUNUCU_URL` — **Value:** `wss://okey-sunucu.onrender.com/ws` (kendi adresin),
   **Add variable**.

### 7. Yeni APK üret

1. Depoda **Actions** sekmesine gir, soldan **CI** iş akışını seç.
2. Sağdaki **Run workflow** düğmesine bas:
   - **Branch:** derlemek istediğin dal (ör. `main`),
   - "Sürüm adı" ve "Play sürüm kodu" **boş** kalsın (onlar Google Play içindir),
   - **Önizleme sürümü olarak yayınla** kutusunu işaretle,
   - yeşil **Run workflow**.
3. 10-15 dakika sonra iş bittiğinde depo ana sayfasında sağdaki **Releases** bölümünde
   **Önizleme: main** sürümü çıkar. Telefondan bu sayfayı açıp `okey-test.apk` dosyasını indir
   ve kur (eski sürümün üstüne kurulur, hesabın telefonda kalır).
4. Uygulamayı aç: birkaç saniye (sunucu uyuyorsa en fazla bir dakika) içinde lobiye
   geçmelisin.

### İsteğe bağlı: sunucuyu uyutmamak

Ücretsiz plan ayda 750 saat çalışma verir; tek bir servis için bu ayın tamamına yeter.
[UptimeRobot](https://uptimerobot.com) gibi ücretsiz bir izleme servisine
`https://okey-sunucu.onrender.com/saglik` adresini **5 dakikada bir** kontrol ettirirsen
sunucu uyumaz; hem bekleme kalkar hem de veriler (yeni sürüm kurulana kadar) yerinde kalır.

## Kalıcı veri (gerçek yayın için)

Veritabanı tek bir SQLite dosyasıdır (`VERITABANI=/veri/okey.db`). Silinmemesi için `/veri`
klasörüne **kalıcı disk** bağlanabilen bir yer gerekir:

- **Render** ücretli planı: servis sayfasında **Disks** > **Add Disk**, *Mount Path* `/veri`.
- **Fly.io** (aşağıda) ya da herhangi bir VPS (Hetzner, DigitalOcean) + Docker.

Gerçek kullanıcılara açmadan önce `SATIN_ALMA_TEST` değerinin `0` olduğundan ve
`GOOGLE_SERVIS_HESABI_JSON`'un girildiğinden emin ol (docs/GOOGLE_PLAY.md).

## Alternatif: Fly.io (kalıcı disk, kart ister)

Fly.io yeni hesaplarda kredi kartı ister (kullandıkça öde; küçük bir makine + 1 GB disk
aylık birkaç dolar tutar). Karşılığında uyku ve veri kaybı yoktur.

```bash
# flyctl kur: https://fly.io/docs/flyctl/install/   sonra depo kökünde:
fly auth login
fly launch --dockerfile packages/sunucu/Dockerfile --no-deploy --region fra
#   (sorulara: uygulama adı ör. okey-sunucu, Postgres/Redis: hayır)
fly volumes create okey_veri --size 1 --region fra
```

Oluşan `fly.toml` dosyasında şunlar olsun:

```toml
[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "off"   # uyumasın

[[mounts]]
  source = "okey_veri"
  destination = "/veri"
```

Sonra `fly deploy`. Adres: `wss://okey-sunucu.fly.dev/ws` (6. adımdaki gibi `SUNUCU_URL`'ye yaz).

## Alternatif: kendi bilgisayarında (aynı Wi-Fi)

Hiçbir yere kurmadan, telefon ve bilgisayar **aynı Wi-Fi ağındayken** denemek için:

1. Bilgisayarda depo kökünde:
   ```bash
   npm install
   SATIN_ALMA_TEST=1 npm run dev:sunucu
   ```
   "Okey sunucusu 8080 portunda çalışıyor" yazmalı. (Windows PowerShell'de:
   `$env:SATIN_ALMA_TEST=1; npm run dev:sunucu`.)
2. Bilgisayarın yerel IP adresini bul:
   - Windows: `ipconfig` → "IPv4 Address", ör. `192.168.1.20`
   - macOS: `ipconfig getifaddr en0`
   - Linux: `hostname -I`
3. Telefonda uygulamanın giriş ekranında **Gelişmiş / Sunucu adresim var** (ya da
   Ayarlar > Sunucu) alanına `ws://192.168.1.20:8080/ws` yaz, **Kaydet**, **Oyna**.
   (`192.168.1.20:8080` yazman da yeter, uygulama tamamlar.)
4. Bağlanmazsa: bilgisayarın güvenlik duvarı 8080 portunu engelliyor olabilir (Windows ilk
   çalıştırmada "Node.js'e izin ver" diye sorar: **Özel ağlar**'ı işaretle). Telefonun
   tarayıcısında `http://192.168.1.20:8080/saglik` açılıyorsa adres doğrudur.

Bu yöntem sadece sen ve aynı ağdakiler içindir; bilgisayar kapanınca sunucu da kapanır.
