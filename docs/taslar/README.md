# Taş setleri

`prototip.html` dört taş setini masa, istaka, yığın (30 px) ve deste boyunda yan yana gösteren tek dosyalık bir çalışmadır. `hepsi.png` dosyası bu sayfanın ekran görüntüsüdür.

Prototip, `packages/mobil/src/bilesenler/Tas.tsx` ile aynı DOM'u kullanır (`.tas .tas--{renk} .tas--okey .tas--sahte .tas--kapali`, `.tas__sayi .tas__nokta .tas__sahte .tas__yildiz .tas__parilti`). Her set yalnızca kendi kapsamı altındaki CSS'ten oluşur (`.y1` … `.y4`). Sayfa Oswald yazı tipini yerel `node_modules` yolundan yükler. Yazı tipi bulunamazsa sayfa yedek yazı tipiyle açılır.

## Setler

| # | Ad | Durum | Görsel ipucu |
|---|----|-------|--------------|
| 1 | Kalın bakalit | **Varsayılan.** Uygulamaya taşındı (`temel.css` taş bölümü, `tema.css` `--tas-*`). | Fildişi yüz, altında derin ve dikine bir yan yüz, eğimli kenar (bevel), üstte lake cila bandı, oyulmuş rakam. Kapalı taşın sırtında kabartma sekiz köşeli yıldız var. |
| 2 | Altın yaldızlı fildişi | Sonraki güncelleme | İnci-sedef yüz, altın çerçeve, altın konturlu rakam ve köşede lale motifi. |
| 3 | Siyah lüks (onyx) | Sonraki güncelleme | Damarlı siyah onyx yüz, metalik folyo rakamlar ve altın kenar. |
| 4 | Mermer + çini | Sonraki güncelleme | Beyaz damarlı mermer yüz, köşelerde İznik süsleri, keskin koyu rakam. |

2, 3 ve 4 numaralı setler, sonraki güncellemede görevle kazanılan ya da Play'den satın alınan taş setleri olarak düşünülüyor.

## Uygulamaya taşırken dikkat edilecekler

- **SVG değişkenleri.** Prototip bazı motifleri JS ile kök öğeye değişken olarak atar: `--sirt-y1..4` (kapalı taş sırtı), `--lale`, `--kose-*` (İznik köşeleri) ve `--damar-*`. Uygulamada JS kullanılmaz. Her SVG `encodeURIComponent` ile kodlanıp sabit bir `url("data:image/svg+xml,...")` olarak CSS'e yazılır. Örnek için `tema.css` içindeki `--tas-sirt-motif` değişkenine bakın.
- **feTurbulence damarları** (onyx ve mermer setleri). `--damar-acik` ve `--damar-koyu` değişkenleri 300×440 boyutunda, `feTurbulence` filtreli SVG'lerdir. Her taşta bir arka plan katmanı olarak çizilirler. 15 taşlık istakada bu pahalı olabilir. Önce düşük uçlu Android cihazda ölçün. Gerekirse damarı bir kez PNG/WebP olarak üretip tek bir doku olarak kullanın. `data-efekt="kapali"` modunda damar katmanını kaldırın.
- **`--dx` / `--dy`.** Damar dokusu her taşta başka bir yerden görünsün diye prototip her taşa satır içi `--dx` ve `--dy` yüzdeleri verir. Uygulamada bunu `Tas.tsx` taş id'sinden türetebilir (ör. `(id*37)%100`). Değer sabit kalmalı, yoksa taş yer değiştirdiğinde deseni de değişir.
- **Kalınlık yer kaplamaz.** Yan yüz `box-shadow` ile çizilir. Taşın altında `--kalin` (= en × `--tas-derinlik`) kadar boşluk bırakmak, taşı dizen yerin işidir: istaka rafının `padding-bottom` değeri, sonuç penceresindeki boşluklar. Prototipteki `margin-bottom` uygulamada kullanılmadı.
- **Küçük boylar.** Yaklaşık 30 px ve altındaki boylarda (`.tas--orta`, `.tas--kucuk`) gölge katmanları azaltılır. Rakam filtresiz, düz renkte çizilir.
- **Tema uyumu.** Yan yüz renkleri temadan gelir (`--tas-kenar`, `--tas-yan`, `--tas-alt-golge`, `--tas-alt-koyu`). Yeni bir set eklenirken bu değişkenler set kapsamında yeniden tanımlanmalı, temel kurallara dokunulmamalıdır.
- **Rakam renkleri** setlere göre değişir: koyu zeminli onyx setinde açık ve metalik tonlar kullanılır. Her set kendi `--tas-kirmizi/sari/mavi/siyah/sahte` değerlerini tanımlar. Okunabilirliği 30 px'lik yığın boyunda kontrol edin.
