// Uygulamanın giriş noktası: yazı tipi, tema ve kök bileşen.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Yazı tipi uygulamanın içine paketlenir (internetsiz de çalışır). Türkçe harfler (ğ, ş, ı, İ)
// latin-ext alt kümesindedir; diğer alfabeler gereksiz yer kaplamasın diye alınmaz.
import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-ext-400.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-ext-700.css";
import "@fontsource/nunito/latin-800.css";
import "@fontsource/nunito/latin-ext-800.css";
import "@fontsource/nunito/latin-900.css";
import "@fontsource/nunito/latin-ext-900.css";
// Başlık yazı tipi (Fredoka): logo, başlıklar ve büyük sayılar.
import "@fontsource/fredoka/latin-500.css";
import "@fontsource/fredoka/latin-ext-500.css";
import "@fontsource/fredoka/latin-600.css";
import "@fontsource/fredoka/latin-ext-600.css";
import "@fontsource/fredoka/latin-700.css";
import "@fontsource/fredoka/latin-ext-700.css";
import "./tema.css";
import "./stil.css";
import { Uygulama } from "./Uygulama.tsx";
import { geriTusunuDinle } from "./platform/geriTusu.ts";
// Efekt ayarını erkenden yükle (<html data-efekt> özniteliği ilk çizimden önce hazır olsun).
import "./efektler/ayar.ts";

geriTusunuDinle();

createRoot(document.getElementById("kok")!).render(
  <StrictMode>
    <Uygulama />
  </StrictMode>,
);
