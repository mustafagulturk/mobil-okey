// Ekranın üstünde kısa süre görünen bildirimler (toast): hamle hataları, ödüller vb.
import { useEffect } from "react";
import { useOyun } from "../durum/OyunSaglayici.tsx";

export function Bildirimler() {
  const { durum, bildirimKapat } = useOyun();
  return (
    <div className="bildirimler">
      {durum.bildirimler.map((b) => (
        <BildirimKarti key={b.id} id={b.id} tur={b.tur} metin={b.metin} kapat={bildirimKapat} />
      ))}
    </div>
  );
}

function BildirimKarti({ id, tur, metin, kapat }: { id: number; tur: string; metin: string; kapat: (id: number) => void }) {
  useEffect(() => {
    const z = setTimeout(() => kapat(id), tur === "hata" ? 2600 : 3400);
    return () => clearTimeout(z);
  }, [id, tur, kapat]);
  return (
    <div className={`bildirim bildirim--${tur}`} onClick={() => kapat(id)}>
      {metin}
    </div>
  );
}
