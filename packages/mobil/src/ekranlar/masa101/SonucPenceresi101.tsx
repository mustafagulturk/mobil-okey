// 101 el sonu ve maç sonu penceresi. Okey'in sonuç penceresiyle aynı kalıbı (cam kart, dev
// altın harfler, ışık huzmeleri, konfeti ve çip yağmuru, geri sayım halkası) kullanır; içerik
// 101'e göredir:
//  - Başlık: eli kim bitirdi, okeyle mi elden mi (puanlar ikiye katlanır), ya da orta bitti.
//  - Tablo: her oyuncunun el el puanları; bu elin sütunu ve toplam sayarak akar.
//  - Maç sonu (4. el): kazanan(lar) taçla, çip değişimi ve XP; "Yeni maç" geri sayımı.
import type { ElSonucu101, MacDurumu, OdaGorunumu } from "@okey/kurallar";
import { type CSSProperties, Fragment, type RefObject, useEffect, useRef, useState } from "react";
import { CipSimgesi } from "../../bilesenler/Simge.tsx";
import { efektlerAcik } from "../../efektler/ayar.ts";
import { kutlama } from "../../efektler/kutlama.ts";
import { SayiSayaci } from "../../efektler/SayiSayaci.tsx";
import { useGeriTusu } from "../../platform/geriTusu.ts";
import { cipDegisimiBicim } from "../../yardimci/bicim.ts";
import { useSimdi } from "../../yardimci/kancalar.ts";
import { koltukAdi } from "../../yardimci/oda.ts";
import { halkaRengi, Madalyon } from "../masa/Madalyon.tsx";
import { puanBicim } from "./PuanTablosu.tsx";

interface Ozellikler {
  oda: OdaGorunumu;
  sonuc: ElSonucu101;
  mac: MacDurumu;
  antrenman: boolean;
  kucult: () => void;
  ayril: () => void;
}

/** Dev harflerle yazılan başlık (harfler sırayla zıplar). */
function DevBaslik({ metin, baslik }: { metin: string; baslik: RefObject<HTMLHeadingElement> }) {
  return (
    <h2 ref={baslik} className="sonuc__dev" aria-label={metin}>
      {[...metin].map((h, i) => (
        <span key={i} style={{ "--h": i } as CSSProperties}>
          {h === " " ? " " : h}
        </span>
      ))}
    </h2>
  );
}

export function SonucPenceresi101({ oda, sonuc: s, mac, antrenman, kucult, ayril }: Ozellikler) {
  const ozet = oda.sonEl!;
  const ben = oda.benimKoltugum ?? 0;
  const macBitti = ozet.macBitti;
  const bitiren = s.tur === "bitti" ? s.koltuk : null;
  const macKazandim = macBitti && (mac.kazananlar ?? []).includes(ben);
  const eliBitirdim = bitiren === ben;
  const kutla = macKazandim || (!macBitti && eliBitirdim);
  useGeriTusu(kucult);

  // Sonraki ele (ya da yeni maça) geri sayım: toplam süre pencerenin açıldığı andan ölçülür.
  const simdi = useSimdi(250);
  const acilis = useRef(Date.now());
  const toplamMs = ozet.sonrakiEl ? Math.max(1, ozet.sonrakiEl - acilis.current) : 1;
  const kalanMs = ozet.sonrakiEl ? Math.max(0, ozet.sonrakiEl - simdi) : null;
  const kalan = kalanMs === null ? null : Math.ceil(kalanMs / 1000);
  const oran = kalanMs === null ? 0 : Math.min(1, kalanMs / toplamMs);

  // Bu elin puanları ve toplam, pencere açıldıktan kısa süre sonra sayarak akar.
  const efekt = efektlerAcik();
  const [say, setSay] = useState(!efekt);
  useEffect(() => {
    if (!efekt) return;
    const z = setTimeout(() => setSay(true), 650);
    return () => clearTimeout(z);
  }, []);

  const baslik = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!kutla) return;
    void kutlama("konfeti", { kaynak: baslik.current?.getBoundingClientRect() });
    if (!macKazandim) return;
    const z = setTimeout(() => void kutlama("cipYagmuru"), 650);
    return () => clearTimeout(z);
  }, [kutla]);

  // Tablo: mac.puanlar bu eli de içerir (oda eli bitirince yazar). Bu elin sütunu = son satır.
  const elIndeksi = mac.puanlar.length - 1;
  const oncekiToplam = mac.toplam.map((t, k) => t - (mac.puanlar[elIndeksi]?.[k] ?? 0));
  const sira = [0, 1, 2, 3].map((r) => (ben + r) % 4);
  const kazananlar = new Set(macBitti ? (mac.kazananlar ?? []) : []);
  const bitisNotu =
    s.tur === "orta"
      ? "Ortada taş kalmadı, el kapandı"
      : [s.okeyle && "Okeyle bitirdi", s.elden && "Elden bitirdi"].filter(Boolean).join(" · ") + (s.okeyle || s.elden ? " · puanlar ×2" : "");

  let ust;
  if (macBitti) {
    const adlar = [...kazananlar].map((k) => (k === ben ? "Sen" : koltukAdi(oda, k)));
    ust = macKazandim ? (
      <>
        <DevBaslik metin={kazananlar.size > 1 ? "BERABERE!" : "MAÇI KAZANDIN!"} baslik={baslik} />
        <span className="sonuc__bitis">
          {mac.elSayisi} elde toplam {puanBicim(mac.toplam[ben])} puan{kazananlar.size > 1 ? ` · ${adlar.join(", ")}` : ""}
        </span>
      </>
    ) : (
      <>
        <h2 className="sonuc__baslik">{adlar.join(", ")} maçı kazandı</h2>
        <span className="sonuc__bitis sonuc__bitis--sakin">Maç bitti · {mac.elSayisi} el</span>
      </>
    );
  } else if (s.tur === "bitti") {
    ust = eliBitirdim ? (
      <>
        <DevBaslik metin={s.okeyle ? "OKEYLE BİTTİ!" : s.elden ? "ELDEN BİTTİ!" : "ELİ BİTİRDİN!"} baslik={baslik} />
        <span className="sonuc__bitis">{bitisNotu || `${mac.elNo}. el senin`}</span>
      </>
    ) : (
      <>
        <h2 className="sonuc__baslik">{koltukAdi(oda, s.koltuk)} eli bitirdi</h2>
        <span className="sonuc__bitis sonuc__bitis--sakin">{bitisNotu || `${mac.elNo}. el bitti`}</span>
      </>
    );
  } else {
    ust = (
      <>
        <h2 className="sonuc__baslik">El kapandı</h2>
        <span className="sonuc__bitis sonuc__bitis--sakin">{bitisNotu}</span>
      </>
    );
  }

  const cipVar = macBitti && !antrenman;
  const sutunlar = `minmax(0, 1.6fr) repeat(${mac.elSayisi}, minmax(0, 0.7fr)) minmax(0, 0.9fr)${cipVar ? " minmax(0, 1.1fr)" : ""}`;

  return (
    <div className="pencere-arka sonuc-arka">
      <div className={`sonuc sonuc101 ${kutla ? "sonuc--kazandim" : "sonuc--kaybettim"}`} onClick={(e) => e.stopPropagation()}>
        {kutla && <div className="sonuc__isinlar" aria-hidden />}
        <div className="sonuc__ust">{ust}</div>

        <div className="sonuc101__tablo" style={{ gridTemplateColumns: sutunlar }}>
          <span className="sonuc101__baslik" />
          {Array.from({ length: mac.elSayisi }, (_, e) => (
            <span key={e} className={`sonuc101__baslik ${e === elIndeksi ? "simdiki" : ""}`}>
              {e + 1}. el
            </span>
          ))}
          <span className="sonuc101__baslik">Toplam</span>
          {cipVar && <span className="sonuc101__baslik">Çip</span>}

          {sira.map((k, i) => {
            const kol = oda.koltuklar[k];
            const ad = koltukAdi(oda, k);
            const kazanan = kazananlar.has(k);
            const bitirdi = bitiren === k;
            const degisim = ozet.cipDegisimi[k];
            return (
              <Fragment key={k}>
                <div className={`sonuc101__oyuncu ${k === ben ? "ben" : ""} ${kazanan ? "kazanan" : ""}`} style={{ "--o": i } as CSSProperties}>
                  <Madalyon ad={ad} bot={kol.tur === "bot"} oran={null} boyut="kucuk" />
                  <span className="sonuc__ad">
                    {kazanan && <i className="sonuc__tac" aria-label="kazanan" />}
                    {k === ben ? "Sen" : ad}
                  </span>
                  {bitirdi && <small className="sonuc101__bitirdi">bitirdi</small>}
                </div>
                {Array.from({ length: mac.elSayisi }, (_, e) => {
                  const p = mac.puanlar[e]?.[k];
                  const simdiki = e === elIndeksi;
                  return (
                    <span key={e} className={`sonuc101__hucre ${simdiki ? "simdiki" : ""} ${p !== undefined && p < 0 ? "eksi-puan" : ""}`}>
                      {p === undefined ? "—" : simdiki ? <SayiSayaci deger={say ? p : 0} bicim={(n) => puanBicim(Math.round(n))} /> : puanBicim(p)}
                    </span>
                  );
                })}
                <span className={`sonuc101__hucre toplam ${kazanan ? "lider" : ""}`}>
                  <SayiSayaci deger={say ? mac.toplam[k] : oncekiToplam[k]} bicim={(n) => puanBicim(Math.round(n))} />
                </span>
                {cipVar && (
                  <span className={`sonuc101__hucre cip ${degisim > 0 ? "arti" : degisim < 0 ? "eksi" : ""}`}>
                    <CipSimgesi boyut={12} />
                    <SayiSayaci deger={say ? degisim : 0} bicim={(n) => cipDegisimiBicim(Math.round(n))} />
                    {ozet.xp[k] > 0 && <small className="xp">+{ozet.xp[k]} XP</small>}
                  </span>
                )}
              </Fragment>
            );
          })}
        </div>
        {macBitti && antrenman && <p className="sonuc__not">Antrenmanda çip ve XP yoktur.</p>}
        {!macBitti && <p className="sonuc__not">Puan cezadır: {mac.elSayisi} elin sonunda en düşük toplam kazanır.</p>}

        <div className="sonuc__alt">
          <div className="sonuc__sayac">
            {kalan !== null && (
              <>
                <div className="sonuc__halka" style={{ "--oran": oran, "--halka-renk": halkaRengi(Math.max(oran, 0.6)) } as CSSProperties}>
                  <b>{kalan}</b>
                </div>
                <span>{macBitti ? "Yeni maç" : `${mac.elNo + 1}. el`}</span>
              </>
            )}
          </div>
          <div className="sonuc__dugmeler">
            <button className="masa-dugme" onClick={kucult}>
              Masayı gör
            </button>
            <button className="masa-dugme" onClick={ayril}>
              Masadan kalk
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
