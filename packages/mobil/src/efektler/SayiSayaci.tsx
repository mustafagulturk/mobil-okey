// Sayı sayacı: değer değişince eski değerden yeniye sayarak akar (çip, XP, puan).
// Efektler kapalıysa doğrudan yeni değeri gösterir.
import { useEffect, useRef, useState } from "react";
import { efektlerAcik } from "./ayar.ts";

const varsayilanBicim = (n: number) => Math.round(n).toLocaleString("tr-TR");

interface Ozellikler {
  deger: number;
  bicim?: (n: number) => string;
  /** Akış süresi (ms). Verilmezse farka göre 450-1100 ms. */
  sure?: number;
  className?: string;
}

export function SayiSayaci({ deger, bicim = varsayilanBicim, sure, className }: Ozellikler) {
  const [gosterilen, setGosterilen] = useState(deger);
  const simdiki = useRef(deger);
  const [akiyor, setAkiyor] = useState<"" | "artis" | "azalis">("");

  useEffect(() => {
    const bas = simdiki.current;
    if (bas === deger) return;
    if (!efektlerAcik()) {
      simdiki.current = deger;
      setGosterilen(deger);
      return;
    }
    const fark = deger - bas;
    const toplam = sure ?? Math.min(1100, 450 + Math.log10(Math.abs(fark) + 1) * 160);
    const t0 = performance.now();
    let kare = 0;
    setAkiyor(fark > 0 ? "artis" : "azalis");
    const adim = (t: number) => {
      const p = Math.min(1, (t - t0) / toplam);
      const e = 1 - Math.pow(1 - p, 3); // yavaşlayarak dur
      const v = bas + fark * e;
      simdiki.current = v;
      setGosterilen(v);
      if (p < 1) kare = requestAnimationFrame(adim);
      else {
        simdiki.current = deger;
        setGosterilen(deger);
        setAkiyor("");
      }
    };
    kare = requestAnimationFrame(adim);
    return () => cancelAnimationFrame(kare);
  }, [deger, sure]);

  const sinif = ["sayi-sayaci", akiyor && `sayi-sayaci--${akiyor}`, className].filter(Boolean).join(" ");
  return <span className={sinif}>{bicim(akiyor ? Math.round(gosterilen) : gosterilen)}</span>;
}
