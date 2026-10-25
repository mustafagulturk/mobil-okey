// Masaya açılmış perler. Orta alan iki sütundur: solda herkesin seri/grup perleri, sağda
// herkesin çiftleri (PerSutunu); çiftlerin altında (ya da yanında) deste yuvası. Her sütunda
// oyuncu başına bir satır (PerSatiri): satırın kime ait olduğunu solundaki ince, oyuncunun
// renginde çizgi söyler (açma değeri zaten oyuncunun plakasındaki rozette yazar). Kimse
// açmamışken sütunda zarif bir yer tutucu yazar ("Seri açılanlar" / "Çiftler").
//
// 101 işleme usulüdür; masada çok taş birikir. Bu yüzden yer sığmaya harcanır:
//  - Sütun genişlikleri içeriğe göre ayarlanır (sutunlariBol): iki sütundaki taşların
//    birlikte en büyük boyda sığacağı bölüşüm seçilir; ikisi de rahatsa eşit kalır, bir
//    sütun boşsa dar bir yer tutucuya iner. Geçiş yumuşaktır (CSS transition).
//  - Çiftler sütunu yükseklik isterse (dört oyuncu da çift açmış gibi) deste yuvası
//    çiftlerin altından yanına geçer ve dikey dizilir; çiftler tam boyu kullanır.
//  - Taşlar iki sütunda da aynı boydadır (--per-tas-en alanın kökünde); en büyük boydan
//    taşma kalmayana kadar küçülür (useSigdir), en küçük boyda da sığmazsa sütun kayar.
//
// Benim istakadan sürüklediğim taş bir pere işlenebiliyorsa o per altın çerçeveyle nefes
// alır ve bırakma hedefi olur (data-birak="per"); parmak üstüne gelince parlar
// (surukleme.ts). Taş seçiliyken pere dokunmak da işler (sürüklemeden oynamak isteyenler için).
import type { AcikPer, Deger } from "@okey/kurallar";
import { type CSSProperties, memo, type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from "react";
import { Tas } from "../../bilesenler/Tas.tsx";

export type SutunTuru = "seri" | "cift";

/** Bir oyuncunun masadaki perleri (satır hâlinde gösterilir). */
export interface Oyuncu101 {
  koltuk: number;
  /** Oyuncunun adı (ben isem "Sen"); satırın erişilebilirlik etiketinde. */
  ad: string;
  /** Madalyon tonu: satırın ince sol çizgisi oyuncunun renginde. */
  ton: number;
  /** Oyuncunun bütün perleri (sırası masadaki per numarasıdır). */
  perler: AcikPer[];
  /** Sürüklenen/seçili taşın işlenebileceği perlerin sıraları ("okey" ise okey alınır). */
  hedefler: ReadonlyMap<number, "uzat" | "okey">;
}

interface Ozellikler {
  oyuncular: Oyuncu101[];
  okey: Deger;
  /** Seçili taşla bir pere dokunuldu. */
  dokun?: (koltuk: number, per: number) => void;
  /** Çiftler sütununun altına (ya da yanına) gelen deste yuvası. */
  deste: ReactNode;
}

/** Taş eni sınırları (px): alan doluyken bu aralıkta küçülür. */
const EN_BUYUK = 22;
const EN_KUCUK = 12;

/*
 * Yerleşim modelinin ölçüleri (px). masa101.css'teki değerlerle aynı tutulmalı; model
 * yalnızca bölüşümü seçer, son taş boyunu her zaman gerçek ölçüm (useSigdir) belirler.
 */
const OLCU = {
  /** Listenin iç boşluğu: yatay toplam ve dikey toplam */
  listeYatay: 8,
  listeDikey: 7,
  /** Satır: sol çizgi payı + sağ boşluk; satırlar arası boşluk */
  satirYatay: 8,
  satirArasi: 2,
  /** Perler arası boşluk (yatay ve alt alta) */
  perArasi: 3,
  /** Perin yatay iç boşluğu (toplam) ve taşlar arası boşluk */
  perYatay: 2,
  tasArasi: 1,
  /** Boş (dar) sütunun ve dikey deste yuvasının genişliği; sütunlar arası boşluk */
  darSutun: 96,
  desteYanEn: 50,
  desteYanAra: 6,
  /** Çiftlerin altındaki deste yuvasının kapladığı yükseklik (boşluğuyla) */
  desteAltBoy: 47,
};

const BOS_YAZI: Record<SutunTuru, [string, string, string]> = {
  seri: ["Seri açılanlar", "Seriler ve gruplar burada dizilir", "Henüz seri yok"],
  cift: ["Çiftler", "Çift açanların taşları burada", "Henüz çift yok"],
};

/** Per bu sütuna mı ait? Seri ve grup solda, çift sağda. */
const sutunda = (tur: SutunTuru, p: AcikPer) => (tur === "cift") === (p.tur === "cift");

/** Sütunun satırları: her oyuncunun bu sütundaki perlerinin taş sayıları. */
const satirOlculeri = (tur: SutunTuru, oyuncular: Oyuncu101[]) =>
  oyuncular.map((o) => o.perler.filter((p) => sutunda(tur, p)).map((p) => p.taslar.length)).filter((s) => s.length > 0);

/** Verilen genişlik ve yükseklikte bu satırlar en çok kaç piksellik taşla sığar? */
function sigacakEn(satirlar: number[][], en: number, boy: number): number {
  if (satirlar.length === 0) return EN_BUYUK;
  const icEn = en - OLCU.listeYatay - OLCU.satirYatay;
  for (let e = EN_BUYUK; e > EN_KUCUK; e--) {
    const perBoy = e * 1.61 + 2; // taş boyu (oran 1.44) + yan yüz (0.17) + üst ve alt pay
    let toplam = OLCU.listeDikey + (satirlar.length - 1) * OLCU.satirArasi;
    let sigmaz = false;
    for (const perler of satirlar) {
      let sira = 1;
      let x = 0;
      for (const n of perler) {
        const w = n * e + (n - 1) * OLCU.tasArasi + OLCU.perYatay;
        if (w > icEn) sigmaz = true;
        if (x > 0 && x + OLCU.perArasi + w > icEn) {
          sira++;
          x = w;
        } else x += (x > 0 ? OLCU.perArasi : 0) + w;
      }
      toplam += sira * perBoy + (sira - 1) * OLCU.perArasi;
    }
    if (!sigmaz && toplam <= boy) return e;
  }
  return EN_KUCUK;
}

interface Bolusum {
  /** Seri sütununun genişliği (px); null: henüz ölçülmedi, eşit bölünür */
  seri: number | null;
  cift: number | null;
  /** Deste yuvası çiftlerin yanında mı (dikey)? */
  desteYan: boolean;
}

/**
 * İki sütunun genişliğini ve deste yuvasının yerini seçer: iki sütundaki taşların birlikte
 * en büyük boyda sığdığı bölüşüm. Eşit iyilerin arasından eşite en yakını (boş sütun
 * varsa onun en darını) seçer; deste yuvası, gerekmedikçe çiftlerin altında kalır.
 */
function sutunlariBol(seri: number[][], cift: number[][], toplamEn: number, boy: number): Bolusum {
  const dar = OLCU.darSutun;
  const hedef = seri.length === 0 && cift.length > 0 ? dar : cift.length === 0 && seri.length > 0 ? toplamEn - dar : toplamEn / 2;
  const adaylar: { s: number; desteYan: boolean; puan: number }[] = [];
  for (const desteYan of [false, true]) {
    for (let s = dar; s <= toplamEn - dar; s += 2) {
      const c = toplamEn - s;
      const eS = sigacakEn(seri, s, boy);
      const eC = desteYan ? sigacakEn(cift, c - OLCU.desteYanEn - OLCU.desteYanAra, boy) : sigacakEn(cift, c, boy - OLCU.desteAltBoy);
      adaylar.push({ s, desteYan, puan: Math.min(eS, eC) });
    }
  }
  // Puan: iki sütunun ortak taş boyu. Deste yuvası çiftlerin altında kalır; yanına ancak
  // taşlar alttayken fazla küçülüyorsa (3 px ve üstü kazanç ya da 16 px'in altı) geçer.
  const enIyi = (yan: boolean) => Math.max(...adaylar.filter((a) => a.desteYan === yan).map((a) => a.puan));
  const [alt, yan] = [enIyi(false), enIyi(true)];
  const desteYan = yan >= alt + 3 || (alt < 16 && yan > alt);
  const puan = desteYan ? yan : alt;
  const iyiler = adaylar.filter((a) => a.desteYan === desteYan && a.puan === puan);
  const genislikler = new Set(iyiler.map((a) => a.s));
  // Seçilen genişlik en iyi aralığın sınırında kalmasın (model ile gerçek ölçü arasındaki
  // bir iki piksellik fark taşmaya dönmesin): sınıra en az 10 px uzak olanlardan, hedefe
  // (eşit bölüşüme ya da boş sütunun en darına) en yakını.
  const pay = (s: number) => {
    let d = 0;
    while (d < 10 && (genislikler.has(s - d - 2) || s - d - 2 < dar) && (genislikler.has(s + d + 2) || s + d + 2 > toplamEn - dar)) d += 2;
    return d;
  };
  let secilen = { s: toplamEn / 2, pay: -1, uzaklik: Infinity };
  for (const s of genislikler) {
    const p = pay(s);
    const uzaklik = Math.abs(s - hedef);
    if (p > secilen.pay || (p === secilen.pay && uzaklik < secilen.uzaklik)) secilen = { s, pay: p, uzaklik };
  }
  return { seri: secilen.s, cift: toplamEn - secilen.s, desteYan };
}

export function PerAlani({ oyuncular, okey, dokun, deste }: Ozellikler) {
  const kok = useRef<HTMLDivElement>(null);
  const seri = satirOlculeri("seri", oyuncular);
  const cift = satirOlculeri("cift", oyuncular);
  const anahtar = `${JSON.stringify(seri)}|${JSON.stringify(cift)}`;
  const [bolusum, setBolusum] = useState<Bolusum>({ seri: null, cift: null, desteYan: false });

  // Alanın ölçüsü ya da perler değişince bölüşümü yeniden seç.
  useLayoutEffect(() => {
    const el = kok.current;
    if (!el) return;
    const sec = () => {
      const stil = getComputedStyle(el);
      const ic = el.clientWidth - parseFloat(stil.paddingLeft) - parseFloat(stil.paddingRight) - parseFloat(stil.columnGap || "0");
      const liste = el.querySelector<HTMLElement>(".per-sutunu--seri .per-sutunu__liste");
      if (!liste || ic <= 0) return;
      const yeni = sutunlariBol(seri, cift, ic, liste.clientHeight);
      setBolusum((o) => (o.seri === yeni.seri && o.desteYan === yeni.desteYan ? o : yeni));
    };
    sec();
    const g = new ResizeObserver(sec);
    g.observe(el);
    return () => g.disconnect();
  }, [anahtar]);

  useSigdir(kok, `${anahtar}|${bolusum.seri}|${bolusum.desteYan}`);

  const stil = bolusum.seri === null ? undefined : ({ gridTemplateColumns: `minmax(0, ${bolusum.seri}fr) minmax(0, ${bolusum.cift}fr)` } as CSSProperties);
  return (
    <div ref={kok} className={`masa__merkez masa101__alan ${bolusum.desteYan ? "masa101__alan--deste-yan" : ""}`} style={stil}>
      <PerSutunu tur="seri" oyuncular={oyuncular} okey={okey} dokun={dokun} dar={bolusum.seri !== null && bolusum.seri <= OLCU.darSutun + 2} />
      <PerSutunu tur="cift" oyuncular={oyuncular} okey={okey} dokun={dokun} dar={bolusum.cift !== null && bolusum.cift <= OLCU.darSutun + 2} alt={deste} />
    </div>
  );
}

function PerSutunu({ tur, oyuncular, okey, dokun, alt, dar }: { tur: SutunTuru; oyuncular: Oyuncu101[]; okey: Deger; dokun?: (koltuk: number, per: number) => void; alt?: ReactNode; dar: boolean }) {
  const satirlar = oyuncular.filter((o) => o.perler.some((p) => sutunda(tur, p)));
  const [baslik, aciklama, kisa] = BOS_YAZI[tur];

  return (
    <section className={`per-sutunu per-sutunu--${tur} ${satirlar.length === 0 ? "per-sutunu--bos" : ""} ${dar ? "per-sutunu--dar" : ""}`} aria-label={baslik}>
      <div className="per-sutunu__cerceve">
        <span className="per-sutunu__baslik">{tur === "seri" ? "Seriler" : "Çiftler"}</span>
        <div className="per-sutunu__liste">
          {satirlar.length === 0 ? (
            <div className="per-sutunu__bos">
              <b>{baslik}</b>
              <small>{aciklama}</small>
              <small className="per-sutunu__kisa">{kisa}</small>
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
  const { koltuk, ad, ton, perler, hedefler } = oyuncu;
  return (
    <div className="per-satiri" style={{ "--ton": ton } as CSSProperties} data-per-alani={koltuk} aria-label={`${ad} perleri`}>
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
 * Perler sığmıyorsa taşları küçültür: en büyük boydan başlayıp iki sütunda da taşma
 * kalmayana kadar birer piksel indirir (--per-tas-en alanın kökünde; iki sütun aynı
 * boyda kalır). En küçük boyda da sığmazsa sütun kayar ve devamı olan ucu solar (data-kayar).
 * Perler, bölüşüm ya da alanın ölçüsü değişince (sütun geçişi sırasında da) yeniden hesaplanır.
 */
function useSigdir(kok: RefObject<HTMLElement>, anahtar: string) {
  useLayoutEffect(() => {
    const el = kok.current;
    if (!el) return;
    const listeler = [...el.querySelectorAll<HTMLElement>(".per-sutunu__liste")];
    const tasiyor = () => listeler.some((l) => l.scrollHeight > l.clientHeight + 1 || l.scrollWidth > l.clientWidth + 1);
    // Kayan listede hangi uçta devamı var: maske o ucu soldurur.
    const kenarlariIsaretle = (l: HTMLElement) => {
      const ust = l.scrollTop > 1;
      const alt = l.scrollTop + l.clientHeight < l.scrollHeight - 1;
      const kayar = ust && alt ? "iki" : ust ? "ust" : alt ? "alt" : null;
      if (kayar) l.dataset.kayar = kayar;
      else delete l.dataset.kayar;
    };
    const sigdir = () => {
      let en = EN_BUYUK;
      el.style.setProperty("--per-tas-en", `${en}px`);
      while (en > EN_KUCUK && tasiyor()) {
        en--;
        el.style.setProperty("--per-tas-en", `${en}px`);
      }
      listeler.forEach(kenarlariIsaretle);
    };
    sigdir();
    const g = new ResizeObserver(sigdir);
    listeler.forEach((l) => g.observe(l));
    const kaydi = (e: Event) => kenarlariIsaretle(e.currentTarget as HTMLElement);
    listeler.forEach((l) => l.addEventListener("scroll", kaydi, { passive: true }));
    return () => {
      g.disconnect();
      listeler.forEach((l) => l.removeEventListener("scroll", kaydi));
    };
  }, [anahtar]);
}
