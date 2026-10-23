// Mağaza: çip paketleri (Google Play) ve ödüllü reklam.
//
// Fiyatlar Play'den gelir (her ülkede yerel para birimiyle). Satın alınca Play'in
// verdiği jeton sunucuya gönderilir; çipi sunucu doğrulayıp verir. Bu yüzden burada
// "çip eklendi" demiyoruz; sunucudan gelen güncel profil ekranı kendiliğinden günceller.
import { CIP_PAKETLERI, REKLAM_ODULU } from "@okey/kurallar";
import { useEffect, useState } from "react";
import { Cip, EkranBasligi } from "../bilesenler/Ortak.tsx";
import { Pencere } from "../bilesenler/Pencere.tsx";
import { CipSimgesi, Simge } from "../bilesenler/Simge.tsx";
import { useOyun } from "../durum/OyunSaglayici.tsx";
import { magaza, type MagazaUrunu } from "../platform/magaza.ts";
import { reklam } from "../platform/reklam.ts";
import { cipBicim } from "../yardimci/bicim.ts";

export function Magaza() {
  const { durum, gonder, ekranaGit, bildir } = useOyun();
  const profil = durum.profil!;
  const [urunler, setUrunler] = useState<MagazaUrunu[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekleyen, setBekleyen] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        if (!(await magaza.kullanilabilirMi())) throw new Error("Google Play bu cihazda kullanılamıyor");
        setUrunler(await magaza.urunleriGetir());
      } catch (e) {
        setHata(e instanceof Error ? e.message : "Ürünler yüklenemedi");
      }
    })();
  }, []);

  const satinAl = async (urunId: string) => {
    setBekleyen(urunId);
    try {
      const sonuc = await magaza.satinAl(urunId, profil.id);
      if (sonuc) {
        gonder({ t: "satinAlma", urunId: sonuc.urunId, satinAlmaJetonu: sonuc.jeton });
        bildir("Ödeme alındı, çipler hesabına ekleniyor…", "bilgi");
      }
    } catch (e) {
      bildir(e instanceof Error ? e.message : "Satın alma başarısız", "hata");
    } finally {
      setBekleyen(null);
    }
  };

  return (
    <div className="ekran alt-ekran magaza">
      <EkranBasligi baslik="Mağaza" geri={() => ekranaGit("lobi")} sag={<Cip miktar={profil.cip} />} />

      <div className="magaza__icerik">
        <div className="paketler">
          {CIP_PAKETLERI.map((p, i) => {
            const urun = urunler?.find((u) => u.urunId === p.urunId);
            return (
              <div key={p.urunId} className={`kart paket ${p.etiket ? "paket--one-cikan" : ""}`}>
                {p.etiket && <span className="paket__etiket">{p.etiket}</span>}
                <div className={`paket__yigin paket__yigin--${i}`}>
                  {Array.from({ length: i + 1 }, (_, k) => (
                    <CipSimgesi key={k} boyut={34 + i * 2} />
                  ))}
                </div>
                <div className="paket__miktar">{cipBicim(p.cip)}</div>
                <div className="paket__alt">çip</div>
                <button
                  className="dugme dugme--birincil dugme--genis"
                  disabled={!urun || bekleyen !== null}
                  onClick={() => satinAl(p.urunId)}
                >
                  {bekleyen === p.urunId ? "Bekleniyor…" : (urun?.fiyat ?? "…")}
                </button>
              </div>
            );
          })}
        </div>

        <aside className="magaza__yan">
          <div className="kart reklam-karti">
            <Simge ad="video" boyut={30} />
            <div>
              <b>Reklam izle</b>
              <p className="soluk">
                Kısa bir video izle, <b>+{REKLAM_ODULU}</b> çip kazan. Bugün kalan hak: {profil.kalanReklamHakki}
              </p>
            </div>
            <ReklamDugmesi />
          </div>
          {!magaza.gercek && (
            <p className="not">
              <Simge ad="bilgi" boyut={14} /> Test mağazası: gerçek ödeme alınmaz. Sunucu SATIN_ALMA_TEST=1 ile
              çalışıyorsa çip eklenir.
            </p>
          )}
          {hata && <p className="not not--hata">{hata}</p>}
          <p className="not">Çipler sadece oyun içinde kullanılır; paraya çevrilemez, başkasına aktarılamaz.</p>
        </aside>
      </div>
    </div>
  );
}

/**
 * "Reklam izle, +250 çip" düğmesi. Ödülü sunucu verir (AdMob SSV); düğme reklamı
 * gösterir ve profilin güncellenmesini bekler. Tarayıcıda 2 saniyelik sahte reklam açılır.
 */
export function ReklamDugmesi({ kisa }: { kisa?: boolean }) {
  const { durum, bildir } = useOyun();
  const [izleniyor, setIzleniyor] = useState(false);
  const profil = durum.profil;
  const hak = profil?.kalanReklamHakki ?? 0;

  const izle = async () => {
    if (!profil) return;
    setIzleniyor(true);
    try {
      const tamamlandi = await reklam.odulluGoster(profil.id);
      if (!reklam.gercek) bildir("Test reklamı bitti. Tarayıcıda sunucuya doğrulama gitmediği için ödül gelmez.", "bilgi");
      else if (tamamlandi) bildir(`Teşekkürler! +${REKLAM_ODULU} çip birazdan hesabında`, "basari");
    } catch {
      bildir("Şu an reklam yok, biraz sonra tekrar dene", "hata");
    } finally {
      setIzleniyor(false);
    }
  };

  return (
    <>
      <button className="dugme dugme--yesil" disabled={hak <= 0 || izleniyor || durum.baglanti !== "bagli"} onClick={izle}>
        <Simge ad="video" />
        {kisa ? `+${REKLAM_ODULU}` : hak > 0 ? `İzle +${REKLAM_ODULU}` : "Yarın"}
        {kisa && <CipSimgesi boyut={16} />}
      </button>
      {izleniyor && !reklam.gercek && (
        <Pencere baslik="Test reklamı">
          <div className="sahte-reklam">
            <div className="donen" />
            <p>Burada ödüllü reklam oynar (tarayıcı taklidi, 2 sn).</p>
            <div className="sahte-reklam__cubuk" />
          </div>
        </Pencere>
      )}
    </>
  );
}
