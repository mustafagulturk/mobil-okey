// Uçuş efekti: bir taşı A'dan B'ye yay çizerek uçurur (FLIP).
//
//   ucur(baslangic, hedef, icerik, { sure, yay, donus })
//
// - `icerik` uçacak öğedir (genelde hedefteki taşın bir kopyası). Başta başlangıç
//   kutusunun, sonda hedef kutusunun genişliğine ölçeklenir; merkezden merkeze uçar.
// - Yol ikinci dereceden bir Bézier eğrisidir: ortası `yay` piksel yukarı kalkar.
// - Uçarken `donus` derece döner, inerken küçük bir sıçrama yapar.
// - Sadece transform/opacity canlandırılır (GPU'da çalışır). Başta bir kez öğenin
//   doğal boyutu okunur; karelerde layout okunmaz.
// - Efektler kapalıysa çok kısa, düz bir kayma olur; oyun yine anlaşılır kalır.
import { efektlerAcik } from "./ayar.ts";

export interface UcusSecenegi {
  /** ms (varsayılan mesafeye göre 380-620) */
  sure?: number;
  /** Yolun ortasının ne kadar yukarı kalkacağı, px (varsayılan mesafenin %22'si) */
  yay?: number;
  /** Uçuş boyunca dönüş, derece (inişte sıfıra döner). Varsayılan 0. */
  donus?: number;
  /** false: iniş sıçraması yok (ör. taş bir oyuncunun madalyonunda kaybolurken). */
  inis?: boolean;
  /** Hedefteki saydamlık (0-1). Varsayılan 1. */
  sonOpaklik?: number;
  /** Başlamadan önce bekleme, ms. */
  gecikme?: number;
}

let katman: HTMLDivElement | null = null;

function katmanAl(): HTMLDivElement {
  if (katman && katman.isConnected) return katman;
  katman = document.createElement("div");
  katman.className = "ucus-katmani";
  katman.setAttribute("aria-hidden", "true");
  Object.assign(katman.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "60",
    overflow: "hidden",
    contain: "strict",
  });
  document.body.appendChild(katman);
  return katman;
}

/** Hızlanıp yumuşakça duran eğri. */
function egri(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function ucur(
  baslangic: DOMRect,
  hedef: DOMRect,
  icerik: HTMLElement | (() => HTMLElement),
  secenek: UcusSecenegi = {},
): Promise<void> {
  if (typeof document === "undefined" || !hedef.width || !hedef.height) return Promise.resolve();
  const el = typeof icerik === "function" ? icerik() : icerik;
  const acik = efektlerAcik();

  // Kopyalanan öğenin kendi konum/dönüş/animasyon stilleri uçuşu bozmasın.
  Object.assign(el.style, {
    position: "absolute",
    left: "0",
    top: "0",
    margin: "0",
    animation: "none",
    transition: "none",
    transformOrigin: "50% 50%",
    visibility: "visible",
    willChange: "transform, opacity",
  });
  el.style.transform = "translate(-9999px, 0)";
  katmanAl().appendChild(el);
  const w = el.offsetWidth || hedef.width;
  const h = el.offsetHeight || hedef.height;

  const ax = baslangic.left + baslangic.width / 2 - w / 2;
  const ay = baslangic.top + baslangic.height / 2 - h / 2;
  const bx = hedef.left + hedef.width / 2 - w / 2;
  const by = hedef.top + hedef.height / 2 - h / 2;
  const s0 = baslangic.width / w || 1;
  const s1 = hedef.width / w || 1;
  const son = secenek.sonOpaklik ?? 1;
  const mesafe = Math.hypot(bx - ax, by - ay);
  const tf = (x: number, y: number, r: number, sx: number, sy = sx) =>
    `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;

  let anim: Animation;
  if (!acik) {
    anim = el.animate(
      [
        { transform: tf(ax, ay, 0, s0), opacity: 1 },
        { transform: tf(bx, by, 0, s1), opacity: son },
      ],
      { duration: 110, easing: "ease-out", fill: "both", delay: Math.min(60, secenek.gecikme ?? 0) },
    );
  } else {
    const sure = secenek.sure ?? Math.min(620, 380 + mesafe * 0.32);
    const yay = secenek.yay ?? Math.min(110, 24 + mesafe * 0.2);
    const donus = secenek.donus ?? 0;
    const inis = secenek.inis ?? true;
    // Kontrol noktası: iki ucun ortası, yay kadar yukarıda.
    const cx = (ax + bx) / 2;
    const cy = Math.min(ay, by) - yay;
    const ADIM = 16;
    const ucusPayi = inis ? 0.8 : 1;
    const kareler: Keyframe[] = [];
    for (let i = 0; i <= ADIM; i++) {
      const t = egri(i / ADIM);
      const u = 1 - t;
      const x = u * u * ax + 2 * u * t * cx + t * t * bx;
      const y = u * u * ay + 2 * u * t * cy + t * t * by;
      // Ortada biraz büyür (havaya kalkıyormuş gibi), sonra hedef boyutuna iner.
      const s = s0 + (s1 - s0) * t + Math.sin(Math.PI * t) * 0.16 * Math.max(s0, s1);
      const r = donus * Math.sin(Math.PI * t) + (inis ? 0 : donus * t);
      const o = 1 + (son - 1) * Math.max(0, (t - 0.6) / 0.4);
      kareler.push({ offset: (i / ADIM) * ucusPayi, transform: tf(x, y, r, s), opacity: o });
    }
    if (inis) {
      // İniş: hafifçe ezilip sıçrar, yerine oturur (taşın alt kenarı sabit kalır).
      const yerde = (sx: number, sy: number, dy = 0) => tf(bx, by + (h * s1 * (1 - sy)) / 2 + dy, 0, s1 * sx, s1 * sy);
      kareler.push({ offset: 0.88, transform: yerde(1.1, 0.88), opacity: son });
      kareler.push({ offset: 0.95, transform: yerde(0.97, 1.04, -2), opacity: son });
      kareler.push({ offset: 1, transform: yerde(1, 1), opacity: son });
    }
    anim = el.animate(kareler, { duration: sure, easing: "linear", fill: "both", delay: secenek.gecikme ?? 0 });
  }

  return new Promise((bitti) => {
    let tamam = false;
    const temizle = () => {
      if (tamam) return;
      tamam = true;
      el.remove();
      bitti();
    };
    anim.onfinish = temizle;
    anim.oncancel = temizle;
    // Sekme gizliyken animasyon durabilir; güvenlik için zaman aşımı.
    setTimeout(temizle, 6000 + (secenek.gecikme ?? 0));
  });
}
