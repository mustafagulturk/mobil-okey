// Günlük görevler: metalik ilerleme çubuğu, tamamlananlar için parlayan "Ödülü al",
// alınınca çip yağmuru. Görevler Türkiye saatiyle gece yarısı yenilenir (geri sayım).
import type { GorevDurumu } from "@okey/kurallar";
import { useEffect, useState } from "react";
import { Cip } from "../bilesenler/Ortak.tsx";
import { Simge, type SimgeAdi } from "../bilesenler/Simge.tsx";
import { useOyun } from "../durum/OyunSaglayici.tsx";
import { kutlama } from "../efektler/kutlama.ts";
import { cipBicim } from "../yardimci/bicim.ts";
import { AltUstCubuk, EkSimge, sira } from "./alt/ortak.tsx";

/** Bir sonraki Türkiye gece yarısına (UTC 21:00) kalan süre, ms. */
function yenilenmeyeKalan(simdi = Date.now()): number {
  const tr = simdi + 3 * 3600_000;
  const gun = 24 * 3600_000;
  return gun - (tr % gun);
}

function saatBicim(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const iki = (n: number) => String(n).padStart(2, "0");
  return `${iki(Math.floor(s / 3600))}:${iki(Math.floor((s % 3600) / 60))}:${iki(s % 60)}`;
}

function GeriSayim() {
  const [kalan, setKalan] = useState(yenilenmeyeKalan);
  useEffect(() => {
    const z = setInterval(() => setKalan(yenilenmeyeKalan()), 1000);
    return () => clearInterval(z);
  }, []);
  return (
    <span className="yenilenme-sayaci" title="Görevler gece yarısı yenilenir">
      <EkSimge ad="saat" boyut={15} />
      <span className="yenilenme-sayaci__yazi">Yenilenme</span>
      <b>{saatBicim(kalan)}</b>
    </span>
  );
}

function gorevSimgesi(id: string): SimgeAdi {
  if (id.startsWith("kazan")) return "kupa";
  if (id.startsWith("cift")) return "kalp";
  if (id.startsWith("okey")) return "anahtar";
  if (id.startsWith("gosterge")) return "bilgi";
  return "oyna";
}

export function Gorevler() {
  const { durum, gonder, ekranaGit } = useOyun();
  useEffect(() => gonder({ t: "gorevler" }), [gonder]);
  const liste = durum.gorevler;
  /** Bu ekranda ödülü istenmiş görevler (sunucu cevabı gelene kadar düğme tekrar basılmasın). */
  const [istenen, setIstenen] = useState<Set<string>>(new Set());

  const odulAl = (g: GorevDurumu, dugme: HTMLElement) => {
    setIstenen((s) => new Set(s).add(g.id));
    gonder({ t: "gorevOdulu", gorevId: g.id });
    void kutlama("cipYagmuru", { kaynak: dugme.getBoundingClientRect(), miktar: 60 });
  };

  const biten = liste?.filter((g) => g.ilerleme >= g.hedef).length ?? 0;
  const toplamCip = liste?.reduce((t, g) => t + g.odulCip, 0) ?? 0;

  return (
    <div className="ekran alt-ekran gorevler">
      <AltUstCubuk baslik="Günlük görevler" alt={liste ? `${biten}/${liste.length} tamamlandı · toplam ${cipBicim(toplamCip)} çip` : undefined}
        geri={() => ekranaGit("lobi")} sag={<GeriSayim />} />
      <div className="gorev-listesi">
        {!liste && <div className="donen" />}
        {liste?.map((g, i) => {
          const bitti = g.ilerleme >= g.hedef;
          const alindi = g.alindi || istenen.has(g.id);
          const hazir = bitti && !alindi;
          const oran = Math.min(1, g.ilerleme / g.hedef);
          return (
            <div
              key={g.id}
              className={`gorev alt-giris ${alindi ? "gorev--alindi" : ""} ${hazir ? "gorev--hazir" : ""}`}
              style={sira(i + 1)}
            >
              <span className="gorev__simge" aria-hidden>
                {alindi ? <EkSimge ad="tik" boyut={22} /> : <Simge ad={gorevSimgesi(g.id)} boyut={22} />}
              </span>
              <div className="gorev__metin">
                <b>{g.metin}</b>
                <div className="metal-cubuk gorev__cubuk">
                  <div className={`metal-cubuk__dolu ${bitti ? "metal-cubuk__dolu--tam" : ""}`} style={{ width: `${oran * 100}%` }} />
                </div>
                <small>
                  {Math.min(g.ilerleme, g.hedef)} / {g.hedef}
                  {bitti && !alindi && <span className="gorev__tamam"> · Tamamlandı!</span>}
                </small>
              </div>
              <div className="gorev__odul">
                <Cip miktar={g.odulCip} />
                <small>+{g.odulXp} XP</small>
              </div>
              <button
                className={`gorev__dugme ${hazir ? "gorev__dugme--hazir" : ""}`}
                disabled={!hazir}
                onClick={(e) => odulAl(g, e.currentTarget)}
              >
                {alindi ? (
                  <>
                    <EkSimge ad="tik" boyut={15} /> Alındı
                  </>
                ) : bitti ? (
                  "Ödülü Al"
                ) : (
                  `%${Math.round(oran * 100)}`
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
