// Masadaki sohbet: sağdan açılan panel, hazır hızlı mesajlar ve serbest yazı.
import type { SohbetMesaji } from "@okey/kurallar";
import { useEffect, useRef, useState } from "react";
import { Simge } from "../../bilesenler/Simge.tsx";

const HIZLI_MESAJLAR = ["Kolay gelsin", "Hadi bakalım", "Eyvallah", "Tebrikler", "Şansına küs", "Bir çay alır mısın?"];

interface Ozellikler {
  mesajlar: SohbetMesaji[];
  benimKoltugum: number | null;
  gonder: (metin: string) => void;
  kapat: () => void;
}

export function SohbetPaneli({ mesajlar, benimKoltugum, gonder, kapat }: Ozellikler) {
  const [metin, setMetin] = useState("");
  const liste = useRef<HTMLDivElement>(null);
  useEffect(() => {
    liste.current?.scrollTo({ top: liste.current.scrollHeight });
  }, [mesajlar.length]);

  const yolla = (m: string) => {
    const t = m.trim();
    if (!t) return;
    gonder(t.slice(0, 120));
    setMetin("");
  };

  return (
    <div className="sohbet-arka" onClick={kapat}>
      <aside className="sohbet" onClick={(e) => e.stopPropagation()}>
        <div className="sohbet__ust">
          <b>Sohbet</b>
          <button className="simge-dugme" onClick={kapat} aria-label="Kapat">
            <Simge ad="kapat" />
          </button>
        </div>
        <div className="sohbet__liste" ref={liste}>
          {mesajlar.length === 0 && <p className="soluk">Henüz mesaj yok. Masaya selam ver!</p>}
          {mesajlar.map((m, i) =>
            m.koltuk === -1 ? (
              <p key={i} className="sohbet__sistem">{m.metin}</p>
            ) : (
              <p key={i} className={`sohbet__mesaj ${m.koltuk === benimKoltugum ? "sohbet__mesaj--ben" : ""}`}>
                <b>{m.ad}</b> {m.metin}
              </p>
            ),
          )}
        </div>
        <div className="sohbet__hizli">
          {HIZLI_MESAJLAR.map((h) => (
            <button key={h} className="cip-dugme" onClick={() => yolla(h)}>
              {h}
            </button>
          ))}
        </div>
        <form
          className="sohbet__yaz"
          onSubmit={(e) => {
            e.preventDefault();
            yolla(metin);
          }}
        >
          <input className="girdi girdi--kucuk" value={metin} maxLength={120} placeholder="Mesaj yaz…" onChange={(e) => setMetin(e.target.value)} />
          <button className="simge-dugme simge-dugme--altin" type="submit" aria-label="Gönder">
            <Simge ad="gonder" />
          </button>
        </form>
      </aside>
    </div>
  );
}
