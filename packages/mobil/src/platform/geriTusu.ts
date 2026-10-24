// Android geri tuşu.
//
// Ekranda o an "en üstte" ne varsa geri tuşu onu kapatır. Bunun için basit bir yığın
// tutulur: açılan pencere/panel useGeriTusu() ile kendi kapatma fonksiyonunu yığına
// koyar, kapanınca çıkarır. Yığın boşsa ekranın varsayılan davranışı çalışır
// (alt ekrandan lobiye dön, lobide uygulamayı küçült). Tarayıcıda geri tuşu yoktur.
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect, useRef } from "react";

type Isleyici = () => void;

const yigin: Isleyici[] = [];
let varsayilan: Isleyici = () => void App.minimizeApp();

/** Yığın boşken çalışacak davranış (Uygulama.tsx her ekranda bunu ayarlar). */
export function varsayilanGeri(fn: Isleyici) {
  varsayilan = fn;
}

/** Bileşen ekrandayken (ve aktif=true iken) geri tuşu fn'i çalıştırır. */
export function useGeriTusu(fn: Isleyici, aktif = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!aktif) return;
    const isleyici = () => ref.current();
    yigin.push(isleyici);
    return () => {
      const i = yigin.lastIndexOf(isleyici);
      if (i !== -1) yigin.splice(i, 1);
    };
  }, [aktif]);
}

/** Uygulama açılışında bir kez çağrılır. */
export function geriTusunuDinle() {
  if (!Capacitor.isNativePlatform()) return;
  void App.addListener("backButton", () => (yigin.at(-1) ?? varsayilan)());
}

export function uygulamayiKucult() {
  if (Capacitor.isNativePlatform()) void App.minimizeApp();
}
