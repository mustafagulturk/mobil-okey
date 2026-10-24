// Avatar madalyonu: oyuncunun baş harfi (bot ise robot simgesi), altın çerçeve,
// sıradaysa çevresinde altından kırmızıya dönen geri sayım halkası.
import type { CSSProperties } from "react";
import { Simge } from "../../bilesenler/Simge.tsx";

interface Ozellikler {
  ad: string;
  bot?: boolean;
  /** Sıra bu oyuncudaysa 0-1 arası kalan süre oranı; değilse null. */
  oran: number | null;
  /** Son saniyeler: nabız + titreşim. */
  acil?: boolean;
  boyut?: "normal" | "kucuk";
}

/** Oran 1 → altın, 0 → kırmızı. */
export function halkaRengi(oran: number) {
  const o = Math.max(0, Math.min(1, oran));
  return `hsl(${Math.round(4 + 40 * o)} ${Math.round(86 + 8 * (1 - o))}% ${Math.round(54 + 6 * o)}%)`;
}

/** Addan sabit bir ton (her oyuncunun madalyonu farklı renkte olsun). */
function tonu(ad: string) {
  let h = 0;
  for (let i = 0; i < ad.length; i++) h = (h * 31 + ad.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function Madalyon({ ad, bot, oran, acil, boyut = "normal" }: Ozellikler) {
  const sirada = oran !== null;
  const harf = (ad.trim()[0] ?? "?").toLocaleUpperCase("tr-TR");
  return (
    <div
      className={`madalyon madalyon--${boyut} ${sirada ? "madalyon--sirada" : ""} ${acil ? "madalyon--acil" : ""}`}
      style={{ "--ton": tonu(ad) } as CSSProperties}
      data-madalyon
    >
      {sirada && (
        <div
          className="madalyon__halka"
          style={{ "--oran": oran, "--halka-renk": halkaRengi(oran) } as CSSProperties}
        />
      )}
      <div className="madalyon__ic">{bot ? <Simge ad="robot" boyut={boyut === "kucuk" ? 15 : 18} /> : <span>{harf}</span>}</div>
    </div>
  );
}
