// 101 puan tablosu: masanın sol üstünden açılan küçük cam panel. Maçın her eli bir satır
// (biten eller puanlarıyla, oynanan el o ana kadarki cezalarıyla, gelecek eller boş), en
// altta toplam. 101'de puan cezadır: en düşük toplam önde, onun sütunu altınla vurgulanır.
import type { MacDurumu, OdaGorunumu } from "@okey/kurallar";
import { Fragment } from "react";
import { Simge } from "../../bilesenler/Simge.tsx";
import { useGeriTusu } from "../../platform/geriTusu.ts";
import { koltukAdi } from "../../yardimci/oda.ts";

interface Ozellikler {
  oda: OdaGorunumu;
  mac: MacDurumu;
  /** Oynanan elin şimdiye kadarki cezaları (koltuk başına). */
  cezalar: number[];
  kapat: () => void;
}

/** Puanı tabloda yaz: eksiler "−101", artılar işaretsiz. */
export const puanBicim = (n: number) => (n < 0 ? `−${-n}` : String(n));

export function PuanTablosu({ oda, mac, cezalar, kapat }: Ozellikler) {
  useGeriTusu(kapat);
  const ben = oda.benimKoltugum ?? 0;
  // Sütunlar benden başlayıp oyun yönünde (sağ, üst, sol).
  const sira = [0, 1, 2, 3].map((r) => (ben + r) % 4);
  const enDusuk = Math.min(...mac.toplam);
  const lider = mac.puanlar.length > 0 ? mac.toplam.map((t) => t === enDusuk) : [false, false, false, false];
  const elBitti = mac.puanlar.length >= mac.elNo;

  return (
    <div className="puan-arka" onClick={kapat}>
      <section className="puan-tablosu" onClick={(e) => e.stopPropagation()} aria-label="Puan tablosu">
        <header className="puan-tablosu__ust">
          <b>Puan tablosu</b>
          <span>
            El {mac.elNo}/{mac.elSayisi}
          </span>
          <button className="simge-dugme" onClick={kapat} aria-label="Kapat">
            <Simge ad="kapat" boyut={16} />
          </button>
        </header>
        <div className="puan-tablosu__izgara" style={{ gridTemplateColumns: `auto repeat(4, minmax(0, 1fr))` }}>
          <span />
          {sira.map((k) => (
            <span key={k} className={`puan-tablosu__ad ${k === ben ? "ben" : ""} ${lider[k] ? "lider" : ""}`}>
              {k === ben ? "Sen" : koltukAdi(oda, k)}
            </span>
          ))}
          {Array.from({ length: mac.elSayisi }, (_, e) => {
            const satir = mac.puanlar[e];
            const simdiki = !satir && e === mac.elNo - 1 && !elBitti;
            return (
              <Fragment key={e}>
                <span className={`puan-tablosu__el ${simdiki ? "simdiki" : ""}`}>{e + 1}. el</span>
                {sira.map((k) => (
                  <span key={k} className={`puan-tablosu__hucre ${simdiki ? "simdiki" : ""} ${satir && satir[k] < 0 ? "eksi" : ""}`}>
                    {satir ? puanBicim(satir[k]) : simdiki ? (cezalar[k] !== 0 ? <i className="ceza">{puanBicim(cezalar[k])}</i> : "…") : "—"}
                  </span>
                ))}
              </Fragment>
            );
          })}
          <span className="puan-tablosu__el toplam">Toplam</span>
          {sira.map((k) => (
            <span key={k} className={`puan-tablosu__hucre toplam ${lider[k] ? "lider" : ""}`}>
              {puanBicim(mac.toplam[k])}
            </span>
          ))}
        </div>
        <p className="puan-tablosu__not">Puan cezadır: maç sonunda en düşük toplam kazanır.</p>
      </section>
    </div>
  );
}
