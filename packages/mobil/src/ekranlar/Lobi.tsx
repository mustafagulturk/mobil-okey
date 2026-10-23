// Lobi: profil kartı, salonlar ve oyuna giriş düğmeleri. Yatay ekran için iki sütun:
// solda oyuncunun kendisi (profil, çip, hediyeler), sağda salonlar ve eylemler.
import { salonaUygunMu, SALONLAR, type SalonBilgisi, type SalonId } from "@okey/kurallar";
import { useEffect, useMemo, useState } from "react";
import { IsimEtiketi } from "../bilesenler/IsimEtiketi.tsx";
import { Cip, SeviyeCubugu } from "../bilesenler/Ortak.tsx";
import { Pencere } from "../bilesenler/Pencere.tsx";
import { CipSimgesi, Simge, type SimgeAdi } from "../bilesenler/Simge.tsx";
import type { Ekran } from "../durum/durum.ts";
import { useOyun } from "../durum/OyunSaglayici.tsx";
import { cipBicim, kisaCip, metindekiSayilariBicimle } from "../yardimci/bicim.ts";
import { ReklamDugmesi } from "./Magaza.tsx";

export function Lobi() {
  const { durum, gonder, ekranaGit, antrenmanBaslat } = useOyun();
  const profil = durum.profil!;
  const [secili, setSecili] = useState<SalonId | null>(null);
  const [kodPenceresi, setKodPenceresi] = useState(false);

  // Salon bilgilerini (oyuncu sayıları) bağlanınca ve sonra ara ara iste.
  useEffect(() => {
    if (durum.baglanti !== "bagli") return;
    gonder({ t: "salonlar" });
    gonder({ t: "gorevler" }); // menüdeki "ödül hazır" noktası için
    const z = setInterval(() => gonder({ t: "salonlar" }), 15_000);
    return () => clearInterval(z);
  }, [durum.baglanti, gonder]);

  // Sunucu henüz göndermediyse kurallar paketindeki salon tanımlarını göster.
  const salonlar: SalonBilgisi[] = durum.salonlar.length
    ? durum.salonlar
    : SALONLAR.map((s) => ({ ...s, oyuncuSayisi: 0 }));

  // Seçili salon yoksa ya da artık uygun değilse, oyuncuya uygun en düşük girişli salonu seç
  // (yeni oyuncu çipini tek elde riske atmasın).
  const uygunlar = salonlar.filter((s) => salonaUygunMu(s, profil.cip).uygun);
  const seciliSalon = useMemo(() => {
    const s = uygunlar.find((x) => x.id === secili);
    return s ?? uygunlar[0] ?? null;
  }, [secili, uygunlar]);

  const cevrimici = durum.baglanti === "bagli";

  return (
    <div className="ekran lobi">
      <aside className="lobi__sol">
        <div className="kart profil-karti">
          <button className="profil-karti__etiket" onClick={() => ekranaGit("profil")}>
            <IsimEtiketi ad={profil.ad} seviye={profil.seviye} etiket={profil.etiket} boyut="buyuk" />
          </button>
          <SeviyeCubugu mevcut={profil.seviyeIlerleme.mevcut} gereken={profil.seviyeIlerleme.gereken} />
          <div className="profil-karti__cip">
            <CipSimgesi boyut={26} />
            <span>{cipBicim(profil.cip)}</span>
            <button className="simge-dugme simge-dugme--altin" onClick={() => ekranaGit("magaza")} aria-label="Çip al">
              <Simge ad="arti" />
            </button>
          </div>
        </div>

        <div className="lobi__oduller">
          <button
            className={`dugme dugme--hediye ${profil.gunlukHediyeAlinabilir ? "dugme--nabiz" : ""}`}
            disabled={!profil.gunlukHediyeAlinabilir || !cevrimici}
            onClick={() => gonder({ t: "gunlukHediye" })}
          >
            <Simge ad="hediye" />
            {profil.gunlukHediyeAlinabilir ? "Günlük hediye" : "Hediye yarın"}
          </button>
          <ReklamDugmesi kisa />
        </div>

        {durum.gorevler && durum.gorevler.length > 0 && (
          <button className="kart mini-gorevler" onClick={() => ekranaGit("gorevler")}>
            <h3>Bugünün görevleri</h3>
            {durum.gorevler.map((g) => (
              <div key={g.id} className={`mini-gorev ${g.alindi ? "mini-gorev--alindi" : ""}`}>
                <span>{g.metin}</span>
                <small>{g.alindi ? "✓" : `${Math.min(g.ilerleme, g.hedef)}/${g.hedef}`}</small>
                <div className="gorev__cubuk">
                  <div style={{ width: `${Math.min(100, (g.ilerleme / g.hedef) * 100)}%` }} />
                </div>
              </div>
            ))}
          </button>
        )}
      </aside>

      <main className="lobi__sag">
        <header className="lobi__ust">
          <h1>Salonlar</h1>
          {!cevrimici && <span className="rozet-uyari">Bağlantı yok</span>}
          <nav className="lobi__menu">
            <MenuDugmesi simge="gorev" yazi="Görevler" ekran="gorevler" />
            <MenuDugmesi simge="kupa" yazi="Sıralama" ekran="siralama" />
            <MenuDugmesi simge="magaza" yazi="Mağaza" ekran="magaza" />
            <MenuDugmesi simge="profil" yazi="Etiket" ekran="profil" />
            <MenuDugmesi simge="ayar" yazi="Ayarlar" ekran="ayarlar" />
          </nav>
        </header>

        <div className="salonlar">
          {salonlar.map((s, i) => {
            const u = salonaUygunMu(s, profil.cip);
            return (
              <button
                key={s.id}
                className={`salon salon--${i} ${seciliSalon?.id === s.id ? "salon--secili" : ""} ${u.uygun ? "" : "salon--kapali"}`}
                disabled={!u.uygun}
                onClick={() => setSecili(s.id)}
              >
                <div className="salon__ust">
                  <span className="salon__ad">{s.ad}</span>
                  <span className="salon__oyuncu">
                    <Simge ad="profil" boyut={13} /> {s.oyuncuSayisi}
                  </span>
                </div>
                <div className="salon__giris">
                  <Cip miktar={s.giris} kisa />
                  <small>el başı</small>
                </div>
                <div className="salon__aralik">
                  {u.uygun
                    ? `${kisaCip(s.enAzCip)} – ${s.enFazlaCip === null ? "sınırsız" : kisaCip(s.enFazlaCip)}`
                    : metindekiSayilariBicimle(u.sebep)}
                </div>
              </button>
            );
          })}
        </div>

        <div className="lobi__eylemler">
          <button
            className="dugme dugme--birincil dugme--buyuk"
            disabled={!cevrimici || !seciliSalon}
            onClick={() => seciliSalon && gonder({ t: "hizliOyun", salon: seciliSalon.id })}
          >
            <Simge ad="oyna" /> Hızlı Oyun
          </button>
          <button
            className="dugme dugme--ikincil"
            disabled={!cevrimici || !seciliSalon}
            onClick={() => seciliSalon && gonder({ t: "odaKur", salon: seciliSalon.id })}
          >
            <Simge ad="arti" /> Oda Kur
          </button>
          <button className="dugme dugme--ikincil" disabled={!cevrimici} onClick={() => setKodPenceresi(true)}>
            <Simge ad="anahtar" /> Kodla Katıl
          </button>
          <button className="dugme dugme--ikincil" onClick={antrenmanBaslat}>
            <Simge ad="robot" /> Antrenman
          </button>
        </div>
      </main>

      {kodPenceresi && <KodlaKatil kapat={() => setKodPenceresi(false)} />}
    </div>
  );
}

function MenuDugmesi({ simge, yazi, ekran }: { simge: SimgeAdi; yazi: string; ekran: Ekran }) {
  const { ekranaGit, durum } = useOyun();
  const nokta =
    (ekran === "gorevler" && durum.gorevler?.some((g) => g.ilerleme >= g.hedef && !g.alindi)) ||
    (ekran === "magaza" && (durum.profil?.kalanReklamHakki ?? 0) > 0);
  return (
    <button className="menu-dugmesi" onClick={() => ekranaGit(ekran)}>
      <Simge ad={simge} boyut={22} />
      <span>{yazi}</span>
      {nokta && <i className="menu-dugmesi__nokta" />}
    </button>
  );
}

function KodlaKatil({ kapat }: { kapat: () => void }) {
  const { gonder } = useOyun();
  const [kod, setKod] = useState("");
  const temiz = kod.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 5);
  return (
    <Pencere baslik="Kodla katıl" kapat={kapat}>
      <p className="soluk">Arkadaşının paylaştığı 5 haneli oda kodunu yaz.</p>
      <input
        className="girdi girdi--kod"
        value={temiz}
        autoFocus
        placeholder="ABCDE"
        onChange={(e) => setKod(e.target.value)}
      />
      <button
        className="dugme dugme--birincil dugme--genis"
        disabled={temiz.length !== 5}
        onClick={() => {
          gonder({ t: "odayaKatil", kod: temiz });
          kapat();
        }}
      >
        Katıl
      </button>
    </Pencere>
  );
}
