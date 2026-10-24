// El sonu penceresi: kazananın perleri (taşlar sırayla çevrilerek açılır), herkesin
// çip değişimi (sayarak akar), kazanılan XP ve sonraki ele geri sayım halkası.
// Kazanan bensem büyük "KAZANDIN!" (okey atarak bitirdiysem "OKEY!") yazısı, konfeti
// ve çip yağmuru; kaybettiysem sakin ama şık bir özet.
import type { BitisTuru, Deger, OdaGorunumu } from "@okey/kurallar";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { CipSimgesi } from "../../bilesenler/Simge.tsx";
import { Tas } from "../../bilesenler/Tas.tsx";
import { efektlerAcik } from "../../efektler/ayar.ts";
import { kutlama } from "../../efektler/kutlama.ts";
import { SayiSayaci } from "../../efektler/SayiSayaci.tsx";
import { useGeriTusu } from "../../platform/geriTusu.ts";
import { cipDegisimiBicim } from "../../yardimci/bicim.ts";
import { useSimdi } from "../../yardimci/kancalar.ts";
import { koltukAdi } from "../../yardimci/oda.ts";
import { halkaRengi, Madalyon } from "./Madalyon.tsx";

const BITIS_METNI: Record<BitisTuru, string> = {
  normal: "Eli bitirdi",
  cift: "Çift bitirdi!",
  okeyAtarak: "Okey atarak bitirdi!",
  ciftOkeyAtarak: "Çift ve okey atarak bitirdi!",
};

/** Perlerdeki her taşın açılma aralığı (ms). */
const TAS_ARALIK = 55;

interface Ozellikler {
  oda: OdaGorunumu;
  okey: Deger;
  antrenman: boolean;
  kucult: () => void;
  ayril: () => void;
}

export function SonucPenceresi({ oda, okey, antrenman, kucult, ayril }: Ozellikler) {
  const ozet = oda.sonEl!;
  const s = ozet.sonuc;
  const ben = oda.benimKoltugum ?? 0;
  const simdi = useSimdi(250);
  const kazandim = s.tur === "kazanan" && s.koltuk === ben;
  const okeyle = s.tur === "kazanan" && (s.bitis === "okeyAtarak" || s.bitis === "ciftOkeyAtarak");
  useGeriTusu(kucult);

  // Sonraki ele geri sayım: toplam süre pencerenin açıldığı andan ölçülür.
  const acilis = useRef(Date.now());
  const toplamMs = ozet.sonrakiEl ? Math.max(1, ozet.sonrakiEl - acilis.current) : 1;
  const kalanMs = ozet.sonrakiEl ? Math.max(0, ozet.sonrakiEl - simdi) : null;
  const kalan = kalanMs === null ? null : Math.ceil(kalanMs / 1000);
  const oran = kalanMs === null ? 0 : Math.min(1, kalanMs / toplamMs);

  // Perler açıldıktan sonra çipler sayarak akar.
  const tasSayisi = s.tur === "kazanan" ? s.perler.reduce((n, p) => n + p.length, 0) + 1 : 0;
  const efekt = efektlerAcik();
  const [say, setSay] = useState(!efekt);
  useEffect(() => {
    if (!efekt) return;
    const z = setTimeout(() => setSay(true), 500 + tasSayisi * TAS_ARALIK);
    return () => clearTimeout(z);
  }, []);

  // Kutlama: konfeti, biraz sonra çip yağmuru.
  const baslik = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!kazandim) return;
    const kaynak = baslik.current?.getBoundingClientRect();
    void kutlama("konfeti", { kaynak });
    const z = setTimeout(() => void kutlama("cipYagmuru"), 650);
    return () => clearTimeout(z);
  }, [kazandim]);

  let tasNo = 0;
  const sonrakiTas = () => ({ "--t": tasNo++ } as CSSProperties);

  return (
    <div className="pencere-arka sonuc-arka">
      <div className={`sonuc ${kazandim ? "sonuc--kazandim" : "sonuc--kaybettim"}`} onClick={(e) => e.stopPropagation()}>
        {kazandim && <div className="sonuc__isinlar" aria-hidden />}
        <div className="sonuc__ust">
          {s.tur === "kazanan" ? (
            kazandim ? (
              <>
                <h2 ref={baslik} className="sonuc__dev" aria-label={okeyle ? "OKEY!" : "KAZANDIN!"}>
                  {[...(okeyle ? "OKEY!" : "KAZANDIN!")].map((h, i) => (
                    <span key={i} style={{ "--h": i } as CSSProperties}>
                      {h}
                    </span>
                  ))}
                </h2>
                <span className="sonuc__bitis">{BITIS_METNI[s.bitis]}</span>
              </>
            ) : (
              <>
                <h2 className="sonuc__baslik">{koltukAdi(oda, s.koltuk)} kazandı</h2>
                <span className="sonuc__bitis sonuc__bitis--sakin">{BITIS_METNI[s.bitis]}</span>
              </>
            )
          ) : (
            <h2 className="sonuc__baslik">Ortada taş kalmadı — el berabere</h2>
          )}
        </div>

        {s.tur === "kazanan" && (
          <div className="sonuc__perler">
            {s.perler.map((per, i) => (
              <div key={i} className="per">
                {per.map((t) => (
                  <div key={t} className="per__tas" style={sonrakiTas()}>
                    <Tas id={t} okey={okey} boyut="kucuk" />
                  </div>
                ))}
              </div>
            ))}
            <div className="per per--atilan">
              <div className="per__tas" style={sonrakiTas()}>
                <Tas id={s.atilan} okey={okey} boyut="kucuk" />
              </div>
              <small>{okeyle ? "okey attı" : "attığı"}</small>
            </div>
          </div>
        )}

        <div className="sonuc__tablo">
          {oda.koltuklar.map((kol, k) => {
            const degisim = ozet.cipDegisimi[k];
            const kazanan = s.tur === "kazanan" && s.koltuk === k;
            const ad = koltukAdi(oda, k);
            return (
              <div
                key={k}
                className={`sonuc__oyuncu ${k === ben ? "ben" : ""} ${kazanan ? "kazanan" : ""}`}
                style={{ "--o": k } as CSSProperties}
              >
                <Madalyon ad={ad} bot={kol.tur === "bot"} oran={null} boyut="kucuk" />
                <div className="sonuc__oyuncu-bilgi">
                  <span className="sonuc__ad">
                    {kazanan && <i className="sonuc__tac" aria-label="kazanan" />}
                    {ad}
                  </span>
                  <span className="sonuc__satir">
                    {!antrenman && (
                      <span className={`cip ${degisim > 0 ? "arti" : degisim < 0 ? "eksi" : ""}`}>
                        <CipSimgesi boyut={13} />
                        <SayiSayaci deger={say ? degisim : 0} bicim={(n) => cipDegisimiBicim(Math.round(n))} />
                      </span>
                    )}
                    {ozet.xp[k] > 0 && (
                      <span className="xp">
                        +<SayiSayaci deger={say ? ozet.xp[k] : 0} /> XP
                      </span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {antrenman && <p className="sonuc__not">Antrenmanda çip ve XP yoktur.</p>}

        <div className="sonuc__alt">
          <div className="sonuc__sayac">
            {kalan !== null && (
              <>
                <div className="sonuc__halka" style={{ "--oran": oran, "--halka-renk": halkaRengi(Math.max(oran, 0.6)) } as CSSProperties}>
                  <b>{kalan}</b>
                </div>
                <span>Sonraki el</span>
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
