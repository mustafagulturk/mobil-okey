// Ayarlar: ses/titreşim/efektler, hesap kurtarma kodu, sunucu adresi, gizlilik, hesap silme.
import { type ReactNode, useEffect, useState } from "react";
import { Pencere } from "../bilesenler/Pencere.tsx";
import { Simge } from "../bilesenler/Simge.tsx";
import { ONIZLEME, sunucuAdresi } from "../durum/ayar.ts";
import { useOyun } from "../durum/OyunSaglayici.tsx";
import { efektAyari, efektAyariniDegistir, efektAyariniDinle, efektlerAcik } from "../efektler/ayar.ts";
import { kopyala, SURUM } from "../platform/cihaz.ts";
import { kurtarmaKodu } from "../platform/depo.ts";
import { AltUstCubuk, EkSimge, sira } from "./alt/ortak.tsx";

const GIZLILIK = "https://github.com/mustafagulturk/mobil-okey/blob/main/docs/GIZLILIK.md";

/** Şık aç/kapa satırı: simge + başlık + açıklama + anahtar. */
function AyarAnahtari(o: { simge: ReactNode; etiket: string; aciklama?: string; acik: boolean; degistir: (a: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={o.acik}
      className={`ayar-satiri ayar-satiri--anahtar ${o.acik ? "ayar-satiri--acik" : ""}`}
      onClick={() => o.degistir(!o.acik)}
    >
      <span className="ayar-satiri__simge">{o.simge}</span>
      <span className="ayar-satiri__metin">
        <b>{o.etiket}</b>
        {o.aciklama && <small>{o.aciklama}</small>}
      </span>
      <span className="sik-anahtar" aria-hidden>
        <span className="sik-anahtar__top" />
      </span>
    </button>
  );
}

export function Ayarlar() {
  const { durum, ekranaGit, ayarlariKaydet, gonder, bildir } = useOyun();
  const a = durum.ayarlar;
  const [kodGorunur, setKodGorunur] = useState(false);
  const [silOnay, setSilOnay] = useState(false);
  const [adres, setAdres] = useState(a.sunucuUrl);
  const [efekt, setEfekt] = useState(efektAyari);
  const hareketAzalt = efekt && !efektlerAcik();
  useEffect(() => efektAyariniDinle(() => setEfekt(efektAyari())), []);
  const kod = durum.hesap ? kurtarmaKodu(durum.hesap) : ONIZLEME ? "onizleme:0000-0000" : null;

  return (
    <div className="ekran alt-ekran ayarlar">
      <AltUstCubuk baslik="Ayarlar" alt={`Okey Salonu · sürüm ${SURUM}`} geri={() => ekranaGit(durum.profil ? "lobi" : "giris")} />
      <div className="ayarlar__icerik">
        <div className="ayarlar__sutun">
          <section className="ayar-grubu alt-giris" style={sira(1)}>
            <h3>Oyun</h3>
            <AyarAnahtari
              simge={<EkSimge ad="ses" boyut={18} />}
              etiket="Ses efektleri"
              aciklama="Taş, zar ve masa sesleri"
              acik={a.ses}
              degistir={(ses) => ayarlariKaydet({ ...a, ses })}
            />
            <AyarAnahtari
              simge={<EkSimge ad="titresim" boyut={18} />}
              etiket="Titreşim"
              aciklama="Sıra sana gelince"
              acik={a.titresim}
              degistir={(titresim) => ayarlariKaydet({ ...a, titresim })}
            />
            <AyarAnahtari
              simge={<EkSimge ad="yildiz" boyut={18} />}
              etiket="Efektler"
              aciklama={hareketAzalt ? "Telefonda “hareketi azalt” açık" : "Konfeti, ışıklar, animasyonlar"}
              acik={efekt}
              degistir={(acik) => {
                efektAyariniDegistir(acik);
                setEfekt(acik);
              }}
            />
          </section>

          <section className="ayar-grubu alt-giris" style={sira(2)}>
            <h3>Sunucu</h3>
            <div className="ayar-sunucu">
              <span className="ayar-satiri__simge">
                <EkSimge ad="sunucu" boyut={18} />
              </span>
              <input
                className="ayar-girdi"
                value={adres}
                placeholder={sunucuAdresi({ ...a, sunucuUrl: "" })}
                onChange={(e) => setAdres(e.target.value)}
                aria-label="Sunucu adresi"
              />
              <button
                className="ayar-kucuk-dugme"
                disabled={adres === a.sunucuUrl}
                onClick={() => ayarlariKaydet({ ...a, sunucuUrl: adres.trim() })}
              >
                Kaydet
              </button>
            </div>
          </section>
        </div>

        <div className="ayarlar__sutun">
          <section className="ayar-grubu alt-giris" style={sira(3)}>
            <h3>Hesap kurtarma</h3>
            <p className="ayar-aciklama">
              <EkSimge ad="kalkan" boyut={14} /> Telefon değiştirirsen ya da uygulamayı silersen hesabına bu kodla dönebilirsin.
              Kimseyle paylaşma.
            </p>
            {kod ? (
              <div className="kurtarma">
                <code className={`kurtarma-kodu ${kodGorunur ? "" : "kurtarma-kodu--gizli"}`}>{kod}</code>
                <div className="kurtarma__dugmeler">
                  <button className="ayar-kucuk-dugme" onClick={() => setKodGorunur(!kodGorunur)}>
                    <EkSimge ad="goz" boyut={15} /> {kodGorunur ? "Gizle" : "Göster"}
                  </button>
                  <button
                    className="ayar-kucuk-dugme"
                    onClick={async () => bildir((await kopyala(kod)) ? "Kopyalandı" : "Kopyalanamadı", "bilgi")}
                  >
                    <Simge ad="kopyala" boyut={15} /> Kopyala
                  </button>
                </div>
              </div>
            ) : (
              <p className="ayar-aciklama">Henüz hesabın yok.</p>
            )}
          </section>

          <section className="ayar-grubu alt-giris" style={sira(4)}>
            <h3>Diğer</h3>
            <a className="ayar-satiri ayar-satiri--baglanti" href={GIZLILIK} target="_blank" rel="noreferrer">
              <span className="ayar-satiri__simge">
                <EkSimge ad="kalkan" boyut={18} />
              </span>
              <span className="ayar-satiri__metin">
                <b>Gizlilik politikası</b>
                <small>Hangi verileri topladığımız</small>
              </span>
              <EkSimge ad="disari" boyut={16} />
            </a>
            {durum.profil && (
              <button className="ayar-satiri ayar-satiri--tehlike" onClick={() => setSilOnay(true)}>
                <span className="ayar-satiri__simge">
                  <EkSimge ad="cop" boyut={18} />
                </span>
                <span className="ayar-satiri__metin">
                  <b>Hesabımı sil</b>
                  <small>Kalıcıdır, geri alınamaz</small>
                </span>
              </button>
            )}
          </section>
        </div>
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
