// Kutlama efektleri: konfeti, çip yağmuru, seviye atlama ışık patlaması.
// Her çağrı ekranın üstüne geçici bir canvas koyar, bitince kendini kaldırır.
// Efektler kapalıysa hiçbir şey yapmaz. Parçacık sayısı telefon için ≤150.
import { efektlerAcik } from "./ayar.ts";

export type KutlamaTuru = "konfeti" | "cipYagmuru" | "seviye";

export interface KutlamaSecenegi {
  /** Efektin çıkacağı yer (ör. düğmenin getBoundingClientRect()). Yoksa ekranın ortası/üstü. */
  kaynak?: DOMRect;
  /** Parçacık sayısı (en fazla 150). */
  miktar?: number;
}

const KONFETI_RENK = ["#ffe08a", "#f6c453", "#d9a23a", "#fff4d6", "#f3e2b8", "#34e3a4", "#14a874", "#0d6b4b"];
const ENCOK = 150;

interface Sahne {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
}

/** Geçici tam ekran canvas açar; ciz(t, dt) false dönene kadar çizer, sonra kaldırır. */
function sahneAc(ciz: (s: Sahne, t: number, dt: number) => boolean): Promise<void> {
  return new Promise((bitti) => {
    const canvas = document.createElement("canvas");
    canvas.className = "kutlama-canvas";
    canvas.setAttribute("aria-hidden", "true");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "200",
    });
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      canvas.remove();
      return bitti();
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sahne = { ctx, w, h };
    const t0 = performance.now();
    let son = t0;
    const adim = (simdi: number) => {
      const dt = Math.min(0.05, (simdi - son) / 1000);
      son = simdi;
      ctx.clearRect(0, 0, w, h);
      const devam = ciz(sahne, (simdi - t0) / 1000, dt);
      // Sekme gizlenirse rAF durur; güvenlik için en fazla 6 sn.
      if (devam && simdi - t0 < 6000) requestAnimationFrame(adim);
      else {
        canvas.remove();
        bitti();
      }
    };
    requestAnimationFrame(adim);
  });
}

const rastgele = (a: number, b: number) => a + Math.random() * (b - a);
const merkez = (r: DOMRect | undefined, w: number, h: number) =>
  r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: w / 2, y: h * 0.45 };

// ---------------------------------------------------------------- Konfeti
function konfeti(secenek: KutlamaSecenegi) {
  const sayi = Math.min(ENCOK, secenek.miktar ?? 130);
  type Konfeti = {
    x: number; y: number; vx: number; vy: number; d: number; vd: number; salinim: number;
    en: number; boy: number; renk: string; serit: boolean; gecikme: number;
  };
  let parcalar: Konfeti[] | undefined;
  return sahneAc(({ ctx, w, h }, t, dt) => {
    if (!parcalar) {
      const m = merkez(secenek.kaynak, w, h);
      parcalar = Array.from({ length: sayi }, (_, i) => {
        // Kaynak yoksa iki yandan, kaynak varsa kaynaktan yukarı doğru patlar.
        const yan = !secenek.kaynak ? (i % 2 ? 1 : -1) : 0;
        const x = secenek.kaynak ? m.x : yan < 0 ? -10 : w + 10;
        const y = secenek.kaynak ? m.y : h + 10;
        // İki alt köşeden yukarı-içeri doğru fışkırır, sonra salınarak süzülür.
        const aci = secenek.kaynak ? rastgele(-Math.PI * 0.92, -Math.PI * 0.08) : yan < 0 ? rastgele(-1.4, -0.75) : rastgele(-Math.PI + 0.75, -Math.PI + 1.4);
        const hiz = (secenek.kaynak ? rastgele(380, 760) : rastgele(800, 1350)) * Math.min(1.3, h / 390);
        return {
          x,
          y,
          vx: Math.cos(aci) * hiz,
          vy: Math.sin(aci) * hiz,
          d: rastgele(0, Math.PI * 2),
          vd: rastgele(-9, 9),
          salinim: rastgele(0, 6),
          en: rastgele(6, 11),
          boy: rastgele(9, 16),
          renk: KONFETI_RENK[i % KONFETI_RENK.length],
          serit: Math.random() < 0.3,
          gecikme: Math.random() * 0.25,
        };
      });
    }
    let canli = 0;
    for (const p of parcalar) {
      if (t < p.gecikme) {
        canli++;
        continue;
      }
      p.vx *= 1 - 2.4 * dt;
      p.vy = p.vy * (1 - 2.0 * dt) + 820 * dt;
      p.vy = Math.min(p.vy, 260);
      p.salinim += dt * 5;
      p.x += (p.vx + Math.sin(p.salinim) * 40) * dt;
      p.y += p.vy * dt;
      p.d += p.vd * dt;
      if (p.y > h + 20) continue;
      canli++;
      const solma = t > 3.2 ? Math.max(0, 1 - (t - 3.2) / 0.6) : 1;
      ctx.globalAlpha = solma;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.d);
      ctx.scale(1, Math.cos(p.salinim * 1.7)); // dönerek takla atma hissi
      ctx.fillStyle = p.renk;
      if (p.serit) ctx.fillRect(-p.en * 0.25, -p.boy, p.en * 0.5, p.boy * 2);
      else ctx.fillRect(-p.en / 2, -p.boy / 2, p.en, p.boy * 0.62);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    return canli > 0 && t < 3.8;
  });
}

// ---------------------------------------------------------------- Çip yağmuru
/** Altın jeton görüntüsü bir kez çizilir; düşerken sadece yatay ölçeklenir (dönme hissi). */
let jetonOnbellek: HTMLCanvasElement | null = null;
function jetonSprite(): HTMLCanvasElement {
  if (jetonOnbellek) return jetonOnbellek;
  const c = document.createElement("canvas");
  const R = 32;
  c.width = c.height = R * 2;
  const g = c.getContext("2d")!;
  const dis = g.createLinearGradient(0, 0, R * 2, R * 2);
  dis.addColorStop(0, "#fff3c4");
  dis.addColorStop(0.35, "#f6d37a");
  dis.addColorStop(0.65, "#c08a2a");
  dis.addColorStop(1, "#8a5a14");
  g.fillStyle = dis;
  g.beginPath();
  g.arc(R, R, R - 1, 0, Math.PI * 2);
  g.fill();
  const ic = g.createRadialGradient(R * 0.75, R * 0.7, 2, R, R, R * 0.78);
  ic.addColorStop(0, "#fff0b8");
  ic.addColorStop(0.6, "#e9b949");
  ic.addColorStop(1, "#b5801f");
  g.fillStyle = ic;
  g.beginPath();
  g.arc(R, R, R * 0.74, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255,248,220,.85)";
  g.lineWidth = 2.4;
  g.setLineDash([4, 3.2]);
  g.beginPath();
  g.arc(R, R, R * 0.5, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = "rgba(120,78,10,.85)";
  g.font = `700 ${R * 0.62}px Fredoka, Nunito, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("₺", R, R + 1);
  jetonOnbellek = c;
  return c;
}

function cipYagmuru(secenek: KutlamaSecenegi) {
  const sayi = Math.min(ENCOK, secenek.miktar ?? 46);
  const jeton = jetonSprite();
  type Jeton = { x: number; y: number; vx: number; vy: number; r: number; don: number; vdon: number; egim: number; gecikme: number; zipla: number };
  let jetonlar: Jeton[] | undefined;
  return sahneAc(({ ctx, w, h }, t, dt) => {
    if (!jetonlar) {
      const m = secenek.kaynak ? merkez(secenek.kaynak, w, h) : null;
      jetonlar = Array.from({ length: sayi }, () => {
        const r = rastgele(9, 17);
        if (m) {
          const aci = rastgele(-Math.PI * 0.85, -Math.PI * 0.15);
          const hiz = rastgele(300, 640);
          return { x: m.x, y: m.y, vx: Math.cos(aci) * hiz, vy: Math.sin(aci) * hiz, r, don: rastgele(0, 6), vdon: rastgele(5, 11), egim: rastgele(-0.4, 0.4), gecikme: Math.random() * 0.2, zipla: 0 };
        }
        return { x: rastgele(0.05, 0.95) * w, y: -rastgele(20, 40), vx: rastgele(-30, 30), vy: rastgele(120, 260), r, don: rastgele(0, 6), vdon: rastgele(5, 11), egim: rastgele(-0.4, 0.4), gecikme: Math.random() * 1.1, zipla: 0 };
      });
    }
    let canli = 0;
    const zemin = h - 6;
    for (const j of jetonlar) {
      if (t < j.gecikme) {
        canli++;
        continue;
      }
      j.vy += 1100 * dt;
      j.x += j.vx * dt;
      j.y += j.vy * dt;
      j.don += j.vdon * dt;
      // Zeminde bir kez sekip düşer.
      if (j.y > zemin - j.r && j.zipla === 0 && j.vy > 0) {
        j.y = zemin - j.r;
        j.vy *= -0.38;
        j.vx *= 0.6;
        j.zipla = 1;
      }
      if (j.y > h + j.r * 2) continue;
      canli++;
      const solma = t > 2.6 ? Math.max(0, 1 - (t - 2.6) / 0.5) : 1;
      const sx = Math.abs(Math.cos(j.don));
      ctx.globalAlpha = solma;
      ctx.save();
      ctx.translate(j.x, j.y);
      ctx.rotate(j.egim);
      // Kenardan bakınca jetonun kalınlığı görünsün.
      ctx.fillStyle = "#7a4e10";
      ctx.beginPath();
      ctx.ellipse(1.5, 0, Math.max(1.6, j.r * sx), j.r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.scale(Math.max(0.08, sx), 1);
      ctx.drawImage(jeton, -j.r, -j.r, j.r * 2, j.r * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    return canli > 0 && t < 3.2;
  });
}

// ---------------------------------------------------------------- Seviye
function seviye(secenek: KutlamaSecenegi) {
  const sayi = Math.min(ENCOK, secenek.miktar ?? 70);
  type Kivilcim = { aci: number; hiz: number; r: number; renk: string };
  let kivilcimlar: Kivilcim[] | undefined;
  return sahneAc(({ ctx, w, h }, t) => {
    const m = merkez(secenek.kaynak, w, h);
    if (!kivilcimlar)
      kivilcimlar = Array.from({ length: sayi }, (_, i) => ({
        aci: rastgele(0, Math.PI * 2),
        hiz: rastgele(140, 420),
        r: rastgele(1.2, 3.2),
        renk: i % 4 === 0 ? "#34e3a4" : i % 3 === 0 ? "#fff4d6" : "#ffd36b",
      }));
    const T = 2.1;
    const boyut = Math.max(w, h);
    ctx.globalCompositeOperation = "lighter";

    // 1) Merkezden yumuşak ışık patlaması
    const flas = t < 0.18 ? t / 0.18 : Math.max(0, 1 - (t - 0.18) / 1.2);
    if (flas > 0) {
      const R = boyut * (0.25 + 0.35 * Math.min(1, t / 0.5));
      const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, R);
      g.addColorStop(0, `rgba(255,240,200,${0.6 * flas})`);
      g.addColorStop(0.25, `rgba(255,205,110,${0.3 * flas})`);
      g.addColorStop(1, "rgba(255,190,80,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // 2) Dönen ışık huzmeleri
    const huzme = t < 0.3 ? t / 0.3 : Math.max(0, 1 - (t - 0.3) / 1.4);
    if (huzme > 0) {
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(t * 0.5);
      const L = boyut * 0.7;
      const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, L);
      hg.addColorStop(0, `rgba(255,226,150,${0.24 * huzme})`);
      hg.addColorStop(0.55, `rgba(255,214,130,${0.08 * huzme})`);
      hg.addColorStop(1, "rgba(255,226,150,0)");
      ctx.fillStyle = hg;
      for (let i = 0; i < 16; i++) {
        ctx.rotate((Math.PI * 2) / 16);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(L, -L * (i % 2 ? 0.035 : 0.06));
        ctx.lineTo(L, L * (i % 2 ? 0.035 : 0.06));
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // 3) Genişleyen halkalar
    for (let k = 0; k < 3; k++) {
      const tk = t - k * 0.16;
      if (tk <= 0 || tk > 1.2) continue;
      const p = tk / 1.2;
      const e = 1 - Math.pow(1 - p, 3);
      ctx.strokeStyle = k === 1 ? `rgba(52,227,164,${0.7 * (1 - p)})` : `rgba(255,214,120,${0.9 * (1 - p)})`;
      ctx.lineWidth = (k === 0 ? 7 : 3.5) * (1 - p) + 0.5;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 20 + e * boyut * 0.42, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 4) Dışa saçılan kıvılcımlar
    const kp = Math.min(1, t / 1.5);
    const ke = 1 - Math.pow(1 - kp, 2.4);
    ctx.globalAlpha = Math.max(0, 1 - kp);
    for (const k of kivilcimlar) {
      const d = k.hiz * ke * 1.4;
      const x = m.x + Math.cos(k.aci) * d;
      const y = m.y + Math.sin(k.aci) * d + 60 * kp * kp;
      ctx.fillStyle = k.renk;
      ctx.beginPath();
      ctx.arc(x, y, k.r * (1.2 - kp * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    return t < T;
  });
}

/**
 * Kutlama efekti oynatır. Efektler kapalıysa hemen biter.
 *   kutlama("konfeti")                     — iki yandan konfeti
 *   kutlama("cipYagmuru", { kaynak })      — kaynaktan jeton fışkırır (yoksa üstten yağar)
 *   kutlama("seviye")                      — merkezden ışık patlaması + halkalar
 */
export function kutlama(tur: KutlamaTuru, secenek: KutlamaSecenegi = {}): Promise<void> {
  if (!efektlerAcik() || typeof document === "undefined") return Promise.resolve();
  if (tur === "konfeti") return konfeti(secenek);
  if (tur === "cipYagmuru") return cipYagmuru(secenek);
  return seviye(secenek);
}
