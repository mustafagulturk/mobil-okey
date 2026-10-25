// Masa uçuşları: ardışık iki masa görünümünün farkından çıkarılan hamlelerin (masaOlaylari.ts)
// animasyonları. Okey ve 101 masası aynı uçuşları kullanır.
//
// useLayoutEffect içinde (boyamadan önce) çağrılır: hedefteki asıl taş gizlenir, kutular
// ölçülür; uçuş bir mikro görevde başlar (taş kopyası React ile çizilebilsin diye) ve iniş
// bitince hedef taş görünür.
import type { Deger } from "@okey/kurallar";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Tas } from "../../bilesenler/Tas.tsx";
import { efektlerAcik } from "../../efektler/ayar.ts";
import { ucur } from "../../efektler/ucus.ts";
import type { MasaOlayi } from "./masaOlaylari.ts";

/** Uçuş için bir taş öğesinin temiz kopyası (seçili/soluk/gizli hâlleri olmadan). */
export function tasKopyasi(el: HTMLElement): HTMLElement {
  const k = el.cloneNode(true) as HTMLElement;
  k.classList.remove("tas--secili", "tas--soluk", "tas--gizli", "tas--yeni");
  return k;
}

/** Bir kutunun merkezinde, verilen boyutta yeni bir kutu. */
export function merkezKutu(k: DOMRect, en: number, boy: number) {
  return new DOMRect(k.left + k.width / 2 - en / 2, k.top + k.height / 2 - boy / 2, en, boy);
}

/** Bir hamlenin uçuşunu hazırlar (bkz. yukarıdaki açıklama). */
export function ucusHazirla(
  kok: HTMLElement,
  olay: MasaOlayi,
  ben: number,
  okey: Deger,
  sonAtis: { tas: number; kutu: DOMRect } | null,
  cekKutu: DOMRect | null,
  gecikme: number,
) {
  const q = <T extends HTMLElement = HTMLElement>(s: string) => kok.querySelector<T>(s);
  const madalyon = (k: number) => q(`[data-oyuncu="${k}"] [data-madalyon]`);
  const yiginYuva = (k: number) => q(`[data-yigin="${k}"] .yigin__yuva`);
  const desteUst = q(".deste .tas:last-of-type");
  const ornekTas = q(".yigin .tas, .gosterge__yuz .tas");
  const ortaEn = ornekTas?.offsetWidth || 30;
  const ortaBoy = ornekTas?.offsetHeight || 41;
  const acik = efektlerAcik();
  const donus = () => (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 14);

  let baslangic: DOMRect | null = null;
  let hedef: DOMRect | null = null;
  let gizlenen: HTMLElement | null = null;
  let icerik: (() => { el: HTMLElement; birak?: () => void }) | null = null;
  let secenek: Parameters<typeof ucur>[3] = {};

  if (olay.tur === "at") {
    const ust = q(`[data-yigin="${olay.koltuk}"] .yigin__tas:last-child`);
    const yuva = yiginYuva(olay.koltuk);
    if (!ust || !yuva) return;
    gizlenen = ust;
    hedef = merkezKutu(yuva.getBoundingClientRect(), ortaEn, ortaBoy);
    if (olay.koltuk === ben) {
      baslangic = sonAtis?.tas === olay.tas ? sonAtis.kutu : (q(".istaka")?.getBoundingClientRect() ?? null);
      if (baslangic && sonAtis?.tas !== olay.tas) baslangic = merkezKutu(baslangic, ortaEn, ortaBoy);
    } else {
      const m = madalyon(olay.koltuk);
      if (m) baslangic = merkezKutu(m.getBoundingClientRect(), ortaEn * 0.7, ortaBoy * 0.7);
    }
    const kaynakTas = ust.querySelector<HTMLElement>(".tas");
    icerik = () => ({ el: kaynakTas!.cloneNode(true) as HTMLElement });
    secenek = { donus: donus() * 0.5, sure: olay.koltuk === ben ? 240 : 300 };
  } else {
    const benim = olay.koltuk === ben;
    if (olay.kaynak === "yan") {
      const y = yiginYuva(olay.yigin);
      if (y) baslangic = merkezKutu(y.getBoundingClientRect(), ortaEn, ortaBoy);
    } else if (desteUst) {
      baslangic = desteUst.getBoundingClientRect();
    }
    if (benim) {
      const t = olay.tas === null ? null : q(`.istaka [data-tas="${olay.tas}"]`);
      if (!t) return;
      gizlenen = t;
      hedef = t.getBoundingClientRect();
      icerik = () => ({ el: tasKopyasi(t) });
      secenek = { donus: donus() * 0.4, yay: 40, sure: 250 };
      // Sürükleyip yuvaya bıraktıysa taş bırakıldığı yerden yuvasına kısa bir kayışla oturur.
      if (cekKutu) {
        baslangic = cekKutu;
        secenek = { donus: 0, yay: 6, sure: 170 };
      }
    } else {
      const m = madalyon(olay.koltuk);
      if (!m) return;
      hedef = merkezKutu(m.getBoundingClientRect(), ortaEn * 0.6, ortaBoy * 0.6);
      secenek = { inis: false, sonOpaklik: 0.15, donus: donus() * 0.5, sure: 300 };
      if (olay.kaynak === "yan") {
        const tas = olay.tas;
        icerik = () => tasCiz(tas, okey);
      } else if (desteUst) {
        icerik = () => ({ el: desteUst.cloneNode(true) as HTMLElement });
      }
    }
  }
  if (!baslangic || !hedef || !icerik) return;

  if (gizlenen) gizlenen.style.visibility = "hidden";
  const goster = () => {
    if (gizlenen) gizlenen.style.visibility = "";
  };
  const b = baslangic;
  const h = hedef;
  const ic = icerik;
  queueMicrotask(() => {
    let birak: (() => void) | undefined;
    ucur(
      b,
      h,
      () => {
        const r = ic();
        birak = r.birak;
        return r.el;
      },
      { ...secenek, gecikme: acik ? gecikme : 0 },
    )
      .catch(() => {})
      .finally(() => {
        goster();
        birak?.();
      });
  });
}

/** Ekranda olmayan bir taşın uçmak için çizilmiş kopyası (ör. rakibin yandan aldığı taş). */
export function tasCiz(id: number, okey: Deger): { el: HTMLElement; birak: () => void } {
  const kap = document.createElement("div");
  const kok = createRoot(kap);
  flushSync(() => kok.render(<Tas id={id} okey={okey} boyut="orta" />));
  return { el: kap, birak: () => setTimeout(() => kok.unmount(), 0) };
}

/**
 * Elden masaya giden taşlar (101'de açma ve işleme): her taş istakadaki eski yerinden masadaki
 * yeni yerine uçar. Kutular hamle gönderilirken ölçülür (taş istakadan kalkmadan önce).
 */
export function eldenMasayaUcur(kok: HTMLElement, kutular: Map<number, DOMRect>) {
  let i = 0;
  for (const [tas, kutu] of kutular) {
    const hedef = kok.querySelector<HTMLElement>(`[data-per-alani] [data-tas="${tas}"]`);
    if (!hedef) continue;
    hedef.style.visibility = "hidden";
    const h = hedef.getBoundingClientRect();
    const sira = i++;
    const gecikme = efektlerAcik() ? sira * 45 : 0;
    queueMicrotask(() => {
      ucur(kutu, h, tasKopyasi(hedef), { sure: 300, yay: 26, donus: (sira % 2 ? -1 : 1) * 6, gecikme })
        .catch(() => {})
        .finally(() => (hedef.style.visibility = ""));
    });
  }
}
