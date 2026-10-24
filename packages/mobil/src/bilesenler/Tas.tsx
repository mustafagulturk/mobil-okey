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

/** Sahte okey: ince hatlı sekiz köşeli yıldız (iki kare), içinde dört yapraklı gül motifi ve altın göbek. */
function SahteOkeySimgesi() {
  return (
    <svg className="tas__sahte" viewBox="0 0 40 40" aria-label="sahte okey">
      <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
        <rect x="8.5" y="8.5" width="23" height="23" rx="1.5" />
        <rect x="8.5" y="8.5" width="23" height="23" rx="1.5" transform="rotate(45 20 20)" />
      </g>
      <g fill="currentColor">
        <ellipse cx="20" cy="14.6" rx="2.6" ry="4" />
        <ellipse cx="20" cy="25.4" rx="2.6" ry="4" />
        <ellipse cx="14.6" cy="20" rx="4" ry="2.6" />
        <ellipse cx="25.4" cy="20" rx="4" ry="2.6" />
      </g>
      <circle cx="20" cy="20" r="3" fill="#c9973a" stroke="#fbf3e1" strokeWidth="0.9" />
    </svg>
  );
}

/** Kapalı taş (deste). */
export function KapaliTas({ boyut = "orta" }: { boyut?: TasBoyutu }) {
  return <div className={`tas tas--${boyut} tas--kapali`} />;
}
