// Ayarlar: ses/titreşim, hesap kurtarma kodu, sunucu adresi, gizlilik, hesap silme.
import { useState } from "react";
import { Anahtar, EkranBasligi } from "../bilesenler/Ortak.tsx";
import { Pencere } from "../bilesenler/Pencere.tsx";
import { Simge } from "../bilesenler/Simge.tsx";
import { ONIZLEME, sunucuAdresi } from "../durum/ayar.ts";
import { useOyun } from "../durum/OyunSaglayici.tsx";
import { kopyala, SURUM } from "../platform/cihaz.ts";
import { kurtarmaKodu } from "../platform/depo.ts";

const GIZLILIK = "https://github.com/mustafagulturk/mobil-okey/blob/main/docs/GIZLILIK.md";

export function Ayarlar() {
  const { durum, ekranaGit, ayarlariKaydet, gonder, bildir } = useOyun();
  const a = durum.ayarlar;
  const [kodGorunur, setKodGorunur] = useState(false);
  const [silOnay, setSilOnay] = useState(false);
  const [adres, setAdres] = useState(a.sunucuUrl);
  const kod = durum.hesap ? kurtarmaKodu(durum.hesap) : ONIZLEME ? "onizleme:0000-0000" : null;

  return (
    <div className="ekran alt-ekran ayarlar">
      <EkranBasligi baslik="Ayarlar" geri={() => ekranaGit(durum.profil ? "lobi" : "giris")} />
      <div className="ayarlar__icerik">
        <section className="kart">
          <h3>Oyun</h3>
          <Anahtar etiket="Ses efektleri" acik={a.ses} degistir={(ses) => ayarlariKaydet({ ...a, ses })} />
          <Anahtar etiket="Titreşim (sıra sana gelince)" acik={a.titresim} degistir={(titresim) => ayarlariKaydet({ ...a, titresim })} />
          <h3>Sunucu</h3>
          <div className="satir">
            <input
              className="girdi girdi--kucuk"
              value={adres}
              placeholder={sunucuAdresi({ ...a, sunucuUrl: "" })}
              onChange={(e) => setAdres(e.target.value)}
            />
            <button
              className="dugme dugme--ikincil dugme--kucuk"
              disabled={adres === a.sunucuUrl}
              onClick={() => ayarlariKaydet({ ...a, sunucuUrl: adres.trim() })}
            >
              Kaydet
            </button>
          </div>
        </section>

        <section className="kart">
          <h3>Hesap kurtarma</h3>
          <p className="soluk">
            Telefon değiştirirsen ya da uygulamayı silersen hesabına bu kodla dönebilirsin. Kimseyle paylaşma.
          </p>
          {kod ? (
            <>
              <code className={`kurtarma-kodu ${kodGorunur ? "" : "kurtarma-kodu--gizli"}`}>{kod}</code>
              <div className="satir">
                <button className="dugme dugme--ikincil dugme--kucuk" onClick={() => setKodGorunur(!kodGorunur)}>
                  {kodGorunur ? "Gizle" : "Göster"}
                </button>
                <button
                  className="dugme dugme--ikincil dugme--kucuk"
                  onClick={async () => bildir((await kopyala(kod)) ? "Kopyalandı" : "Kopyalanamadı", "bilgi")}
                >
                  <Simge ad="kopyala" boyut={16} /> Kopyala
                </button>
              </div>
            </>
          ) : (
            <p className="soluk">Henüz hesabın yok.</p>
          )}
          <h3>Diğer</h3>
          <a className="metin-dugme" href={GIZLILIK} target="_blank" rel="noreferrer">
            Gizlilik politikası
          </a>
          {durum.profil && (
            <button className="dugme dugme--tehlike dugme--kucuk" onClick={() => setSilOnay(true)}>
              Hesabımı sil
            </button>
          )}
          <p className="surum">Okey Salonu · sürüm {SURUM}</p>
        </section>
      </div>

      {silOnay && (
        <Pencere baslik="Hesabın silinsin mi?" kapat={() => setSilOnay(false)}>
          <p>Çiplerin, seviyen ve açtığın süsler kalıcı olarak silinir. Bu işlem geri alınamaz.</p>
          <div className="satir satir--sag">
            <button className="dugme dugme--ikincil" onClick={() => setSilOnay(false)}>
              Vazgeç
            </button>
            <button
              className="dugme dugme--tehlike"
              onClick={() => {
                gonder({ t: "hesapSil" });
                setSilOnay(false);
              }}
            >
              Evet, sil
            </button>
          </div>
        </Pencere>
      )}
    </div>
  );
}
