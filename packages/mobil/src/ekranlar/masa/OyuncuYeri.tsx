// Masadaki bir rakibin yeri: isim etiketi, elindeki taş sayısı, sıra halkası ve geri sayım.
import { type KoltukGorunumu, VARSAYILAN_ETIKET } from "@okey/kurallar";
import { IsimEtiketi } from "../../bilesenler/IsimEtiketi.tsx";
import { Simge } from "../../bilesenler/Simge.tsx";

interface Ozellikler {
  koltuk: KoltukGorunumu;
  tasSayisi: number;
  siraBunda: boolean;
  /** 0-1 arası kalan süre oranı (bilinmiyorsa null). */
  kalanOran: number | null;
  konum: "ust" | "sol" | "sag";
}

export function OyuncuYeri({ koltuk, tasSayisi, siraBunda, kalanOran, konum }: Ozellikler) {
  const bot = koltuk.tur === "bot";
  const ad = koltuk.tur === "insan" ? koltuk.oyuncu.ad : koltuk.tur === "bot" ? koltuk.ad : "Boş";
  const etiket = koltuk.tur === "insan" ? koltuk.oyuncu.etiket : VARSAYILAN_ETIKET;
  const seviye = koltuk.tur === "insan" ? koltuk.oyuncu.seviye : undefined;
  const kopuk = koltuk.tur === "insan" && !koltuk.bagli;

  return (
    <div className={`oyuncu-yeri oyuncu-yeri--${konum} ${siraBunda ? "oyuncu-yeri--sirada" : ""}`}>
      <div className="oyuncu-yeri__halka">
        <IsimEtiketi
          ad={ad}
          seviye={seviye}
          etiket={bot ? { ...etiket, unvan: "yok" } : etiket}
          boyut="kucuk"
          soluk={kopuk}
          ek={
            <span className="oyuncu-yeri__tas" title="Elindeki taş">
              {bot ? <Simge ad="robot" boyut={12} /> : null}
              {tasSayisi}
            </span>
          }
        />
      </div>
      <div className="geri-sayim">
        {siraBunda && <div className="geri-sayim__dolu" style={{ transform: `scaleX(${kalanOran ?? 1})` }} />}
      </div>
      {kopuk && <span className="oyuncu-yeri__not">bağlantı koptu</span>}
    </div>
  );
}
