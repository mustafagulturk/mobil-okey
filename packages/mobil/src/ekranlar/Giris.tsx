// Giriş ekranı.
//  - İlk açılışta takma ad sorulur; "Oyna" sunucuya bağlanır, sunucu hesap açar.
//  - Kayıtlı hesap varsa otomatik bağlanılır, bu ekranda sadece durum görünür.
//  - Sunucuya ulaşılamazsa çevrim dışı antrenman önerilir.
//  - Başka cihazdaki hesaba kurtarma koduyla girilebilir.
//  - Gelişmiş: sunucu adresi.
import { type CSSProperties, useState } from "react";
import { Simge } from "../bilesenler/Simge.tsx";
import { Tas } from "../bilesenler/Tas.tsx";
import { sunucuAdresi } from "../durum/ayar.ts";
import { useOyun } from "../durum/OyunSaglayici.tsx";
import { kurtarmaKodunuCoz } from "../platform/depo.ts";

export function Giris() {
  const { durum, girisYap, tekrarDene, antrenmanBaslat, ayarlariKaydet, bildir } = useOyun();
  const [ad, setAd] = useState(durum.hesap?.ad ?? "");
  const [kurtarmaAcik, setKurtarmaAcik] = useState(false);
  const [kod, setKod] = useState("");
  const [gelismis, setGelismis] = useState(false);
  const [adres, setAdres] = useState(durum.ayarlar.sunucuUrl);
  const [denendi, setDenendi] = useState(false);

  const adGecerli = /^[\p{L}\p{N} _.-]{2,16}$/u.test(ad.trim());
  const baglaniyor = durum.baglanti === "baglaniyor" || (durum.baglanti === "yok" && denendi);
  const ulasilamadi = durum.baglanti === "koptu";
  const otomatik = durum.hesap !== null;

  const oyna = () => {
    if (!adGecerli) return bildir("Ad 2-16 harf olmalı (harf, rakam, boşluk, . _ -)", "hata");
    if (kurtarmaAcik) {
      const k = kurtarmaKodunuCoz(kod);
      if (!k) return bildir("Kurtarma kodu geçersiz", "hata");
      girisYap(ad.trim(), k);
    } else {
      girisYap(ad.trim());
    }
    setDenendi(true);
  };

  return (
    <div className="ekran giris">
      <div className="giris__sahne">
        <UcanTaslar />
        <div className="giris__hale" aria-hidden />
        <Logo buyuk />
        <p className="giris__alt">Kahvehane sıcaklığında, cebinde bir okey masası.</p>
      </div>

      <div className="kart cam giris__kart">
        {otomatik && !ulasilamadi ? (
          <div className="giris__durum">
            <div className="donen" />
            <p>
              Hoş geldin <b>{durum.hesap!.ad}</b>, masaya bağlanılıyor…
            </p>
          </div>
        ) : (
          <>
            {!otomatik && (
              <>
                <h2 className="giris__baslik">
                  Masaya otur
                  <small>Bir takma ad seç, hemen oyuna katıl.</small>
                </h2>
                <label className="alan-etiketi" htmlFor="ad">
                  Takma adın
                </label>
                <input
                  id="ad"
                  className="girdi"
                  value={ad}
                  maxLength={16}
                  placeholder="ör. Kahveci Mustafa"
                  onChange={(e) => setAd(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && oyna()}
                  autoComplete="off"
                />
                {kurtarmaAcik && (
                  <input
                    className="girdi"
                    value={kod}
                    placeholder="Kurtarma kodunu yapıştır"
                    onChange={(e) => setKod(e.target.value)}
                    autoComplete="off"
                  />
                )}
                <button className="dugme dugme--birincil dugme--buyuk" disabled={baglaniyor && !ulasilamadi} onClick={oyna}>
                  {baglaniyor && !ulasilamadi ? "Bağlanıyor…" : "Oyna"}
                </button>
              </>
            )}
            {ulasilamadi && (
              <div className="giris__hata">
                <Simge ad="wifiYok" />
                <span>Sunucuya ulaşılamadı. Tekrar deneniyor…</span>
                <button className="dugme dugme--ikincil dugme--kucuk" onClick={tekrarDene}>
                  Şimdi dene
                </button>
              </div>
            )}
          </>
        )}

        <button className="dugme dugme--ikincil" onClick={antrenmanBaslat}>
          <Simge ad="robot" /> Çevrim dışı antrenman
        </button>

        <div className="giris__baglantilar">
          {!otomatik && (
            <button className="metin-dugme" onClick={() => setKurtarmaAcik(!kurtarmaAcik)}>
              {kurtarmaAcik ? "Yeni hesap aç" : "Kurtarma kodum var"}
            </button>
          )}
          <button className="metin-dugme" onClick={() => setGelismis(!gelismis)}>
            Gelişmiş
          </button>
        </div>

        {gelismis && (
          <div className="giris__gelismis">
            <label className="alan-etiketi">Sunucu adresi</label>
            <input
              className="girdi girdi--kucuk"
              value={adres}
              placeholder={sunucuAdresi({ ...durum.ayarlar, sunucuUrl: "" })}
              onChange={(e) => setAdres(e.target.value)}
            />
            <button
              className="dugme dugme--ikincil dugme--kucuk"
              onClick={() => {
                ayarlariKaydet({ ...durum.ayarlar, sunucuUrl: adres });
                bildir("Sunucu adresi kaydedildi", "basari");
              }}
            >
              Kaydet
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Logonun arkasında yavaşça süzülen ve dönen 3D taşlar (yalnız transform animasyonu). */
const UCAN_TASLAR: Array<{ id: number; x: string; y: string; r: number; s: number; sure: number; gecikme: number; uzak?: boolean }> = [
  { id: 102, x: "4%", y: "10%", r: -18, s: 1, sure: 9, gecikme: 0 },
  { id: 38, x: "80%", y: "4%", r: 14, s: 0.85, sure: 11, gecikme: -3 },
  { id: 104, x: "88%", y: "64%", r: -10, s: 0.95, sure: 10, gecikme: -6 },
  { id: 20, x: "10%", y: "70%", r: 20, s: 0.8, sure: 12, gecikme: -2 },
  { id: 66, x: "44%", y: "-4%", r: 6, s: 0.6, sure: 13, gecikme: -8, uzak: true },
  { id: 86, x: "56%", y: "84%", r: -24, s: 0.62, sure: 14, gecikme: -5, uzak: true },
];

function UcanTaslar() {
  return (
    <div className="ucan-taslar" aria-hidden>
      {UCAN_TASLAR.map((t, i) => (
        <div
          key={t.id}
          className={`ucan-tas ${t.uzak ? "ucan-tas--uzak" : ""}`}
          style={
            {
              left: t.x,
              top: t.y,
              "--r": `${t.r}deg`,
              "--s": t.s,
              "--sure": `${t.sure}s`,
              "--gecikme": `${t.gecikme}s`,
              "--giris": `${0.25 + i * 0.08}s`,
            } as CSSProperties
          }
        >
          <div className="ucan-tas__ic">
            <Tas id={t.id} boyut="buyuk" okey={t.id === 20 ? { renk: 0, sayi: 11 } : null} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Uygulama logosu: iki fildişi taş ve metalik altın yazı. */
export function Logo({ buyuk }: { buyuk?: boolean }) {
  return (
    <div className={`logo ${buyuk ? "logo--buyuk" : ""}`}>
      <div className="logo__taslar">
        <Tas id={0} boyut="buyuk" />
        <Tas id={56} boyut="buyuk" />
      </div>
      <div className="logo__yazi">
        <span>Okey</span>
        <span>Salonu</span>
      </div>
    </div>
  );
}
