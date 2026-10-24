// Masa ekranı: oyunun asıl ekranı (yatay).
//
// Yerleşim: ben alttayım; sıra benden sonra sağdakine, sonra üsttekine, sonra soldakine geçer.
// Okey'de atılan taş, atanın sağına (yani sıradaki oyuncunun soluna) konur. Bu yüzden:
//   - sol alttaki yığın soldaki oyuncunun attıkları = benim "yan" taşım (çekebilirim),
//   - sağ alttaki yığın benim attıklarım (atma alanı),
//   - sağ üst sağdakinin, sol üst üsttekinin attıkları.
//
// Efektler: ardışık oda görünümlerinin farkından hamleler çıkarılır (masaOlaylari.ts) ve
// her hamle bir uçuş animasyonuyla gösterilir (efektler/ucus.ts): desteden/yandan çekilen
// taş çekenin yerine, atılan taş atanın yığınına uçar. Uçuş sürerken hedefteki asıl taş
// gizli tutulur, taş inince görünür.
//
// Online oyun ve antrenman aynı ekranı kullanır; fark sadece mesajların nereye gittiğidir.
import { type Deger, diz, type IstemciMesaji, RENKLER, TAS_SAYISI, VARSAYILAN_ETIKET, yuzDegeri } from "@okey/kurallar";
import { type CSSProperties, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { IsimEtiketi } from "../../bilesenler/IsimEtiketi.tsx";
import { Cip } from "../../bilesenler/Ortak.tsx";
import { Pencere } from "../../bilesenler/Pencere.tsx";
import { Simge } from "../../bilesenler/Simge.tsx";
import { KapaliTas, Tas } from "../../bilesenler/Tas.tsx";
import { useOyun } from "../../durum/OyunSaglayici.tsx";
import { efektlerAcik } from "../../efektler/ayar.ts";
import { Parcaciklar } from "../../efektler/Parcaciklar.tsx";
import { ucur } from "../../efektler/ucus.ts";
import { titret } from "../../platform/cihaz.ts";
import { useGeriTusu } from "../../platform/geriTusu.ts";
import { tamEkranAc } from "../../platform/tamEkran.ts";
import { sesCek, sesKazandin, sesSira, sesTas } from "../../platform/ses.ts";
import { RENK_ADLARI } from "../../yardimci/bicim.ts";
import { bosIstaka, dizilisiYerlestir, eliYerlestir, istakaEsitle, tasiTasi, YUVA_SAYISI, type Yuvalar } from "../../yardimci/istaka.ts";
import { useSimdi } from "../../yardimci/kancalar.ts";
import { koltukAdi } from "../../yardimci/oda.ts";
import type { SahteSonuc } from "./gelistirme.ts";
import { Istaka, type SuruklemeDurumu } from "./Istaka.tsx";
import { Madalyon, tonu } from "./Madalyon.tsx";
import { type MasaOlayi, olaylariCikar } from "./masaOlaylari.ts";
import { OyuncuYeri } from "./OyuncuYeri.tsx";
import { SohbetPaneli } from "./SohbetPaneli.tsx";
import { SonucPenceresi } from "./SonucPenceresi.tsx";
import { hayaletiKoy, suruklemeYeniBitti, suruklemeyiIzle, yuvaVurgula, yuvaVurgusunuKaldir } from "./surukleme.ts";

/** Son kaç saniye "acil" sayılır (halka nabız atar, plaka titrer). */
const ACIL_SN = 5;
/** Toplam taş: 4 x 14 + başlayanın fazladan taşı. */
const DAGITILAN = 57;

export function MasaEkrani() {
  const { durum, gonder, sohbetOkundu, bildir } = useOyun();

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

  const masa = oda.masa!;
  const ben = masa.koltuk;
  const goreli = (r: number) => (ben + r) % 4; // 1: sağ, 2: üst, 3: sol
  const kok = useRef<HTMLDivElement>(null);

  // ---------- İstaka (yuva düzeni sadece bu telefonda tutulur) ----------
  const [istaka, setIstaka] = useState<{ elNo: number; yuvalar: Yuvalar }>({ elNo: -1, yuvalar: bosIstaka() });
  // Desteden/yandan sürüklenip bir yuvaya bırakılan çekiş: gelen taş o yuvaya konur.
  const [cekisHedefi, setCekisHedefi] = useState<CekisHedefi | null>(null);
  const cekilenTas = cekisHedefi && istaka.elNo === oda.elNo ? (masa.el.find((t) => !cekisHedefi.oncekiEl.includes(t)) ?? null) : null;
  const yuvalar = useMemo(() => {
    if (istaka.elNo !== oda.elNo) return eliYerlestir(masa.el);
    const y = istakaEsitle(istaka.yuvalar, masa.el);
    if (cekisHedefi && cekilenTas !== null) {
      const i = y.indexOf(cekilenTas);
      if (i !== -1 && i !== cekisHedefi.yuva) return tasiTasi(y, i, cekisHedefi.yuva);
    }
    return y;
  }, [istaka, oda.elNo, masa.el, cekisHedefi, cekilenTas]);
  useEffect(() => {
    if (istaka.elNo !== oda.elNo) setIstaka({ elNo: oda.elNo, yuvalar: eliYerlestir(masa.el) });
  }, [oda.elNo, istaka.elNo, masa.el]);
  const yuvalariDegistir = useCallback((y: Yuvalar) => setIstaka({ elNo: oda.elNo, yuvalar: y }), [oda.elNo]);

  const [secili, setSecili] = useState<number | null>(null);
  if (secili !== null && !masa.el.includes(secili)) setSecili(null);

  // ---------- Sıra, süre, ses ve titreşim ----------
  const bitti = masa.sonuc !== null;
  const benimSiram = !bitti && masa.sira === ben;
  const cekebilir = benimSiram && masa.asama === "cek";
  const atabilir = benimSiram && masa.asama === "at";
  const bitirebilir = atabilir && masa.el.length === 15;
  const sonHataId = useMemo(() => durum.bildirimler.reduce((n, b) => (b.tur === "hata" ? Math.max(n, b.id) : n), 0), [durum.bildirimler]);

  // Sürükleyerek çekilen taş geldi: yerleşimi kalıcı yap. Çekiş reddedildiyse ya da el
  // değiştiyse bekleyen hedefi unut.
  useEffect(() => {
    if (!cekisHedefi) return;
    if (cekilenTas !== null) {
      setIstaka({ elNo: oda.elNo, yuvalar });
      setCekisHedefi(null);
    } else if (sonHataId > cekisHedefi.hataId || oda.elNo !== cekisHedefi.elNo || bitti) {
      setCekisHedefi(null);
    }
  }, [cekisHedefi, cekilenTas, sonHataId, oda.elNo, bitti]);

  // Geri sayım telefonun kendi saatiyle: oda mesajı geldiğinde "şimdi + turKalanMs"
  // olarak hesaplanan bitiş anı (durum.turYerelBitis) ve sunucunun verdiği toplam süre.
  const simdi = useSimdi(200, !bitti);
  const bitis = durum.turYerelBitis;
  const kalanMs = bitis === null ? null : Math.max(0, bitis - simdi);
  const kalanOran = kalanMs === null ? null : Math.min(1, kalanMs / Math.max(1, oda.turSuresiMs));
  const kalanSn = kalanMs === null ? null : Math.ceil(kalanMs / 1000);
  const acil = kalanSn !== null && kalanSn <= ACIL_SN && !bitti;

  useEffect(() => {
    if (!benimSiram) return;
    if (durum.ayarlar.titresim) void titret();
    if (durum.ayarlar.ses) sesSira();
  }, [benimSiram]);
  // Benim sıramda son saniyelere girince bir kez daha titret.
  useEffect(() => {
    if (benimSiram && acil && durum.ayarlar.titresim) void titret();
  }, [benimSiram && acil]);

  const atilanToplam = masa.atilanlar.reduce((n, a) => n + a.length, 0);
  useEffect(() => {
    if (atilanToplam > 0 && durum.ayarlar.ses) sesTas();
  }, [atilanToplam]);

  const kazandim = masa.sonuc?.tur === "kazanan" && masa.sonuc.koltuk === ben;
  useEffect(() => {
    if (kazandim && durum.ayarlar.ses) sesKazandin();
  }, [kazandim]);

  // ---------- El başı: gösterge çevrilir, taşlar istakaya sırayla düşer ----------
  const tasToplam = masa.tasSayilari.reduce((n, t) => n + t, 0);
  const [elBasi, setElBasi] = useState(() => atilanToplam === 0 && tasToplam === DAGITILAN);
  const ilkElNo = useRef(oda.elNo);
  useEffect(() => {
    if (oda.elNo === ilkElNo.current) {
      if (!elBasi) return;
    } else {
      ilkElNo.current = oda.elNo;
      setElBasi(true);
    }
    const z = setTimeout(() => setElBasi(false), 2600);
    return () => clearTimeout(z);
  }, [oda.elNo]);

  // ---------- Uçuşlar: önceki görünümle farktan hamleleri çıkar ----------
  const sonAtis = useRef<{ tas: number; kutu: DOMRect } | null>(null);
  const oncekiMasa = useRef({ elNo: oda.elNo, masa });
  useLayoutEffect(() => {
    const o = oncekiMasa.current;
    oncekiMasa.current = { elNo: oda.elNo, masa };
    if (o.masa === masa || o.elNo !== oda.elNo || !kok.current || sahteMi) return;
    const olaylar = olaylariCikar(o.masa, masa);
    olaylar.forEach((olay, i) => ucusHazirla(kok.current!, olay, ben, masa.okey, sonAtis.current, cekisHedefi?.kutu ?? null, i * 60));
    if (olaylar.some((ol) => ol.tur === "cek" && ol.koltuk === ben) && durum.ayarlar.ses) sesCek();
    sonAtis.current = null;
  }, [masa]);

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
  const birakildi = useCallback((tas: number, kutu: DOMRect | null, hedef: "at" | "bitir") => {
    if (hedef === "at") atRef.current(tas, kutu);
    else suruklemeBitirRef.current(tas, kutu);
  }, []);

  // ---------- Desteden / yandan sürükleyerek çekme ----------
  // Dokunuş eskisi gibi çeker (taş ilk boş yuvaya gelir). Sürükleyip bir yuvaya
  // bırakınca çekilen taş o yuvaya konur; istaka dışında bırakılırsa hiçbir şey olmaz.
  const [disSurukle, setDisSurukle] = useState<{ kaynak: "orta" | "yan"; tas: number | null } | null>(null);
  const disHayalet = useRef<HTMLDivElement>(null);
  const disKonum = useRef({ x: 0, y: 0, ofsetX: 0, ofsetY: 0 });
  useLayoutEffect(() => {
    const k = disKonum.current;
    if (disSurukle) hayaletiKoy(disHayalet.current, k.x, k.y, k.ofsetX, k.ofsetY);
  }, [disSurukle]);
  const cekmeSurukle = (e: ReactPointerEvent<HTMLElement>, kaynak: "orta" | "yan") => {
    if (!cekebilir || cekisHedefi || (kaynak === "yan" && yanTaslar.length === 0)) return;
    const ornek = kok.current?.querySelector<HTMLElement>(".istaka .tas");
    const en = ornek?.offsetWidth || 40;
    const boy = ornek?.offsetHeight || 56;
    // Taş parmağın biraz üstünde durur ki parmak altında kalmasın.
    const ofsetX = en / 2;
    const ofsetY = boy * 0.75;
    suruklemeyiIzle(e, {
      basla: () => {
        if (!cekebilirRef.current) return false;
        disKonum.current = { x: e.clientX, y: e.clientY, ofsetX, ofsetY };
        setDisSurukle({ kaynak, tas: kaynak === "yan" ? (yanTaslar.at(-1) ?? null) : null });
        setSurukleme("var");
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
        setSurukleme("yok");
        if (yuva === null || !cekebilirRef.current) return;
        setCekisHedefi({ yuva, oncekiEl: masaRef.current.el, kutu, hataId: sonHataId, elNo: oda.elNo });
        cek(kaynak);
      },
    });
  };
  const cekebilirRef = useRef(cekebilir);
  cekebilirRef.current = cekebilir;
  const masaRef = useRef(masa);
  masaRef.current = masa;

  // ---------- Konuşma balonları ----------
  const [balonlar, setBalonlar] = useState<Record<number, string>>({});
  const sonSohbet = durum.sohbet.at(-1);
  const ilkSohbet = useRef(sonSohbet);
  const balonSaatleri = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    if (!sonSohbet || sonSohbet === ilkSohbet.current || sonSohbet.koltuk < 0) return;
    const { koltuk, metin } = sonSohbet;
    setBalonlar((b) => ({ ...b, [koltuk]: metin }));
    balonSaatleri.current.push(
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
  useEffect(() => () => balonSaatleri.current.forEach(clearTimeout), []);

  // ---------- Pencereler ----------
  const [sohbetAcik, setSohbetAcik] = useState(false);
  const [cikisOnay, setCikisOnay] = useState(false);
  const [sonucKucuk, setSonucKucuk] = useState(false);
  useEffect(() => setSonucKucuk(false), [oda.elNo]);
  const ayril = () => gonder({ t: "odadanAyril" });
  // Android geri tuşu: önce "Masadan kalkmak istiyor musun?" (pencereler kendileri kapanır).
  useGeriTusu(() => setCikisOnay(true));
  // Masadayken sistem çubukları gizlenir.
  useEffect(() => tamEkranAc(), []);

  const okeyMetni = `${RENK_ADLARI[masa.okey.renk]} ${masa.okey.sayi}`;
  // Okey ikonu için bu değerdeki herhangi bir taşın kimliği.
  const okeyOrnegi = useMemo(() => {
    for (let id = 0; id < TAS_SAYISI; id++) {
      const d = yuzDegeri(id);
      if (d && d.renk === masa.okey.renk && d.sayi === masa.okey.sayi) return id;
    }
    return null;
  }, [masa.okey.renk, masa.okey.sayi]);
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

  const yanTaslar = masa.atilanlar[goreli(3)];
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
          <button className="masa-simge" onClick={() => (bitti ? ayril() : setCikisOnay(true))} aria-label="Masadan kalk">
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
        <div
          className={`deste-alani ${bitirVurgu ? "deste-alani--bitir" : ""} ${bitirVurgu && surukleme === "bitirUstunde" ? "deste-alani--ustunde" : ""}`}
          data-birak={bitirebilir ? "bitir" : undefined}
        >
          <button
            className={`deste ${cekebilir ? "deste--cekilebilir" : ""}`}
            onClick={() => !suruklemeYeniBitti() && cek("orta")}
            onPointerDown={(e) => cekmeSurukle(e, "orta")}
            disabled={!cekebilir}
            aria-label="Ortadan çek"
            data-deste
          >
            <KapaliTas />
            <KapaliTas />
            <KapaliTas />
            <span className="deste__sayi">{masa.ortaSayisi}</span>
          </button>
          <div className="gosterge" aria-label={`Gösterge; okey ${okeyMetni}`}>
            <div key={oda.elNo} className={`gosterge__kart ${elBasi ? "gosterge__kart--cevir" : ""}`}>
              <div className="gosterge__yuz">
                <Tas id={masa.gosterge} boyut="orta" />
              </div>
              <div className="gosterge__arka">
                <KapaliTas />
              </div>
            </div>
            {okeyOrnegi !== null && (
              <div className="okey-ikon" title={`Okey: ${okeyMetni}`}>
                <Tas id={okeyOrnegi} okey={masa.okey} boyut="kucuk" />
              </div>
            )}
          </div>
        </div>
        {masa.gostergeGosterebilir && (
          <button className="metal-dugme metal-dugme--zumrut metal-dugme--kucuk gosterge-dugmesi" onClick={() => hamle({ t: "hamle", eylem: { tur: "gostergeGoster" } })}>
            Gösterge göster
          </button>
        )}
        {masa.gostergeGosteren !== null && (
          <span className="gosterge-not">{koltukAdi(oda, masa.gostergeGosteren)} göstergeyi gösterdi</span>
        )}
      </div>

      <div className="masa__ipucu">
        {benimSiram ? (
          <div key={masa.asama} className={`sira-seridi ${acil ? "sira-seridi--acil" : ""}`}>
            <b>Sıra sende</b>
            <span>{ipucu}</span>
            {kalanSn !== null && <i>{kalanSn}</i>}
          </div>
        ) : (
          <span className="masa__ipucu-metin">{ipucu}</span>
        )}
      </div>

      {/* ---------- İstaka ---------- */}
      <div className="masa__istaka">
        <div className={`benim-etiketim ${benimSiram ? "benim-etiketim--sirada" : ""} ${benimSiram && acil ? "benim-etiketim--acil" : ""}`}>
          <Madalyon ad={benimKartim.ad} oran={benimSiram ? (kalanOran ?? 1) : null} acil={benimSiram && acil} boyut="kucuk" />
          <IsimEtiketi ad={benimKartim.ad} seviye={benimKartim.seviye} etiket={benimKartim.etiket} boyut="kucuk" />
          {balonlar[ben] && (
            <div key={balonlar[ben]} className="konusma-balonu konusma-balonu--ben">
              {balonlar[ben]}
            </div>
          )}
        </div>
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
          <button
            className="masa-simge"
            onClick={() => {
              setSohbetAcik(true);
              sohbetOkundu();
            }}
            aria-label="Sohbet"
          >
            <Simge ad="sohbet" />
            {durum.okunmamisSohbet > 0 && <i className="rozet-sayi">{durum.okunmamisSohbet}</i>}
          </button>
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

      {disSurukle && (
        <div className="hayalet" ref={disHayalet}>
          {disSurukle.tas !== null ? <Tas id={disSurukle.tas} okey={masa.okey} suruklenen /> : <KapaliTas boyut="buyuk" />}
        </div>
      )}

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
      {sohbetAcik && (
        <SohbetPaneli
          mesajlar={durum.sohbet}
          benimKoltugum={oda.benimKoltugum}
          gonder={(metin) => gonder({ t: "sohbet", metin })}
          kapat={() => {
            setSohbetAcik(false);
            sohbetOkundu();
          }}
        />
      )}
      {cikisOnay && (
        <Pencere baslik="Masadan kalkmak istiyor musun?" kapat={() => setCikisOnay(false)}>
          <p>
            {durum.antrenman
              ? "Antrenman eli bitecek."
              : "El sürüyor. Kalkarsan yerine bot oynar ve bu el için koyduğun çip ortada kalır."}
          </p>
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Yığın: bir oyuncunun attığı taşlar. Masanın köşelerinde, atan ile sıradaki oyuncu
// arasında durur. Sadece son taş tam görünür; altındaki en fazla iki taş kaymış kenar
// olarak seçilir. Zemindeki halka atanın madalyon renginde, küçük ok atana bakar.
// ---------------------------------------------------------------------------

type Yon = "ust" | "sag" | "alt" | "sol";

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

/** Uçuş için bir taş öğesinin temiz kopyası (seçili/soluk/gizli hâlleri olmadan). */
function tasKopyasi(el: HTMLElement): HTMLElement {
  const k = el.cloneNode(true) as HTMLElement;
  k.classList.remove("tas--secili", "tas--soluk", "tas--gizli", "tas--yeni");
  return k;
}

function Yigin({ taslar, okey, koltuk, ton, yon }: { taslar: number[]; okey: Deger; koltuk: number; ton: number; yon: Yon }) {
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

// ---------------------------------------------------------------------------
// Uçuş hazırlığı. useLayoutEffect içinde (boyamadan önce) çağrılır: hedefteki asıl
// taş gizlenir, kutular ölçülür; uçuş bir mikro görevde başlar (taş kopyası React
// ile çizilebilsin diye) ve iniş bitince hedef taş görünür.
// ---------------------------------------------------------------------------

/** Bir kutunun merkezinde, verilen boyutta yeni bir kutu. */
function merkezKutu(k: DOMRect, en: number, boy: number) {
  return new DOMRect(k.left + k.width / 2 - en / 2, k.top + k.height / 2 - boy / 2, en, boy);
}

/** Bir hamlenin uçuşunu hazırlar (bkz. yukarıdaki açıklama). */
function ucusHazirla(
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
function tasCiz(id: number, okey: Deger): { el: HTMLElement; birak: () => void } {
  const kap = document.createElement("div");
  const kok = createRoot(kap);
  flushSync(() => kok.render(<Tas id={id} okey={okey} boyut="orta" />));
  return { el: kap, birak: () => setTimeout(() => kok.unmount(), 0) };
}
