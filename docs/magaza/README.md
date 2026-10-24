# Google Play mağaza görselleri

| Dosya | Boyut | Biçim | Play alanı |
|---|---|---|---|
| `one-cikan-gorsel.png` | 1024×500 | 24-bit PNG (alfasız) | Öne çıkan görsel (feature graphic) |
| `simge-512.png` | 512×512 | 32-bit PNG (RGBA, tamamen opak) | Uygulama simgesi |

Görseller `kaynak/` altındaki HTML/CSS dosyalarından Chromium (Playwright) ekran görüntüsüyle üretilir.

## Yeniden üretmek (tek komut)

Depo kökünden:

```bash
bash docs/magaza/kaynak/uret.sh
```

- `playwright-core` depoya bağımlılık olarak **eklenmez**; ilk çalıştırmada geçici bir klasöre kurulur
  (`$TMPDIR/okey-magaza-pw`, `OKEY_PW_DIR` ile değiştirilebilir).
- Chromium `PLAYWRIGHT_BROWSERS_PATH` (varsayılan `/opt/pw-browsers`) altındaki `chromium-*` klasöründen alınır;
  başka bir tarayıcı için `CHROMIUM_PATH=/yol/chrome` verin. `playwright install` gerekmez.
- Çıktılar `docs/magaza/*.png` üzerine yazılır.

## Kaynaklar (`kaynak/`)

- `ortak.css` – renk tokenleri (çuha `#0f3d2e`, altın `#e8c26a`, taş renkleri kırmızı `#c8312b`, sarı `#e0a020`,
  mavi `#1f5fbf`, siyah `#1d1d1d`), çuha dokusu ve okey taşı bileşeni (`.tas.kirmizi|sari|mavi|siyah`, `.tas.okey`).
  Taşın tüm ölçüleri `--g` (genişlik) değişkeninden türetilir.
- `one-cikan-gorsel.html` – başlık, slogan ve taş yelpazesi (kırmızı 11-12-13 + yıldızlı okey).
  Önemli içerik kenarlardan en az ~70 px içeride tutulur; üst/alt ahşap kenar yalnızca süstür.
- `simge.html` – bordo kadife çuha üzerinde altın yıldızlı okey taşı (öne çıkan görseldekiyle aynı stil). Köşeler bilerek yuvarlatılmaz; Play maskeyi kendisi uygular.
- `uret.cjs` / `uret.sh` – üretim betiği.
- `fonts/` – Nunito (700/800/900, latin + latin-ext; @fontsource/nunito 5.3.0'dan), lisans: `fonts/OFL.txt` (SIL OFL 1.1).

Değişiklik için HTML'i bir tarayıcıda açıp düzenleyin, ardından komutu yeniden çalıştırın.
