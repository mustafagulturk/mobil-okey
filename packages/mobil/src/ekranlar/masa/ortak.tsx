// Masa ekranlarının ortak parçaları.
//
// Okey (MasaEkrani) ve 101 (masa101/Masa101Ekrani) aynı masada oynanır: aynı istaka ve
// sürükle-bırak, aynı köşe yığınları, deste ve gösterge, hamle süresi, sesler, uçuşlar,
// konuşma balonları, sohbet ve çıkış penceresi. Bunlar burada kancalar (use...) ve küçük
// bileşenler olarak durur. Oyuna özgü olanlar (Okey'de bitirme, 101'de açma/işleme ve puan
// tablosu, iki ayrı sonuç penceresi) ekranların kendisinde kalır.
import { type Deger, type Etiket, type IstemciMesaji, type OdaGorunumu, type SohbetMesaji, TAS_SAYISI, yuzDegeri } from "@okey/kurallar";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IsimEtiketi } from "../../bilesenler/IsimEtiketi.tsx";
import { Pencere } from "../../bilesenler/Pencere.tsx";
import { Simge } from "../../bilesenler/Simge.tsx";
import { KapaliTas, Tas } from "../../bilesenler/Tas.tsx";
import { useOyun } from "../../durum/OyunSaglayici.tsx";
import { titret } from "../../platform/cihaz.ts";
import { useGeriTusu } from "../../platform/geriTusu.ts";
import { sesCek, sesKazandin, sesSira, sesTas } from "../../platform/ses.ts";
import { tamEkranAc } from "../../platform/tamEkran.ts";
import type { Ayarlar } from "../../platform/depo.ts";
import { RENK_ADLARI } from "../../yardimci/bicim.ts";
import { bosIstaka, eliYerlestir, istakaEsitle, tasiTasi, type Yuvalar } from "../../yardimci/istaka.ts";
import { useSimdi } from "../../yardimci/kancalar.ts";
import { koltukAdi } from "../../yardimci/oda.ts";
import { Madalyon } from "./Madalyon.tsx";
import { type OlayMasasi, olaylariCikar } from "./masaOlaylari.ts";
import { SohbetPaneli } from "./SohbetPaneli.tsx";
import { hayaletiKoy, suruklemeyiIzle, type SuruklemeDurumu, yuvaVurgula, yuvaVurgusunuKaldir } from "./surukleme.ts";
import { eldenMasayaUcur, ucusHazirla } from "./ucuslar.tsx";

/** Son kaç saniye "acil" sayılır (halka nabız atar, plaka titrer). */
const ACIL_SN = 5;

// ---------------------------------------------------------------------------
// İstaka düzeni: yuva düzeni sadece bu telefonda tutulur (sunucu sadece hangi taşların
// elde olduğunu bilir). Desteden/yandan sürüklenip bir yuvaya bırakılan çekişte gelen
// taş o yuvaya konur.
// ---------------------------------------------------------------------------

interface CekisHedefi {
  /** Taşın konacağı yuva. */
  yuva: number;
  /** Çekmeden önceki el: yeni gelen taş bundan ayırt edilir. */
  oncekiEl: number[];
  /** Hayaletin bırakıldığı yer (taş oradan yuvasına kayar). */
  kutu: DOMRect | null;
  /** Çekiş anındaki son hata bildirimi: daha yenisi gelirse çekiş reddedilmiştir. */
  hataId: number;
  elNo: number;
}

export function useIstakaDuzeni(elNo: number, el: number[], bitti: boolean, sonHataId: number) {
  const [istaka, setIstaka] = useState<{ elNo: number; yuvalar: Yuvalar }>({ elNo: -1, yuvalar: bosIstaka() });
  const [cekisHedefi, setCekisHedefi] = useState<CekisHedefi | null>(null);
  const cekilenTas = cekisHedefi && istaka.elNo === elNo ? (el.find((t) => !cekisHedefi.oncekiEl.includes(t)) ?? null) : null;
  const yuvalar = useMemo(() => {
    if (istaka.elNo !== elNo) return eliYerlestir(el);
    const y = istakaEsitle(istaka.yuvalar, el);
    if (cekisHedefi && cekilenTas !== null) {
      const i = y.indexOf(cekilenTas);
      if (i !== -1 && i !== cekisHedefi.yuva) return tasiTasi(y, i, cekisHedefi.yuva);
    }
    return y;
  }, [istaka, elNo, el, cekisHedefi, cekilenTas]);
  useEffect(() => {
    if (istaka.elNo !== elNo) setIstaka({ elNo, yuvalar: eliYerlestir(el) });
  }, [elNo, istaka.elNo, el]);
  const yuvalariDegistir = useCallback((y: Yuvalar) => setIstaka({ elNo, yuvalar: y }), [elNo]);

  // Sürükleyerek çekilen taş geldi: yerleşimi kalıcı yap. Çekiş reddedildiyse ya da el
  // değiştiyse bekleyen hedefi unut.
  useEffect(() => {
    if (!cekisHedefi) return;
    if (cekilenTas !== null) {
      setIstaka({ elNo, yuvalar });
      setCekisHedefi(null);
    } else if (sonHataId > cekisHedefi.hataId || elNo !== cekisHedefi.elNo || bitti) {
      setCekisHedefi(null);
    }
  }, [cekisHedefi, cekilenTas, sonHataId, elNo, bitti]);

  // Pointer olaylarından çağrılır: en güncel eli ve hata numarasını ref'ten okur.
  const son = useRef({ el, sonHataId, elNo });
  son.current = { el, sonHataId, elNo };
  /** Çek hamlesinden hemen önce: gelecek taşın konacağı yuvayı hatırla. */
  const cekisiBekle = useCallback((yuva: number, kutu: DOMRect | null) => {
    const s = son.current;
    setCekisHedefi({ yuva, oncekiEl: s.el, kutu, hataId: s.sonHataId, elNo: s.elNo });
  }, []);

  return { yuvalar, yuvalariDegistir, cekisVar: cekisHedefi !== null, cekKutu: cekisHedefi?.kutu ?? null, cekisiBekle };
}

/** Son hata bildiriminin numarası: bir hamleden sonra artarsa hamle reddedilmiştir. */
export function useSonHataId(): number {
  const { durum } = useOyun();
  return useMemo(() => durum.bildirimler.reduce((n, b) => (b.tur === "hata" ? Math.max(n, b.id) : n), 0), [durum.bildirimler]);
}

// ---------------------------------------------------------------------------
// Hamle süresi, ses ve titreşim
// ---------------------------------------------------------------------------

/**
 * Geri sayım telefonun kendi saatiyle: oda mesajı geldiğinde "şimdi + turKalanMs" olarak
 * hesaplanan bitiş anı (durum.turYerelBitis) ve sunucunun verdiği toplam süre.
 */
export function useTurSayaci(yerelBitis: number | null, turSuresiMs: number, bitti: boolean) {
  const simdi = useSimdi(200, !bitti);
  const kalanMs = yerelBitis === null ? null : Math.max(0, yerelBitis - simdi);
  const kalanOran = kalanMs === null ? null : Math.min(1, kalanMs / Math.max(1, turSuresiMs));
  const kalanSn = kalanMs === null ? null : Math.ceil(kalanMs / 1000);
  const acil = kalanSn !== null && kalanSn <= ACIL_SN && !bitti;
  return { kalanOran, kalanSn, acil };
}

export function useMasaSesleri(ayarlar: Ayarlar, o: { benimSiram: boolean; acil: boolean; atilanToplam: number; kazandim: boolean }) {
  const { benimSiram, acil, atilanToplam, kazandim } = o;
  useEffect(() => {
    if (!benimSiram) return;
    if (ayarlar.titresim) void titret();
    if (ayarlar.ses) sesSira();
  }, [benimSiram]);
  // Benim sıramda son saniyelere girince bir kez daha titret.
  useEffect(() => {
    if (benimSiram && acil && ayarlar.titresim) void titret();
  }, [benimSiram && acil]);
  useEffect(() => {
    if (atilanToplam > 0 && ayarlar.ses) sesTas();
  }, [atilanToplam]);
  useEffect(() => {
    if (kazandim && ayarlar.ses) sesKazandin();
  }, [kazandim]);
}

/**
 * El başı: gösterge çevrilir, taşlar istakaya sırayla düşer. ilkAn: masa ekranı elin tam
 * başında mı açıldı (hiç taş atılmamış, dağıtılan bütün taşlar elde)?
 */
export function useElBasi(elNo: number, ilkAn: boolean): boolean {
  const [elBasi, setElBasi] = useState(ilkAn);
  const ilkElNo = useRef(elNo);
  useEffect(() => {
    if (elNo === ilkElNo.current) {
      if (!elBasi) return;
    } else {
      ilkElNo.current = elNo;
      setElBasi(true);
    }
    const z = setTimeout(() => setElBasi(false), 2600);
    return () => clearTimeout(z);
  }, [elNo]);
  return elBasi;
}

// ---------------------------------------------------------------------------
// Uçuşlar: önceki görünümle farktan hamleleri çıkar (masaOlaylari.ts) ve her birini
// uçur (ucuslar.tsx). sonAtis: benim attığım taşın bırakıldığı yer; eldenGiden: 101'de
// açılan/işlenen taşların istakadaki yerleri. İkisi de hamle gönderilirken doldurulur.
// ---------------------------------------------------------------------------

export function useUcuslar(
  kok: RefObject<HTMLElement>,
  elNo: number,
  masa: OlayMasasi & { okey: Deger },
  cekKutu: DOMRect | null,
  kapali: boolean,
  ses: boolean,
) {
  const sonAtis = useRef<{ tas: number; kutu: DOMRect } | null>(null);
  const eldenGiden = useRef<Map<number, DOMRect> | null>(null);
  const onceki = useRef({ elNo, masa });
  useLayoutEffect(() => {
    const o = onceki.current;
    onceki.current = { elNo, masa };
    if (o.masa === masa || o.elNo !== elNo || !kok.current || kapali) return;
    const ben = masa.koltuk;
    const olaylar = olaylariCikar(o.masa, masa);
    olaylar.forEach((olay, i) => ucusHazirla(kok.current!, olay, ben, masa.okey, sonAtis.current, cekKutu, i * 60));
    if (olaylar.some((ol) => ol.tur === "cek" && ol.koltuk === ben) && ses) sesCek();
    sonAtis.current = null;
    if (eldenGiden.current && masa.el.length < o.masa.el.length) {
      eldenMasayaUcur(kok.current, eldenGiden.current);
      eldenGiden.current = null;
    }
  }, [masa]);
  return { sonAtis, eldenGiden };
}

/** İstakadaki taşların şimdiki kutuları (hamle gönderilmeden önce, uçuş başlangıcı için). */
export function istakaKutulari(kok: HTMLElement | null, taslar: number[]): Map<number, DOMRect> {
  const m = new Map<number, DOMRect>();
  for (const t of taslar) {
    const el = kok?.querySelector<HTMLElement>(`.istaka [data-tas="${t}"]`);
    if (el) m.set(t, el.getBoundingClientRect());
  }
  return m;
}

// ---------------------------------------------------------------------------
// Desteden / yandan sürükleyerek çekme. Dokunuş eskisi gibi çeker (taş ilk boş yuvaya
// gelir). Sürükleyip bir yuvaya bırakınca birakildi(kaynak, yuva, kutu) çağrılır; ekran
// çekişi yapar (101'de önce ceza uyarısı gösterebilir). İstaka dışında bırakılırsa hiçbir
// şey olmaz.
// ---------------------------------------------------------------------------

export function useCekmeSurukle(o: {
  kok: RefObject<HTMLElement>;
  cekebilir: boolean;
  /** Bir çekiş zaten bekleniyor (yeni sürükleme başlamaz). */
  mesgul: boolean;
  yanTas: number | null;
  birakildi: (kaynak: "orta" | "yan", yuva: number, kutu: DOMRect | null) => void;
  suruklemeDurumu: (d: SuruklemeDurumu) => void;
}) {
  const [disSurukle, setDisSurukle] = useState<{ kaynak: "orta" | "yan"; tas: number | null } | null>(null);
  const disHayalet = useRef<HTMLDivElement>(null);
  const disKonum = useRef({ x: 0, y: 0, ofsetX: 0, ofsetY: 0 });
  const ref = useRef(o);
  ref.current = o;
  useLayoutEffect(() => {
    const k = disKonum.current;
    if (disSurukle) hayaletiKoy(disHayalet.current, k.x, k.y, k.ofsetX, k.ofsetY);
  }, [disSurukle]);

  const cekmeSurukle = (e: ReactPointerEvent<HTMLElement>, kaynak: "orta" | "yan") => {
    if (!o.cekebilir || o.mesgul || (kaynak === "yan" && o.yanTas === null)) return;
    const ornek = o.kok.current?.querySelector<HTMLElement>(".istaka .tas");
    const en = ornek?.offsetWidth || 40;
    const boy = ornek?.offsetHeight || 56;
    // Taş parmağın biraz üstünde durur ki parmak altında kalmasın.
    const ofsetX = en / 2;
    const ofsetY = boy * 0.75;
    suruklemeyiIzle(e, {
      basla: () => {
        if (!ref.current.cekebilir) return false;
        disKonum.current = { x: e.clientX, y: e.clientY, ofsetX, ofsetY };
        setDisSurukle({ kaynak, tas: kaynak === "yan" ? ref.current.yanTas : null });
        ref.current.suruklemeDurumu("var");
      },
      hareket: (x, y, alt) => {
        disKonum.current = { x, y, ofsetX, ofsetY };
        hayaletiKoy(disHayalet.current, x, y, ofsetX, ofsetY);
        yuvaVurgula(alt);
      },
      bitir: (x, y, alt, iptal) => {
        hayaletiKoy(disHayalet.current, x, y, ofsetX, ofsetY);
        const kutu = disHayalet.current?.firstElementChild?.getBoundingClientRect() ?? null;
        const yuva = iptal ? null : yuvaVurgula(alt);
        yuvaVurgusunuKaldir();
        setDisSurukle(null);
        ref.current.suruklemeDurumu("yok");
        if (yuva === null || !ref.current.cekebilir) return;
        ref.current.birakildi(kaynak, yuva, kutu);
      },
    });
  };
  return { disSurukle, disHayalet, cekmeSurukle };
}

/** Desteden/yandan sürüklenen taşın parmak altındaki hayaleti. */
export function DisHayalet({ surukle, hayalet, okey }: { surukle: { tas: number | null } | null; hayalet: RefObject<HTMLDivElement>; okey: Deger }) {
  if (!surukle) return null;
  return (
    <div className="hayalet" ref={hayalet}>
      {surukle.tas !== null ? <Tas id={surukle.tas} okey={okey} suruklenen /> : <KapaliTas boyut="buyuk" />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Konuşma balonları: sohbete yazan oyuncunun yanında birkaç saniye görünür.
// ---------------------------------------------------------------------------

export function useBalonlar(sohbet: SohbetMesaji[]): Record<number, string> {
  const [balonlar, setBalonlar] = useState<Record<number, string>>({});
  const sonSohbet = sohbet.at(-1);
  const ilkSohbet = useRef(sonSohbet);
  const saatler = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    if (!sonSohbet || sonSohbet === ilkSohbet.current || sonSohbet.koltuk < 0) return;
    const { koltuk, metin } = sonSohbet;
    setBalonlar((b) => ({ ...b, [koltuk]: metin }));
    saatler.current.push(
      setTimeout(
        () =>
          setBalonlar((b) => {
            if (b[koltuk] !== metin) return b;
            const c = { ...b };
            delete c[koltuk];
            return c;
          }),
        3800,
      ),
    );
  }, [sonSohbet]);
  useEffect(() => () => saatler.current.forEach(clearTimeout), []);
  return balonlar;
}

// ---------------------------------------------------------------------------
// Pencereler: sohbet paneli ve "Masadan kalkmak istiyor musun?". Android geri tuşu önce
// çıkış onayını açar (açık pencereler kendileri kapanır). Masadayken sistem çubukları gizlenir.
// ---------------------------------------------------------------------------

export function useMasaPencereleri(cikisMetni: string) {
  const { durum, gonder, sohbetOkundu } = useOyun();
  const [sohbetAcik, setSohbetAcik] = useState(false);
  const [cikisOnay, setCikisOnay] = useState(false);
  const ayril = () => gonder({ t: "odadanAyril" });
  useGeriTusu(() => setCikisOnay(true));
  useEffect(() => tamEkranAc(), []);

  const sohbetiAc = () => {
    setSohbetAcik(true);
    sohbetOkundu();
  };
  const pencereler = (
    <>
      {sohbetAcik && (
        <SohbetPaneli
          mesajlar={durum.sohbet}
          benimKoltugum={durum.oda?.benimKoltugum ?? null}
          gonder={(metin) => gonder({ t: "sohbet", metin })}
          kapat={() => {
            setSohbetAcik(false);
            sohbetOkundu();
          }}
        />
      )}
      {cikisOnay && (
        <Pencere baslik="Masadan kalkmak istiyor musun?" kapat={() => setCikisOnay(false)}>
          <p>{cikisMetni}</p>
          <div className="satir satir--sag">
            <button className="dugme dugme--ikincil" onClick={() => setCikisOnay(false)}>
              Oyuna dön
            </button>
            <button className="dugme dugme--tehlike" onClick={ayril}>
              Kalk
            </button>
          </div>
        </Pencere>
      )}
    </>
  );
  return { ayril, cikisOnayAc: () => setCikisOnay(true), sohbetiAc, pencereler };
}

/** Sağ üst köşe: çip (online) ve okunmamış sayılı sohbet düğmesi. */
export function SohbetDugmesi({ ac }: { ac: () => void }) {
  const { durum } = useOyun();
  return (
    <button className="masa-simge" onClick={ac} aria-label="Sohbet">
      <Simge ad="sohbet" />
      {durum.okunmamisSohbet > 0 && <i className="rozet-sayi">{durum.okunmamisSohbet}</i>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Masadaki küçük bileşenler
// ---------------------------------------------------------------------------

/** Okey ikonu için bu değerdeki herhangi bir taşın kimliği. */
export function okeyOrnegi(okey: Deger): number | null {
  for (let id = 0; id < TAS_SAYISI; id++) {
    const d = yuzDegeri(id);
    if (d && d.renk === okey.renk && d.sayi === okey.sayi) return id;
  }
  return null;
}

export const okeyMetni = (okey: Deger) => `${RENK_ADLARI[okey.renk]} ${okey.sayi}`;

/**
 * Orta deste ve gösterge (yanında küçük okey ikonu). sinif/birak: Okey'de deste alanı
 * aynı zamanda bitirme alanıdır (son taş göstergenin üstüne bırakılır).
 */
export function DesteVeGosterge(o: {
  ortaSayisi: number;
  gosterge: number;
  okey: Deger;
  elNo: number;
  elBasi: boolean;
  cekebilir: boolean;
  cek: () => void;
  cekmeSurukle: (e: ReactPointerEvent<HTMLElement>) => void;
  sinif?: string;
  birak?: "bitir";
  /** Destenin ve göstergenin yanına yazılan küçük künyeler (101'deki deste yuvası). */
  yazilar?: { deste: ReactNode; gosterge: ReactNode };
}) {
  const ornek = useMemo(() => okeyOrnegi(o.okey), [o.okey.renk, o.okey.sayi]);
  const metin = okeyMetni(o.okey);
  return (
    <div className={`deste-alani ${o.sinif ?? ""}`} data-birak={o.birak}>
      <button
        className={`deste ${o.cekebilir ? "deste--cekilebilir" : ""}`}
        onClick={o.cek}
        onPointerDown={o.cekmeSurukle}
        disabled={!o.cekebilir}
        aria-label="Ortadan çek"
        data-deste
      >
        <KapaliTas />
        <KapaliTas />
        <KapaliTas />
        <span className="deste__sayi">{o.ortaSayisi}</span>
      </button>
      {o.yazilar && <span className="deste-alani__yazi deste-alani__yazi--deste">{o.yazilar.deste}</span>}
      <div className="gosterge" aria-label={`Gösterge; okey ${metin}`}>
        <div key={o.elNo} className={`gosterge__kart ${o.elBasi ? "gosterge__kart--cevir" : ""}`}>
          <div className="gosterge__yuz">
            <Tas id={o.gosterge} boyut="orta" />
          </div>
          <div className="gosterge__arka">
            <KapaliTas />
          </div>
        </div>
        {ornek !== null && (
          <div className="okey-ikon" title={`Okey: ${metin}`}>
            <Tas id={ornek} okey={o.okey} boyut="kucuk" />
          </div>
        )}
      </div>
      {o.yazilar && <span className="deste-alani__yazi deste-alani__yazi--gosterge">{o.yazilar.gosterge}</span>}
    </div>
  );
}

/** "Gösterge göster" düğmesi ve gösterenin notu. */
export function GostergeNotu({ oda, gosterebilir, gosteren, gonder }: { oda: OdaGorunumu; gosterebilir: boolean; gosteren: number | null; gonder: (m: IstemciMesaji) => void }) {
  return (
    <>
      {gosterebilir && (
        <button className="metal-dugme metal-dugme--zumrut metal-dugme--kucuk gosterge-dugmesi" onClick={() => gonder({ t: "hamle", eylem: { tur: "gostergeGoster" } })}>
          Gösterge göster
        </button>
      )}
      {gosteren !== null && <span className="gosterge-not">{koltukAdi(oda, gosteren)} göstergeyi gösterdi</span>}
    </>
  );
}

/** İstakanın üstündeki "Sıra sende" şeridi ya da kimin oynadığı. */
export function SiraIpucu({ benimSiram, acil, asama, ipucu, kalanSn }: { benimSiram: boolean; acil: boolean; asama: string; ipucu: string; kalanSn: number | null }) {
  return (
    <div className="masa__ipucu">
      {benimSiram ? (
        <div key={asama} className={`sira-seridi ${acil ? "sira-seridi--acil" : ""}`}>
          <b>Sıra sende</b>
          <span>{ipucu}</span>
          {kalanSn !== null && <i>{kalanSn}</i>}
        </div>
      ) : (
        <span className="masa__ipucu-metin">{ipucu}</span>
      )}
    </div>
  );
}

/**
 * İstakanın sol üstündeki kendi isim etiketim (madalyon, sıra halkası, konuşma balonu).
 * kompakt: 101'de ortada perlere yer kalsın diye süslü isim etiketi yerine sade ad.
 */
export function BenimEtiketim(o: {
  kart: { ad: string; seviye?: number; etiket: Etiket };
  sirada: boolean;
  acil: boolean;
  kalanOran: number | null;
  balon?: string;
  kompakt?: boolean;
  /** 101: açma rozeti. */
  ek?: ReactNode;
}) {
  return (
    <div
      className={`benim-etiketim ${o.kompakt ? "benim-etiketim--kompakt" : ""} ${o.sirada ? "benim-etiketim--sirada" : ""} ${o.sirada && o.acil ? "benim-etiketim--acil" : ""}`}
    >
      <Madalyon ad={o.kart.ad} oran={o.sirada ? (o.kalanOran ?? 1) : null} acil={o.sirada && o.acil} boyut="kucuk" />
      {o.kompakt ? (
        <span className="benim-etiketim__ad">{o.kart.ad}</span>
      ) : (
        <IsimEtiketi ad={o.kart.ad} seviye={o.kart.seviye} etiket={o.kart.etiket} boyut="kucuk" />
      )}
      {o.ek}
      {o.balon && (
        <div key={o.balon} className="konusma-balonu konusma-balonu--ben">
          {o.balon}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Yığın: bir oyuncunun attığı taşlar. Masanın köşelerinde, atan ile sıradaki oyuncu
// arasında durur. Sadece son taş tam görünür; altındaki en fazla iki taş kaymış kenar
// olarak seçilir. Zemindeki halka atanın madalyon renginde, küçük ok atana bakar.
// ---------------------------------------------------------------------------

type Yon = "ust" | "sag" | "alt" | "sol";

export function Yigin({ taslar, okey, koltuk, ton, yon }: { taslar: number[]; okey: Deger; koltuk: number; ton: number; yon: Yon }) {
  const son = taslar.slice(-3);
  return (
    <div className={`yigin yigin--${yon}`} data-yigin={koltuk} style={{ "--ton": ton } as CSSProperties}>
      <i className="yigin__ok" aria-hidden />
      <div className="yigin__yuva">
        {son.map((t, i) => (
          <div key={t} className="yigin__tas" style={{ "--d": son.length - 1 - i } as CSSProperties}>
            <Tas id={t} okey={okey} boyut="orta" />
          </div>
        ))}
      </div>
      {taslar.length > 1 && <span className="yigin__sayi">{taslar.length}</span>}
    </div>
  );
}
