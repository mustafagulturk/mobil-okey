// Mağaza paketlerinin 3D çip yığını illüstrasyonu (saf SVG, resim dosyası yok).
// Kademe büyüdükçe daha çok ve daha yüksek yığın çizilir. Her jeton: kenar çizgili
// yan yüz + altın üst yüz. Sadece her yığının en üstteki jetonunun yüzü görünür.
import { useId } from "react";

interface Yigin {
  x: number;
  y: number; // en alttaki jetonun üst yüz merkezi
  n: number; // jeton sayısı
}

const KADEMELER: Yigin[][] = [
  [{ x: 80, y: 92, n: 4 }],
  [
    { x: 64, y: 88, n: 6 },
    { x: 98, y: 95, n: 4 },
  ],
  [
    { x: 56, y: 84, n: 8 },
    { x: 98, y: 86, n: 10 },
    { x: 76, y: 101, n: 4 },
    { x: 118, y: 103, n: 3 },
  ],
  [
    { x: 40, y: 84, n: 9 },
    { x: 79, y: 80, n: 13 },
    { x: 118, y: 84, n: 10 },
    { x: 58, y: 101, n: 6 },
    { x: 100, y: 103, n: 5 },
    { x: 134, y: 105, n: 2 },
    { x: 22, y: 105, n: 2 },
  ],
];

// Parıltı yıldızlarının yerleri (kademe büyüdükçe daha çok).
const YILDIZLAR: [number, number, number][][] = [
  [[96, 70, 0.7]],
  [[52, 56, 0.8], [110, 72, 0.6]],
  [[44, 40, 0.9], [110, 36, 0.8], [130, 86, 0.6]],
  [[30, 34, 0.9], [92, 14, 1], [128, 30, 0.8], [146, 84, 0.6], [12, 80, 0.6]],
];

const RX = 17;
const RY = 6.4;
const KALINLIK = 4.6;

export function CipYigini({ kademe }: { kademe: number }) {
  const k = Math.max(0, Math.min(3, kademe));
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const yiginlar = [...KADEMELER[k]].sort((a, b) => a.y - b.y);

  return (
    <svg className={`cip-yigini cip-yigini--${k}`} viewBox="0 0 160 116" aria-hidden>
      <defs>
        <linearGradient id={`${id}-yan`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#6b4612" />
          <stop offset="0.28" stopColor="#c99332" />
          <stop offset="0.5" stopColor="#ffe39a" />
          <stop offset="0.72" stopColor="#c99332" />
          <stop offset="1" stopColor="#5e3c0e" />
        </linearGradient>
        <radialGradient id={`${id}-yuz`} cx="0.38" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#fff6cf" />
          <stop offset="0.35" stopColor="#f6d37a" />
          <stop offset="0.75" stopColor="#d49a33" />
          <stop offset="1" stopColor="#9a6a1c" />
        </radialGradient>
        <radialGradient id={`${id}-orta`} cx="0.6" cy="0.7" r="0.9">
          <stop offset="0" stopColor="#f3c862" />
          <stop offset="1" stopColor="#b98226" />
        </radialGradient>
        <pattern id={`${id}-cizgi`} width="7" height="10" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="2.6" height="10" fill="rgba(255,248,225,0.82)" />
        </pattern>
        <radialGradient id={`${id}-isik`} cx="0.5" cy="0.6" r="0.5">
          <stop offset="0" stopColor="rgba(255,214,120,0.55)" />
          <stop offset="1" stopColor="rgba(255,214,120,0)" />
        </radialGradient>
      </defs>

      <ellipse className="cip-yigini__isik" cx="80" cy="70" rx={50 + k * 18} ry={34 + k * 10} fill={`url(#${id}-isik)`} />
      <ellipse cx="80" cy="108" rx={26 + k * 22} ry={6 + k} fill="rgba(0,0,0,0.45)" />

      {yiginlar.map((y, yi) => (
        <g key={yi}>
          {Array.from({ length: y.n }, (_, j) => {
            const kay = (((yi * 7 + j * 13) % 5) - 2) * 0.55; // hafif düzensizlik
            const cx = y.x + kay;
            const cy = y.y - j * KALINLIK;
            const yan = `M${cx - RX} ${cy} L${cx - RX} ${cy + KALINLIK} A${RX} ${RY} 0 0 0 ${cx + RX} ${cy + KALINLIK} L${cx + RX} ${cy} Z`;
            const ust = j === y.n - 1;
            return (
              <g key={j}>
                <path d={yan} fill={`url(#${id}-yan)`} />
                <path d={yan} fill={`url(#${id}-cizgi)`} opacity="0.75" />
                <path d={`M${cx - RX} ${cy + KALINLIK} A${RX} ${RY} 0 0 0 ${cx + RX} ${cy + KALINLIK}`} fill="none" stroke="rgba(60,36,6,0.55)" strokeWidth="0.6" />
                {ust && (
                  <>
                    <ellipse cx={cx} cy={cy} rx={RX} ry={RY} fill={`url(#${id}-yuz)`} stroke="#8a5b14" strokeWidth="0.6" />
                    <ellipse cx={cx} cy={cy} rx={RX * 0.74} ry={RY * 0.74} fill="none" stroke="rgba(255,250,230,0.9)" strokeWidth="1.5" strokeDasharray="3.2 2.4" />
                    <ellipse cx={cx} cy={cy + 0.3} rx={RX * 0.46} ry={RY * 0.46} fill={`url(#${id}-orta)`} />
                    <ellipse cx={cx - 4} cy={cy - 2.2} rx={RX * 0.3} ry={RY * 0.18} fill="rgba(255,255,255,0.55)" />
                  </>
                )}
              </g>
            );
          })}
        </g>
      ))}

      {YILDIZLAR[k].map(([x, y, b], i) => (
        <path
          key={i}
          className="cip-yigini__yildiz"
          style={{ animationDelay: `${i * 0.55}s` }}
          transform={`translate(${x} ${y}) scale(${b})`}
          d="M0 -7 C1 -1.6 1.6 -1 7 0 C1.6 1 1 1.6 0 7 C-1 1.6 -1.6 1 -7 0 C-1.6 -1 -1 -1.6 0 -7Z"
          fill="#fff6d6"
        />
      ))}
    </svg>
  );
}
