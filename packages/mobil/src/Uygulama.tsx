// Kök bileşen: hangi ekranın görüneceğine karar verir. (Yönlendirme kütüphanesi yok;
// ekran durumda tutulan basit bir değerdir.)
import { Bildirimler } from "./bilesenler/Bildirimler.tsx";
import { Parcaciklar } from "./efektler/Parcaciklar.tsx";
import { OyunSaglayici, useOyun } from "./durum/OyunSaglayici.tsx";
import { Ayarlar } from "./ekranlar/Ayarlar.tsx";
import { BeklemeOdasi } from "./ekranlar/BeklemeOdasi.tsx";
import { Giris, Logo } from "./ekranlar/Giris.tsx";
import { Gorevler } from "./ekranlar/Gorevler.tsx";
import { Lobi } from "./ekranlar/Lobi.tsx";
import { Magaza } from "./ekranlar/Magaza.tsx";
import { MasaEkrani } from "./ekranlar/masa/MasaEkrani.tsx";
import { Masa101Ekrani } from "./ekranlar/masa101/Masa101Ekrani.tsx";
import { Profil } from "./ekranlar/Profil.tsx";
import { Siralama } from "./ekranlar/Siralama.tsx";
import { uygulamayiKucult, varsayilanGeri } from "./platform/geriTusu.ts";

export function Uygulama() {
  return (
    <OyunSaglayici>
      <ArkaPlan />
      <Ekran />
      <Bildirimler />
    </OyunSaglayici>
  );
}

/** Bütün ekranların arkasındaki "gece salonu": koyu zemin, üstten lamba ışığı, doku, köşe
 *  kararması ve süzülen ışık tozları. Ekranlar şeffaf zeminle bunun üstünde durur. */
function ArkaPlan() {
  const { durum } = useOyun();
  // Masada çuha ekranın çoğunu kaplar; tozlar azalır (pil ve akıcılık için).
  const masada = !!durum.oda?.masa;
  return (
    <div className="arka-plan" aria-hidden>
      <div className="arka-plan__lamba" />
      <Parcaciklar yogunluk={masada ? "az" : "normal"} />
      <div className="arka-plan__doku" />
    </div>
  );
}

function Ekran() {
  const { durum, ekranaGit } = useOyun();
  // Geri tuşunun varsayılanı (açık pencere/masa yokken): alt ekrandan lobiye, lobide küçült.
  varsayilanGeri(() => {
    const altEkran = durum.ekran !== "lobi" && durum.ekran !== "giris" && durum.ekran !== "oda";
    if (altEkran) ekranaGit(durum.profil ? "lobi" : "giris");
    else uygulamayiKucult();
  });
  if (!durum.yuklendi)
    return (
      <div className="ekran acilis">
        <Logo />
      </div>
    );

  // Odadaysak: masa varsa oyun türünün masa ekranı, yoksa bekleme odası.
  if (durum.oda) {
    if (!durum.oda.masa) return <BeklemeOdasi />;
    return durum.oda.oyun === "101" ? <Masa101Ekrani /> : <MasaEkrani />;
  }
  if (durum.antrenman)
    return (
      <div className="ekran acilis">
        <Logo />
      </div>
    );

  // Profil yoksa (giriş yapılmadı) sadece giriş ve ayarlar açılabilir.
  if (!durum.profil) return durum.ekran === "ayarlar" ? <Ayarlar /> : <Giris />;

  switch (durum.ekran) {
    case "magaza":
      return <Magaza />;
    case "profil":
      return <Profil />;
    case "ayarlar":
      return <Ayarlar />;
    case "gorevler":
      return <Gorevler />;
    case "siralama":
      return <Siralama />;
    default:
      return <Lobi />;
  }
}
