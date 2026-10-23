// Kök bileşen: hangi ekranın görüneceğine karar verir. (Yönlendirme kütüphanesi yok;
// ekran durumda tutulan basit bir değerdir.)
import { Bildirimler } from "./bilesenler/Bildirimler.tsx";
import { OyunSaglayici, useOyun } from "./durum/OyunSaglayici.tsx";
import { Ayarlar } from "./ekranlar/Ayarlar.tsx";
import { BeklemeOdasi } from "./ekranlar/BeklemeOdasi.tsx";
import { Giris, Logo } from "./ekranlar/Giris.tsx";
import { Gorevler } from "./ekranlar/Gorevler.tsx";
import { Lobi } from "./ekranlar/Lobi.tsx";
import { Magaza } from "./ekranlar/Magaza.tsx";
import { MasaEkrani } from "./ekranlar/masa/MasaEkrani.tsx";
import { Profil } from "./ekranlar/Profil.tsx";
import { Siralama } from "./ekranlar/Siralama.tsx";

export function Uygulama() {
  return (
    <OyunSaglayici>
      <Ekran />
      <Bildirimler />
    </OyunSaglayici>
  );
}

function Ekran() {
  const { durum } = useOyun();
  if (!durum.yuklendi)
    return (
      <div className="ekran acilis">
        <Logo />
      </div>
    );

  // Odadaysak: masa varsa masa ekranı, yoksa bekleme odası.
  if (durum.oda) return durum.oda.masa ? <MasaEkrani /> : <BeklemeOdasi />;
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
