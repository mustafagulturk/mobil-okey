// Okey taşı. Resim yok: krem zemin CSS gradyanıdır, rakam yazıdır, sahte okey
// simgesi küçük bir SVG'dir. Renkler ve ölçüler tema.css'teki değişkenlerden gelir.
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
  stil?: CSSProperties;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
  onClick?: () => void;
}

export function Tas({ id, okey, boyut = "buyuk", secili, yeni, soluk, stil, onPointerDown, onClick }: Ozellikler) {
  const d = yuzDegeri(id);
  const okeyTasi = okey ? okeyMi(id, okey) : false;
  const sinif = [
    "tas",
    `tas--${boyut}`,
    d ? `tas--${RENKLER[d.renk]}` : "tas--sahte",
    secili && "tas--secili",
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
      {okeyTasi && !sahteMi(id) && (
        <svg className="tas__yildiz" viewBox="0 0 24 24" aria-label="okey">
          <path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7-6.2-3.8-6.2 3.8 1.6-7L2 9.5l7.1-.6z" />
        </svg>
      )}
    </div>
  );
}

/** Sahte okey: geleneksel taşlardaki gibi yonca/çiçek motifi. */
function SahteOkeySimgesi() {
  return (
    <svg className="tas__sahte" viewBox="0 0 40 40" aria-label="sahte okey">
      <g fill="currentColor">
        <circle cx="20" cy="11" r="7" />
        <circle cx="29" cy="20" r="7" />
        <circle cx="20" cy="29" r="7" />
        <circle cx="11" cy="20" r="7" />
      </g>
      <circle cx="20" cy="20" r="4.5" fill="var(--renk-altin)" />
    </svg>
  );
}

/** Kapalı taş (deste). */
export function KapaliTas({ boyut = "orta" }: { boyut?: TasBoyutu }) {
  return <div className={`tas tas--${boyut} tas--kapali`} />;
}
