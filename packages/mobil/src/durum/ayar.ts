// Çalışma ortamına bağlı ayarlar: önizleme modu ve sunucu adresi.
import type { Ayarlar } from "../platform/depo.ts";
import { yerelMi } from "../platform/cihaz.ts";

const sorgu = new URLSearchParams(location.search);

/** Adres çubuğunda ?onizleme=1 varsa sunucu yerine sahte veri kullanılır (geliştirme için). */
export const ONIZLEME = sorgu.has("onizleme");

/**
 * Yalnız geliştirmede: ?sunucusuz=1 telefondaki "sunucu adresi yapılandırılmamış" durumunu
 * tarayıcıda taklit eder (Ayarlar'da adres girilirse o yine kullanılır).
 */
const SUNUCUSUZ_TAKLIT = import.meta.env.DEV && sorgu.has("sunucusuz");

/** Ayarlar'daki adres alanında örnek olarak gösterilen adres. */
export const ORNEK_ADRES = "wss://okey-sunucu.onrender.com/ws";

/**
 * Sunucu adresi: Ayarlar'da girilen > VITE_SUNUCU_URL > geliştirme varsayılanı.
 *
 * null dönerse online oyun için bir adres yoktur: telefona kurulan sürümde (Capacitor)
 * ne derlemede VITE_SUNUCU_URL verilmiş ne de Ayarlar'da adres girilmiştir. Bu durumda
 * boşuna localhost'a bağlanmaya çalışılmaz; giriş ekranı antrenmanı öne çıkarır.
 */
export function sunucuAdresi(ayarlar: Ayarlar): string | null {
  if (ayarlar.sunucuUrl.trim()) return adresiDuzelt(ayarlar.sunucuUrl);
  if (SUNUCUSUZ_TAKLIT) return null;
  if (import.meta.env.VITE_SUNUCU_URL) return adresiDuzelt(import.meta.env.VITE_SUNUCU_URL);
  if (yerelMi()) {
    // Telefonda bilgisayarın adresini bilemeyiz. Yalnız geliştirme derlemesinde Android
    // emülatörünü varsayarız (10.0.2.2 emülatörde bilgisayarın kendisidir).
    return import.meta.env.DEV ? "ws://10.0.2.2:8080/ws" : null;
  }
  // Tarayıcıda sayfayı sunan bilgisayarın 8080 portunu deneriz.
  return `ws://${location.hostname || "localhost"}:8080/ws`;
}

/**
 * Kullanıcının yazdığı adresi WebSocket adresine çevirir:
 *   "https://okey.onrender.com"   -> "wss://okey.onrender.com/ws"
 *   "okey.onrender.com"           -> "wss://okey.onrender.com/ws"
 *   "192.168.1.20:8080"           -> "ws://192.168.1.20:8080/ws"
 *   "ws://192.168.1.20:8080/ws"   -> değişmez
 */
export function adresiDuzelt(girdi: string): string {
  let a = girdi.trim();
  if (!a) return a;
  if (/^https:\/\//i.test(a)) a = "wss://" + a.slice(8);
  else if (/^http:\/\//i.test(a)) a = "ws://" + a.slice(7);
  else if (!/^wss?:\/\//i.test(a)) {
    // Şema yok: yerel ağ adresi (IP, localhost ya da port verilmiş) ise şifresiz, değilse TLS.
    const ana = a.split(/[/:]/)[0] ?? "";
    const yerelAg = /^(localhost|\d{1,3}(\.\d{1,3}){3})$/.test(ana) || /:\d+/.test(a);
    a = (yerelAg ? "ws://" : "wss://") + a;
  }
  // Yol verilmemişse sunucunun WebSocket yolu /ws eklenir.
  const m = /^(wss?:\/\/[^/?#]+)(.*)$/i.exec(a);
  if (m && (m[2] === "" || m[2] === "/")) a = `${m[1]}/ws`;
  return a;
}
