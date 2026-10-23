// Bekleme odası: oda kodu, 4 koltuk, sahibi için "Başla". Boş koltuklara oyun başlayınca bot oturur.
import type { KoltukGorunumu } from "@okey/kurallar";
import { IsimEtiketi } from "../bilesenler/IsimEtiketi.tsx";
import { Cip } from "../bilesenler/Ortak.tsx";
import { Simge } from "../bilesenler/Simge.tsx";
import { useOyun } from "../durum/OyunSaglayici.tsx";
import { paylas } from "../platform/cihaz.ts";
import { SALONLAR } from "@okey/kurallar";

export function BeklemeOdasi() {
  const { durum, gonder, bildir } = useOyun();
  const oda = durum.oda!;
  const sahibim = oda.sahipId === durum.profil?.id;
  const salonAdi = SALONLAR.find((s) => s.id === oda.salon)?.ad ?? "Antrenman";

  const kodPaylas = async () => {
    const sonuc = await paylas("Okey Salonu", `Okey Salonu'nda masama gel! Oda kodu: ${oda.kod}`);
    if (sonuc === "kopyalandi") bildir("Oda kodu kopyalandı", "basari");
  };

  return (
    <div className="ekran bekleme">
      <header className="bekleme__ust">
        <button className="dugme dugme--ikincil dugme--kucuk" onClick={() => gonder({ t: "odadanAyril" })}>
          <Simge ad="cikis" boyut={16} /> Ayrıl
        </button>
        <div className="bekleme__salon">
          {salonAdi} · <Cip miktar={oda.giris} /> el başı
        </div>
      </header>

      <div className="bekleme__orta">
        <div className="kart oda-kodu">
          <span className="soluk">Oda kodu</span>
          <span className="oda-kodu__kod">{oda.kod}</span>
          <button className="dugme dugme--ikincil dugme--kucuk" onClick={kodPaylas}>
            <Simge ad="paylas" boyut={16} /> Paylaş
          </button>
        </div>

        <div className="koltuklar">
          {oda.koltuklar.map((k, i) => (
            <KoltukKarti key={i} k={k} sahip={k.tur === "insan" && k.oyuncu.id === oda.sahipId} />
          ))}
        </div>
      </div>

      <footer className="bekleme__alt">
        {sahibim ? (
          <button className="dugme dugme--birincil dugme--buyuk" onClick={() => gonder({ t: "basla" })}>
            <Simge ad="oyna" /> Başla
          </button>
        ) : (
          <p className="soluk">Masa sahibinin başlatması bekleniyor…</p>
        )}
        <p className="not">Boş koltuklara oyun başlayınca bot oturur.</p>
      </footer>
    </div>
  );
}

function KoltukKarti({ k, sahip }: { k: KoltukGorunumu; sahip: boolean }) {
  if (k.tur === "bos")
    return (
      <div className="koltuk koltuk--bos">
        <Simge ad="profil" boyut={28} />
        <span>Boş koltuk</span>
      </div>
    );
  if (k.tur === "bot")
    return (
      <div className="koltuk">
        <Simge ad="robot" boyut={28} />
        <span>{k.ad} (bot)</span>
      </div>
    );
  return (
    <div className="koltuk koltuk--dolu">
      <IsimEtiketi ad={k.oyuncu.ad} seviye={k.oyuncu.seviye} etiket={k.oyuncu.etiket} soluk={!k.bagli} />
      {sahip && <span className="koltuk__sahip">Masa sahibi</span>}
    </div>
  );
}
