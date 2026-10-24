// Masada tam ekran (immersive): Android'in durum ve gezinme çubuklarını gizler.
// Kenardan kaydırınca çubuklar geçici olarak görünür. İşi, android/ içindeki küçük
// yerel eklenti (TamEkranEklentisi.java) yapar; tarayıcıda hiçbir şey olmaz.
import { App } from "@capacitor/app";
import { Capacitor, registerPlugin } from "@capacitor/core";

interface TamEkranEklentisi {
  ac(): Promise<void>;
  kapat(): Promise<void>;
}

const TamEkran = registerPlugin<TamEkranEklentisi>("TamEkran");

/** Tam ekranı açar; dönen fonksiyon kapatır. Uygulama arka plandan dönünce yeniden uygulanır. */
export function tamEkranAc(): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};
  const ac = () => TamEkran.ac().catch(() => {});
  void ac();
  const dinleyici = App.addListener("resume", ac);
  return () => {
    void dinleyici.then((d) => d.remove());
    void TamEkran.kapat().catch(() => {});
  };
}
