// Günlük görevler: ilerleme çubuğu ve tamamlananlar için "Ödülü al".
import { useEffect } from "react";
import { Cip, EkranBasligi } from "../bilesenler/Ortak.tsx";
import { useOyun } from "../durum/OyunSaglayici.tsx";

export function Gorevler() {
  const { durum, gonder, ekranaGit } = useOyun();
  useEffect(() => gonder({ t: "gorevler" }), [gonder]);
  const liste = durum.gorevler;

  return (
    <div className="ekran alt-ekran gorevler">
      <EkranBasligi baslik="Günlük görevler" geri={() => ekranaGit("lobi")} sag={<span className="soluk">Gece yarısı yenilenir</span>} />
      <div className="gorev-listesi">
        {!liste && <div className="donen" />}
        {liste?.map((g) => {
          const bitti = g.ilerleme >= g.hedef;
          return (
            <div key={g.id} className={`kart gorev ${g.alindi ? "gorev--alindi" : ""}`}>
              <div className="gorev__metin">
                <b>{g.metin}</b>
                <div className="gorev__cubuk">
                  <div style={{ width: `${Math.min(100, (g.ilerleme / g.hedef) * 100)}%` }} />
                </div>
                <small>
                  {Math.min(g.ilerleme, g.hedef)} / {g.hedef}
                </small>
              </div>
              <div className="gorev__odul">
                <Cip miktar={g.odulCip} />
                <small>+{g.odulXp} XP</small>
              </div>
              <button
                className="dugme dugme--birincil dugme--kucuk"
                disabled={!bitti || g.alindi}
                onClick={() => gonder({ t: "gorevOdulu", gorevId: g.id })}
              >
                {g.alindi ? "Alındı" : bitti ? "Ödülü al" : "Devam"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
