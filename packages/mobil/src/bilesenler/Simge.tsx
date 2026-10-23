// Küçük çizgi simgeler (SVG). Resim dosyası yok; renk yazının renginden (currentColor) gelir.
const YOLLAR = {
  geri: "M15 18l-6-6 6-6",
  ayar: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z",
  magaza: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0",
  gorev: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  kupa: "M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3",
  profil: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
  hediye: "M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z",
  video: "M23 7l-7 5 7 5V7zM1 5h15v14H1z",
  kilit: "M5 11h14v10H5zM8 11V7a4 4 0 018 0v4",
  sohbet: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  cikis: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  paylas: "M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13",
  kopyala: "M9 9h13v13H9zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1",
  oyna: "M6 4l14 8-14 8z",
  arti: "M12 5v14M5 12h14",
  anahtar: "M21 2l-2 2m-7.6 7.6a5.5 5.5 0 11-7.8 7.8 5.5 5.5 0 017.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
  robot: "M5 8h14v12H5zM12 4v4M9 13h.01M15 13h.01M9 17h6M2 13v3M22 13v3",
  gonder: "M22 2L11 13M22 2l-7 20-4-9-9-4z",
  kapat: "M18 6L6 18M6 6l12 12",
  wifiYok: "M1 1l22 22M16.7 11.1A10.9 10.9 0 0119 12.6M5 12.6a10.9 10.9 0 015.2-2.5M10.7 5A16 16 0 0122.6 9M1.4 9a16 16 0 014.3-2.7M8.5 16.1a5 5 0 017 0M12 20h.01",
  kalp: "M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 000-7.8z",
  bilgi: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01",
} as const;

export type SimgeAdi = keyof typeof YOLLAR;

export function Simge({ ad, boyut = 20 }: { ad: SimgeAdi; boyut?: number }) {
  return (
    <svg
      className="simge"
      width={boyut}
      height={boyut}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={YOLLAR[ad]} />
    </svg>
  );
}

/** Çip simgesi: altın renkli küçük bir jeton. */
export function CipSimgesi({ boyut = 18 }: { boyut?: number }) {
  return (
    <svg className="cip-simgesi" width={boyut} height={boyut} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill="var(--renk-altin-koyu)" />
      <circle cx="12" cy="12" r="9" fill="var(--renk-altin)" />
      <circle cx="12" cy="12" r="5.5" fill="none" stroke="var(--renk-altin-acik)" strokeWidth="1.6" strokeDasharray="2.4 1.6" />
    </svg>
  );
}
