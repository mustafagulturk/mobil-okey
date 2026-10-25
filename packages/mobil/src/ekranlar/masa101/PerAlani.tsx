// Bir oyuncunun masaya açtığı perler. Her oyuncunun alanı kendi tarafındadır: karşıdakinin
// perleri üstte, soldakinin solda, sağdakinin sağda, benimkiler istakanın hemen üstünde.
//
// Taşlar küçük boyda çizilir; alan dolunca taşlar sığana kadar küçülür (useSigdir). Benim
// istakadan sürüklediğim taş bir pere işlenebiliyorsa o per altın çerçeveyle nefes alır ve
// bırakma hedefi olur (data-birak="per"); parmak üstüne gelince parlar (surukleme.ts).
// Taş seçiliyken pere dokunmak da işler (sürüklemeden oynamak isteyenler için).
import type { AcikPer, Deger } from "@okey/kurallar";
import { type CSSProperties, memo, type RefObject, useLayoutEffect, useRef } from "react";
import { Tas } from "../../bilesenler/Tas.tsx";

export type AlanKonumu = "ust" | "sol" | "sag" | "ben";

interface Ozellikler {
  koltuk: number;
  konum: AlanKonumu;
  perler: AcikPer[];
  okey: Deger;
  /** Oyuncunun adı (henüz açmadıysa alanda soluk yazar). */
  ad: string;
  /** Madalyon tonu: alanın ince kenarı oyuncunun renginde. */
  ton: number;
  /** Sürüklenen/seçili taşın işlenebileceği perlerin sıraları ("okey" ise okey alınır). */
  hedefler: ReadonlyMap<number, "uzat" | "okey">;
  /** Seçili taşla pere dokunuldu. */
  dokun?: (per: number) => void;
}

/** Taş eni sınırları (px): alan doluyken bu aralıkta küçülür. */
const EN_BUYUK = 22;
const EN_KUCUK = 13;

export const PerAlani = memo(function PerAlani({ koltuk, konum, perler, okey, ad, ton, hedefler, dokun }: Ozellikler) {
  const kok = useRef<HTMLElement>(null);
  const tasSayisi = perler.reduce((n, p) => n + p.taslar.length, 0);
  useSigdir(kok, `${perler.length}/${tasSayisi}`);

  return (
    <section
      ref={kok}
      className={`per-alani per-alani--${konum} ${perler.length === 0 ? "per-alani--bos" : ""}`}
      style={{ "--ton": ton } as CSSProperties}
      data-per-alani={koltuk}
      aria-label={`${ad} perleri`}
    >
      {perler.length === 0 ? (
        <span className="per-alani__bos">{konum === "ben" ? "Henüz açmadın" : `${ad} açmadı`}</span>
      ) : (
        perler.map((p, i) => {
          const hedef = hedefler.get(i);
          return (
            <div
              // Perin ilk taşı per boyunca değişmez değil (başa işlenebilir); sıra numarası yeterli.
              key={i}
              className={`per101 per101--${p.tur} ${hedef ? "per101--hedef" : ""} ${hedef === "okey" ? "per101--okey-al" : ""}`}
              data-birak={hedef ? "per" : undefined}
              data-koltuk={koltuk}
              data-per={i}
              onClick={hedef && dokun ? () => dokun(i) : undefined}
            >
              {p.taslar.map((t) => (
                <Tas key={t} id={t} okey={okey} boyut="kucuk" />
              ))}
            </div>
          );
        })
      )}
    </section>
  );
});

/**
 * Alanın içeriği sığmıyorsa taşları küçültür: en büyük boydan başlayıp taşma kalmayana
 * kadar birer piksel indirir (--per-tas-en). Per sayısı/taş sayısı değişince ve alan
 * yeniden boyutlanınca (ekran döndü, pencere değişti) tekrar hesaplanır.
 */
function useSigdir(kok: RefObject<HTMLElement>, anahtar: string) {
  useLayoutEffect(() => {
    const el = kok.current;
    if (!el) return;
    const sigdir = () => {
      let en = EN_BUYUK;
      el.style.setProperty("--per-tas-en", `${en}px`);
      while (en > EN_KUCUK && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
        en--;
        el.style.setProperty("--per-tas-en", `${en}px`);
      }
    };
    sigdir();
    const g = new ResizeObserver(sigdir);
    g.observe(el);
    return () => g.disconnect();
  }, [anahtar]);
}
