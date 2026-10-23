// İsim etiketi: oyuncunun masada, lobide ve sıralamada görünen kartı.
// Oyuncular sadece bunu süsler: çerçeve (kenarlık), rozet (simge) ve unvan (alt yazı).
// Süslerin görünümü kurallar paketindeki kozmetik.ts'ten okunur; yeni süs eklemek için
// orayı düzenlemek yeter, bu bileşen değişmez.
import { CERCEVELER, type Etiket, ROZETLER, UNVANLAR } from "@okey/kurallar";
import type { CSSProperties, ReactNode } from "react";

interface Ozellikler {
  ad: string;
  seviye?: number;
  etiket: Etiket;
  boyut?: "kucuk" | "normal" | "buyuk";
  /** Etiketin altına eklenecek ek bilgi (ör. taş sayısı). */
  ek?: ReactNode;
  soluk?: boolean;
}

export function IsimEtiketi({ ad, seviye, etiket, boyut = "normal", ek, soluk }: Ozellikler) {
  const cerceve = CERCEVELER.find((c) => c.id === etiket.cerceve) ?? CERCEVELER[0];
  const rozet = ROZETLER.find((r) => r.id === etiket.rozet);
  const unvan = UNVANLAR.find((u) => u.id === etiket.unvan);

  // Çerçeve: dış kutunun arka planı gradyan, iç kutu koyu; aradaki ince şerit kenarlık gibi görünür.
  const stil = { "--cerceve": cerceve.stil } as CSSProperties;
  const sinif = ["etiket", `etiket--${boyut}`, cerceve.parlak && "etiket--parlak", soluk && "etiket--soluk"]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={sinif} style={stil}>
      <div className="etiket__ic">
        {seviye !== undefined && <span className="etiket__seviye">{seviye}</span>}
        <div className="etiket__metin">
          <span className="etiket__ad">
            {rozet?.simge && <span className="etiket__rozet">{rozet.simge}</span>}
            {ad}
          </span>
          {unvan?.ad && (
            <span className="etiket__unvan" style={{ color: unvan.renk }}>
              {unvan.ad}
            </span>
          )}
        </div>
        {ek}
      </div>
    </div>
  );
}
