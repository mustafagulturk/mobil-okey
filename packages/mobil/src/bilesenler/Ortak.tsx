// Birkaç ekranda kullanılan küçük parçalar.
import type { ReactNode } from "react";
import { kisaCip, cipBicim } from "../yardimci/bicim.ts";
import { CipSimgesi, Simge } from "./Simge.tsx";

/** Çip miktarı: simge + Türkçe biçimli sayı. */
export function Cip({ miktar, kisa }: { miktar: number; kisa?: boolean }) {
  return (
    <span className="cip">
      <CipSimgesi />
      {kisa ? kisaCip(miktar) : cipBicim(miktar)}
    </span>
  );
}

export function SeviyeCubugu({ mevcut, gereken }: { mevcut: number; gereken: number }) {
  const oran = Math.min(1, gereken > 0 ? mevcut / gereken : 0);
  return (
    <div className="seviye-cubugu" title={`${mevcut} / ${gereken} XP`}>
      <div className="seviye-cubugu__dolu" style={{ width: `${oran * 100}%` }} />
      <span className="seviye-cubugu__yazi">
        {mevcut} / {gereken} XP
      </span>
    </div>
  );
}

/** Alt ekranların (mağaza, ayarlar...) ortak başlığı: geri düğmesi + başlık + sağ taraf. */
export function EkranBasligi({ baslik, geri, sag }: { baslik: string; geri: () => void; sag?: ReactNode }) {
  return (
    <header className="ekran-basligi">
      <button className="simge-dugme" onClick={geri} aria-label="Geri">
        <Simge ad="geri" boyut={24} />
      </button>
      <h1>{baslik}</h1>
      <div className="ekran-basligi__sag">{sag}</div>
    </header>
  );
}

/** Aç/kapa anahtarı. */
export function Anahtar({ acik, degistir, etiket }: { acik: boolean; degistir: (a: boolean) => void; etiket: string }) {
  return (
    <label className="anahtar-satiri">
      <span>{etiket}</span>
      <button
        role="switch"
        aria-checked={acik}
        className={`anahtar ${acik ? "anahtar--acik" : ""}`}
        onClick={() => degistir(!acik)}
      >
        <span className="anahtar__top" />
      </button>
    </label>
  );
}
