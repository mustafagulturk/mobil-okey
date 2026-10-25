// Lobi: yatay ekran için iki sütun. Solda oyuncunun kendisi (cam oyuncu kartı, hediye, reklam,
// görevler), sağda üst menü, oyun türü anahtarı (Okey / 101), salon kartları ve alttaki eylem
// çubuğu. Hızlı oyun, oda kurma ve antrenman seçili oyun türüyle başlar.
import { type OyunTuru, salonaUygunMu, SALONLAR, type SalonBilgisi, type SalonId } from "@okey/kurallar";
import { useEffect, useMemo, useState } from "react";
import { Pencere } from "../bilesenler/Pencere.tsx";
import { Simge, type SimgeAdi } from "../bilesenler/Simge.tsx";
import type { Ekran } from "../durum/durum.ts";
import { useOyun } from "../durum/OyunSaglayici.tsx";
import { kayitliOyunTuru, oyunTuruKaydet } from "../durum/oyunTuru.ts";
import { kisaCip } from "../yardimci/bicim.ts";
import { OyuncuPaneli } from "./lobi/OyuncuPaneli.tsx";
import { SalonCizimTanimlari, SalonKarti } from "./lobi/SalonKarti.tsx";

export function Lobi() {
  const { durum, gonder, antrenmanBaslat, tekrarDene } = useOyun();
  const profil = durum.profil!;
  const [secili, setSecili] = useState<SalonId | null>(null);
  const [kodPenceresi, setKodPenceresi] = useState(false);
  const [oyun, setOyun] = useState<OyunTuru>(kayitliOyunTuru);
  const oyunSec = (o: OyunTuru) => {
    setOyun(o);
    oyunTuruKaydet(o);
  };

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
  // Salondaki çevrimiçi oyuncu sayısı seçili oyuna göre (sunucu 101 sayısını ayrıca bildirir).
  const oyuncuSayisi = (s: SalonBilgisi) => (oyun === "101" ? (s.oyuncuSayisi101 ?? 0) : s.oyuncuSayisi);
  const toplamOyuncu = salonlar.reduce((t, s) => t + oyuncuSayisi(s), 0);

  return (
    <div className="ekran lobi">
      <SalonCizimTanimlari />
      <OyuncuPaneli />

      <main className="lobi__sag">
        <header className="lobi__ust">
          <div className="lobi__baslik">
            <h1>Salonlar</h1>
            {cevrimici ? (
              <span className="lobi__cevrimici">
                <i className="salon__nokta" /> {toplamOyuncu > 0 ? `${toplamOyuncu} oyuncu masada` : "Çevrimiçi"}
              </span>
            ) : (
              <button
                type="button"
                className="rozet-uyari"
                onClick={tekrarDene}
                title="Sunucuya ulaşılamadı; arka planda tekrar deneniyor. Dokun: şimdi dene."
              >
                {durum.baglanti === "baglaniyor" ? "Bağlanıyor…" : "Bağlantı yok · tekrar dene"}
              </button>
            )}
          </div>
          <OyunAnahtari oyun={oyun} sec={oyunSec} />
          <nav className="lobi__menu">
            <MenuDugmesi simge="gorev" yazi="Görevler" ekran="gorevler" />
            <MenuDugmesi simge="kupa" yazi="Sıralama" ekran="siralama" />
            <MenuDugmesi simge="magaza" yazi="Mağaza" ekran="magaza" />
            <MenuDugmesi simge="profil" yazi="Etiket" ekran="profil" />
            <MenuDugmesi simge="ayar" yazi="Ayarlar" ekran="ayarlar" />
          </nav>
        </header>

        <div className="salonlar">
          {salonlar.map((s, i) => (
            <SalonKarti
              key={s.id}
              salon={{ ...s, oyuncuSayisi: oyuncuSayisi(s) }}
              oyun={oyun}
              sira={i}
              cip={profil.cip}
              secili={seciliSalon?.id === s.id}
              sec={() => setSecili(s.id)}
            />
          ))}
        </div>

        <div className="lobi__eylemler">
          <button
            className="hizli-oyun"
            disabled={!cevrimici || !seciliSalon}
            onClick={() => seciliSalon && gonder({ t: "hizliOyun", salon: seciliSalon.id, oyun })}
          >
            <span className="hizli-oyun__simge">
              <Simge ad="oyna" boyut={18} />
            </span>
            <span className="hizli-oyun__metin">
              <b>{oyun === "101" ? "Hızlı 101" : "Hızlı Oyun"}</b>
              {seciliSalon && (
                <small>
                  {seciliSalon.ad} · {kisaCip(seciliSalon.giris)}
                </small>
              )}
            </span>
          </button>
          <EylemDugmesi
            simge="arti"
            yazi="Oda Kur"
            disabled={!cevrimici || !seciliSalon}
            tikla={() => seciliSalon && gonder({ t: "odaKur", salon: seciliSalon.id, oyun })}
          />
          <EylemDugmesi simge="anahtar" yazi="Kodla Katıl" disabled={!cevrimici} tikla={() => setKodPenceresi(true)} />
          <EylemDugmesi simge="robot" yazi="Antrenman" tikla={() => antrenmanBaslat(oyun)} />
        </div>
      </main>

      {kodPenceresi && <KodlaKatil kapat={() => setKodPenceresi(false)} />}
    </div>
  );
}

/**
 * Oyun türü anahtarı: iki sekmeli altın bir "kaydırmalı düğme". Seçili sekmenin arkasındaki
 * altın parça yaylanarak öbür sekmeye kayar (sadece transform).
 */
function OyunAnahtari({ oyun, sec }: { oyun: OyunTuru; sec: (o: OyunTuru) => void }) {
  return (
    <div className={`oyun-anahtari oyun-anahtari--${oyun === "101" ? "sag" : "sol"}`} role="tablist" aria-label="Oyun türü">
      <i className="oyun-anahtari__parca" aria-hidden />
      {(["okey", "101"] as const).map((o) => (
        <button key={o} role="tab" aria-selected={oyun === o} className="oyun-anahtari__sekme" onClick={() => sec(o)}>
          {o === "okey" ? "Okey" : "101"}
          <small>{o === "okey" ? "klasik" : "perli"}</small>
        </button>
      ))}
    </div>
  );
}

function EylemDugmesi({ simge, yazi, disabled, tikla }: { simge: SimgeAdi; yazi: string; disabled?: boolean; tikla: () => void }) {
  return (
    <button className="eylem-dugmesi" disabled={disabled} onClick={tikla}>
      <span className="eylem-dugmesi__simge">
        <Simge ad={simge} boyut={18} />
      </span>
      <span>{yazi}</span>
    </button>
  );
}

function MenuDugmesi({ simge, yazi, ekran }: { simge: SimgeAdi; yazi: string; ekran: Ekran }) {
  const { ekranaGit, durum } = useOyun();
  const nokta =
    (ekran === "gorevler" && durum.gorevler?.some((g) => g.ilerleme >= g.hedef && !g.alindi)) ||
    (ekran === "magaza" && (durum.profil?.kalanReklamHakki ?? 0) > 0);
  return (
    <button className="menu-dugmesi" onClick={() => ekranaGit(ekran)}>
      <span className="menu-dugmesi__daire">
        <Simge ad={simge} boyut={19} />
        {nokta && <i className="menu-dugmesi__nokta" />}
      </span>
      <span className="menu-dugmesi__yazi">{yazi}</span>
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
