// Efekt ayarı: konfeti, parçacıklar, uzun animasyonlar açık mı?
//  - Kullanıcının uygulamadaki "Efektler" anahtarı (localStorage + Capacitor Preferences).
//  - Telefonun "hareketi azalt" (prefers-reduced-motion) ayarı açıksa efektler kapalı sayılır.
// Ayar <html data-efekt="acik|kapali"> özniteliğine de yansır; CSS animasyonları buna göre kısalır.
import { Preferences } from "@capacitor/preferences";

const ANAHTAR = "okey.efektler";

function kayitliOku(): boolean {
  try {
    return localStorage.getItem(ANAHTAR) !== "0";
  } catch {
    return true;
  }
}

let kullaniciAcik = kayitliOku();
const hareketSorgusu = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
const dinleyiciler = new Set<(acik: boolean) => void>();

function yansit() {
  const acik = efektlerAcik();
  if (typeof document !== "undefined") document.documentElement.dataset.efekt = acik ? "acik" : "kapali";
  dinleyiciler.forEach((f) => f(acik));
}

/** Efektler şu an açık mı? (Kullanıcı ayarı açık VE telefonda "hareketi azalt" kapalı.) */
export function efektlerAcik(): boolean {
  return kullaniciAcik && !hareketSorgusu?.matches;
}

/** Kullanıcının "Efektler" ayarı (hareketi azalt'tan bağımsız; ayarlar ekranındaki anahtar için). */
export function efektAyari(): boolean {
  return kullaniciAcik;
}

export function efektAyariniDegistir(acik: boolean): void {
  kullaniciAcik = acik;
  try {
    localStorage.setItem(ANAHTAR, acik ? "1" : "0");
  } catch {
    /* depolama yoksa sadece bu oturum için */
  }
  Preferences.set({ key: ANAHTAR, value: acik ? "1" : "0" }).catch(() => {});
  yansit();
}

/** Ayar değişince haber verir; dönen fonksiyon dinlemeyi bırakır. */
export function efektAyariniDinle(f: (acik: boolean) => void): () => void {
  dinleyiciler.add(f);
  return () => dinleyiciler.delete(f);
}

// Başlangıç: <html> özniteliğini ayarla, telefondaki kalıcı kaydı oku, "hareketi azalt" değişimini izle.
yansit();
hareketSorgusu?.addEventListener?.("change", yansit);
Preferences.get({ key: ANAHTAR })
  .then(({ value }) => {
    if (value === null) return;
    const acik = value !== "0";
    if (acik !== kullaniciAcik) {
      kullaniciAcik = acik;
      try {
        localStorage.setItem(ANAHTAR, value);
      } catch {
        /* yok say */
      }
      yansit();
    }
  })
  .catch(() => {});
