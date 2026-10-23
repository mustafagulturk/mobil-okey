// El sonu penceresi: kazananın perleri, herkesin çip değişimi, kazanılan XP ve sonraki ele geri sayım.
import type { BitisTuru, Deger, OdaGorunumu } from "@okey/kurallar";
import { CipSimgesi } from "../../bilesenler/Simge.tsx";
import { Tas } from "../../bilesenler/Tas.tsx";
import { useSimdi } from "../../yardimci/kancalar.ts";
import { cipDegisimiBicim } from "../../yardimci/bicim.ts";
import { koltukAdi } from "../../yardimci/oda.ts";

const BITIS_METNI: Record<BitisTuru, string> = {
  normal: "Eli bitirdi",
  cift: "Çift bitirdi!",
  okeyAtarak: "Okey atarak bitirdi!",
  ciftOkeyAtarak: "Çift ve okey atarak bitirdi!",
};

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
  const simdi = useSimdi(500);
  const kalan = ozet.sonrakiEl ? Math.max(0, Math.ceil((ozet.sonrakiEl - simdi) / 1000)) : null;
  const kazandim = s.tur === "kazanan" && s.koltuk === ben;

  return (
    <div className="pencere-arka">
      <div className={`pencere pencere--genis sonuc ${kazandim ? "sonuc--kazandim" : ""}`}>
        <div className="sonuc__ust">
          {s.tur === "kazanan" ? (
            <>
              <h2>{kazandim ? "Tebrikler, kazandın!" : `${koltukAdi(oda, s.koltuk)} kazandı`}</h2>
              <span className="sonuc__bitis">{BITIS_METNI[s.bitis]}</span>
            </>
          ) : (
            <h2>Ortada taş kalmadı — el berabere</h2>
          )}
        </div>

        {s.tur === "kazanan" && (
          <div className="sonuc__perler">
            {s.perler.map((per, i) => (
              <div key={i} className="per">
                {per.map((t) => (
                  <Tas key={t} id={t} okey={okey} boyut="kucuk" />
                ))}
              </div>
            ))}
            <div className="per per--atilan">
              <Tas id={s.atilan} okey={okey} boyut="kucuk" />
              <small>attığı</small>
            </div>
          </div>
        )}

        <div className="sonuc__tablo">
          {oda.koltuklar.map((_, k) => {
            const degisim = ozet.cipDegisimi[k];
            const kazanan = s.tur === "kazanan" && s.koltuk === k;
            return (
              <div key={k} className={`sonuc__oyuncu ${k === ben ? "ben" : ""} ${kazanan ? "kazanan" : ""}`}>
                <span>
                  {kazanan && "🏆 "}
                  {koltukAdi(oda, k)}
                </span>
                {!antrenman && (
                  <span className={`cip ${degisim > 0 ? "arti" : degisim < 0 ? "eksi" : ""}`}>
                    <CipSimgesi boyut={14} />
                    {cipDegisimiBicim(degisim)}
                  </span>
                )}
                {ozet.xp[k] > 0 && <span className="xp">+{ozet.xp[k]} XP</span>}
              </div>
            );
          })}
        </div>
        {antrenman && <p className="not">Antrenmanda çip ve XP yoktur.</p>}

        <div className="sonuc__alt">
          <span className="soluk">{kalan !== null ? `Sonraki el ${kalan} sn içinde` : ""}</span>
          <div className="satir">
            <button className="dugme dugme--ikincil dugme--kucuk" onClick={kucult}>
              Masayı gör
            </button>
            <button className="dugme dugme--ikincil dugme--kucuk" onClick={ayril}>
              Masadan kalk
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
