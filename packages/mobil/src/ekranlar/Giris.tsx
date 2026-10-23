// Giriş ekranı.
//  - İlk açılışta takma ad sorulur; "Oyna" sunucuya bağlanır, sunucu hesap açar.
//  - Kayıtlı hesap varsa otomatik bağlanılır, bu ekranda sadece durum görünür.
//  - Sunucuya ulaşılamazsa çevrim dışı antrenman önerilir.
//  - Başka cihazdaki hesaba kurtarma koduyla girilebilir.
//  - Gelişmiş: sunucu adresi.
import { useState } from "react";
import { Simge } from "../bilesenler/Simge.tsx";
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
        <Logo />
        <p className="giris__alt">Kahvehane sıcaklığında, cebinde bir okey masası.</p>
      </div>

      <div className="kart giris__kart">
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

/** Uygulama logosu: iki krem taş ve yazı. */
export function Logo() {
  return (
    <div className="logo">
      <div className="logo__taslar">
        <span className="logo__tas logo__tas--kirmizi">1</span>
        <span className="logo__tas logo__tas--mavi">3</span>
      </div>
      <div className="logo__yazi">
        Okey <span>Salonu</span>
      </div>
    </div>
  );
}
