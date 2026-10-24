// Bekleme odası: solda oda kodu (taş harfler, kopyala/paylaş) ve sahibi için "Başla";
// sağda üstten görünen masa ve etrafındaki 4 koltuk. Gelen oyuncu koltuğuna yaylanarak oturur,
// boş koltuk "bekleniyor" diye nabız atar. Boş koltuklara oyun başlayınca bot oturur.
import { SALONLAR, type KoltukGorunumu } from "@okey/kurallar";
import { useEffect, useState, type CSSProperties } from "react";
import { IsimEtiketi } from "../bilesenler/IsimEtiketi.tsx";
import { CipSimgesi, Simge } from "../bilesenler/Simge.tsx";
import { useOyun } from "../durum/OyunSaglayici.tsx";
import { kopyala, paylas } from "../platform/cihaz.ts";
import { useGeriTusu } from "../platform/geriTusu.ts";
import { cipBicim } from "../yardimci/bicim.ts";

const KONUMLAR = ["alt", "sag", "ust", "sol"] as const;

export function BeklemeOdasi() {
  const { durum, gonder, bildir } = useOyun();
  const oda = durum.oda!;
  const sahibim = oda.sahipId === durum.profil?.id;
  useGeriTusu(() => gonder({ t: "odadanAyril" })); // el başlamadığı için çip riski yok
  const salonAdi = SALONLAR.find((s) => s.id === oda.salon)?.ad ?? "Antrenman";
  const ben = oda.benimKoltugum ?? 0;
  const dolu = oda.koltuklar.filter((k) => k.tur !== "bos").length;
  const [kopyalandi, setKopyalandi] = useState(false);

  useEffect(() => {
    if (!kopyalandi) return;
    const z = setTimeout(() => setKopyalandi(false), 1600);
    return () => clearTimeout(z);
  }, [kopyalandi]);

  const kodKopyala = async () => {
    if (await kopyala(oda.kod)) {
      setKopyalandi(true);
      bildir("Oda kodu kopyalandı", "basari");
    }
  };

  const kodPaylas = async () => {
    const sonuc = await paylas("Okey Salonu", `Okey Salonu'nda masama gel! Oda kodu: ${oda.kod}`);
    if (sonuc === "kopyalandi") bildir("Oda kodu kopyalandı", "basari");
  };

  return (
    <div className="ekran bekleme">
      <header className="bekleme__ust">
        <button className="bekleme__ayril" onClick={() => gonder({ t: "odadanAyril" })}>
          <Simge ad="cikis" boyut={16} /> Ayrıl
        </button>
        <div className="bekleme__salon">
          <span className="bekleme__salon-ad">{salonAdi}</span>
          <span className="bekleme__ayrac" />
          <CipSimgesi boyut={18} />
          <b>{cipBicim(oda.giris)}</b>
          <small>el başı</small>
        </div>
        <div className="bekleme__sayi">
          <Simge ad="profil" boyut={15} />
          <span>
            <b>{dolu}</b>/4
          </span>
        </div>
      </header>

      <aside className="oda-paneli">
        <span className="oda-paneli__etiket">Oda kodu</span>
        <div className="oda-kodu" aria-label={`Oda kodu ${oda.kod}`}>
          {oda.kod.split("").map((h, i) => (
            <span key={i} className="oda-kodu__tas" style={{ "--sira": i } as CSSProperties}>
              {h}
            </span>
          ))}
        </div>
        <div className="oda-paneli__dugmeler">
          <button className={`oda-dugme ${kopyalandi ? "oda-dugme--tamam" : ""}`} onClick={kodKopyala}>
            <Simge ad={kopyalandi ? "gorev" : "kopyala"} boyut={15} /> {kopyalandi ? "Kopyalandı" : "Kopyala"}
          </button>
          <button className="oda-dugme" onClick={kodPaylas}>
            <Simge ad="paylas" boyut={15} /> Paylaş
          </button>
        </div>
        <p className="oda-paneli__not">Kodu arkadaşlarına gönder, masana otursunlar.</p>

        <div className="doluluk" aria-label={`${dolu} / 4 koltuk dolu`}>
          <span className="doluluk__yazi">Masa</span>
          {oda.koltuklar.map((k, i) => (
            <i key={i} className={k.tur === "bos" ? "" : "doluluk--dolu"} />
          ))}
          <span className="doluluk__yazi">
            {dolu}/4
          </span>
        </div>

        <div className="oda-paneli__alt">
          {sahibim ? (
            <button className="basla-dugmesi" onClick={() => gonder({ t: "basla" })}>
              <span className="basla-dugmesi__simge">
                <Simge ad="oyna" boyut={18} />
              </span>
              Başla
            </button>
          ) : (
            <p className="oda-paneli__bekle">
              <span className="bekleme-noktalari">
                <i />
                <i />
                <i />
              </span>
              Masa sahibinin başlatması bekleniyor
            </p>
          )}
        </div>
      </aside>

      <section className="bekleme-masa">
        <div className="masa-ust">
          <div className="masa-ust__cuha">
            <span className="masa-ust__isik" />
            {oda.koltuklar.map((k, i) => (
              <span
                key={i}
                className={`istakacik istakacik--${KONUMLAR[(i - ben + 4) % 4]} ${k.tur === "bos" ? "" : "istakacik--dolu"}`}
              />
            ))}
            <div className="masa-ust__orta">
              <span className="masa-ust__deste">
                <i />
                <i />
                <i />
              </span>
              <span className="masa-ust__yazi">{salonAdi}</span>
              <span className="masa-ust__not">Boş koltuklara oyun başlayınca bot oturur</span>
            </div>
          </div>
        </div>

        {oda.koltuklar.map((k, i) => {
          const konum = KONUMLAR[(i - ben + 4) % 4];
          const anahtar = k.tur === "insan" ? k.oyuncu.id : k.tur === "bot" ? `bot-${k.ad}` : "bos";
          return (
            <Koltuk
              key={`${i}-${anahtar}`}
              k={k}
              konum={konum}
              sira={i}
              ben={i === ben}
              sahip={k.tur === "insan" && k.oyuncu.id === oda.sahipId}
            />
          );
        })}
      </section>
    </div>
  );
}

interface KoltukOzellikleri {
  k: KoltukGorunumu;
  konum: (typeof KONUMLAR)[number];
  sira: number;
  ben: boolean;
  sahip: boolean;
}

function Koltuk({ k, konum, sira, ben, sahip }: KoltukOzellikleri) {
  const stil = { "--sira": sira } as CSSProperties;
  if (k.tur === "bos")
    return (
      <div className={`koltuk koltuk--${konum} koltuk--bos`} style={stil}>
        <span className="koltuk__bos-daire">
          <Simge ad="profil" boyut={22} />
        </span>
        <span className="koltuk__bekleniyor">
          Bekleniyor
          <span className="bekleme-noktalari">
            <i />
            <i />
            <i />
          </span>
        </span>
      </div>
    );
  return (
    <div className={`koltuk koltuk--${konum} koltuk--dolu ${ben ? "koltuk--ben" : ""}`} style={stil}>
      <span className="koltuk__halka" aria-hidden />
      <span className="koltuk__sandalye">
        {k.tur === "bot" ? (
          <span className="koltuk__bot">
            <Simge ad="robot" boyut={20} />
            <span>{k.ad}</span>
          </span>
        ) : (
          <IsimEtiketi ad={k.oyuncu.ad} seviye={k.oyuncu.seviye} etiket={k.oyuncu.etiket} soluk={!k.bagli} />
        )}
      </span>
      {(sahip || ben) && (
        <span className="koltuk__rozet">{sahip ? (ben ? "Masa sahibi · Sen" : "Masa sahibi") : "Sen"}</span>
      )}
    </div>
  );
}
