// Lobinin sol sütunu: cam oyuncu kartı (madalyon seviye rozeti, isim etiketi, metalik XP çubuğu,
// akan çip sayacı), günlük hediye kutusu, reklam düğmesi ve günün görevleri.
import { GUNLUK_HEDIYE } from "@okey/kurallar";
import { useEffect, useRef, useState } from "react";
import { IsimEtiketi } from "../../bilesenler/IsimEtiketi.tsx";
import { CipSimgesi, Simge } from "../../bilesenler/Simge.tsx";
import { kutlama } from "../../efektler/kutlama.ts";
import { SayiSayaci } from "../../efektler/SayiSayaci.tsx";
import { useOyun } from "../../durum/OyunSaglayici.tsx";
import { cipBicim } from "../../yardimci/bicim.ts";
import { ReklamDugmesi } from "../Magaza.tsx";

export function OyuncuPaneli() {
  const { durum, ekranaGit } = useOyun();
  const profil = durum.profil!;
  const { mevcut, gereken } = profil.seviyeIlerleme;
  const oran = Math.min(1, gereken > 0 ? mevcut / gereken : 0);

  // XP çubuğu ilk açılışta boştan dolar.
  const [dolu, setDolu] = useState(0);
  useEffect(() => {
    const z = setTimeout(() => setDolu(oran), 250);
    return () => clearTimeout(z);
  }, [oran]);

  return (
    <aside className="lobi__sol">
      <div className="oyuncu-karti">
        <div className="oyuncu-karti__ust">
          <button className="lobi-madalyon" onClick={() => ekranaGit("profil")} aria-label={`Seviye ${profil.seviye}, profil`}>
            <span className="lobi-madalyon__halka" />
            <span className="lobi-madalyon__sayi">{profil.seviye}</span>
            <span className="lobi-madalyon__yazi">SEVİYE</span>
          </button>
          <button className="oyuncu-karti__etiket" onClick={() => ekranaGit("profil")}>
            <IsimEtiketi ad={profil.ad} etiket={profil.etiket} boyut="buyuk" />
          </button>
        </div>

        <div className="lobi-xp" title={`${mevcut} / ${gereken} XP`}>
          <div className="lobi-xp__dolu" style={{ transform: `scaleX(${dolu})` }} />
          <span className="lobi-xp__yazi">
            {cipBicim(mevcut)} / {cipBicim(gereken)} XP
          </span>
        </div>

        <div className="oyuncu-karti__cip">
          <span className="jeton">
            <CipSimgesi boyut={30} />
          </span>
          <span className="oyuncu-karti__miktar">
            <SayiSayaci deger={profil.cip} bicim={cipBicim} />
          </span>
          <button className="cip-ekle" onClick={() => ekranaGit("magaza")} aria-label="Çip al">
            <Simge ad="arti" boyut={18} />
          </button>
        </div>
      </div>

      <div className="lobi__oduller">
        <GunlukHediye />
        <div className="reklam-kutusu">
          <span className="reklam-kutusu__baslik">
            Reklam · {profil.kalanReklamHakki} hak
          </span>
          <ReklamDugmesi kisa />
        </div>
      </div>

      <MiniGorevler />
    </aside>
  );
}

/** Türkiye saatine göre gece yarısına kalan süre: "5 sa 12 dk". */
function geceYarisinaKalan(): string {
  const simdi = Date.now() + 3 * 3600_000;
  const kalan = 86_400_000 - (simdi % 86_400_000);
  const sa = Math.floor(kalan / 3600_000);
  const dk = Math.floor((kalan % 3600_000) / 60_000);
  return sa > 0 ? `${sa} sa ${dk} dk` : `${dk} dk`;
}

function GunlukHediye() {
  const { durum, gonder } = useOyun();
  const profil = durum.profil!;
  const alinabilir = profil.gunlukHediyeAlinabilir && durum.baglanti === "bagli";
  const ref = useRef<HTMLButtonElement>(null);
  const [kalan, setKalan] = useState(geceYarisinaKalan);

  useEffect(() => {
    if (profil.gunlukHediyeAlinabilir) return;
    const z = setInterval(() => setKalan(geceYarisinaKalan()), 30_000);
    return () => clearInterval(z);
  }, [profil.gunlukHediyeAlinabilir]);

  const al = () => {
    const kaynak = ref.current?.querySelector(".hediye-kutusu")?.getBoundingClientRect();
    void kutlama("cipYagmuru", { kaynak });
    gonder({ t: "gunlukHediye" });
  };

  return (
    <button
      ref={ref}
      className={`hediye ${alinabilir ? "hediye--hazir" : ""}`}
      disabled={!alinabilir}
      onClick={al}
    >
      <span className="hediye__isinlar" aria-hidden />
      <HediyeKutusu />
      <span className="hediye__metin">
        <b>Günlük Hediye</b>
        {profil.gunlukHediyeAlinabilir ? (
          <small>
            +{cipBicim(GUNLUK_HEDIYE)} <CipSimgesi boyut={12} />
          </small>
        ) : (
          <small>Yenisi {kalan} sonra</small>
        )}
      </span>
    </button>
  );
}

function HediyeKutusu() {
  return (
    <svg className="hediye-kutusu" viewBox="0 0 48 48" aria-hidden>
      <defs>
        <linearGradient id="hk-govde" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e2463f" />
          <stop offset="1" stopColor="#9c1f22" />
        </linearGradient>
        <linearGradient id="hk-kurdele" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b07a22" />
          <stop offset="0.5" stopColor="#fff0b5" />
          <stop offset="1" stopColor="#c48d25" />
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="45" rx="16" ry="2.5" fill="rgba(0,0,0,.35)" />
      <rect x="8" y="22" width="32" height="22" rx="3" fill="url(#hk-govde)" />
      <rect x="21" y="22" width="6" height="22" fill="url(#hk-kurdele)" />
      <g className="hediye-kutusu__kapak">
        <path d="M17 15c-6-6-1-11 3-7 2 2 4 7 4 7s-5 2-7 0zM31 15c6-6 1-11-3-7-2 2-4 7-4 7s5 2 7 0z" fill="url(#hk-kurdele)" />
        <rect x="6" y="14" width="36" height="10" rx="3" fill="url(#hk-govde)" />
        <rect x="6" y="14" width="36" height="3" rx="1.5" fill="rgba(255,255,255,.22)" />
        <rect x="21" y="14" width="6" height="10" fill="url(#hk-kurdele)" />
      </g>
    </svg>
  );
}

function MiniGorevler() {
  const { durum, ekranaGit } = useOyun();
  const gorevler = durum.gorevler;
  if (!gorevler || gorevler.length === 0) return null;
  return (
    <button className="mini-gorevler" onClick={() => ekranaGit("gorevler")}>
      <span className="mini-gorevler__baslik">Bugünün görevleri</span>
      {gorevler.map((g) => {
        const oran = Math.min(1, g.ilerleme / g.hedef);
        const hazir = g.ilerleme >= g.hedef && !g.alindi;
        return (
          <span key={g.id} className={`mini-gorev ${g.alindi ? "mini-gorev--alindi" : ""} ${hazir ? "mini-gorev--hazir" : ""}`}>
            <span className="mini-gorev__metin">{g.metin}</span>
            <small>{g.alindi ? "✓" : hazir ? "Ödül hazır" : `${Math.min(g.ilerleme, g.hedef)}/${g.hedef}`}</small>
            <span className="mini-gorev__cubuk">
              <span style={{ transform: `scaleX(${oran})` }} />
            </span>
          </span>
        );
      })}
    </button>
  );
}
