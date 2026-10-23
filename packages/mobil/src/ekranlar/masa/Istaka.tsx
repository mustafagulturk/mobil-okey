// İstaka ve sürükle-bırak.
//
// Kütüphane kullanmadan, Pointer Events ile basit bir sürükle-bırak:
//  1) Taşa basılınca (pointerdown) başlangıç noktası kaydedilir.
//  2) Parmak 6 pikselden fazla kayarsa sürükleme başlar: taşın bir kopyası ("hayalet")
//     parmağın altında gezer, asıl taş yerinde soluk görünür.
//  3) Bırakılınca (pointerup) parmağın altındaki öğeye bakılır (elementFromPoint):
//     bir yuva ise taş oraya taşınır, atma alanı ise taş atılır.
//  4) Hiç kaymadan bırakılırsa bu bir dokunuştur: taş seçilir/seçim kalkar.
import type { Deger } from "@okey/kurallar";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { Tas } from "../../bilesenler/Tas.tsx";
import { SIRA_UZUNLUGU, tasiTasi, type Yuvalar } from "../../yardimci/istaka.ts";

const KAYMA_ESIGI = 6;

interface Surukleme {
  tas: number;
  kaynak: number;
  /** Parmağın taşın sol üst köşesine göre konumu (hayalet kaymasın diye). */
  ofsetX: number;
  ofsetY: number;
  x: number;
  y: number;
  basladi: boolean;
  baslangicX: number;
  baslangicY: number;
}

interface Ozellikler {
  yuvalar: Yuvalar;
  okey: Deger;
  secili: number | null;
  yeniler: Set<number>;
  sirada: boolean;
  degistir: (y: Yuvalar) => void;
  sec: (tas: number | null) => void;
  /** Taş atma alanına bırakıldı. */
  birakildi: (tas: number, hedef: "at") => void;
}

export function Istaka({ yuvalar, okey, secili, yeniler, sirada, degistir, sec, birakildi }: Ozellikler) {
  const [s, setS] = useState<Surukleme | null>(null);
  const [hedefYuva, setHedefYuva] = useState<number | null>(null);
  // Pencere olay dinleyicileri en güncel değerleri görsün diye ref.
  const ref = useRef({ s, yuvalar, secili, degistir, sec, birakildi });
  ref.current = { s, yuvalar, secili, degistir, sec, birakildi };

  const basla = (e: ReactPointerEvent<HTMLDivElement>, tas: number, kaynak: number) => {
    if (e.button !== 0) return;
    const kutu = e.currentTarget.getBoundingClientRect();
    setS({
      tas,
      kaynak,
      ofsetX: e.clientX - kutu.left,
      ofsetY: e.clientY - kutu.top,
      x: e.clientX,
      y: e.clientY,
      basladi: false,
      baslangicX: e.clientX,
      baslangicY: e.clientY,
    });
  };

  const surukleniyor = s !== null;
  useEffect(() => {
    if (!surukleniyor) return;

    const hareket = (e: PointerEvent) => {
      const m = ref.current.s;
      if (!m) return;
      const kaydi = Math.hypot(e.clientX - m.baslangicX, e.clientY - m.baslangicY) > KAYMA_ESIGI;
      setS({ ...m, x: e.clientX, y: e.clientY, basladi: m.basladi || kaydi });
      const yuva = altindaki(e.clientX, e.clientY)?.closest<HTMLElement>("[data-yuva]");
      setHedefYuva(yuva ? Number(yuva.dataset.yuva) : null);
    };

    const birak = (e: PointerEvent) => {
      const m = ref.current.s;
      setS(null);
      setHedefYuva(null);
      if (!m) return;
      if (!m.basladi) {
        // Dokunuş: seç ya da seçimi kaldır.
        ref.current.sec(ref.current.secili === m.tas ? null : m.tas);
        return;
      }
      const alt = altindaki(e.clientX, e.clientY);
      const yuva = alt?.closest<HTMLElement>("[data-yuva]");
      if (yuva) {
        ref.current.degistir(tasiTasi(ref.current.yuvalar, m.kaynak, Number(yuva.dataset.yuva)));
        return;
      }
      if (alt?.closest("[data-birak='at']")) ref.current.birakildi(m.tas, "at");
    };

    window.addEventListener("pointermove", hareket);
    window.addEventListener("pointerup", birak);
    window.addEventListener("pointercancel", birak);
    return () => {
      window.removeEventListener("pointermove", hareket);
      window.removeEventListener("pointerup", birak);
      window.removeEventListener("pointercancel", birak);
    };
  }, [surukleniyor]);

  const sira = (bas: number) => (
    <div className="istaka__sira">
      {yuvalar.slice(bas, bas + SIRA_UZUNLUGU).map((tas, i) => {
        const yuva = bas + i;
        const kaynakBu = s?.basladi && s.kaynak === yuva;
        return (
          <div key={yuva} className={`yuva ${hedefYuva === yuva && s?.basladi ? "yuva--hedef" : ""}`} data-yuva={yuva}>
            {tas !== null && (
              <Tas
                id={tas}
                okey={okey}
                secili={secili === tas}
                yeni={yeniler.has(tas)}
                soluk={kaynakBu}
                onPointerDown={(e) => basla(e, tas, yuva)}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <div className={`istaka ${sirada ? "istaka--sirada" : ""}`}>
        {sira(0)}
        {sira(SIRA_UZUNLUGU)}
      </div>
      {s?.basladi && (
        <div className="hayalet" style={{ left: s.x - s.ofsetX, top: s.y - s.ofsetY }}>
          <Tas id={s.tas} okey={okey} />
        </div>
      )}
    </>
  );
}

/** Parmağın altındaki öğe. Hayalet "pointer-events: none" olduğu için onu atlar. */
function altindaki(x: number, y: number): HTMLElement | null {
  return document.elementFromPoint(x, y) as HTMLElement | null;
}
