// Masa ekranı: Okey'in asıl ekranı (yatay).
//
// Yerleşim: ben alttayım; sıra benden sonra sağdakine, sonra üsttekine, sonra soldakine geçer.
// Okey'de atılan taş, atanın sağına (yani sıradaki oyuncunun soluna) konur. Bu yüzden:
//   - sol alttaki yığın soldaki oyuncunun attıkları = benim "yan" taşım (çekebilirim),
//   - sağ alttaki yığın benim attıklarım (atma alanı),
//   - sağ üst sağdakinin, sol üst üsttekinin attıkları.
//
// Efektler: ardışık oda görünümlerinin farkından hamleler çıkarılır (masaOlaylari.ts) ve
// her hamle bir uçuş animasyonuyla gösterilir (ucuslar.tsx): desteden/yandan çekilen
// taş çekenin yerine, atılan taş atanın yığınına uçar. Uçuş sürerken hedefteki asıl taş
// gizli tutulur, taş inince görünür.
//
// İstaka, yığınlar, deste, sayaç, sesler, uçuşlar ve pencereler 101 masasıyla ortaktır
// (ortak.tsx); burada Okey'e özgü olanlar kalır: bitirme ve sonuç penceresi.
//
// Online oyun ve antrenman aynı ekranı kullanır; fark sadece mesajların nereye gittiğidir.
import { diz, type IstemciMesaji, type MasaGorunumu, RENKLER, VARSAYILAN_ETIKET } from "@okey/kurallar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Cip } from "../../bilesenler/Ortak.tsx";
import { Simge } from "../../bilesenler/Simge.tsx";
import { useOyun } from "../../durum/OyunSaglayici.tsx";
import { Parcaciklar } from "../../efektler/Parcaciklar.tsx";
import { ucur } from "../../efektler/ucus.ts";
import { dizilisiYerlestir, YUVA_SAYISI, type Yuvalar } from "../../yardimci/istaka.ts";
import { koltukAdi } from "../../yardimci/oda.ts";
import type { SahteSonuc } from "./gelistirme.ts";
import { type BirakmaHedefi, Istaka, type SuruklemeDurumu } from "./Istaka.tsx";
import { tonu } from "./Madalyon.tsx";
import {
  BenimEtiketim,
  DesteVeGosterge,
  DisHayalet,
  GostergeNotu,
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
} from "./ortak.tsx";
import { OyuncuYeri } from "./OyuncuYeri.tsx";
import { SonucPenceresi } from "./SonucPenceresi.tsx";
import { suruklemeYeniBitti } from "./surukleme.ts";
import { merkezKutu, tasKopyasi } from "./ucuslar.tsx";

/** Toplam taş: 4 x 14 + başlayanın fazladan taşı. */
const DAGITILAN = 57;

export function MasaEkrani() {
  const { durum, gonder, bildir } = useOyun();

  // Geliştirmede sonuç penceresini beklemeden görmek için (üretim paketine girmez).
  const [sahte, setSahte] = useState<SahteSonuc | null>(null);
  const [sahteModul, setSahteModul] = useState<typeof import("./gelistirme.ts") | null>(null);
  useEffect(() => {
    if (import.meta.env.DEV) {
      let iptal = false;
      void import("./gelistirme.ts").then((m) => !iptal && setSahteModul(m));
      const w = window as unknown as { __okeySonucDene?: (s?: SahteSonuc | null) => void };
      w.__okeySonucDene = (s = {}) => setSahte(s);
      void import("./gelistirme.ts").then((m) => !iptal && m.bitirKancasiniKur());
      return () => {
        iptal = true;
        delete w.__okeySonucDene;
      };
    }
  }, []);
  const sahteMi = import.meta.env.DEV && sahte !== null && sahteModul !== null && durum.oda?.masa != null;
  const oda = sahteMi ? sahteModul!.sahteSonucOdasi(durum.oda!, sahte!) : durum.oda!;

  // Uygulama, 101 masasını Masa101Ekrani'na gönderir; buraya sadece Okey masası gelir.
  const masa = oda.masa as MasaGorunumu;
  const ben = masa.koltuk;
  const goreli = (r: number) => (ben + r) % 4; // 1: sağ, 2: üst, 3: sol
  const kok = useRef<HTMLDivElement>(null);

  // ---------- Sıra, süre, istaka ----------
  const bitti = masa.sonuc !== null;
  const benimSiram = !bitti && masa.sira === ben;
  const cekebilir = benimSiram && masa.asama === "cek";
  const atabilir = benimSiram && masa.asama === "at";
  const bitirebilir = atabilir && masa.el.length === 15;
  const sonHataId = useSonHataId();
  const { yuvalar, yuvalariDegistir, cekisVar, cekKutu, cekisiBekle } = useIstakaDuzeni(oda.elNo, masa.el, bitti, sonHataId);
  const [secili, setSecili] = useState<number | null>(null);
  if (secili !== null && !masa.el.includes(secili)) setSecili(null);

  const { kalanOran, kalanSn, acil } = useTurSayaci(durum.turYerelBitis, oda.turSuresiMs, bitti);
  const atilanToplam = masa.atilanlar.reduce((n, a) => n + a.length, 0);
  const kazandim = masa.sonuc?.tur === "kazanan" && masa.sonuc.koltuk === ben;
  useMasaSesleri(durum.ayarlar, { benimSiram, acil, atilanToplam, kazandim });

  const tasToplam = masa.tasSayilari.reduce((n, t) => n + t, 0);
  const elBasi = useElBasi(oda.elNo, atilanToplam === 0 && tasToplam === DAGITILAN);
  const { sonAtis } = useUcuslar(kok, oda.elNo, masa, cekKutu, sahteMi, durum.ayarlar.ses);

  // ---------- Hamleler ----------
  const hamle = (m: Extract<IstemciMesaji, { t: "hamle" }>) => gonder(m);
  const cek = (kaynak: "orta" | "yan") => cekebilir && hamle({ t: "hamle", eylem: { tur: "cek", kaynak } });
  const at = (tas: number, kutu?: DOMRect | null) => {
    if (!atabilir) return;
    const el = kok.current?.querySelector<HTMLElement>(`.istaka [data-tas="${tas}"]`);
    const k = kutu ?? el?.getBoundingClientRect();
    sonAtis.current = k ? { tas, kutu: k } : null;
    hamle({ t: "hamle", eylem: { tur: "at", tas } });
    setSecili(null);
  };
  const bitir = () => secili !== null && hamle({ t: "hamle", eylem: { tur: "bitir", tas: secili } });
  const otomatikDiz = (tur: "seri" | "cift") => {
    // diz() çok nadir durumlarda (arama sınırı aşılırsa) sonuç üretemeyebilir; o zaman
    // istakadaki mevcut düzen bozulmadan kalır.
    let yeni: Yuvalar | null = null;
    try {
      yeni = dizilisiYerlestir(diz(masa.el, masa.okey, tur, YUVA_SAYISI));
    } catch {
      yeni = null;
    }
    const tamMi = yeni !== null && masa.el.every((t) => yeni!.includes(t));
    if (!tamMi) {
      bildir("Taşlar şu an otomatik dizilemedi", "bilgi");
      return;
    }
    setSecili(null);
    yuvalariDegistir(yeni!);
  };
  const atRef = useRef(at);
  atRef.current = at;
  const [surukleme, setSurukleme] = useState<SuruklemeDurumu>("yok");

  // ---------- Bitirme: son taşı göstergenin üstüne sürükleyip bırakmak ----------
  // Taş istakada gizlenir, bir kopyası bırakıldığı yerden göstergenin üstüne uçar ve
  // cevap beklenir. El biterse sonuç penceresi gelir; motor/sunucu reddederse (hata
  // bildirimi) ya da cevap gelmezse kopya istakadaki yerine geri uçar.
  const [bitirBekleyen, setBitirBekleyen] = useState<{ tas: number; hataId: number } | null>(null);
  const bitirUcusu = useRef<Promise<HTMLElement | null> | null>(null);
  const geriDonuyor = useRef(false);
  const suruklemeBitir = (tas: number, kutu: DOMRect | null) => {
    if (!bitirebilir || bitirBekleyen) return;
    const hedef = kok.current?.querySelector(".gosterge__kart")?.getBoundingClientRect();
    const kaynakEl = kok.current?.querySelector<HTMLElement>(`.istaka [data-tas="${tas}"]`);
    setSecili(null);
    setBitirBekleyen({ tas, hataId: sonHataId });
    bitirUcusu.current =
      hedef && kutu && kaynakEl
        ? ucur(kutu, merkezKutu(hedef, kutu.width * 0.86, kutu.height * 0.86), tasKopyasi(kaynakEl), { sure: 220, yay: 18, donus: 4, kalsin: true }).catch(() => null)
        : Promise.resolve(null);
    hamle({ t: "hamle", eylem: { tur: "bitir", tas } });
  };
  useEffect(() => {
    if (!bitirBekleyen) return;
    const ucus = bitirUcusu.current;
    if (bitti) {
      // El bitti: sonuç penceresi açılıyor; ortadaki kopya kısa süre sonra kalkar.
      void ucus?.then((el) => setTimeout(() => el?.remove(), 400));
      setBitirBekleyen(null);
      return;
    }
    const geriDon = () => {
      if (geriDonuyor.current) return;
      geriDonuyor.current = true;
      void (ucus ?? Promise.resolve(null)).then((el) => {
        const tasEl = kok.current?.querySelector<HTMLElement>(`.istaka [data-tas="${bitirBekleyen.tas}"]`);
        const bas = el?.getBoundingClientRect();
        el?.remove();
        if (!tasEl || !bas) {
          geriDonuyor.current = false;
          setBitirBekleyen(null);
          return;
        }
        void ucur(bas, tasEl.getBoundingClientRect(), tasKopyasi(tasEl), { sure: 300, yay: 30, donus: -5 })
          .catch(() => {})
          .finally(() => {
            geriDonuyor.current = false;
            setBitirBekleyen(null);
          });
      });
    };
    if (sonHataId > bitirBekleyen.hataId || !atabilir) {
      geriDon();
      return;
    }
    // Cevap hiç gelmezse (bağlantı koptu vb.) taş yine yerine döner.
    const z = setTimeout(geriDon, 4000);
    return () => clearTimeout(z);
  }, [bitirBekleyen, bitti, sonHataId, atabilir]);

  const suruklemeBitirRef = useRef(suruklemeBitir);
  suruklemeBitirRef.current = suruklemeBitir;
  const birakildi = useCallback((tas: number, kutu: DOMRect | null, hedef: BirakmaHedefi) => {
    if (hedef.alan === "at") atRef.current(tas, kutu);
    else if (hedef.alan === "bitir") suruklemeBitirRef.current(tas, kutu);
  }, []);

  // ---------- Desteden / yandan sürükleyerek çekme ----------
  const yanTaslar = masa.atilanlar[goreli(3)];
  const { disSurukle, disHayalet, cekmeSurukle } = useCekmeSurukle({
    kok,
    cekebilir,
    mesgul: cekisVar,
    yanTas: yanTaslar.at(-1) ?? null,
    suruklemeDurumu: setSurukleme,
    birakildi: (kaynak, yuva, kutu) => {
      cekisiBekle(yuva, kutu);
      cek(kaynak);
    },
  });

  // ---------- Konuşma balonları ve pencereler ----------
  const balonlar = useBalonlar(durum.sohbet);
  const { ayril, cikisOnayAc, sohbetiAc, pencereler } = useMasaPencereleri(
    durum.antrenman ? "Antrenman eli bitecek." : "El sürüyor. Kalkarsan yerine bot oynar ve bu el için koyduğun çip ortada kalır.",
  );
  const [sonucKucuk, setSonucKucuk] = useState(false);
  useEffect(() => setSonucKucuk(false), [oda.elNo]);

  const benimKoltugum = oda.koltuklar[ben];
  const benimKartim =
    benimKoltugum.tur === "insan" ? benimKoltugum.oyuncu : { ad: "Sen", seviye: undefined, etiket: VARSAYILAN_ETIKET };

  let ipucu = "";
  if (bitti) ipucu = "El bitti";
  else if (cekebilir) ipucu = "Ortadan ya da yandan taş çek";
  else if (atabilir) ipucu = masa.el.length === 15 ? "Bir taş at — ya da seçip bitir" : "Bir taş at";
  else ipucu = `${koltukAdi(oda, masa.sira)} oynuyor…`;

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
    />
  );

  const bitirVurgu = bitirebilir && !bitirBekleyen && (surukleme === "var" || surukleme === "bitirUstunde");
  const benimAttiklarim = masa.atilanlar[ben];

  return (
    <div
      ref={kok}
      className={`ekran masa masa--${RENKLER[masa.okey.renk]} ${surukleme !== "yok" ? "masa--surukleniyor" : ""} ${elBasi ? "masa--el-basi" : ""}`}
    >
      <div className="masa__cuha">
        <div className="masa__isik" />
      </div>
      <Parcaciklar yogunluk="az" />

      {/* ---------- Sol kenar: çıkış, üsttekinin yığını, soldaki oyuncu, yan (soldakinin yığını) ---------- */}
      <aside className="masa__kenar masa__kenar--sol">
        <div className="masa__kenar-ust">
          <button className="masa-simge" onClick={() => (bitti ? ayril() : cikisOnayAc())} aria-label="Masadan kalk">
            <Simge ad="cikis" />
          </button>
          <div className="masa__bilgi">
            <span>{durum.antrenman ? "Antrenman" : `Oda ${oda.kod}`}</span>
            <small>
              {oda.elNo}. el {!durum.antrenman && oda.giris > 0 && <Cip miktar={oda.giris} kisa />}
            </small>
          </div>
        </div>
        <div className="masa__kenar-orta">
          <Yigin taslar={masa.atilanlar[goreli(2)]} okey={masa.okey} koltuk={goreli(2)} ton={tonu(koltukAdi(oda, goreli(2)))} yon="sag" />
          {rakip(3, "sol")}
          <button
            className={`yan-tas ${cekebilir && yanTaslar.length > 0 ? "yan-tas--cekilebilir" : ""} ${disSurukle?.kaynak === "yan" ? "yan-tas--suruklenen" : ""}`}
            onClick={() => !suruklemeYeniBitti() && cek("yan")}
            onPointerDown={(e) => cekmeSurukle(e, "yan")}
            disabled={!cekebilir || yanTaslar.length === 0}
            aria-label="Yandan çek"
          >
            <Yigin taslar={yanTaslar} okey={masa.okey} koltuk={goreli(3)} ton={tonu(koltukAdi(oda, goreli(3)))} yon="ust" />
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

      {/* ---------- Merkez: deste, gösterge, okey ---------- */}
      <div className="masa__merkez">
        <DesteVeGosterge
          ortaSayisi={masa.ortaSayisi}
          gosterge={masa.gosterge}
          okey={masa.okey}
          elNo={oda.elNo}
          elBasi={elBasi}
          cekebilir={cekebilir}
          cek={() => !suruklemeYeniBitti() && cek("orta")}
          cekmeSurukle={(e) => cekmeSurukle(e, "orta")}
          sinif={`${bitirVurgu ? "deste-alani--bitir" : ""} ${bitirVurgu && surukleme === "bitirUstunde" ? "deste-alani--ustunde" : ""}`}
          birak={bitirebilir ? "bitir" : undefined}
        />
        <GostergeNotu oda={oda} gosterebilir={masa.gostergeGosterebilir} gosteren={masa.gostergeGosteren} gonder={gonder} />
      </div>

      <SiraIpucu benimSiram={benimSiram} acil={acil} asama={masa.asama} ipucu={ipucu} kalanSn={kalanSn} />

      {/* ---------- İstaka ---------- */}
      <div className="masa__istaka">
        <BenimEtiketim kart={benimKartim} sirada={benimSiram} acil={acil} kalanOran={kalanOran} balon={balonlar[ben]} />
        <Istaka
          yuvalar={yuvalar}
          okey={masa.okey}
          secili={secili}
          sirada={benimSiram}
          dagitim={elBasi}
          degistir={yuvalariDegistir}
          sec={setSecili}
          birakildi={birakildi}
          suruklemeDurumu={setSurukleme}
          gizliTas={bitirBekleyen?.tas ?? null}
        />
      </div>

      {/* ---------- Sağ kenar: sohbet, sağdakinin yığını, sağdaki oyuncu, benim yığınım ---------- */}
      <aside className="masa__kenar masa__kenar--sag">
        <div className="masa__kenar-ust">
          {durum.profil && !durum.antrenman && <Cip miktar={durum.profil.cip} kisa />}
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
            <Yigin taslar={benimAttiklarim} okey={masa.okey} koltuk={ben} ton={tonu(benimKartim.ad)} yon="sol" />
          </div>
        </div>
        <div className="dizme-dugmeleri">
          <button className="metal-dugme metal-dugme--altin" disabled={!atabilir || secili === null} onClick={() => secili !== null && at(secili)}>
            At
          </button>
          <button className="metal-dugme metal-dugme--zumrut" disabled={!atabilir || secili === null || masa.el.length !== 15} onClick={bitir}>
            Bitir
          </button>
        </div>
      </aside>

      <DisHayalet surukle={disSurukle} hayalet={disHayalet} okey={masa.okey} />

      {/* ---------- Pencereler ---------- */}
      {bitti && oda.sonEl && !sonucKucuk && (
        <SonucPenceresi
          key={oda.elNo}
          oda={oda}
          okey={masa.okey}
          antrenman={durum.antrenman && !sahteMi}
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
