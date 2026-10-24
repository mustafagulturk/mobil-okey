// Ekranın ortasında açılan pencere (modal). Arka plana dokununca kapanır.
import type { ReactNode } from "react";
import { useGeriTusu } from "../platform/geriTusu.ts";
import { Simge } from "./Simge.tsx";

interface Ozellikler {
  baslik?: string;
  kapat?: () => void;
  children: ReactNode;
  genis?: boolean;
}

export function Pencere({ baslik, kapat, children, genis }: Ozellikler) {
  // Android geri tuşu pencereyi kapatır (kapatılamayan pencerede hiçbir şey yapmaz).
  useGeriTusu(() => kapat?.());
  return (
    <div className="pencere-arka" onClick={kapat}>
      <div className={`pencere ${genis ? "pencere--genis" : ""}`} onClick={(e) => e.stopPropagation()}>
        {(baslik || kapat) && (
          <div className="pencere__ust">
            {baslik && <h2>{baslik}</h2>}
            {kapat && (
              <button className="simge-dugme" onClick={kapat} aria-label="Kapat">
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
