// Profil ve isim etiketi düzenleme. Süsler seviye ve başarımlarla açılır, satılmaz.
// Kilitli süs gri görünür; üstünde nasıl açılacağı (kosulMetni) yazar.
import {
  CERCEVELER,
  type Etiket,
  kosulMetni,
  kosulSaglandiMi,
  type Kosul,
  ROZETLER,
  UNVANLAR,
} from "@okey/kurallar";
import { type CSSProperties, type ReactNode, useState } from "react";
import { IsimEtiketi } from "../bilesenler/IsimEtiketi.tsx";
import { EkranBasligi, SeviyeCubugu } from "../bilesenler/Ortak.tsx";
import { Simge } from "../bilesenler/Simge.tsx";
import { useOyun } from "../durum/OyunSaglayici.tsx";
import { cipBicim } from "../yardimci/bicim.ts";

type Sekme = "cerceve" | "rozet" | "unvan";

export function Profil() {
  const { durum, gonder, ekranaGit, bildir } = useOyun();
  const p = durum.profil!;
  const [etiket, setEtiket] = useState<Etiket>(p.etiket);
  const [sekme, setSekme] = useState<Sekme>("cerceve");
  const [ad, setAd] = useState(p.ad);

  const acik = (k: Kosul) => kosulSaglandiMi(k, p.seviye, p.istatistik);
  const degisti = JSON.stringify(etiket) !== JSON.stringify(p.etiket);

  const kaydet = () => {
    if (degisti) gonder({ t: "etiketSec", ...etiket });
    if (ad.trim() !== p.ad) gonder({ t: "adDegistir", ad: ad.trim() });
    bildir("Etiketin kaydedildi", "basari");
  };

  const ist = p.istatistik;
  const oran = ist.oynanan ? Math.round((ist.kazanilan / ist.oynanan) * 100) : 0;

  return (
    <div className="ekran alt-ekran profil">
      <EkranBasligi
        baslik="Profil ve etiket"
        geri={() => ekranaGit("lobi")}
        sag={
          <button className="dugme dugme--birincil dugme--kucuk" disabled={!degisti && ad.trim() === p.ad} onClick={kaydet}>
            Kaydet
          </button>
        }
      />
      <div className="profil__icerik">
        <aside className="kart profil__onizleme">
          <div className="profil__etiket-sahne">
            <IsimEtiketi ad={ad || p.ad} seviye={p.seviye} etiket={etiket} boyut="buyuk" />
          </div>
          <SeviyeCubugu mevcut={p.seviyeIlerleme.mevcut} gereken={p.seviyeIlerleme.gereken} />
          <input className="girdi girdi--kucuk" value={ad} maxLength={16} onChange={(e) => setAd(e.target.value)} aria-label="Takma ad" />
          <dl className="istatistik">
            <div><dt>Oynanan</dt><dd>{cipBicim(ist.oynanan)}</dd></div>
            <div><dt>Kazanılan</dt><dd>{cipBicim(ist.kazanilan)} <small>%{oran}</small></dd></div>
            <div><dt>Çift</dt><dd>{ist.cift}</dd></div>
            <div><dt>Okey atarak</dt><dd>{ist.okeyAtarak}</dd></div>
          </dl>
        </aside>

        <section className="kart profil__susler">
          <div className="sekmeler">
            {(["cerceve", "rozet", "unvan"] as const).map((s) => (
              <button key={s} className={`sekme ${sekme === s ? "sekme--secili" : ""}`} onClick={() => setSekme(s)}>
                {{ cerceve: "Çerçeve", rozet: "Rozet", unvan: "Unvan" }[s]}
              </button>
            ))}
          </div>
          <div className="sus-izgara">
            {sekme === "cerceve" &&
              CERCEVELER.map((c) => (
                <SusKarti key={c.id} ad={c.ad} kosul={c.kosul} acik={acik(c.kosul)} secili={etiket.cerceve === c.id}
                  sec={() => setEtiket({ ...etiket, cerceve: c.id })}>
                  <span className={`sus-cerceve ${c.parlak ? "etiket--parlak" : ""}`} style={{ "--cerceve": c.stil } as CSSProperties} />
                </SusKarti>
              ))}
            {sekme === "rozet" &&
              ROZETLER.map((r) => (
                <SusKarti key={r.id} ad={r.ad} kosul={r.kosul} acik={acik(r.kosul)} secili={etiket.rozet === r.id}
                  sec={() => setEtiket({ ...etiket, rozet: r.id })}>
                  <span className="sus-rozet">{r.simge || "—"}</span>
                </SusKarti>
              ))}
            {sekme === "unvan" &&
              UNVANLAR.map((u) => (
                <SusKarti key={u.id} ad={u.ad || "Unvan yok"} kosul={u.kosul} acik={acik(u.kosul)} secili={etiket.unvan === u.id}
                  sec={() => setEtiket({ ...etiket, unvan: u.id })}>
                  <span className="sus-unvan" style={{ color: u.renk }}>{u.ad || "—"}</span>
                </SusKarti>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SusKarti(o: { ad: string; kosul: Kosul; acik: boolean; secili: boolean; sec: () => void; children: ReactNode }) {
  return (
    <button
      className={`sus ${o.secili ? "sus--secili" : ""} ${o.acik ? "" : "sus--kilitli"}`}
      disabled={!o.acik}
      onClick={o.sec}
    >
      <div className="sus__gorsel">{o.children}</div>
      <div className="sus__ad">{o.ad}</div>
      {!o.acik && (
        <div className="sus__kosul">
          <Simge ad="kilit" boyut={12} /> {kosulMetni(o.kosul)}
        </div>
      )}
    </button>
  );
}
