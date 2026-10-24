// Arka planda yavaşça süzülen sıcak ışık tozları (tam ekran canvas).
// Sayfa gizliyken ya da efektler kapalıyken durur. Tıklamaları engellemez.
import { useEffect, useRef } from "react";
import { efektAyariniDinle, efektlerAcik } from "./ayar.ts";

interface Toz {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  faz: number;
  hiz: number;
  parlaklik: number;
  renk: number; // 0: altın, 1: krem, 2: zümrüt
}

/** Bir kez çizilen yumuşak ışık noktası; her karede sadece kopyalanır (ucuz). */
function sprite(renk: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  r.addColorStop(0, renk.replace("A", "1"));
  r.addColorStop(0.25, renk.replace("A", "0.55"));
  r.addColorStop(1, renk.replace("A", "0"));
  g.fillStyle = r;
  g.fillRect(0, 0, 32, 32);
  return c;
}

// Üstte bulanık bir katman (pencere) açıkken tozlar durur: arka plan sabit kalınca
// backdrop-filter her karede yeniden hesaplanmaz (Android WebView'de akıcılık için).
let duraklatan = 0;
const duraklatmaDinleyicileri = new Set<() => void>();

/** Tozları geçici olarak dondurur; dönen fonksiyon bırakır (sayaçlıdır, iç içe çağrılabilir). */
export function parcaciklariDuraklat(): () => void {
  duraklatan++;
  duraklatmaDinleyicileri.forEach((f) => f());
  let birakildi = false;
  return () => {
    if (birakildi) return;
    birakildi = true;
    duraklatan--;
    duraklatmaDinleyicileri.forEach((f) => f());
  };
}

export function Parcaciklar({ yogunluk = "normal" }: { yogunluk?: "az" | "normal" }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const spritelar = [sprite("rgba(255,206,120,A)"), sprite("rgba(255,244,214,A)"), sprite("rgba(90,230,170,A)")];
    let w = 0;
    let h = 0;
    let tozlar: Toz[] = [];
    let kare = 0;
    let son = 0;

    const yeniToz = (rastgeleY: boolean): Toz => ({
      x: Math.random() * w,
      y: rastgeleY ? Math.random() * h : h + 10,
      r: 1.2 + Math.random() * 2.8,
      vx: (Math.random() - 0.5) * 6,
      vy: -(3 + Math.random() * 9),
      faz: Math.random() * Math.PI * 2,
      hiz: 0.4 + Math.random() * 1.2,
      parlaklik: 0.25 + Math.random() * 0.55,
      renk: Math.random() < 0.62 ? 0 : Math.random() < 0.75 ? 1 : 2,
    });

    const boyutla = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sayi = Math.round(((w * h) / (844 * 390)) * (yogunluk === "az" ? 16 : 34));
      tozlar = Array.from({ length: Math.min(sayi, 60) }, () => yeniToz(true));
    };

    const ciz = (t: number) => {
      const dt = son ? Math.min(0.05, (t - son) / 1000) : 0.016;
      son = t;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const p of tozlar) {
        p.faz += dt * p.hiz;
        p.x += (p.vx + Math.sin(p.faz) * 6) * dt;
        p.y += p.vy * dt;
        if (p.y < -12 || p.x < -12 || p.x > w + 12) Object.assign(p, yeniToz(false));
        // Üst kısım (lamba altı) daha parlak; aşağı indikçe sönükleşir.
        const isik = 0.55 + 0.45 * (1 - p.y / h);
        ctx.globalAlpha = p.parlaklik * isik * (0.65 + 0.35 * Math.sin(p.faz * 2.3));
        const s = p.r * 4;
        ctx.drawImage(spritelar[p.renk], p.x - s / 2, p.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
      kare = requestAnimationFrame(ciz);
    };

    const baslat = () => {
      cancelAnimationFrame(kare);
      if (duraklatan > 0) return; // son kare ekranda kalır
      if (document.hidden || !efektlerAcik()) {
        ctx.clearRect(0, 0, w, h);
        return;
      }
      son = 0;
      kare = requestAnimationFrame(ciz);
    };

    boyutla();
    baslat();
    const yeniden = () => {
      boyutla();
      baslat();
    };
    window.addEventListener("resize", yeniden);
    document.addEventListener("visibilitychange", baslat);
    const birak = efektAyariniDinle(baslat);
    duraklatmaDinleyicileri.add(baslat);
    return () => {
      cancelAnimationFrame(kare);
      window.removeEventListener("resize", yeniden);
      document.removeEventListener("visibilitychange", baslat);
      birak();
      duraklatmaDinleyicileri.delete(baslat);
    };
  }, [yogunluk]);

  return <canvas ref={ref} className="parcaciklar" aria-hidden />;
}
