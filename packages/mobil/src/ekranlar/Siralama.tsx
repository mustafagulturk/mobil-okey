// Sıralama: Seviye ve Çip sekmeleri. İlk 3 kürsüde (altın/gümüş/bronz), gerisi listede.
// Oyuncunun kendi satırı altın vurgulu olarak her zaman altta sabit görünür.
import type { SiralamaSatiri } from "@okey/kurallar";
import { useEffect, useState } from "react";
import { IsimEtiketi } from "../bilesenler/IsimEtiketi.tsx";
import { Cip } from "../bilesenler/Ortak.tsx";
import { CipSimgesi } from "../bilesenler/Simge.tsx";
import { useOyun } from "../durum/OyunSaglayici.tsx";
import { cipBicim, kisaCip } from "../yardimci/bicim.ts";
import { AltSekmeler, AltUstCubuk, sira } from "./alt/ortak.tsx";

type Tur = "seviye" | "cip";

export function Siralama() {
  const { durum, gonder, ekranaGit } = useOyun();
  const [tur, setTur] = useState<Tur>("seviye");
  useEffect(() => gonder({ t: "siralama", tur }), [tur, gonder]);
  const veri = durum.siralama[tur];
  const benimId = durum.profil?.id;
  const ben = veri ? (veri.satirlar.find((s) => s.oyuncu.id === benimId) ?? veri.ben) : null;
  const kursu = veri?.satirlar.filter((s) => s.sira <= 3) ?? [];
  const liste = veri?.satirlar.filter((s) => s.sira > 3) ?? [];

  return (
    <div className="ekran alt-ekran siralama">
      <AltUstCubuk
        baslik="Sıralama"
        alt="Salonun en iyileri"
        geri={() => ekranaGit("lobi")}
        orta={
          <AltSekmeler<Tur>
            secili={tur}
            sec={setTur}
            secenekler={[
              { id: "seviye", ad: "Seviye" },
              { id: "cip", ad: "Çip" },
            ]}
          />
        }
      />
      <div className="siralama__icerik" key={tur}>
        {!veri && <div className="donen" />}
        {veri && (
          <>
            <div className="kursu alt-giris" style={sira(1)}>
              {[2, 1, 3].map((n) => {
                const s = kursu.find((k) => k.sira === n);
                return s ? <KursuBasamagi key={n} s={s} tur={tur} ben={s.oyuncu.id === benimId} /> : <div key={n} />;
              })}
            </div>
            <div className="siralama__sag alt-giris" style={sira(2)}>
              <div className="siralama__liste">
                {liste.length === 0 && <p className="siralama__bos">Kürsüden sonrası henüz boş.</p>}
                {liste.map((s, i) => (
                  <Satir key={s.oyuncu.id} s={s} tur={tur} ben={s.oyuncu.id === benimId} i={i} />
                ))}
              </div>
              {ben && (
                <div className="siralama__ben">
                  <span className="siralama__ben-etiket">Sen</span>
                  <Satir s={ben} tur={tur} ben />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Deger({ tur, deger, kisa }: { tur: Tur; deger: number; kisa?: boolean }) {
  if (tur === "cip") return kisa ? (
    <span className="cip">
      <CipSimgesi />
      {kisaCip(deger)}
    </span>
  ) : (
    <Cip miktar={deger} />
  );
  return <span>{cipBicim(deger)} XP</span>;
}

const MADALYA = { 1: "altin", 2: "gumus", 3: "bronz" } as const;

function KursuBasamagi({ s, tur, ben }: { s: SiralamaSatiri; tur: Tur; ben: boolean }) {
  const tip = MADALYA[s.sira as 1 | 2 | 3];
  return (
    <div className={`kursu__yer kursu__yer--${s.sira} ${ben ? "kursu__yer--ben" : ""}`} style={sira(s.sira === 1 ? 2 : s.sira === 2 ? 3 : 4)}>
      <div className={`madalya madalya--${tip}`}>
        <span className="madalya__kurdele" aria-hidden />
        <span className="madalya__disk">{s.sira}</span>
      </div>
      <div className="kursu__etiket">
        <IsimEtiketi ad={s.oyuncu.ad} seviye={s.oyuncu.seviye} etiket={s.oyuncu.etiket} boyut="kucuk" />
      </div>
      <div className="kursu__deger">
        <Deger tur={tur} deger={s.deger} kisa />
      </div>
      <div className={`kursu__basamak kursu__basamak--${tip}`}>
        <span>{s.sira}</span>
      </div>
    </div>
  );
}

function Satir({ s, tur, ben, i = 0 }: { s: SiralamaSatiri; tur: Tur; ben?: boolean; i?: number }) {
  return (
    <div className={`siralama-satiri ${ben ? "siralama-satiri--ben" : ""} alt-giris`} style={sira(2 + i * 0.7)}>
      <span className="siralama-satiri__sira">{s.sira}</span>
      <IsimEtiketi ad={s.oyuncu.ad} seviye={s.oyuncu.seviye} etiket={s.oyuncu.etiket} boyut="kucuk" />
      <span className="siralama-satiri__deger">
        <Deger tur={tur} deger={s.deger} />
      </span>
    </div>
  );
}
