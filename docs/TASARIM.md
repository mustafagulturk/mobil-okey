# Tasarım Yönü: "Gece Salonu"

> Güncel durum: tasarım sistemi bu belgeyle kuruldu. Sonrasında varsayılan renk paleti **Osmanlı Konağı** oldu (bordo kadife çuha, antika altın; diğer paletler `packages/mobil/src/temalar/`), taşlar **kalın bakalit** oldu (bkz. `docs/taslar/`). Atılan taşlar klasik düzende masanın dört köşesinde durur; yığının kime ait olduğu madalyon rengi ve okla gösterilir.

Hedef: ilk bakışta "bu pahalı bir oyun" dedirten, sıcak ve lüks bir gece kahvehanesi/salon havası. Koyu, derin zemin; üstten vuran sıcak lamba ışığı; zümrüt çuha; cilalı ceviz ahşap; metalik altın; fildişi 3D taşlar. Her etkileşimde küçük ama tatmin edici bir hareket.

## Kurallar
- Renk/ölçü SADECE `src/tema.css` değişkenleri ile. Yeni bir değere ihtiyaç olursa kendi CSS dosyanın en üstünde `:root { --... }` olarak tanımla ve yorumla "tema.css'e taşınacak" yaz; sonunda hepsi tema.css'e toplanır.
- Yazı: başlıklar ve büyük sayılar `--yazi-tipi-baslik` (Fredoka), gövde `--yazi-tipi` (Nunito).
- Paneller: cam görünüm (`--cam-zemin`, `backdrop-filter: var(--cam-bulanik)`, `border: var(--cam-kenar)`, `box-shadow: var(--golge), var(--cam-ust-isik)`).
- Birincil düğmeler: `--gradyan-altin-metal`, basınca `scale(.96)`, üstünden ara ara kayan parıltı (`--parilti`).
- Zemin: `--zemin-gece` + `--isik-lamba` + `--doku-gurultu` katmanları; arkada yavaşça süzülen ışık tozları (Parcaciklar bileşeni).
- Hareket: transform/opacity ile (GPU dostu). `--egri-yay`, `--egri-yumusak`. Telefonun "hareketi azalt" ayarı ve uygulamadaki "Efektler" ayarı kapalıysa animasyonlar kısalır/kapanır.
- Yatay telefon: 844x390 ve 915x412'de taşma, kesilme yok; çentik için güvenli alan.

## Ortak efekt API'si (`src/efektler/`, Tasarım Sistemi ajanı yazar)
- `efektlerAcik(): boolean` ve `efektAyariniDegistir(acik: boolean)` — `efektler/ayar.ts` (Preferences/localStorage, prefers-reduced-motion'ı da hesaba katar).
- `<Parcaciklar yogunluk?: "az" | "normal" />` — tam ekran arka plan canvas'ı, süzülen sıcak ışık tozları; sayfa gizliyken durur.
- `kutlama(tur: "konfeti" | "cipYagmuru" | "seviye", secenek?: { kaynak?: DOMRect; miktar?: number })` — `efektler/kutlama.ts`, üstte geçici canvas, kendi kendini temizler.
- `<SayiSayaci deger={number} bicim?={(n)=>string} />` — değer değişince eski değerden yeniye sayarak akar.
- `ucur(baslangic: DOMRect, hedef: DOMRect, icerik: HTMLElement | (() => HTMLElement), secenek?: { sure?: number; yay?: number; donus?: number }): Promise<void>` — `efektler/ucus.ts` (Masa ajanı yazar): bir taşı A'dan B'ye yay çizerek uçurur (FLIP).
