// Mağaza: çip paketleri (Google Play) ve ödüllü reklam.
//
// Fiyatlar Play'den gelir (her ülkede yerel para birimiyle). Satın alınca Play'in
// verdiği jeton sunucuya gönderilir; çipi sunucu doğrulayıp verir. Bu yüzden burada
// "çip eklendi" demiyoruz; sunucudan gelen güncel profil ekranı kendiliğinden günceller.
// Satın almadan sonra çip gerçekten artınca (sunucu onayladı) çip yağmuru kutlaması çıkar.
import { CIP_PAKETLERI, GUNLUK_REKLAM_SINIRI, REKLAM_ODULU } from "@okey/kurallar";
import { useEffect, useRef, useState } from "react";
import { Pencere } from "../bilesenler/Pencere.tsx";
import { CipSimgesi, Simge } from "../bilesenler/Simge.tsx";
import { useOyun } from "../durum/OyunSaglayici.tsx";
import { kutlama } from "../efektler/kutlama.ts";
import { magaza, type MagazaUrunu } from "../platform/magaza.ts";
import { reklam } from "../platform/reklam.ts";
import { cipBicim } from "../yardimci/bicim.ts";
import { CipYigini } from "./alt/CipYigini.tsx";
import { AltUstCubuk, sira } from "./alt/ortak.tsx";

/** Kurdele rengi, paketin etiketine göre. */
function kurdeleTuru(etiket: string): "yakut" | "zumrut" {
  return /avantaj/i.test(etiket) ? "zumrut" : "yakut";
}

export function Magaza() {
  const { durum, gonder, ekranaGit, bildir } = useOyun();
  const profil = durum.profil!;
  const [urunler, setUrunler] = useState<MagazaUrunu[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekleyen, setBekleyen] = useState<string | null>(null);
  /** Sunucuya gönderilmiş, çipi henüz gelmemiş satın alma (kutlama için). */
  const onayBekleyen = useRef<{ urunId: string; oncekiCip: number } | null>(null);
  const kartlar = useRef(new Map<string, HTMLElement>());

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

  // Çip arttıysa ve bekleyen bir satın alma varsa: kutla.
  useEffect(() => {
    const b = onayBekleyen.current;
    if (!b || profil.cip <= b.oncekiCip) return;
    onayBekleyen.current = null;
    const kart = kartlar.current.get(b.urunId);
    void kutlama("cipYagmuru", { kaynak: kart?.getBoundingClientRect() });
  }, [profil.cip]);

  const satinAl = async (urunId: string) => {
    setBekleyen(urunId);
    try {
      const sonuc = await magaza.satinAl(urunId, profil.id);
      if (sonuc) {
        onayBekleyen.current = { urunId: sonuc.urunId, oncekiCip: profil.cip };
        gonder({ t: "satinAlma", urunId: sonuc.urunId, satinAlmaJetonu: sonuc.jeton });
        bildir("Ödeme alındı, çipler hesabına ekleniyor…", "bilgi");
      }
    } catch (e) {
      bildir(e instanceof Error ? e.message : "Satın alma başarısız", "hata");
    } finally {
      setBekleyen(null);
    }
  };

  const hak = profil.kalanReklamHakki;

  return (
    <div className="ekran alt-ekran magaza">
      <AltUstCubuk baslik="Mağaza" alt="Çip paketleri" geri={() => ekranaGit("lobi")} />

      <div className="magaza__icerik">
        <div className="magaza__vitrin">
          <div className="paketler">
            {CIP_PAKETLERI.map((p, i) => {
              const urun = urunler?.find((u) => u.urunId === p.urunId);
              const kurdele = p.etiket ? kurdeleTuru(p.etiket) : null;
              return (
                <div
                  key={p.urunId}
                  ref={(el) => {
                    if (el) kartlar.current.set(p.urunId, el);
                    else kartlar.current.delete(p.urunId);
                  }}
                  className={`paket alt-giris ${kurdele ? `paket--one-cikan paket--${kurdele}` : ""}`}
                  style={sira(i + 1)}
                >
                  <span className="paket__isik" style={{ animationDelay: `${1.2 + i * 0.9}s` }} aria-hidden />
                  {p.etiket && (
                    <span className={`kurdele kurdele--${kurdele}`}>
                      <span>{p.etiket}</span>
                    </span>
                  )}
                  <div className="paket__sahne">
                    <CipYigini kademe={i} />
                  </div>
                  <div className="paket__miktar">{cipBicim(p.cip)}</div>
                  <div className="paket__alt">çip</div>
                  <button
                    className="paket__fiyat"
                    disabled={!urun || bekleyen !== null}
                    onClick={() => satinAl(p.urunId)}
                  >
                    {bekleyen === p.urunId ? <span className="paket__donen" aria-label="Bekleniyor" /> : (urun?.fiyat ?? "…")}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="magaza__not alt-giris" style={sira(6)}>
            <Simge ad="kilit" boyut={11} /> Çipler paraya çevrilemez ve aktarılamaz.
            {!magaza.gercek && <span className="magaza__test"> · Test mağazası: gerçek ödeme alınmaz.</span>}
          </p>
        </div>

        <aside className="magaza__yan">
          <div className="reklam-karti alt-giris" style={sira(5)}>
            <div className="reklam-karti__ust">
              <span className="reklam-karti__oynat" aria-hidden>
                <Simge ad="oyna" boyut={18} />
              </span>
              <div>
                <b>Ödüllü reklam</b>
                <small>Kısa bir video izle</small>
              </div>
            </div>
            <div className="reklam-karti__odul">
              <div className="reklam-karti__yigin">
                <CipYigini kademe={0} />
              </div>
              <span>+{cipBicim(REKLAM_ODULU)}</span>
            </div>
            <div className="reklam-karti__hak" aria-label={`Bugün kalan hak: ${hak}`}>
              {Array.from({ length: GUNLUK_REKLAM_SINIRI }, (_, k) => (
                <i key={k} className={k < hak ? "dolu" : ""} />
              ))}
              <small>{hak} hak</small>
            </div>
            <ReklamDugmesi />
          </div>
          {hata && <p className="not not--hata">{hata}</p>}
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
