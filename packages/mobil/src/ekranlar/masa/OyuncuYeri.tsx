// Masadaki bir rakibin yeri: cam plaka üstünde avatar madalyonu (sıra halkasıyla),
// isim etiketi, elindeki taş sayısı ve konuşunca kısa süre görünen konuşma balonu.
import { type KoltukGorunumu, VARSAYILAN_ETIKET } from "@okey/kurallar";
import { IsimEtiketi } from "../../bilesenler/IsimEtiketi.tsx";
import { Madalyon } from "./Madalyon.tsx";

interface Ozellikler {
  koltuk: KoltukGorunumu;
  /** Koltuk numarası (uçuş efektleri bu oyuncunun yerini bununla bulur). */
  no: number;
  tasSayisi: number;
  siraBunda: boolean;
  /** 0-1 arası kalan süre oranı (bilinmiyorsa null). */
  kalanOran: number | null;
  acil?: boolean;
  konum: "ust" | "sol" | "sag";
  balon?: string | null;
}

export function OyuncuYeri({ koltuk, no, tasSayisi, siraBunda, kalanOran, acil, konum, balon }: Ozellikler) {
  const bot = koltuk.tur === "bot";
  const ad = koltuk.tur === "insan" ? koltuk.oyuncu.ad : koltuk.tur === "bot" ? koltuk.ad : "Boş";
  const etiket = koltuk.tur === "insan" ? koltuk.oyuncu.etiket : VARSAYILAN_ETIKET;
  const seviye = koltuk.tur === "insan" ? koltuk.oyuncu.seviye : undefined;
  const kopuk = koltuk.tur === "insan" && !koltuk.bagli;

  return (
    <div
      className={`oyuncu-yeri oyuncu-yeri--${konum} ${siraBunda ? "oyuncu-yeri--sirada" : ""} ${siraBunda && acil ? "oyuncu-yeri--acil" : ""}`}
      data-oyuncu={no}
    >
      <div className="oyuncu-yeri__plaka">
        <Madalyon ad={ad} bot={bot} oran={siraBunda ? (kalanOran ?? 1) : null} acil={siraBunda && acil} />
        <div className="oyuncu-yeri__bilgi">
          <IsimEtiketi
            ad={ad}
            seviye={seviye}
            etiket={bot ? { ...etiket, unvan: "yok" } : etiket}
            boyut="kucuk"
            soluk={kopuk}
          />
          <span className="oyuncu-yeri__tas" title="Elindeki taş">
            <i className="oyuncu-yeri__tas-simge" />
            {tasSayisi}
          </span>
        </div>
      </div>
      {kopuk && <span className="oyuncu-yeri__not">bağlantı koptu</span>}
      {balon && (
        <div key={balon} className="konusma-balonu">
          {balon}
        </div>
      )}
    </div>
  );
}
