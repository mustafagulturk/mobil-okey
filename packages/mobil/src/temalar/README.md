# Alternatif renk paletleri

Her dosya yalnızca `:root[data-tema="<ad>"]` altında `src/tema.css` değişkenlerinin
üzerine yazar. `<html>` etiketinde `data-tema` yoksa uygulama tema.css'teki
"Gece Salonu" ile açılır; bu klasör hiçbir şeyi değiştirmez.

| ad | his |
| --- | --- |
| `gece-salonu` | 0 — mevcut tema (zümrüt çuha, ceviz, altın) |
| `bogaz-gecesi` | lacivert çuha, bakır vurgu, maun |
| `osmanli-konagi` | bordo kadife çuha, antika altın, gül ağacı |
| `modern-lounge` | antrasit çuha, neon camgöbeği + pembe, karbon, beyaz taşlar |
| `gunduz-kahvehanesi` | açık krem menüler, adaçayı çuha, açık ceviz (tek açık tema) |
| `iznik` | çini yeşili zemin, turkuaz çuha, kobalt çerçeve, İznik kırmızısı |

## Kalıcı seçmek

`packages/mobil/index.html` içindeki `<html>` etiketine öznitelik yazmak yeterli:

```html
<html lang="tr" data-tema="bogaz-gecesi">
```

İsterseniz aynı dosyadaki `<meta name="theme-color">` değerini de temanın zemin
rengine çekin (Android durum çubuğu).

## Geliştirirken denemek

Adrese `?tema=<ad>` ekleyin (main.tsx bunu `<html data-tema>`'ya yazar), ör.
`http://localhost:5173/?onizleme=1&tema=iznik`.

## Notlar

- `ortak.css`: tema.css'te `:root[data-efekt="kapali"] {` bloğu kapatılmadığı için
  masa çerçevesi/çuhası ve salon kartı zeminleri efektler açıkken hiç çizilmiyor.
  Bu dosya o değişkenleri herhangi bir `data-tema` varken birebir aynı değerlerle
  tanımlar. tema.css düzelince silinebilir.
- Taş rakamları: varsayılan sarı `#e48300` fildişi üstünde 2.3:1 (WCAG büyük yazı
  için 3:1'in altında). Alternatif temalarda sarı `#c76f00` (3.05:1), kırmızı
  `#c4122f` (5.0:1), mavi `#1450c8` (5.8:1).
- `gunduz-kahvehanesi`: açık tema olduğu için masa, salon kartları ve isim
  etiketleri gibi koyu zeminli bileşenlerde değişkenleri (ve miras gelen `color`'ı)
  koyu değerlere geri çevirir. Bileşenlerdeki sabit renkler (ör. `#fffaf0` yazılar,
  siyah gölgeler) değişkene taşınmadan tam bir açık tema olmaz.
