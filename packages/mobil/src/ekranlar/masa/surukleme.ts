// Ortak sürükleme altyapısı (istakadaki taşlar, desteden/yandan çekme).
//
// Akıcılık için:
//  - Parmak hareketi React state'ine yazılmaz. pointermove sadece son konumu saklar;
//    iş (hayaleti taşımak, altındaki öğeye bakmak) requestAnimationFrame'de karede
//    bir kez yapılır.
//  - Hayalet "transform: translate3d" ile taşınır (layout yok, GPU katmanı).
//  - Hedef yuva vurgusu sınıf ekleyip çıkararak yapılır (React render'ı yok).
//  - Sürükleme boyunca arka plandaki toz efekti (tam ekran canvas) ve her karede
//    yeniden boyama isteyen süs animasyonları (isim etiketi parıltısı, lamba) durur
//    (<html class="surukleniyor">, bkz. masa.css).
//  - Pointer capture alınır: parmak taştan çıksa da olaylar kaybolmaz.
import type { PointerEvent as ReactPointerEvent } from "react";
import { parcaciklariDuraklat } from "../../efektler/Parcaciklar.tsx";

export const KAYMA_ESIGI = 6;

export interface SuruklemeIsleyici {
  /** Eşik aşıldı. false dönerse sürükleme hiç başlamaz (hiçbir şey olmaz). */
  basla: () => boolean | void;
  /** Karede en fazla bir kez: parmağın konumu ve altındaki öğe. */
  hareket: (x: number, y: number, alt: HTMLElement | null) => void;
  /** Parmak kalktı (iptal: pointercancel, ör. sistem hareketi). */
  bitir: (x: number, y: number, alt: HTMLElement | null, iptal: boolean) => void;
  /** Hiç kaymadan bırakıldı (dokunuş). */
  dokunus?: () => void;
}

/** Şu an süren bir sürükleme var mı? (İkinci parmak yeni sürükleme başlatmasın.) */
let aktif = false;

/** Parmağın altındaki öğe. Hayalet "pointer-events: none" olduğu için onu atlar. */
export function altindaki(x: number, y: number): HTMLElement | null {
  return document.elementFromPoint(x, y) as HTMLElement | null;
}

/** pointerdown'da çağrılır; gerisini (eşik, kareler, bırakma) kendisi izler. */
export function suruklemeyiIzle(e: ReactPointerEvent<HTMLElement>, is: SuruklemeIsleyici): void {
  if (aktif || (e.pointerType === "mouse" && e.button !== 0)) return;
  aktif = true;
  const id = e.pointerId;
  const hedef = e.currentTarget;
  try {
    hedef.setPointerCapture(id);
  } catch {
    /* bazı tarayıcılarda olmayabilir */
  }
  const bx = e.clientX;
  const by = e.clientY;
  let x = bx;
  let y = by;
  let basladi = false;
  let kare = 0;
  let duraklat: (() => void) | null = null;

  const ciz = () => {
    kare = 0;
    is.hareket(x, y, altindaki(x, y));
  };

  const hareket = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return;
    x = ev.clientX;
    y = ev.clientY;
    if (!basladi) {
      if (Math.hypot(x - bx, y - by) <= KAYMA_ESIGI) return;
      if (is.basla() === false) {
        temizle();
        return;
      }
      basladi = true;
      duraklat = parcaciklariDuraklat();
      document.documentElement.classList.add("surukleniyor");
    }
    if (!kare) kare = requestAnimationFrame(ciz);
  };

  const birak = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return;
    const iptal = ev.type === "pointercancel";
    const bulundu = basladi;
    temizle();
    if (!bulundu) {
      if (!iptal) is.dokunus?.();
      return;
    }
    sonSurukleme = performance.now();
    is.bitir(ev.clientX, ev.clientY, iptal ? null : altindaki(ev.clientX, ev.clientY), iptal);
  };

  function temizle() {
    aktif = false;
    if (kare) cancelAnimationFrame(kare);
    kare = 0;
    duraklat?.();
    duraklat = null;
    document.documentElement.classList.remove("surukleniyor");
    window.removeEventListener("pointermove", hareket);
    window.removeEventListener("pointerup", birak);
    window.removeEventListener("pointercancel", birak);
    try {
      if (hedef.hasPointerCapture(id)) hedef.releasePointerCapture(id);
    } catch {
      /* yok sayılır */
    }
  }

  window.addEventListener("pointermove", hareket);
  window.addEventListener("pointerup", birak);
  window.addEventListener("pointercancel", birak);
}

let sonSurukleme = 0;

/** Bir sürükleme az önce bitti mi? (Sürükleme sonrası gelen "click" yok sayılsın.) */
export function suruklemeYeniBitti(): boolean {
  return performance.now() - sonSurukleme < 400;
}

/** Hayaleti parmağın altına koyar (ofset: parmağın taşın sol üst köşesine göre yeri). */
export function hayaletiKoy(el: HTMLElement | null, x: number, y: number, ofsetX: number, ofsetY: number) {
  if (el) el.style.transform = `translate3d(${x - ofsetX}px, ${y - ofsetY}px, 0)`;
}

// ---------- Hedef yuva vurgusu (DOM sınıfıyla, render'sız) ----------
let vurgulu: HTMLElement | null = null;

/** Altındaki öğeden yuvayı bulur, vurgular ve yuva numarasını döndürür. */
export function yuvaVurgula(alt: HTMLElement | null): number | null {
  const yuva = alt?.closest<HTMLElement>(".istaka [data-yuva]") ?? null;
  if (yuva !== vurgulu) {
    vurgulu?.classList.remove("yuva--hedef");
    yuva?.classList.add("yuva--hedef");
    vurgulu = yuva;
  }
  return yuva ? Number(yuva.dataset.yuva) : null;
}

export function yuvaVurgusunuKaldir() {
  vurgulu?.classList.remove("yuva--hedef");
  vurgulu = null;
}

/** Sürükleme başladı/bitti ve parmak bir bırakma alanının üstünde mi. */
export type SuruklemeDurumu = "yok" | "var" | "atUstunde" | "bitirUstunde" | "perUstunde";

/**
 * Bırakma hedefi: atma alanı, bitirme alanı (Okey: göstergenin üstü) ya da masadaki bir per
 * (101'de işleme). Hedefler HTML'de data-birak ile işaretlenir; per için data-koltuk ve data-per.
 */
export type BirakmaHedefi = { alan: "at" } | { alan: "bitir" } | { alan: "per"; koltuk: number; per: number };

/** Altındaki öğe hangi bırakma alanında? */
export function birakmaAlani(alt: HTMLElement | null): BirakmaHedefi | null {
  const el = alt?.closest<HTMLElement>("[data-birak]");
  const a = el?.dataset.birak;
  if (a === "at" || a === "bitir") return { alan: a };
  if (el && a === "per") return { alan: "per", koltuk: Number(el.dataset.koltuk), per: Number(el.dataset.per) };
  return null;
}

/** Hedefin değişip değişmediğini anlamak için kısa anahtar ("at", "per:2/1"). */
export function hedefAnahtari(h: BirakmaHedefi | null): string {
  if (!h) return "";
  return h.alan === "per" ? `per:${h.koltuk}/${h.per}` : h.alan;
}

// ---------- Üstüne gelinen per vurgusu (yuva vurgusu gibi, render'sız) ----------
let vurguluPer: HTMLElement | null = null;

export function perVurgula(alt: HTMLElement | null) {
  const per = alt?.closest<HTMLElement>('[data-birak="per"]') ?? null;
  if (per === vurguluPer) return;
  vurguluPer?.classList.remove("per101--ustunde");
  per?.classList.add("per101--ustunde");
  vurguluPer = per;
}

export function perVurgusunuKaldir() {
  vurguluPer?.classList.remove("per101--ustunde");
  vurguluPer = null;
}
