// Giriş ekranı.
//  - İlk açılışta takma ad sorulur; "Oyna" sunucuya bağlanır, sunucu hesap açar.
//  - Kayıtlı hesap varsa otomatik bağlanılır, bu ekranda sadece durum görünür.
//  - Sunucuya ulaşılamazsa (birkaç saniye içinde bağlanılamazsa) "ulaşılamadı" + "Tekrar dene"
//    gösterilir, antrenman öne çıkar; arka planda denemeler sürer.
//  - Telefonda sunucu adresi hiç yapılandırılmamışsa bağlanmaya çalışılmaz; "online yakında"
//    denir ve antrenman önerilir.
//  - Başka cihazdaki hesaba kurtarma koduyla girilebilir.
//  - Gelişmiş: sunucu adresi.
import { type CSSProperties, useState } from "react";
import { Simge } from "../bilesenler/Simge.tsx";
import { Tas } from "../bilesenler/Tas.tsx";
import { adresiDuzelt, ONIZLEME, ORNEK_ADRES, sunucuAdresi } from "../durum/ayar.ts";
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
  // Telefonda sunucu adresi yapılandırılmamışsa online oyun yok: antrenman öne çıkar.
  const ayarsiz = !ONIZLEME && sunucuAdresi(durum.ayarlar) === null;
  const baglaniyor = !ayarsiz && (durum.baglanti === "baglaniyor" || (durum.baglanti === "yok" && denendi));
  const ulasilamadi = !ayarsiz && durum.baglanti === "koptu";
  const otomatik = durum.hesap !== null && !ayarsiz;
  // Antrenman, online oyun mümkün değilken birincil seçenek olur.
  const antrenmanOnde = ayarsiz || ulasilamadi;

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

  const antrenmanDugmesi = (
    <button className={`dugme ${antrenmanOnde ? "dugme--birincil dugme--buyuk" : "dugme--ikincil"}`} onClick={antrenmanBaslat}>
      <Simge ad="robot" /> {antrenmanOnde ? "Antrenman oyna" : "Çevrim dışı antrenman"}
    </button>
  );

  return (
    <div className="ekran giris">
      <div className="giris__sahne">
        <UcanTaslar />
        <div className="giris__hale" aria-hidden />
        <Logo buyuk />
        <p className="giris__alt">Kahvehane sıcaklığında, cebinde bir okey masası.</p>
      </div>

      <div className="kart cam giris__kart">
        {ayarsiz ? (
          <div className="giris__bilgi" role="status">
            <h2 className="giris__baslik">
              Online salon yakında
              <small>Online oyun henüz açık değil. Bu arada antrenman modunda botlara karşı oynayabilirsin.</small>
            </h2>
          </div>
        ) : ulasilamadi ? (
          <div className="giris__ulasilamadi" role="alert">
            <span className="giris__ulasilamadi-simge">
              <Simge ad="wifiYok" boyut={22} />
            </span>
            <div className="giris__ulasilamadi-metin">
              <b>Sunucuya ulaşılamadı</b>
              <small>
                Sunucu uyanıyor olabilir ya da internetin kesik. Arka planda denemeye devam ediyoruz; bağlanınca kendiliğinden
                açılır.
              </small>
            </div>
            <button className="dugme dugme--ikincil dugme--kucuk" onClick={tekrarDene}>
              Tekrar dene
            </button>
          </div>
        ) : otomatik ? (
          <div className="giris__durum" role="status">
            <div className="donen" />
            <p>
              Hoş geldin <b>{durum.hesap!.ad}</b>, masaya bağlanılıyor…
            </p>
            <small className="giris__not">Sunucu uyanıyor olabilir, bekleniyor…</small>
          </div>
        ) : null}

        {!otomatik && !ayarsiz && !ulasilamadi && (
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
            <button className="dugme dugme--birincil dugme--buyuk" disabled={baglaniyor} onClick={oyna}>
              {baglaniyor ? "Bağlanıyor…" : "Oyna"}
            </button>
            {baglaniyor && <small className="giris__not">Sunucu uyanıyor olabilir, bekleniyor…</small>}
          </>
        )}

        {antrenmanDugmesi}

        <div className="giris__baglantilar">
          {!otomatik && !ayarsiz && !ulasilamadi && (
            <button className="metin-dugme" onClick={() => setKurtarmaAcik(!kurtarmaAcik)}>
              {kurtarmaAcik ? "Yeni hesap aç" : "Kurtarma kodum var"}
            </button>
          )}
          <button className="metin-dugme" onClick={() => setGelismis(!gelismis)}>
            {ayarsiz ? "Sunucu adresim var" : "Gelişmiş"}
          </button>
        </div>

        {gelismis && (
          <div className="giris__gelismis">
            <label className="alan-etiketi" htmlFor="sunucu-adresi">
              Sunucu adresi
            </label>
            <input
              id="sunucu-adresi"
              className="girdi girdi--kucuk"
              value={adres}
              placeholder={sunucuAdresi({ ...durum.ayarlar, sunucuUrl: "" }) ?? ORNEK_ADRES}
              onChange={(e) => setAdres(e.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <button
              className="dugme dugme--ikincil dugme--kucuk"
              onClick={() => {
                const yeni = adres.trim() ? adresiDuzelt(adres) : "";
                setAdres(yeni);
                ayarlariKaydet({ ...durum.ayarlar, sunucuUrl: yeni });
                bildir(yeni ? "Sunucu adresi kaydedildi" : "Varsayılan sunucu adresine dönüldü", "basari");
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
