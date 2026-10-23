// Sıralama: Seviye ve Çip sekmeleri. Oyuncunun kendi satırı listede yoksa altta sabit görünür.
import type { SiralamaSatiri } from "@okey/kurallar";
import { useEffect, useState } from "react";
import { IsimEtiketi } from "../bilesenler/IsimEtiketi.tsx";
import { Cip, EkranBasligi } from "../bilesenler/Ortak.tsx";
import { useOyun } from "../durum/OyunSaglayici.tsx";
import { cipBicim } from "../yardimci/bicim.ts";

export function Siralama() {
  const { durum, gonder, ekranaGit } = useOyun();
  const [tur, setTur] = useState<"seviye" | "cip">("seviye");
  useEffect(() => gonder({ t: "siralama", tur }), [tur, gonder]);
  const veri = durum.siralama[tur];
  const benListede = veri?.satirlar.some((s) => s.oyuncu.id === durum.profil?.id);

  return (
    <div className="ekran alt-ekran siralama">
      <EkranBasligi
        baslik="Sıralama"
        geri={() => ekranaGit("lobi")}
        sag={
          <div className="sekmeler">
            <button className={`sekme ${tur === "seviye" ? "sekme--secili" : ""}`} onClick={() => setTur("seviye")}>
              Seviye
            </button>
            <button className={`sekme ${tur === "cip" ? "sekme--secili" : ""}`} onClick={() => setTur("cip")}>
              Çip
            </button>
          </div>
        }
      />
      <div className="siralama__liste">
        {!veri && <div className="donen" />}
        {veri?.satirlar.map((s) => <Satir key={s.oyuncu.id} s={s} tur={tur} ben={s.oyuncu.id === durum.profil?.id} />)}
      </div>
      {veri?.ben && !benListede && (
        <div className="siralama__ben">
          <Satir s={veri.ben} tur={tur} ben />
        </div>
      )}
    </div>
  );
}

function Satir({ s, tur, ben }: { s: SiralamaSatiri; tur: "seviye" | "cip"; ben?: boolean }) {
  return (
    <div className={`siralama-satiri ${ben ? "siralama-satiri--ben" : ""} ${s.sira <= 3 ? `siralama-satiri--${s.sira}` : ""}`}>
      <span className="siralama-satiri__sira">{s.sira}</span>
      <IsimEtiketi ad={s.oyuncu.ad} seviye={s.oyuncu.seviye} etiket={s.oyuncu.etiket} />
      <span className="siralama-satiri__deger">
        {tur === "cip" ? <Cip miktar={s.deger} /> : `${cipBicim(s.deger)} XP`}
      </span>
    </div>
  );
}
