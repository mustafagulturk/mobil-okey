// 101 masası (yatay). Okey masasıyla aynı aileden: aynı ceviz çerçeve ve çuha, aynı istaka
// ve sürükle-bırak, aynı köşe yığınları, deste, gösterge, uçuşlar ve sohbet (masa/ortak.tsx).
// 101'e özgü olanlar:
//
//  - Ortada açılmış perler alanı: her oyuncunun perleri kendi tarafında (PerAlani). Rakip
//    plakalarında açma rozeti ("Seri 112", "Çift 5").
//  - Sağ alttaki "Aç" düğmesi: açmamışken elden en iyi açılışı bulur ("Aç · 112" ya da
//    "Çift aç · 5"); açtıktan sonra aynı türden yeni perleri açar ("Per aç").
//  - İşleme: istakadaki taş masadaki bir perin üstüne sürüklenip bırakılır (ya da taş
//    seçilip pere dokunulur). Sürüklerken taşın işlenebileceği perler vurgulanır; okey
//    alınabiliyorsa okey alma tercih edilir.
//  - Ceza uyarıları: yandan alınan taş kullanılamayacaksa, atılan taş işlek/okeyse ya da
//    yandan alınan taş kullanılmadıysa hamleden önce onay sorulur (101 ceza).
//  - Puan tablosu (sol üstteki "El 2/4"e dokununca) ve 101 el/maç sonu penceresi.
//
// Yerleşim Okey'deki gibidir: ben alttayım, sıra sağa döner, yan taşım sol alttaki yığın.
import { type IstemciMesaji, type MasaGorunumu101, RENKLER, VARSAYILAN_ETIKET } from "@okey/kurallar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cip } from "../../bilesenler/Ortak.tsx";
import { Pencere } from "../../bilesenler/Pencere.tsx";
import { Simge } from "../../bilesenler/Simge.tsx";
import { useOyun } from "../../durum/OyunSaglayici.tsx";
import { Parcaciklar } from "../../efektler/Parcaciklar.tsx";
import { dizilisiYerlestir, type Yuvalar } from "../../yardimci/istaka.ts";
import { koltukAdi } from "../../yardimci/oda.ts";
import { type BirakmaHedefi, Istaka, type SuruklemeDurumu } from "../masa/Istaka.tsx";
import { tonu } from "../masa/Madalyon.tsx";
import {
  BenimEtiketim,
  DesteVeGosterge,
  DisHayalet,
  GostergeNotu,
  istakaKutulari,
  SiraIpucu,
  SohbetDugmesi,
  useBalonlar,
  useCekmeSurukle,
  useElBasi,
  useIstakaDuzeni,
  useMasaPencereleri,
  useMasaSesleri,
  useSonHataId,
  useTurSayaci,
  useUcuslar,
  Yigin,
} from "../masa/ortak.tsx";
import { OyuncuYeri } from "../masa/OyuncuYeri.tsx";
import { suruklemeYeniBitti } from "../masa/surukleme.ts";
import { type AlanKonumu, PerAlani } from "./PerAlani.tsx";
import { PuanTablosu } from "./PuanTablosu.tsx";
import { SonucPenceresi101 } from "./SonucPenceresi101.tsx";
import { acmaDugmesi, acmaRozeti, atisUyarisi, diz101, islemeHedefleri, yanUyarisi } from "./yardimci101.ts";

/** Dağıtılan taş: başlayan 22, diğerleri 21. */
const DAGITILAN = 22 + 3 * 21;
/** Taş sürüklenmiyorken hiçbir per hedef değildir (PerAlani memo'su bozulmasın diye sabit). */
const HEDEF_YOK: ReadonlyMap<number, "uzat" | "okey"> = new Map();

/** Ceza getirecek bir hamleden önce sorulan onay. */
interface Onay {
  baslik: string;
  metin: string;
  dugme: string;
  devam: () => void;
}

export function Masa101Ekrani() {
  const { durum, gonder, bildir } = useOyun();
  const oda = durum.oda!;
  // Uygulama bu ekranı sadece oda.oyun === "101" iken açar.
  const masa = oda.masa as MasaGorunumu101;
  const mac = oda.mac;
  const ben = masa.koltuk;
  const goreli = (r: number) => (ben + r) % 4; // 1: sağ, 2: üst, 3: sol
  const kok = useRef<HTMLDivElement>(null);

  // ---------- Sıra, süre, istaka ----------
  const bitti = masa.sonuc !== null;
  const benimSiram = !bitti && masa.sira === ben;
  const cekebilir = benimSiram && masa.asama === "cek";
  const atabilir = benimSiram && masa.asama === "at";
  const sonHataId = useSonHataId();
  const { yuvalar, yuvalariDegistir, cekisVar, cekKutu, cekisiBekle } = useIstakaDuzeni(oda.elNo, masa.el, bitti, sonHataId);
  const [secili, setSecili] = useState<number | null>(null);
  if (secili !== null && !masa.el.includes(secili)) setSecili(null);

  const { kalanOran, kalanSn, acil } = useTurSayaci(durum.turYerelBitis, oda.turSuresiMs, bitti);
  const atilanToplam = masa.atilanlar.reduce((n, a) => n + a.length, 0);
  const kutlanir = (masa.sonuc?.tur === "bitti" && masa.sonuc.koltuk === ben) || !!(oda.sonEl?.macBitti && mac?.kazananlar?.includes(ben));
  useMasaSesleri(durum.ayarlar, { benimSiram, acil, atilanToplam, kazandim: kutlanir });

  const tasToplam = masa.tasSayilari.reduce((n, t) => n + t, 0);
  const elBasi = useElBasi(oda.elNo, atilanToplam === 0 && tasToplam === DAGITILAN);
  const { sonAtis, eldenGiden } = useUcuslar(kok, oda.elNo, masa, cekKutu, false, durum.ayarlar.ses);

  // ---------- 101 kararları (kurallar paketiyle hesaplanır; el değişmedikçe yeniden değil) ----------
  const acma = useMemo(() => acmaDugmesi(masa, atabilir), [masa.el, masa.okey, masa.acma, masa.yandanAlinan, atabilir]);
  const yanTaslar = masa.atilanlar[goreli(3)];
  const yanTas = yanTaslar.at(-1) ?? null;
  const yanRiski = useMemo(() => (cekebilir ? yanUyarisi(masa, yanTas) : null), [cekebilir, yanTas, masa.el, masa.perler, masa.acma]);

  const [onay, setOnay] = useState<Onay | null>(null);
  const [surukleme, setSurukleme] = useState<SuruklemeDurumu>("yok");
  const [suruklenen, setSuruklenen] = useState<number | null>(null);
  const suruklemeDurumu = useCallback((d: SuruklemeDurumu, tas: number | null) => {
    setSurukleme(d);
    setSuruklenen(tas);
  }, []);

  // İşleme hedefleri: sürüklenen taş (yoksa seçili taş) hangi perlere işlenebilir?
  const islenen = suruklenen ?? secili;
  const hedefler = useMemo(() => (islenen === null ? [] : islemeHedefleri(masa, islenen)), [islenen, masa]);
  const koltukHedefleri = useMemo(
    () =>
      [0, 1, 2, 3].map((k) => {
        const h = hedefler.filter((x) => x.koltuk === k);
        return h.length ? new Map(h.map((x) => [x.per, x.okeyAl ? ("okey" as const) : ("uzat" as const)])) : HEDEF_YOK;
      }),
    [hedefler],
  );

  // ---------- Hamleler ----------
  const hamle = (m: Extract<IstemciMesaji, { t: "hamle" }>) => gonder(m);
  /** Çek; yuva verilirse (sürükleyerek çekiş) gelen taş o yuvaya konur. Yandan alırken risk varsa önce sorar. */
  const cek = (kaynak: "orta" | "yan", yuva?: { yuva: number; kutu: DOMRect | null }) => {
    if (!cekebilir) return;
    const yap = () => {
      if (yuva) cekisiBekle(yuva.yuva, yuva.kutu);
      hamle({ t: "hamle", eylem: { tur: "cek", kaynak } });
    };
    if (kaynak === "yan" && yanRiski) {
      setOnay({
        baslik: "Yandaki taş alınsın mı?",
        metin: `${yanRiski} Yandan aldığın taşı bu tur kullanmazsan 101 ceza yazılır.`,
        dugme: "Yine de al",
        devam: yap,
      });
      return;
    }
    yap();
  };
  const at = (tas: number, kutu?: DOMRect | null) => {
    if (!atabilir) return;
    const yap = () => {
      const el = kok.current?.querySelector<HTMLElement>(`.istaka [data-tas="${tas}"]`);
      const k = kutu ?? el?.getBoundingClientRect();
      sonAtis.current = k ? { tas, kutu: k } : null;
      hamle({ t: "hamle", eylem: { tur: "at", tas } });
      setSecili(null);
    };
    const uyari = atisUyarisi(masa, tas);
    if (uyari) {
      setOnay({ baslik: "Bu taş atılsın mı?", metin: `${uyari} Atarsan 101 ceza yazılır.`, dugme: "Yine de at", devam: yap });
      return;
    }
    yap();
  };
  /** Taşı masadaki bir pere işle (okey alma mümkünse onu yap). */
  const isle = (tas: number, koltuk: number, per: number, kutu?: DOMRect | null) => {
    const h = islemeHedefleri(masa, tas).find((x) => x.koltuk === koltuk && x.per === per);
    if (!h) return;
    const k = kutu ?? kok.current?.querySelector(`.istaka [data-tas="${tas}"]`)?.getBoundingClientRect();
    eldenGiden.current = k ? new Map([[tas, k]]) : null;
    hamle({ t: "hamle", eylem: { tur: "isle", tas, koltuk, per, okeyAl: h.okeyAl || undefined } });
    setSecili(null);
  };
  const ac = () => {
    if (acma.durum !== "hazir") return;
    eldenGiden.current = istakaKutulari(kok.current, acma.perler.flat());
    hamle({ t: "hamle", eylem: { tur: "ac", perler: acma.perler } });
    setSecili(null);
  };
  const otomatikDiz = (tur: "seri" | "cift") => {
    let yeni: Yuvalar | null = null;
    try {
      yeni = dizilisiYerlestir(diz101(masa.el, masa.okey, tur));
    } catch {
      yeni = null;
    }
    if (!yeni || !masa.el.every((t) => yeni!.includes(t))) {
      bildir("Taşlar şu an otomatik dizilemedi", "bilgi");
      return;
    }
    setSecili(null);
    yuvalariDegistir(yeni);
  };

  // İstaka memo'lu: bırakma işleyicisi kimliği değişmesin, en güncel hâli ref'ten okunsun.
  const birakmaRef = useRef({ at, isle });
  birakmaRef.current = { at, isle };
  const birakildi = useCallback((tas: number, kutu: DOMRect | null, hedef: BirakmaHedefi) => {
    if (hedef.alan === "at") birakmaRef.current.at(tas, kutu);
    else if (hedef.alan === "per") birakmaRef.current.isle(tas, hedef.koltuk, hedef.per, kutu);
  }, []);

  const { disSurukle, disHayalet, cekmeSurukle } = useCekmeSurukle({
    kok,
    cekebilir,
    mesgul: cekisVar,
    yanTas,
    suruklemeDurumu: (d) => suruklemeDurumu(d, null),
    birakildi: (kaynak, yuva, kutu) => cek(kaynak, { yuva, kutu }),
  });

  // ---------- Balonlar ve pencereler ----------
  const balonlar = useBalonlar(durum.sohbet);
  const { ayril, cikisOnayAc, sohbetiAc, pencereler } = useMasaPencereleri(
    durum.antrenman ? "Antrenman maçı bitecek." : "Maç sürüyor. Kalkarsan yerine bot oynar ve maç için koyduğun çip ortada kalır.",
  );
  const [puanAcik, setPuanAcik] = useState(false);
  const [sonucKucuk, setSonucKucuk] = useState(false);
  useEffect(() => setSonucKucuk(false), [oda.elNo]);

  const benimKoltugum = oda.koltuklar[ben];
  const benimKartim =
    benimKoltugum.tur === "insan" ? benimKoltugum.oyuncu : { ad: "Sen", seviye: undefined, etiket: VARSAYILAN_ETIKET };

  let ipucu = "";
  if (bitti) ipucu = "El bitti";
  else if (cekebilir) ipucu = yanRiski && yanTas !== null ? "Ortadan çek — yandaki taş işine yaramıyor" : "Ortadan ya da yandan taş çek";
  else if (atabilir) {
    if (masa.yandanAlinan !== null) ipucu = "Yandan aldığın taşı kullan";
    else if (masa.buTurActi) ipucu = "Açtın! Şimdi bir taş at";
    else if (masa.acma[ben] === null) ipucu = acma.durum === "hazir" ? "Elini aç ya da bir taş at" : "Bir taş at";
    else ipucu = "Pere işle, per aç ya da bir taş at";
  } else ipucu = `${koltukAdi(oda, masa.sira)} oynuyor…`;

  const rakip = (r: 1 | 2 | 3, konum: "sag" | "ust" | "sol") => (
    <OyuncuYeri
      konum={konum}
      no={goreli(r)}
      koltuk={oda.koltuklar[goreli(r)]}
      tasSayisi={masa.tasSayilari[goreli(r)]}
      siraBunda={!bitti && masa.sira === goreli(r)}
      kalanOran={kalanOran}
      acil={acil}
      balon={balonlar[goreli(r)]}
      rozet={acmaRozeti(masa, goreli(r))}
    />
  );

  const alan = (r: 0 | 1 | 2 | 3, konum: AlanKonumu) => {
    const k = goreli(r);
    const ad = koltukAdi(oda, k);
    return (
      <PerAlani
        koltuk={k}
        konum={konum}
        perler={masa.perler[k]}
        okey={masa.okey}
        ad={ad}
        ton={tonu(r === 0 ? benimKartim.ad : ad)}
        hedefler={koltukHedefleri[k]}
        dokun={secili !== null ? (per) => isle(secili, k, per) : undefined}
      />
    );
  };

  const benimRozetim = acmaRozeti(masa, ben);
  const islemeVar = hedefler.length > 0 && surukleme !== "yok";

  return (
    <div
      ref={kok}
      className={`ekran masa masa--101 masa--${RENKLER[masa.okey.renk]} ${surukleme !== "yok" ? "masa--surukleniyor" : ""} ${islemeVar ? "masa--isleme" : ""} ${elBasi ? "masa--el-basi" : ""}`}
    >
      <div className="masa__cuha">
        <div className="masa__isik" />
      </div>
      <Parcaciklar yogunluk="az" />

      {/* ---------- Sol kenar: çıkış ve el sayacı, üsttekinin yığını, soldaki oyuncu, yan taş ---------- */}
      <aside className="masa__kenar masa__kenar--sol">
        <div className="masa__kenar-ust">
          <button className="masa-simge" onClick={() => (bitti ? ayril() : cikisOnayAc())} aria-label="Masadan kalk">
            <Simge ad="cikis" />
          </button>
          <button className="masa__bilgi masa__bilgi--dugme" onClick={() => mac && setPuanAcik(true)} aria-label="Puan tablosu">
            <span>
              <span className="oyun-rozeti oyun-rozeti--101">101</span> {mac ? `El ${mac.elNo}/${mac.elSayisi}` : `${oda.elNo}. el`}
            </span>
            <small>
              {mac ? `Puanın ${mac.toplam[ben]}` : durum.antrenman ? "Antrenman" : `Oda ${oda.kod}`}
              {!durum.antrenman && oda.giris > 0 && <Cip miktar={oda.giris} kisa />}
            </small>
          </button>
        </div>
        <div className="masa__kenar-orta">
          <Yigin taslar={masa.atilanlar[goreli(2)]} okey={masa.okey} koltuk={goreli(2)} ton={tonu(koltukAdi(oda, goreli(2)))} yon="sag" />
          {rakip(3, "sol")}
          <button
            className={`yan-tas ${cekebilir && yanTas !== null ? "yan-tas--cekilebilir" : ""} ${cekebilir && yanRiski ? "yan-tas--riskli" : ""} ${disSurukle?.kaynak === "yan" ? "yan-tas--suruklenen" : ""}`}
            onClick={() => !suruklemeYeniBitti() && cek("yan")}
            onPointerDown={(e) => cekmeSurukle(e, "yan")}
            disabled={!cekebilir || yanTas === null}
            aria-label={yanRiski ? `Yandan çek (dikkat: ${yanRiski})` : "Yandan çek"}
          >
            <Yigin taslar={yanTaslar} okey={masa.okey} koltuk={goreli(3)} ton={tonu(koltukAdi(oda, goreli(3)))} yon="ust" />
            {cekebilir && yanRiski && yanTas !== null && <i className="yan-tas__uyari">101</i>}
          </button>
        </div>
        <div className="dizme-dugmeleri">
          <button className="masa-dugme" onClick={() => otomatikDiz("seri")}>
            Seri Diz
          </button>
          <button className="masa-dugme" onClick={() => otomatikDiz("cift")}>
            Çift Diz
          </button>
        </div>
      </aside>

      {/* ---------- Üst: karşıdaki oyuncu ---------- */}
      <div className="masa__ust">{rakip(2, "ust")}</div>

      {/* ---------- Merkez: perler (herkes kendi tarafında), ortada deste ve gösterge ---------- */}
      <div className="masa__merkez masa101__alan">
        {alan(2, "ust")}
        {alan(3, "sol")}
        <div className="masa101__orta">
          <DesteVeGosterge
            ortaSayisi={masa.ortaSayisi}
            gosterge={masa.gosterge}
            okey={masa.okey}
            elNo={oda.elNo}
            elBasi={elBasi}
            cekebilir={cekebilir}
            cek={() => !suruklemeYeniBitti() && cek("orta")}
            cekmeSurukle={(e) => cekmeSurukle(e, "orta")}
          />
          <GostergeNotu oda={oda} gosterebilir={masa.gostergeGosterebilir} gosteren={masa.gostergeGosteren} gonder={gonder} />
        </div>
        {alan(1, "sag")}
        {alan(0, "ben")}
      </div>

      <SiraIpucu benimSiram={benimSiram} acil={acil} asama={masa.asama} ipucu={ipucu} kalanSn={kalanSn} />

      {/* ---------- İstaka (22 taşa kadar: 2 x 15 yuva) ---------- */}
      <div className="masa__istaka">
        <BenimEtiketim
          kart={benimKartim}
          sirada={benimSiram}
          acil={acil}
          kalanOran={kalanOran}
          balon={balonlar[ben]}
          kompakt
          ek={benimRozetim && <span className={`acma-rozeti ${masa.acma[ben] === "cift" ? "acma-rozeti--cift" : ""}`}>{benimRozetim}</span>}
        />
        <Istaka
          yuvalar={yuvalar}
          okey={masa.okey}
          secili={secili}
          sirada={benimSiram}
          dagitim={elBasi}
          degistir={yuvalariDegistir}
          sec={setSecili}
          birakildi={birakildi}
          suruklemeDurumu={suruklemeDurumu}
        />
      </div>

      {/* ---------- Sağ kenar: puan ve sohbet, sağdakinin yığını, sağdaki oyuncu, atma alanı ---------- */}
      <aside className="masa__kenar masa__kenar--sag">
        <div className="masa__kenar-ust">
          {durum.profil && !durum.antrenman && <Cip miktar={durum.profil.cip} kisa />}
          {mac && (
            <button className="masa-simge" onClick={() => setPuanAcik(true)} aria-label="Puan tablosu">
              <Simge ad="kupa" />
            </button>
          )}
          <SohbetDugmesi ac={sohbetiAc} />
        </div>
        <div className="masa__kenar-orta">
          <Yigin taslar={masa.atilanlar[goreli(1)]} okey={masa.okey} koltuk={goreli(1)} ton={tonu(koltukAdi(oda, goreli(1)))} yon="alt" />
          {rakip(1, "sag")}
          <div
            className={`atma-alani ${atabilir ? "atma-alani--aktif" : ""} ${atabilir && surukleme === "atUstunde" ? "atma-alani--ustunde" : ""}`}
            data-birak="at"
            aria-label={atabilir ? "Buraya at" : "Attığın taşlar"}
          >
            <Yigin taslar={masa.atilanlar[ben]} okey={masa.okey} koltuk={ben} ton={tonu(benimKartim.ad)} yon="sol" />
          </div>
        </div>
        <div className="dizme-dugmeleri">
          <button className="metal-dugme metal-dugme--altin" disabled={!atabilir || secili === null} onClick={() => secili !== null && at(secili)}>
            At
          </button>
          <button
            className={`metal-dugme metal-dugme--zumrut ac-dugmesi ac-dugmesi--${acma.durum}`}
            disabled={acma.durum !== "hazir"}
            onClick={ac}
            title={acma.durum === "yetersiz" ? "Açmak için 101 değer ya da 5 çift gerekir" : undefined}
          >
            {acma.etiket}
          </button>
        </div>
      </aside>

      <DisHayalet surukle={disSurukle} hayalet={disHayalet} okey={masa.okey} />

      {/* ---------- Pencereler ---------- */}
      {puanAcik && mac && <PuanTablosu oda={oda} mac={mac} cezalar={masa.cezalar} kapat={() => setPuanAcik(false)} />}
      {onay && (
        <Pencere baslik={onay.baslik} kapat={() => setOnay(null)}>
          <p className="ceza-uyarisi">
            <b className="ceza-uyarisi__rozet">101</b>
            {onay.metin}
          </p>
          <div className="satir satir--sag">
            <button className="dugme dugme--ikincil" onClick={() => setOnay(null)}>
              Vazgeç
            </button>
            <button
              className="dugme dugme--tehlike"
              onClick={() => {
                onay.devam();
                setOnay(null);
              }}
            >
              {onay.dugme}
            </button>
          </div>
        </Pencere>
      )}
      {bitti && oda.sonEl && mac && masa.sonuc && !sonucKucuk && (
        <SonucPenceresi101
          key={oda.elNo}
          oda={oda}
          sonuc={masa.sonuc}
          mac={mac}
          antrenman={durum.antrenman}
          kucult={() => setSonucKucuk(true)}
          ayril={ayril}
        />
      )}
      {bitti && sonucKucuk && (
        <button className="metal-dugme metal-dugme--altin sonuc-geri" onClick={() => setSonucKucuk(false)}>
          Sonucu göster
        </button>
      )}
      {pencereler}
    </div>
  );
}
