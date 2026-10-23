// Masa ekranı: oyunun asıl ekranı (yatay).
//
// Yerleşim: ben alttayım; sıra benden sonra sağdakine, sonra üsttekine, sonra soldakine geçer.
// Okey'de atılan taş, atanın sağına (yani sıradaki oyuncunun soluna) konur. Bu yüzden:
//   - sol alttaki yığın soldaki oyuncunun attıkları = benim "yan" taşım (çekebilirim),
//   - sağ alttaki yığın benim attıklarım (atma alanı),
//   - sağ üst sağdakinin, sol üst üsttekinin attıkları.
//
// Online oyun ve antrenman aynı ekranı kullanır; fark sadece mesajların nereye gittiğidir.
import { type Deger, diz, type IstemciMesaji, RENKLER, VARSAYILAN_ETIKET } from "@okey/kurallar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IsimEtiketi } from "../../bilesenler/IsimEtiketi.tsx";
import { Cip } from "../../bilesenler/Ortak.tsx";
import { Pencere } from "../../bilesenler/Pencere.tsx";
import { Simge } from "../../bilesenler/Simge.tsx";
import { KapaliTas, Tas } from "../../bilesenler/Tas.tsx";
import { useOyun } from "../../durum/OyunSaglayici.tsx";
import { titret } from "../../platform/cihaz.ts";
import { sesCek, sesKazandin, sesSira, sesTas } from "../../platform/ses.ts";
import { RENK_ADLARI } from "../../yardimci/bicim.ts";
import {
  bosIstaka,
  dizilisiYerlestir,
  eliYerlestir,
  istakaEsitle,
  YUVA_SAYISI,
  type Yuvalar,
} from "../../yardimci/istaka.ts";
import { useSimdi } from "../../yardimci/kancalar.ts";
import { koltukAdi } from "../../yardimci/oda.ts";
import { Istaka } from "./Istaka.tsx";
import { OyuncuYeri } from "./OyuncuYeri.tsx";
import { SohbetPaneli } from "./SohbetPaneli.tsx";
import { SonucPenceresi } from "./SonucPenceresi.tsx";

export function MasaEkrani() {
  const { durum, gonder, sohbetOkundu } = useOyun();
  const oda = durum.oda!;
  const masa = oda.masa!;
  const ben = masa.koltuk;
  const goreli = (r: number) => (ben + r) % 4; // 1: sağ, 2: üst, 3: sol

  // ---------- İstaka (yuva düzeni sadece bu telefonda tutulur) ----------
  const [istaka, setIstaka] = useState<{ elNo: number; yuvalar: Yuvalar }>({ elNo: -1, yuvalar: bosIstaka() });
  const yuvalar = useMemo(
    () => (istaka.elNo === oda.elNo ? istakaEsitle(istaka.yuvalar, masa.el) : eliYerlestir(masa.el)),
    [istaka, oda.elNo, masa.el],
  );
  useEffect(() => {
    if (istaka.elNo !== oda.elNo) setIstaka({ elNo: oda.elNo, yuvalar: eliYerlestir(masa.el) });
  }, [oda.elNo, istaka.elNo, masa.el]);
  const yuvalariDegistir = useCallback((y: Yuvalar) => setIstaka({ elNo: oda.elNo, yuvalar: y }), [oda.elNo]);

  const [secili, setSecili] = useState<number | null>(null);
  if (secili !== null && !masa.el.includes(secili)) setSecili(null);

  // Yeni gelen (çekilen) taşları kısa süre işaretle: düşme animasyonu için.
  const [yeniler, setYeniler] = useState<Set<number>>(new Set());
  const oncekiEl = useRef<number[]>(masa.el);
  useEffect(() => {
    const eski = new Set(oncekiEl.current);
    const gelen = masa.el.filter((t) => !eski.has(t));
    oncekiEl.current = masa.el;
    if (gelen.length === 0 || gelen.length > 2) return; // yeni el dağıtımında animasyon yok
    setYeniler(new Set(gelen));
    if (durum.ayarlar.ses) sesCek();
    const z = setTimeout(() => setYeniler(new Set()), 700);
    return () => clearTimeout(z);
  }, [masa.el, durum.ayarlar.ses]);

  // ---------- Sıra, süre, ses ve titreşim ----------
  const bitti = masa.sonuc !== null;
  const benimSiram = !bitti && masa.sira === ben;
  const cekebilir = benimSiram && masa.asama === "cek";
  const atabilir = benimSiram && masa.asama === "at";

  const simdi = useSimdi(200, !bitti);
  // Sunucu toplam süreyi göndermez; turBitis ilk geldiğindeki kalan süreyi "tam" kabul ederiz.
  const turToplam = useRef<{ bitis: number | null; toplam: number }>({ bitis: null, toplam: 1 });
  if (oda.turBitis !== turToplam.current.bitis) {
    turToplam.current = { bitis: oda.turBitis, toplam: Math.max(1, (oda.turBitis ?? 0) - Date.now()) };
  }
  const kalanOran = oda.turBitis ? Math.max(0, Math.min(1, (oda.turBitis - simdi) / turToplam.current.toplam)) : null;
  const kalanSn = oda.turBitis ? Math.max(0, Math.ceil((oda.turBitis - simdi) / 1000)) : null;

  useEffect(() => {
    if (!benimSiram) return;
    if (durum.ayarlar.titresim) void titret();
    if (durum.ayarlar.ses) sesSira();
  }, [benimSiram]);

  const atilanToplam = masa.atilanlar.reduce((n, a) => n + a.length, 0);
  useEffect(() => {
    if (atilanToplam > 0 && durum.ayarlar.ses) sesTas();
  }, [atilanToplam]);

  const kazandim = masa.sonuc?.tur === "kazanan" && masa.sonuc.koltuk === ben;
  useEffect(() => {
    if (kazandim && durum.ayarlar.ses) sesKazandin();
  }, [kazandim]);

  // ---------- Hamleler ----------
  const hamle = (m: Extract<IstemciMesaji, { t: "hamle" }>) => gonder(m);
  const cek = (kaynak: "orta" | "yan") => cekebilir && hamle({ t: "hamle", eylem: { tur: "cek", kaynak } });
  const at = (tas: number) => {
    if (!atabilir) return;
    hamle({ t: "hamle", eylem: { tur: "at", tas } });
    setSecili(null);
  };
  const bitir = () => secili !== null && hamle({ t: "hamle", eylem: { tur: "bitir", tas: secili } });
  const otomatikDiz = (tur: "seri" | "cift") => {
    setSecili(null);
    yuvalariDegistir(dizilisiYerlestir(diz(masa.el, masa.okey, tur, YUVA_SAYISI)));
  };
  const birakildi = useCallback(
    (tas: number) => {
      if (atabilir) {
        hamle({ t: "hamle", eylem: { tur: "at", tas } });
        setSecili(null);
      }
    },
    [atabilir],
  );

  // ---------- Pencereler ----------
  const [sohbetAcik, setSohbetAcik] = useState(false);
  const [cikisOnay, setCikisOnay] = useState(false);
  const [sonucKucuk, setSonucKucuk] = useState(false);
  useEffect(() => setSonucKucuk(false), [oda.elNo]);
  const ayril = () => gonder({ t: "odadanAyril" });

  const yanTas = masa.atilanlar[goreli(3)].at(-1);
  const okeyMetni = `${RENK_ADLARI[masa.okey.renk]} ${masa.okey.sayi}`;
  const benimKoltugum = oda.koltuklar[ben];
  const benimKartim =
    benimKoltugum.tur === "insan" ? benimKoltugum.oyuncu : { ad: "Sen", seviye: undefined, etiket: VARSAYILAN_ETIKET };

  let ipucu = "";
  if (bitti) ipucu = "El bitti";
  else if (cekebilir) ipucu = "Sıra sende: ortadan ya da yandan taş çek";
  else if (atabilir) ipucu = masa.el.length === 15 ? "Bir taş at — ya da seçip bitir" : "Bir taş at";
  else ipucu = `${koltukAdi(oda, masa.sira)} oynuyor…`;

  return (
    <div className={`ekran masa masa--${RENKLER[masa.okey.renk]}`}>
      <div className="masa__cuha" />

      {/* ---------- Üst şerit ---------- */}
      <div className="masa__ust">
        <div className="masa__ust-sol">
          <button className="simge-dugme simge-dugme--koyu" onClick={() => (bitti ? ayril() : setCikisOnay(true))} aria-label="Masadan kalk">
            <Simge ad="cikis" />
          </button>
          <div className="masa__bilgi">
            <span>{durum.antrenman ? "Antrenman" : `Oda ${oda.kod}`}</span>
            <small>
              {oda.elNo}. el {!durum.antrenman && oda.giris > 0 && <Cip miktar={oda.giris} kisa />}
            </small>
          </div>
        </div>
        <OyuncuYeri
          konum="ust"
          koltuk={oda.koltuklar[goreli(2)]}
          tasSayisi={masa.tasSayilari[goreli(2)]}
          siraBunda={!bitti && masa.sira === goreli(2)}
          kalanOran={kalanOran}
        />
        <div className="masa__ust-sag">
          {durum.profil && !durum.antrenman && <Cip miktar={durum.profil.cip} kisa />}
          <button
            className="simge-dugme simge-dugme--koyu"
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
      </div>

      {/* ---------- Orta: rakipler, yığınlar, deste ---------- */}
      <div className="masa__orta">
        <OyuncuYeri
          konum="sol"
          koltuk={oda.koltuklar[goreli(3)]}
          tasSayisi={masa.tasSayilari[goreli(3)]}
          siraBunda={!bitti && masa.sira === goreli(3)}
          kalanOran={kalanOran}
        />

        <div className="masa__merkez">
          <Yigin taslar={masa.atilanlar[goreli(2)]} okey={masa.okey} konum="sol-ust" />
          <div className="deste-alani">
            <button
              className={`deste ${cekebilir ? "deste--cekilebilir" : ""}`}
              onClick={() => cek("orta")}
              disabled={!cekebilir}
              aria-label="Ortadan çek"
            >
              <KapaliTas />
              <KapaliTas />
              <KapaliTas />
              <span className="deste__sayi">{masa.ortaSayisi}</span>
            </button>
            <div className="gosterge">
              <Tas id={masa.gosterge} boyut="orta" />
              <span>Gösterge</span>
            </div>
            <div className="okey-bilgi">
              Okey: <b className={`renk-${RENKLER[masa.okey.renk]}`}>{okeyMetni}</b>
            </div>
            {masa.gostergeGosterebilir && (
              <button className="dugme dugme--yesil dugme--kucuk gosterge-dugmesi" onClick={() => hamle({ t: "hamle", eylem: { tur: "gostergeGoster" } })}>
                Gösterge göster
              </button>
            )}
            {masa.gostergeGosteren !== null && (
              <span className="gosterge-not">{koltukAdi(oda, masa.gostergeGosteren)} göstergeyi gösterdi</span>
            )}
          </div>
          <Yigin taslar={masa.atilanlar[goreli(1)]} okey={masa.okey} konum="sag-ust" />
        </div>

        <OyuncuYeri
          konum="sag"
          koltuk={oda.koltuklar[goreli(1)]}
          tasSayisi={masa.tasSayilari[goreli(1)]}
          siraBunda={!bitti && masa.sira === goreli(1)}
          kalanOran={kalanOran}
        />
      </div>

      <div className={`masa__ipucu ${benimSiram ? "masa__ipucu--ben" : ""}`}>
        {ipucu}
        {benimSiram && kalanSn !== null && <b> · {kalanSn} sn</b>}
      </div>

      {/* ---------- Alt: yan taş, istaka, atma alanı ---------- */}
      <div className="masa__alt">
        <div className="masa__alt-sol">
          <button
            className={`yan-tas ${cekebilir && yanTas !== undefined ? "yan-tas--cekilebilir" : ""}`}
            onClick={() => cek("yan")}
            disabled={!cekebilir || yanTas === undefined}
            aria-label="Yandan çek"
          >
            {yanTas !== undefined ? <Tas key={yanTas} id={yanTas} okey={masa.okey} boyut="orta" /> : <span className="bos-yer" />}
            <small>Yan</small>
          </button>
          <div className="dizme-dugmeleri">
            <button className="dugme dugme--ikincil dugme--mini" onClick={() => otomatikDiz("seri")}>
              Seri Diz
            </button>
            <button className="dugme dugme--ikincil dugme--mini" onClick={() => otomatikDiz("cift")}>
              Çift Diz
            </button>
          </div>
        </div>

        <div className="masa__istaka">
          <div className="benim-etiketim">
            <IsimEtiketi ad={benimKartim.ad} seviye={benimKartim.seviye} etiket={benimKartim.etiket} boyut="kucuk" />
            {benimSiram && kalanOran !== null && (
              <div className="geri-sayim geri-sayim--ben">
                <div className="geri-sayim__dolu" style={{ transform: `scaleX(${kalanOran})` }} />
              </div>
            )}
          </div>
          <Istaka
            yuvalar={yuvalar}
            okey={masa.okey}
            secili={secili}
            yeniler={yeniler}
            sirada={benimSiram}
            degistir={yuvalariDegistir}
            sec={setSecili}
            birakildi={birakildi}
          />
        </div>

        <div className="masa__alt-sag">
          <div className={`atma-alani ${atabilir ? "atma-alani--aktif" : ""}`} data-birak="at">
            {masa.atilanlar[ben].length > 0 ? (
              <Tas key={masa.atilanlar[ben].at(-1)} id={masa.atilanlar[ben].at(-1)!} okey={masa.okey} boyut="orta" />
            ) : (
              <span className="bos-yer" />
            )}
            <small>{atabilir ? "Buraya at" : "Attığın"}</small>
          </div>
          <div className="dizme-dugmeleri">
            <button className="dugme dugme--birincil dugme--mini" disabled={!atabilir || secili === null} onClick={() => secili !== null && at(secili)}>
              At
            </button>
            <button
              className="dugme dugme--yesil dugme--mini"
              disabled={!atabilir || secili === null || masa.el.length !== 15}
              onClick={bitir}
            >
              Bitir
            </button>
          </div>
        </div>
      </div>

      {/* ---------- Pencereler ---------- */}
      {bitti && oda.sonEl && !sonucKucuk && (
        <SonucPenceresi oda={oda} okey={masa.okey} antrenman={durum.antrenman} kucult={() => setSonucKucuk(true)} ayril={ayril} />
      )}
      {bitti && sonucKucuk && (
        <button className="dugme dugme--birincil sonuc-geri" onClick={() => setSonucKucuk(false)}>
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
        <Pencere baslik="Masadan kalkılsın mı?" kapat={() => setCikisOnay(false)}>
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

/** Bir oyuncunun attığı taşlar: en üstteki görünür, altında birkaç taşın kenarı. */
function Yigin({ taslar, okey, konum }: { taslar: number[]; okey: Deger; konum: string }) {
  const ust = taslar.at(-1);
  return (
    <div className={`yigin yigin--${konum}`}>
      {taslar.length > 1 && <div className="yigin__alt" />}
      {ust !== undefined ? <Tas key={ust} id={ust} okey={okey} boyut="orta" /> : <span className="bos-yer" />}
    </div>
  );
}
