// Çalışma ortamına bağlı ayarlar: önizleme modu ve sunucu adresi.
import type { Ayarlar } from "../platform/depo.ts";
import { yerelMi } from "../platform/cihaz.ts";

/** Adres çubuğunda ?onizleme=1 varsa sunucu yerine sahte veri kullanılır (geliştirme için). */
export const ONIZLEME = new URLSearchParams(location.search).has("onizleme");

/** Sunucu adresi: Ayarlar'da girilen > VITE_SUNUCU_URL > emülatör/tarayıcı varsayılanı. */
export function sunucuAdresi(ayarlar: Ayarlar): string {
  if (ayarlar.sunucuUrl.trim()) return ayarlar.sunucuUrl.trim();
  if (import.meta.env.VITE_SUNUCU_URL) return import.meta.env.VITE_SUNUCU_URL;
  // Android emülatöründe 10.0.2.2 bilgisayarın kendisidir. Tarayıcıda ise sayfayı
  // sunan bilgisayarın 8080 portunu deneriz.
  return yerelMi() ? "ws://10.0.2.2:8080/ws" : `ws://${location.hostname || "localhost"}:8080/ws`;
}
