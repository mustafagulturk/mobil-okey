# Google Play'e Yayınlama Rehberi

Bu belge, Okey Salonu'nu sıfırdan Google Play'e çıkarmak için gereken adımları sırasıyla anlatır. Kodda yapılması gerekenler hazır; buradaki adımlar hesap açma ve ayar girme işleridir.

Kısa özet:

1. Play Console geliştirici hesabı aç
2. Yükleme anahtarını üret ve GitHub'a gizli değişken olarak ekle
3. Oyun sunucusunu internete çıkar
4. Play Console'da uygulamayı oluştur, politika formlarını doldur
5. Çip paketlerini (uygulama içi ürünler) oluştur
6. Sunucunun satın almaları doğrulayabilmesi için servis hesabı aç
7. AdMob hesabı ve ödüllü reklam birimi oluştur
8. Sürümü derle, kapalı teste çıkar, sonra üretime gönder

---

## 1. Geliştirici hesabı

- https://play.google.com/console adresinden hesap aç. Tek seferlik 25 dolar ücret var.
- Kişisel hesaplarda kimlik doğrulaması isteniyor; birkaç gün sürebilir.
- **Önemli:** Yeni kişisel hesaplarda üretime çıkmadan önce uygulamanın **en az 12 test kullanıcısıyla en az 14 gün kesintisiz kapalı testte** kalması gerekiyor. Arkadaşlarından 12 Gmail adresi topla (8. adım).

## 2. Yükleme anahtarı (upload key)

Play'e yüklenen her dosya bu anahtarla imzalanır. Anahtarı kaybedersen Play Console'dan sıfırlama istemen gerekir, o yüzden dosyayı ve şifreleri güvenli bir yerde sakla. **Anahtarı asla depoya koyma.**

Java yüklü bir bilgisayarda (Android Studio ile gelir):

```bash
keytool -genkeypair -v -keystore yukleme-anahtari.jks -alias okey -keyalg RSA -keysize 2048 -validity 10000
```

Sorulan şifreleri not al. Sonra dosyayı metne çevir:

```bash
# macOS / Linux
base64 -i yukleme-anahtari.jks | tr -d '\n' > anahtar.txt
# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("yukleme-anahtari.jks")) > anahtar.txt
```

GitHub'da depo > **Settings > Secrets and variables > Actions > Secrets** bölümüne ekle:

| Gizli değişken | Değer |
| --- | --- |
| `OKEY_KEYSTORE_BASE64` | anahtar.txt içeriği |
| `OKEY_KEYSTORE_SIFRESI` | keystore şifresi |
| `OKEY_ANAHTAR_ADI` | `okey` (yukarıdaki -alias) |
| `OKEY_ANAHTAR_SIFRESI` | anahtar şifresi (genelde keystore şifresiyle aynı) |

Play Console'da ilk yüklemede "Play Uygulama İmzalama" açık kalsın; Google son imzayı kendi anahtarıyla atar.

## 3. Oyun sunucusu

Oyun online olduğu için sunucunun 7/24 çalışması gerekir. Test için kart vermeden ücretsiz kurulum (Render.com, veriler kalıcı değil): [`SUNUCU_KURULUM.md`](SUNUCU_KURULUM.md). Sunucu Docker imajı olarak hazır (`packages/sunucu/Dockerfile`) ve veritabanı tek bir SQLite dosyası olduğu için **kalıcı disk** veren bir yer seçilmeli. Örnek: Fly.io (küçük bir makine + 1 GB volume), Railway, ya da herhangi bir VPS (Hetzner, DigitalOcean).

Sunucuda ayarlanacak ortam değişkenleri `packages/sunucu/README.md` dosyasında. En önemlileri:

- `VERITABANI=/veri/okey.db` (kalıcı diskin içinde olmalı)
- `GOOGLE_SERVIS_HESABI_JSON` (6. adım)
- `ANDROID_PAKET_ADI=dev.mustafagulturk.okey`
- `SATIN_ALMA_TEST` **ayarlanmamalı** (sadece geliştirmede 1 yapılır)

Sunucu adresi `https://` ile çalışmalı (telefon `wss://alanadi/ws` adresine bağlanır). GitHub'da **Settings > Secrets and variables > Actions > Variables** bölümüne `SUNUCU_URL = wss://alanadi/ws` ekle; uygulama derlenirken bu adres içine yazılır.

## 4. Uygulamayı oluşturma ve politika formları

Play Console > **Uygulama oluştur**: ad "Okey Salonu", varsayılan dil Türkçe, tür **Oyun**, **Ücretsiz**.

**Uygulama içeriği** bölümündeki formlar:

| Form | Ne seçilecek |
| --- | --- |
| Gizlilik politikası | `https://github.com/mustafagulturk/mobil-okey/blob/main/docs/GIZLILIK.md` |
| Reklamlar | Evet, uygulama reklam içeriyor |
| Uygulama erişimi | Tüm özellikler kısıtlamasız (giriş için sadece takma ad) |
| İçerik derecelendirmesi | Kategori "Oyun". **Simüle kumar: Evet** (sanal çiple masaya oturuluyor). Gerçek parayla kumar: Hayır. Kullanıcılar arası etkileşim: Evet (sohbet). Dijital ürün satın alma: Evet |
| Hedef kitle | 18 ve üzeri |
| Veri güvenliği | Aşağıdaki tablo |
| Finansal özellikler | Yok |
| Devlet uygulaması / haber | Hayır |

Veri güvenliği formu için:

- Toplanan veriler: **Uygulama etkinliği** (oyun içi işlemler), **Kimlikler** (kullanıcı kimliği: rastgele oyuncu kimliği), **Uygulama içi mesajlar** (sohbet, kalıcı saklanmaz), **Satın alma geçmişi**, **Cihaz kimlikleri** (AdMob reklam kimliği).
- Veriler aktarım sırasında şifrelenir: Evet (wss/https).
- Kullanıcı verilerinin silinmesini isteyebilir: Evet (uygulama içinde Ayarlar > Hesabımı sil). Web'den silme bağlantısı olarak GitHub issues adresi verilebilir.

Not: Sanal çiple oynanan kart/taş oyunları Play'de "sosyal casino / simüle kumar" sayılır. Kurallar: çip paraya çevrilemez, oyuncular arasında aktarılamaz, gerçek ödül verilmez. Oyun bu kurallara göre yazıldı; mağaza açıklamasına da "Gerçek parayla kumar içermez; çipler paraya çevrilemez" cümlesini ekle.

## 5. Çip paketleri (uygulama içi ürünler)

Önce Play Console'da **ödeme profili** (satıcı hesabı) oluşturman gerekiyor. Sonra **Para kazanma > Ürünler > Uygulama içi ürünler** bölümünde şu ürünleri aç. Ürün kimlikleri koddaki (`packages/kurallar/src/ekonomi.ts`) adlarla **birebir aynı** olmalı:

| Ürün kimliği | Verdiği çip | Önerilen fiyat |
| --- | --- | --- |
| `cip_25k` | 25.000 | 29,99 TL |
| `cip_100k` | 100.000 | 99,99 TL |
| `cip_500k` | 500.000 | 399,99 TL |
| `cip_2m` | 2.000.000 | 1.299,99 TL |

Fiyatı istediğin gibi değiştirebilirsin; uygulama fiyatı Play'den okur. Çip miktarını değiştirmek istersen `ekonomi.ts` dosyasındaki `CIP_PAKETLERI` listesini düzenle.

Ürünler ancak uygulamanın bir sürümü (en az dahili test) yüklendikten sonra oluşturulabilir.

## 6. Satın alma doğrulaması için servis hesabı

Telefon satın almayı bitirince sunucuya bir "satın alma jetonu" gönderir. Sunucu bu jetonu Google'a sorar, gerçekse çipi verir ve ürünü tüketir. Bunun için:

1. https://console.cloud.google.com adresinde bir proje aç.
2. **Google Play Android Developer API**'yi etkinleştir.
3. **IAM > Servis hesapları > Hesap oluştur**, sonra **Anahtarlar > JSON anahtar ekle**. İnen JSON dosyasının içeriği sunucudaki `GOOGLE_SERVIS_HESABI_JSON` değişkenine yazılır.
4. Play Console > **Kullanıcılar ve izinler > Yeni kullanıcı davet et**: servis hesabının e-posta adresini ekle, uygulamaya **"Finansal verileri görüntüleme"** ve **"Siparişleri ve abonelikleri yönetme"** izinlerini ver.

İzinlerin etkinleşmesi birkaç saat sürebilir.

## 7. AdMob (ödüllü reklam)

1. https://admob.google.com adresinde hesap aç, ödeme bilgilerini gir.
2. **Uygulamalar > Uygulama ekle**: Android, (yayında değilse) "henüz yayınlanmadı" seç. Uygulama kimliği `ca-app-pub-...~...` şeklindedir.
3. **Reklam birimi ekle > Ödüllü**: ödül miktarı 250, ödül adı "çip". Birim kimliği `ca-app-pub-.../...` şeklindedir.
4. Aynı reklam biriminin **Sunucu taraflı doğrulama** ayarına `https://SUNUCU_ADRESIN/reklam-odulu` yaz. Böylece ödülü telefon değil sunucu verir, hile yapılamaz.
5. GitHub **Variables** bölümüne ekle: `ADMOB_UYGULAMA_ID` ve `ADMOB_ODULLU`.
6. AdMob `app-ads.txt` ister: Play mağaza kaydındaki web sitesi olarak `https://mustafagulturk.github.io` yaz ve AdMob'un verdiği satırı portfolyo deposunun köküne `app-ads.txt` adıyla ekle.

Bu değişkenler girilmeden derlenen sürümler Google'ın **test reklamlarını** gösterir. Kendi gerçek reklamlarına asla kendin tıklama; hesap kapatılabilir.

## 8. Derleme ve yayın

1. GitHub > **Actions > CI > Run workflow**: `surum` = `1.0.0`, `surumKodu` = `1`. (Her yeni yüklemede sürüm kodu bir artmalı.)
2. İş bitince çalıştırmanın sayfasından **okey-play-aab** dosyasını indir (`.aab`). Aynı sürümün APK'sı GitHub Releases sayfasına da eklenir.
3. Play Console > **Test > Dahili test**: yeni sürüm oluştur, `.aab` dosyasını yükle. Kendini test kullanıcısı ekleyip Play'den indir ve satın almayı test et (test hesaplarına ödeme alınmaz: **Ayarlar > Lisans testi** bölümüne Gmail adresini ekle).
4. **Kapalı test**: 12 test kullanıcısını ekle, 14 gün boyunca testte kalsın.
5. 14 gün dolunca Play Console'un **Üretime erişim başvurusu** formunu doldur, onay gelince üretime sürüm gönder.

## Mağaza kaydı için hazır metinler

**Kısa açıklama (80 karakter):**
Arkadaşlarınla ya da Türkiye'nin dört bir yanından rakiplerle canlı Okey oyna!

**Uzun açıklama:**

Okey Salonu'nda gerçek oyuncularla, gerçek zamanlı Okey keyfi!

• Hızlı oyun: saniyeler içinde bir masaya otur. Masa dolmazsa boş koltuklara botlar oturur, beklemezsin.
• Arkadaşlarınla oyna: özel oda kur, 5 haneli kodu paylaş.
• Salonlar: Çaylak Masası'ndan Ağalar Konağı'na, çipine uygun salonda oyna.
• Klasik kurallar: seri ve çift bitirme, okey atarak bitirme, gösterge gösterme.
• İstaka kolaylıkları: taşları sürükle bırak, tek dokunuşla seri ya da çift diz.
• Seviye atla, günlük görevleri tamamla, isim etiketine çerçeve, rozet ve unvan kazan.
• Masada sohbet ve hızlı mesajlar.
• Antrenman modu: internetsiz, botlara karşı pratik yap.

Oyun gerçek parayla kumar içermez. Çipler sadece oyun içinde kullanılır; paraya çevrilemez ve başka oyunculara aktarılamaz.

**Grafikler:** 512x512 simge, 1024x500 öne çıkan görsel ve en az 2 telefon ekran görüntüsü gerekir. Ekran görüntüleri `docs/ekran/` klasöründe.
