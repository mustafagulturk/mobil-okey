// Ekranın ortasında açılan pencere (modal): koyu cam, yaylı ölçekle açılır, arkası
// bulanık kararır. Arka plana dokununca kapanır (kapanırken kısa bir çıkış animasyonu oynar).
import { type ReactNode, useEffect, useRef, useState } from "react";
import { efektlerAcik } from "../efektler/ayar.ts";
import { parcaciklariDuraklat } from "../efektler/Parcaciklar.tsx";
import { useGeriTusu } from "../platform/geriTusu.ts";
import { Simge } from "./Simge.tsx";

interface Ozellikler {
  baslik?: string;
  kapat?: () => void;
  children: ReactNode;
  genis?: boolean;
}

export function Pencere({ baslik, kapat, children, genis }: Ozellikler) {
  const [kapaniyor, setKapaniyor] = useState(false);
  const zamanlayici = useRef<ReturnType<typeof setTimeout>>();

  // Arka plandaki tozlar dursun: bulanık karartma her karede yeniden hesaplanmasın.
  useEffect(() => {
    const birak = parcaciklariDuraklat();
    return () => {
      birak();
      clearTimeout(zamanlayici.current);
    };
  }, []);

  const kapatAnimasyonlu = kapat
    ? () => {
        if (kapaniyor) return;
        if (!efektlerAcik()) return kapat();
        setKapaniyor(true);
        zamanlayici.current = setTimeout(kapat, 170);
      }
    : undefined;

  // Android geri tuşu pencereyi kapatır (kapatılamayan pencerede hiçbir şey yapmaz).
  useGeriTusu(() => kapatAnimasyonlu?.());
  return (
    <div className={`pencere-arka ${kapaniyor ? "pencere-arka--kapaniyor" : ""}`} onClick={kapatAnimasyonlu}>
      <div className={`pencere ${genis ? "pencere--genis" : ""}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        {(baslik || kapat) && (
          <div className="pencere__ust">
            {baslik && <h2>{baslik}</h2>}
            {kapat && (
              <button className="simge-dugme" onClick={kapatAnimasyonlu} aria-label="Kapat">
                <Simge ad="kapat" />
              </button>
            )}
          </div>
        )}
        <div className="pencere__icerik">{children}</div>
      </div>
    </div>
  );
}
