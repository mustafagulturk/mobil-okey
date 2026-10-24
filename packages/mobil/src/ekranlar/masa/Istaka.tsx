// İstaka ve sürükle-bırak.
//
// Kütüphane kullanmadan, Pointer Events ile sürükle-bırak (ortak kısım surukleme.ts'te):
//  1) Taşa basılınca (pointerdown, istaka üzerinde tek dinleyici) izleme başlar.
//  2) Parmak 6 pikselden fazla kayarsa sürükleme başlar: taşın bir kopyası ("hayalet")
//     parmağın altında kalkık ve gölgeli gezer, asıl taş yerinde soluk görünür.
//     Hayalet karede bir kez (rAF), React'e uğramadan, transform ile taşınır.
//  3) Bırakılınca parmağın altındaki öğeye bakılır (elementFromPoint): bir yuva ise
//     taş oraya taşınır, atma alanı ise atılır, gösterge/deste alanı ise el bitirilir.
//  4) Hiç kaymadan bırakılırsa bu bir dokunuştur: taş seçilir/seçim kalkar.
//
// İstaka ve taşlar memo'ludur: masa ekranının saniyede birkaç kez yenilenen
// geri sayımı istakayı yeniden çizdirmez.
//
// Yuva düzeni değişince (bırakma, Seri/Çift Diz) taşlar eski yerlerinden yenisine
// kayarak gider (FLIP): eski konumlar render sırasında (DOM henüz eskiyken) ölçülür,
// yeni konumlar useLayoutEffect'te; aradaki fark yaylı bir transform animasyonudur.
import type { Deger } from "@okey/kurallar";
import { type CSSProperties, memo, type PointerEvent as ReactPointerEvent, useLayoutEffect, useRef, useState } from "react";
import { Tas } from "../../bilesenler/Tas.tsx";
import { efektlerAcik } from "../../efektler/ayar.ts";
import { SIRA_UZUNLUGU, tasiTasi, type Yuvalar } from "../../yardimci/istaka.ts";
import { birakmaAlani, hayaletiKoy, suruklemeyiIzle, yuvaVurgula, yuvaVurgusunuKaldir } from "./surukleme.ts";

interface Ozellikler {
  yuvalar: Yuvalar;
  okey: Deger;
  secili: number | null;
  sirada: boolean;
  /** Elin ilk anı: taşlar sırayla düşerek dizilir. */
  dagitim: boolean;
  degistir: (y: Yuvalar) => void;
  sec: (tas: number | null) => void;
  /** Taş atma ya da bitirme alanına bırakıldı; kutu hayaletin bırakıldığı yer (uçuş oradan başlar). */
  birakildi: (tas: number, kutu: DOMRect | null, hedef: "at" | "bitir") => void;
  /** Sürükleme başladı/bitti ve parmak bir bırakma alanının üstünde mi. */
  suruklemeDurumu: (durum: SuruklemeDurumu) => void;
  /** Bu taş istakada gizli durur (ör. bitirmek için ortaya konmuşken). */
  gizliTas?: number | null;
}

export type SuruklemeDurumu = "yok" | "var" | "atUstunde" | "bitirUstunde";

export const Istaka = memo(IstakaIc, (a, b) =>
  a.yuvalar === b.yuvalar &&
  a.okey.renk === b.okey.renk &&
  a.okey.sayi === b.okey.sayi &&
  a.secili === b.secili &&
  a.sirada === b.sirada &&
  a.dagitim === b.dagitim &&
  a.gizliTas === b.gizliTas &&
  a.degistir === b.degistir &&
  a.sec === b.sec &&
  a.birakildi === b.birakildi &&
  a.suruklemeDurumu === b.suruklemeDurumu,
);

function IstakaIc({ yuvalar, okey, secili, sirada, dagitim, degistir, sec, birakildi, suruklemeDurumu, gizliTas = null }: Ozellikler) {
  const [surukle, setSurukle] = useState<{ tas: number; kaynak: number } | null>(null);
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

  // ---------- Sürükleme (bkz. surukleme.ts: hareket React'e uğramaz) ----------
  const basla = (e: ReactPointerEvent<HTMLDivElement>) => {
    const tasEl = (e.target as HTMLElement).closest<HTMLElement>("[data-tas]");
    const yuvaEl = tasEl?.closest<HTMLElement>("[data-yuva]");
    if (!tasEl || !yuvaEl || !kok.current?.contains(yuvaEl)) return;
    const tas = Number(tasEl.dataset.tas);
    const kaynak = Number(yuvaEl.dataset.yuva);
    const kutu = tasEl.getBoundingClientRect();
    const ofsetX = e.clientX - kutu.left;
    const ofsetY = e.clientY - kutu.top;
    let alan: "at" | "bitir" | null = null;
    let sonX = e.clientX;
    let sonY = e.clientY;
    suruklemeyiIzle(e, {
      basla: () => {
        hayaletKonum.current = { x: e.clientX, y: e.clientY, ofsetX, ofsetY };
        setSurukle({ tas, kaynak });
        ref.current.suruklemeDurumu("var");
      },
      hareket: (x, y, alt) => {
        sonX = x;
        sonY = y;
        hayaletKonum.current = { x, y, ofsetX, ofsetY };
        hayaletiKoy(hayalet.current, x, y, ofsetX, ofsetY);
        yuvaVurgula(alt);
        const yeni = birakmaAlani(alt);
        if (yeni !== alan) {
          alan = yeni;
          ref.current.suruklemeDurumu(yeni === "at" ? "atUstunde" : yeni === "bitir" ? "bitirUstunde" : "var");
        }
      },
      bitir: (x, y, alt, iptal) => {
        // Hayalet son karede kalmış olabilir: bırakma kutusunu parmağın son konumuna göre hesapla.
        hayaletiKoy(hayalet.current, iptal ? sonX : x, iptal ? sonY : y, ofsetX, ofsetY);
        const kutu = hayalet.current?.firstElementChild?.getBoundingClientRect() ?? null;
        yuvaVurgusunuKaldir();
        setSurukle(null);
        ref.current.suruklemeDurumu("yok");
        if (iptal) return;
        const yuva = alt?.closest<HTMLElement>(".istaka [data-yuva]");
        if (yuva) {
          if (kutu) birakmaKutusu.current = { tas, kutu };
          ref.current.degistir(tasiTasi(ref.current.yuvalar, kaynak, Number(yuva.dataset.yuva)));
          return;
        }
        const hedef = birakmaAlani(alt);
        if (hedef) ref.current.birakildi(tas, kutu, hedef);
      },
      dokunus: () => ref.current.sec(ref.current.secili === tas ? null : tas),
    });
  };

  // Hayalet ilk çizildiğinde parmağın altına konur (sonrası surukleme.ts'te).
  const hayaletKonum = useRef<{ x: number; y: number; ofsetX: number; ofsetY: number } | null>(null);
  useLayoutEffect(() => {
    const k = hayaletKonum.current;
    if (surukle && k) hayaletiKoy(hayalet.current, k.x, k.y, k.ofsetX, k.ofsetY);
  }, [surukle]);

  const sira = (bas: number) => (
    <div className="istaka__sira">
      {yuvalar.slice(bas, bas + SIRA_UZUNLUGU).map((tas, i) => {
        const yuva = bas + i;
        const kaynakBu = surukle !== null && surukle.kaynak === yuva;
        return (
          <div
            key={yuva}
            className="yuva"
            data-yuva={yuva}
            style={dagitim ? ({ "--i": i + bas } as CSSProperties) : undefined}
          >
            {tas !== null && (
              <Tas id={tas} okey={okey} secili={secili === tas} soluk={kaynakBu} gizli={gizliTas === tas} />
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <div ref={kok} onPointerDown={basla} className={`istaka ${sirada ? "istaka--sirada" : ""} ${dagitim ? "istaka--dagitim" : ""} ${surukle ? "istaka--surukleniyor" : ""}`}>
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

