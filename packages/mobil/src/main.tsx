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
import "./tema.css";
import "./stil.css";
import { Uygulama } from "./Uygulama.tsx";

createRoot(document.getElementById("kok")!).render(
  <StrictMode>
    <Uygulama />
  </StrictMode>,
);
