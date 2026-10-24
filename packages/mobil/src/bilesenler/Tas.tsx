// Okey taşı: fildişi, 3D görünümlü. Resim yok: yüzey ve kalınlık CSS gradyanı ve
// gölgeleridir, rakam yazıdır (kazınmış görünüm), sahte okey simgesi küçük bir SVG'dir.
// Renkler ve ölçüler tema.css'teki değişkenlerden gelir (--tas-*).
import { type Deger, okeyMi, RENKLER, sahteMi, yuzDegeri } from "@okey/kurallar";
import type { CSSProperties, PointerEvent } from "react";

export type TasBoyutu = "buyuk" | "orta" | "kucuk";

interface Ozellikler {
  id: number;
  /** Okey taşının köşesine yıldız koymak için bu elin okeyi. */
  okey?: Deger | null;
  boyut?: TasBoyutu;
  secili?: boolean;
  /** Yeni gelen taş: kısa bir "düşme" animasyonu oynar. */
  yeni?: boolean;
  soluk?: boolean;
  /** Parmakla taşınan taş: kalkık ve büyük gölgeli görünür (isteğe bağlı). */
  suruklenen?: boolean;
  stil?: CSSProperties;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
  onClick?: () => void;
}

export function Tas({ id, okey, boyut = "buyuk", secili, yeni, soluk, suruklenen, stil, onPointerDown, onClick }: Ozellikler) {
  const d = yuzDegeri(id);
  const okeyTasi = okey ? okeyMi(id, okey) && !sahteMi(id) : false;
  const sinif = [
    "tas",
    `tas--${boyut}`,
    d ? `tas--${RENKLER[d.renk]}` : "tas--sahte",
    okeyTasi && "tas--okey",
    secili && "tas--secili",
    suruklenen && "tas--suruklenen",
    yeni && "tas--yeni",
    soluk && "tas--soluk",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={sinif} style={stil} onPointerDown={onPointerDown} onClick={onClick} data-tas={id}>
      {d ? (
        <>
          <span className="tas__sayi">{d.sayi}</span>
          <span className="tas__nokta" />
        </>
      ) : (
        <SahteOkeySimgesi />
      )}
      {okeyTasi && (
        <>
          <span className="tas__parilti" aria-hidden />
          <svg className="tas__yildiz" viewBox="0 0 24 24" aria-label="okey">
            <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.5l7.1-.6z" />
          </svg>
        </>
      )}
    </div>
  );
}

/** Sahte okey: sekiz köşeli yıldız (iki kare) içinde fildişi halka ve altın göbek. */
function SahteOkeySimgesi() {
  return (
    <svg className="tas__sahte" viewBox="0 0 40 40" aria-label="sahte okey">
      <g fill="currentColor">
        <rect x="9" y="9" width="22" height="22" rx="2.5" />
        <rect x="9" y="9" width="22" height="22" rx="2.5" transform="rotate(45 20 20)" />
      </g>
      <circle cx="20" cy="20" r="8.2" fill="none" stroke="#fbf3e1" strokeWidth="1.6" opacity="0.9" />
      <circle cx="20" cy="20" r="5" fill="url(#sahte-altin)" />
      <circle cx="18.6" cy="18.4" r="1.5" fill="#fff6d6" opacity="0.85" />
      <defs>
        <linearGradient id="sahte-altin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff0b8" />
          <stop offset="0.55" stopColor="#e3ae45" />
          <stop offset="1" stopColor="#a3701c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Kapalı taş (deste). */
export function KapaliTas({ boyut = "orta" }: { boyut?: TasBoyutu }) {
  return <div className={`tas tas--${boyut} tas--kapali`} />;
}
