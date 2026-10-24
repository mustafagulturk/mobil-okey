// Ekranın üstünde kısa süre görünen bildirimler (toast): cam kart, yukarıdan kayarak
// gelir, süresi dolunca yukarı kayarak gider. Hamle hataları, ödüller vb.
import { useEffect, useState } from "react";
import { useOyun } from "../durum/OyunSaglayici.tsx";

export function Bildirimler() {
  const { durum, bildirimKapat } = useOyun();
  return (
    <div className="bildirimler" aria-live="polite">
      {durum.bildirimler.map((b) => (
        <BildirimKarti key={b.id} id={b.id} tur={b.tur} metin={b.metin} kapat={bildirimKapat} />
      ))}
    </div>
  );
}

const SIMGE: Record<string, string> = { hata: "!", basari: "✓", seviye: "★", bilgi: "i" };
const CIKIS_SURESI = 260;

function BildirimKarti({ id, tur, metin, kapat }: { id: number; tur: string; metin: string; kapat: (id: number) => void }) {
  const [cikiyor, setCikiyor] = useState(false);
  useEffect(() => {
    const sure = tur === "hata" ? 2600 : 3400;
    const z1 = setTimeout(() => setCikiyor(true), sure - CIKIS_SURESI);
    const z2 = setTimeout(() => kapat(id), sure);
    return () => {
      clearTimeout(z1);
      clearTimeout(z2);
    };
  }, [id, tur, kapat]);
  const dokun = () => {
    setCikiyor(true);
    setTimeout(() => kapat(id), CIKIS_SURESI);
  };
  return (
    <div className={`bildirim bildirim--${tur} ${cikiyor ? "bildirim--cikiyor" : ""}`} onClick={dokun} role="status">
      <span className="bildirim__simge" aria-hidden>
        {SIMGE[tur] ?? "i"}
      </span>
      <span className="bildirim__metin">{metin}</span>
    </div>
  );
}
