// İstaka ve sürükle-bırak.
//
// Kütüphane kullanmadan, Pointer Events ile sürükle-bırak:
//  1) Taşa basılınca (pointerdown) başlangıç noktası kaydedilir.
//  2) Parmak 6 pikselden fazla kayarsa sürükleme başlar: taşın bir kopyası ("hayalet")
//     parmağın altında kalkık ve gölgeli gezer, asıl taş yerinde soluk görünür.
//     Hayalet her karede React'e uğramadan, doğrudan transform ile taşınır.
//  3) Bırakılınca (pointerup) parmağın altındaki öğeye bakılır (elementFromPoint):
//     bir yuva ise taş oraya taşınır, atma alanı ise taş atılır.
//  4) Hiç kaymadan bırakılırsa bu bir dokunuştur: taş seçilir/seçim kalkar.
//
// Yuva düzeni değişince (bırakma, Seri/Çift Diz) taşlar eski yerlerinden yenisine
// kayarak gider (FLIP): eski konumlar render sırasında (DOM henüz eskiyken) ölçülür,
// yeni konumlar useLayoutEffect'te; aradaki fark yaylı bir transform animasyonudur.
import type { Deger } from "@okey/kurallar";
import { type CSSProperties, type PointerEvent as ReactPointerEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Tas } from "../../bilesenler/Tas.tsx";
import { efektlerAcik } from "../../efektler/ayar.ts";
import { SIRA_UZUNLUGU, tasiTasi, type Yuvalar } from "../../yardimci/istaka.ts";

const KAYMA_ESIGI = 6;

interface Basis {
  tas: number;
  kaynak: number;
  /** Parmağın taşın sol üst köşesine göre konumu (hayalet kaymasın diye). */
  ofsetX: number;
  ofsetY: number;
  x: number;
  y: number;
  baslangicX: number;
  baslangicY: number;
  basladi: boolean;
}

interface Ozellikler {
  yuvalar: Yuvalar;
  okey: Deger;
  secili: number | null;
  sirada: boolean;
  /** Elin ilk anı: taşlar sırayla düşerek dizilir. */
  dagitim: boolean;
  degistir: (y: Yuvalar) => void;
  sec: (tas: number | null) => void;
  /** Taş atma alanına bırakıldı; kutu hayaletin bırakıldığı yer (uçuş oradan başlar). */
  birakildi: (tas: number, kutu: DOMRect | null) => void;
  /** Sürükleme başladı/bitti ve parmak atma alanının üstünde mi. */
  suruklemeDurumu: (durum: "yok" | "var" | "atUstunde") => void;
}

export function Istaka({ yuvalar, okey, secili, sirada, dagitim, degistir, sec, birakildi, suruklemeDurumu }: Ozellikler) {
  const [surukle, setSurukle] = useState<{ tas: number; kaynak: number } | null>(null);
  const [basili, setBasili] = useState(false);
  const [hedefYuva, setHedefYuva] = useState<number | null>(null);
  const basis = useRef<Basis | null>(null);
  const hayalet = useRef<HTMLDivElement>(null);
  const kok = useRef<HTMLDivElement>(null);
  // Pencere olay dinleyicileri en güncel değerleri görsün diye ref.
  const ref = useRef({ yuvalar, secili, degistir, sec, birakildi, suruklemeDurumu });
  ref.current = { yuvalar, secili, degistir, sec, birakildi, suruklemeDurumu };

  // ---------- FLIP: yuva düzeni değişince taşlar kayarak yerine gider ----------
  const oncekiYuvalar = useRef(yuvalar);
  const ilkKutular = useRef<Map<number, DOMRect> | null>(null);
  const birakmaKutusu = useRef<{ tas: number; kutu: DOMRect } | null>(null);
  if (oncekiYuvalar.current !== yuvalar && ilkKutular.current === null && kok.current) {
    // Render aşaması: DOM henüz eski düzende, taşların şimdiki yerini ölç.
    const m = new Map<number, DOMRect>();
    kok.current.querySelectorAll<HTMLElement>("[data-tas]").forEach((el) => m.set(Number(el.dataset.tas), el.getBoundingClientRect()));
    ilkKutular.current = m;
  }
  useLayoutEffect(() => {
    if (oncekiYuvalar.current === yuvalar) return;
    oncekiYuvalar.current = yuvalar;
    const ilk = ilkKutular.current;
    ilkKutular.current = null;
    const birakma = birakmaKutusu.current;
    birakmaKutusu.current = null;
    if (!ilk || !kok.current || !efektlerAcik()) return;
    if (birakma) ilk.set(birakma.tas, birakma.kutu);
    kok.current.querySelectorAll<HTMLElement>("[data-tas]").forEach((el) => {
      const id = Number(el.dataset.tas);
      const a = ilk.get(id);
      if (!a) return;
      const b = el.getBoundingClientRect();
      const dx = a.left - b.left;
      const dy = a.top - b.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      const birakilan = birakma?.tas === id;
      const uzak = Math.min(1, Math.hypot(dx, dy) / 400);
      el.animate(
        birakilan
          ? [
              { transform: `translate(${dx}px, ${dy}px) scale(1.14) rotate(-4deg)`, zIndex: 5 },
              { transform: "translate(0, 0) scale(1) rotate(0deg)", zIndex: 5 },
            ]
          : [{ transform: `translate(${dx}px, ${dy}px)`, zIndex: 3 }, { transform: "translate(0, 0)", zIndex: 3 }],
        { duration: birakilan ? 360 : 380 + uzak * 160, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
      );
    });
  }, [yuvalar]);

  const basla = (e: ReactPointerEvent<HTMLDivElement>, tas: number, kaynak: number) => {
    if (e.button !== 0) return;
    const kutu = e.currentTarget.getBoundingClientRect();
    basis.current = {
      tas,
      kaynak,
      ofsetX: e.clientX - kutu.left,
      ofsetY: e.clientY - kutu.top,
      x: e.clientX,
      y: e.clientY,
      baslangicX: e.clientX,
      baslangicY: e.clientY,
      basladi: false,
    };
    setBasili(true);
  };

  // Hayaleti parmağın altına taşı (React render'ı olmadan).
  const hayaletiTasi = () => {
    const m = basis.current;
    if (m && hayalet.current) hayalet.current.style.transform = `translate3d(${m.x - m.ofsetX}px, ${m.y - m.ofsetY}px, 0)`;
  };
  useLayoutEffect(hayaletiTasi, [surukle]);

  useEffect(() => {
    if (!basili) return;
    let atUstunde = false;

    const hareket = (e: PointerEvent) => {
      const m = basis.current;
      if (!m) return;
      m.x = e.clientX;
      m.y = e.clientY;
      if (!m.basladi && Math.hypot(e.clientX - m.baslangicX, e.clientY - m.baslangicY) > KAYMA_ESIGI) {
        m.basladi = true;
        setSurukle({ tas: m.tas, kaynak: m.kaynak });
        ref.current.suruklemeDurumu("var");
      }
      if (!m.basladi) return;
      hayaletiTasi();
      const alt = altindaki(e.clientX, e.clientY);
      const yuva = alt?.closest<HTMLElement>("[data-yuva]");
      setHedefYuva(yuva ? Number(yuva.dataset.yuva) : null);
      const ustunde = !!alt?.closest("[data-birak='at']");
      if (ustunde !== atUstunde) {
        atUstunde = ustunde;
        ref.current.suruklemeDurumu(ustunde ? "atUstunde" : "var");
      }
    };

    const birak = (e: PointerEvent) => {
      const m = basis.current;
      const kutu = hayalet.current?.firstElementChild?.getBoundingClientRect() ?? null;
      basis.current = null;
      setBasili(false);
      setSurukle(null);
      setHedefYuva(null);
      if (!m) return;
      if (!m.basladi) {
        // Dokunuş: seç ya da seçimi kaldır.
        ref.current.sec(ref.current.secili === m.tas ? null : m.tas);
        return;
      }
      ref.current.suruklemeDurumu("yok");
      const alt = altindaki(e.clientX, e.clientY);
      const yuva = alt?.closest<HTMLElement>("[data-yuva]");
      if (yuva) {
        if (kutu) birakmaKutusu.current = { tas: m.tas, kutu };
        ref.current.degistir(tasiTasi(ref.current.yuvalar, m.kaynak, Number(yuva.dataset.yuva)));
        return;
      }
      if (alt?.closest("[data-birak='at']")) ref.current.birakildi(m.tas, kutu);
    };

    window.addEventListener("pointermove", hareket);
    window.addEventListener("pointerup", birak);
    window.addEventListener("pointercancel", birak);
    return () => {
      window.removeEventListener("pointermove", hareket);
      window.removeEventListener("pointerup", birak);
      window.removeEventListener("pointercancel", birak);
    };
  }, [basili]);

  const sira = (bas: number) => (
    <div className="istaka__sira">
      {yuvalar.slice(bas, bas + SIRA_UZUNLUGU).map((tas, i) => {
        const yuva = bas + i;
        const kaynakBu = surukle !== null && surukle.kaynak === yuva;
        return (
          <div
            key={yuva}
            className={`yuva ${hedefYuva === yuva && surukle ? "yuva--hedef" : ""}`}
            data-yuva={yuva}
            style={dagitim ? ({ "--i": i + bas } as CSSProperties) : undefined}
          >
            {tas !== null && (
              <Tas id={tas} okey={okey} secili={secili === tas} soluk={kaynakBu} onPointerDown={(e) => basla(e, tas, yuva)} />
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <div ref={kok} className={`istaka ${sirada ? "istaka--sirada" : ""} ${dagitim ? "istaka--dagitim" : ""} ${surukle ? "istaka--surukleniyor" : ""}`}>
        <div className="istaka__raf istaka__raf--ust">{sira(0)}</div>
        <div className="istaka__raf istaka__raf--alt">{sira(SIRA_UZUNLUGU)}</div>
      </div>
      {surukle && (
        <div className="hayalet" ref={hayalet}>
          <Tas id={surukle.tas} okey={okey} suruklenen />
        </div>
      )}
    </>
  );
}

/** Parmağın altındaki öğe. Hayalet "pointer-events: none" olduğu için onu atlar. */
function altindaki(x: number, y: number): HTMLElement | null {
  return document.elementFromPoint(x, y) as HTMLElement | null;
}
