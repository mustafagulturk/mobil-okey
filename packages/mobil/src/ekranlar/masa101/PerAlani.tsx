// Masaya açılmış perler. Orta alan iki eşit sütundur: solda herkesin seri/grup perleri,
// sağda herkesin çiftleri (PerSutunu). Her sütunda oyuncu başına bir satır (PerSatiri):
// satırın başında oyuncunun renginde küçük bir künye (ad ve açma değeri / çift sayısı), ardından
// perleri. Kimse açmamışken sütunda zarif bir yer tutucu yazar ("Seri açılanlar" / "Çiftler").
//
// Taşlar küçük boyda çizilir; sütun dolunca taşlar sığana kadar küçülür (useSigdir), en
// küçük boyda da sığmıyorsa sütun kendi içinde kayar. Benim istakadan sürüklediğim taş bir
// pere işlenebiliyorsa o per altın çerçeveyle nefes alır ve bırakma hedefi olur
// (data-birak="per"); parmak üstüne gelince parlar (surukleme.ts). Taş seçiliyken pere
// dokunmak da işler (sürüklemeden oynamak isteyenler için).
import type { AcikPer, Deger } from "@okey/kurallar";
import { type CSSProperties, memo, type ReactNode, type RefObject, useLayoutEffect, useRef } from "react";
import { Tas } from "../../bilesenler/Tas.tsx";

export type SutunTuru = "seri" | "cift";

/** Bir oyuncunun masadaki perleri (satır hâlinde gösterilir). */
export interface Oyuncu101 {
  koltuk: number;
  /** Oyuncunun adı (ben isem "Sen"). */
  ad: string;
  /** Madalyon tonu: künye ve satırın ince kenarı oyuncunun renginde. */
  ton: number;
  /** Seri açtıysa açma değeri (künyede yazar). */
  deger: number | null;
  /** Oyuncunun bütün perleri (sırası masadaki per numarasıdır). */
  perler: AcikPer[];
  /** Sürüklenen/seçili taşın işlenebileceği perlerin sıraları ("okey" ise okey alınır). */
  hedefler: ReadonlyMap<number, "uzat" | "okey">;
}

interface Ozellikler {
  tur: SutunTuru;
  oyuncular: Oyuncu101[];
  okey: Deger;
  /** Seçili taşla bir pere dokunuldu. */
  dokun?: (koltuk: number, per: number) => void;
  /** Sütunun altına eklenen (sağda deste yuvası). */
  alt?: ReactNode;
}

/** Taş eni sınırları (px): sütun doluyken bu aralıkta küçülür. */
const EN_BUYUK = 22;
const EN_KUCUK = 12;

const BOS_YAZI: Record<SutunTuru, [string, string]> = {
  seri: ["Seri açılanlar", "Seriler ve gruplar burada dizilir"],
  cift: ["Çiftler", "Çift açanların taşları burada"],
};

/** Per bu sütuna mı ait? Seri ve grup solda, çift sağda. */
const sutunda = (tur: SutunTuru, p: AcikPer) => (tur === "cift") === (p.tur === "cift");

export function PerSutunu({ tur, oyuncular, okey, dokun, alt }: Ozellikler) {
  const liste = useRef<HTMLDivElement>(null);
  const satirlar = oyuncular.filter((o) => o.perler.some((p) => sutunda(tur, p)));
  const tasSayisi = satirlar.reduce((n, o) => n + o.perler.reduce((m, p) => m + (sutunda(tur, p) ? p.taslar.length : 0), 0), 0);
  useSigdir(liste, `${satirlar.length}/${tasSayisi}`);
  const [baslik, aciklama] = BOS_YAZI[tur];

  return (
    <section className={`per-sutunu per-sutunu--${tur} ${satirlar.length === 0 ? "per-sutunu--bos" : ""}`} aria-label={baslik}>
      <div className="per-sutunu__cerceve">
        <span className="per-sutunu__baslik">{tur === "seri" ? "Seriler" : "Çiftler"}</span>
        <div ref={liste} className="per-sutunu__liste">
          {satirlar.length === 0 ? (
            <div className="per-sutunu__bos">
              <b>{baslik}</b>
              <small>{aciklama}</small>
            </div>
          ) : (
            satirlar.map((o) => <PerSatiri key={o.koltuk} tur={tur} oyuncu={o} okey={okey} dokun={dokun} />)
          )}
        </div>
      </div>
      {alt}
    </section>
  );
}

const PerSatiri = memo(function PerSatiri({ tur, oyuncu, okey, dokun }: { tur: SutunTuru; oyuncu: Oyuncu101; okey: Deger; dokun?: (koltuk: number, per: number) => void }) {
  const { koltuk, ad, ton, deger, perler, hedefler } = oyuncu;
  const ciftSayisi = perler.filter((p) => p.tur === "cift").length;
  const kunyeDeger = tur === "cift" ? `${ciftSayisi} çift` : deger !== null ? String(deger) : null;
  return (
    <div className="per-satiri" style={{ "--ton": ton } as CSSProperties} data-per-alani={koltuk} aria-label={`${ad} perleri`}>
      <span className="per-satiri__kunye">
        <b>{ad}</b>
        {kunyeDeger && <small>{kunyeDeger}</small>}
      </span>
      {perler.map((p, i) => {
        if (!sutunda(tur, p)) return null;
        const hedef = hedefler.get(i);
        return (
          <div
            // Perin ilk taşı per boyunca değişmez değil (başa işlenebilir); sıra numarası yeterli.
            key={i}
            className={`per101 per101--${p.tur} ${hedef ? "per101--hedef" : ""} ${hedef === "okey" ? "per101--okey-al" : ""}`}
            data-birak={hedef ? "per" : undefined}
            data-koltuk={koltuk}
            data-per={i}
            onClick={hedef && dokun ? () => dokun(koltuk, i) : undefined}
          >
            {p.taslar.map((t) => (
              <Tas key={t} id={t} okey={okey} boyut="kucuk" />
            ))}
          </div>
        );
      })}
    </div>
  );
});

/**
 * Sütunun içeriği sığmıyorsa taşları küçültür: en büyük boydan başlayıp taşma kalmayana
 * kadar birer piksel indirir (--per-tas-en). En küçük boyda da sığmazsa sütun kayar ve
 * devamı olan ucu solar (data-kayar).
 * Per sayısı/taş sayısı değişince ve sütun yeniden boyutlanınca tekrar hesaplanır.
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
      kenarlariIsaretle();
    };
    // Kayan listede hangi uçta devamı var: maske o ucu soldurur.
    const kenarlariIsaretle = () => {
      const ust = el.scrollTop > 1;
      const alt = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      const kayar = ust && alt ? "iki" : ust ? "ust" : alt ? "alt" : null;
      if (kayar) el.dataset.kayar = kayar;
      else delete el.dataset.kayar;
    };
    sigdir();
    const g = new ResizeObserver(sigdir);
    g.observe(el);
    el.addEventListener("scroll", kenarlariIsaretle, { passive: true });
    return () => {
      g.disconnect();
      el.removeEventListener("scroll", kenarlariIsaretle);
    };
  }, [anahtar]);
}
