// Profil ve isim etiketi düzenleme. Süsler seviye ve başarımlarla açılır, satılmaz.
// Solda büyük canlı önizleme (seçim anında görünür), sağda çerçeve/rozet/unvan sekmeleri.
// Kilitli süs buzlu cam altında görünür; üstünde nasıl açılacağı ve ilerleme yazar.
import {
  CERCEVELER,
  type Etiket,
  type Istatistik,
  kosulMetni,
  kosulSaglandiMi,
  type Kosul,
  ROZETLER,
  UNVANLAR,
} from "@okey/kurallar";
import { type CSSProperties, type ReactNode, useState } from "react";
import { IsimEtiketi } from "../bilesenler/IsimEtiketi.tsx";
import { Simge } from "../bilesenler/Simge.tsx";
import { useOyun } from "../durum/OyunSaglayici.tsx";
import { SayiSayaci } from "../efektler/SayiSayaci.tsx";
import { cipBicim } from "../yardimci/bicim.ts";
import { AltSekmeler, AltUstCubuk, EkSimge, sira } from "./alt/ortak.tsx";

type Sekme = "cerceve" | "rozet" | "unvan";

/** Koşulun ilerlemesi: seviye için mevcut seviye / gereken, istatistik için sayaç / hedef. */
function ilerleme(k: Kosul, seviye: number, ist: Istatistik): { mevcut: number; hedef: number } | null {
  if ("herkese" in k) return null;
  if ("seviye" in k) return { mevcut: Math.min(seviye, k.seviye), hedef: k.seviye };
  return { mevcut: Math.min(ist[k.istatistik], k.enAz), hedef: k.enAz };
}

export function Profil() {
  const { durum, gonder, ekranaGit, bildir } = useOyun();
  const p = durum.profil!;
  const [etiket, setEtiket] = useState<Etiket>(p.etiket);
  const [sekme, setSekme] = useState<Sekme>("cerceve");
  const [ad, setAd] = useState(p.ad);

  const acik = (k: Kosul) => kosulSaglandiMi(k, p.seviye, p.istatistik);
  const degisti = JSON.stringify(etiket) !== JSON.stringify(p.etiket);
  const kaydedilebilir = degisti || (ad.trim() !== p.ad && ad.trim().length > 0);

  const kaydet = () => {
    if (degisti) gonder({ t: "etiketSec", ...etiket });
    if (ad.trim() && ad.trim() !== p.ad) gonder({ t: "adDegistir", ad: ad.trim() });
    bildir("Etiketin kaydedildi", "basari");
  };

  const ist = p.istatistik;
  const oran = ist.oynanan ? Math.round((ist.kazanilan / ist.oynanan) * 100) : 0;
  const seviyeOrani = Math.min(1, p.seviyeIlerleme.gereken > 0 ? p.seviyeIlerleme.mevcut / p.seviyeIlerleme.gereken : 0);

  const sayac = (liste: { kosul: Kosul }[]) => `${liste.filter((x) => acik(x.kosul)).length}/${liste.length}`;

  return (
    <div className="ekran alt-ekran profil">
      <AltUstCubuk
        baslik="Profil ve etiket"
        alt="Süsler seviye ve başarımla açılır"
        geri={() => ekranaGit("lobi")}
        sag={
          <button className={`profil__kaydet ${kaydedilebilir ? "profil__kaydet--hazir" : ""}`} disabled={!kaydedilebilir} onClick={kaydet}>
            <EkSimge ad="tik" boyut={16} /> Kaydet
          </button>
        }
      />
      <div className="profil__icerik">
        <aside className="profil__onizleme alt-giris" style={sira(1)}>
          <div className="profil__sahne">
            <span className="profil__spot" aria-hidden />
            <div className="profil__etiket" key={JSON.stringify(etiket)}>
              <IsimEtiketi ad={ad.trim() || p.ad} seviye={p.seviye} etiket={etiket} boyut="buyuk" />
            </div>
            <span className="profil__canli">Canlı önizleme</span>
          </div>

          <div className="profil__seviye">
            <span className="profil__seviye-no">Sv. {p.seviye}</span>
            <div className="metal-cubuk">
              <div className="metal-cubuk__dolu" style={{ width: `${seviyeOrani * 100}%` }} />
            </div>
            <span className="profil__seviye-xp">
              {cipBicim(p.seviyeIlerleme.mevcut)} / {cipBicim(p.seviyeIlerleme.gereken)} XP
            </span>
          </div>

          <label className="profil__ad">
            <Simge ad="profil" boyut={15} />
            <input value={ad} maxLength={16} onChange={(e) => setAd(e.target.value)} aria-label="Takma ad" />
          </label>

          <div className="ist-madalyonlar">
            <IstMadalyon etiket="Oynanan" deger={ist.oynanan} simge={<Simge ad="oyna" boyut={13} />} />
            <IstMadalyon etiket="Kazanılan" deger={ist.kazanilan} ek={`%${oran}`} simge={<Simge ad="kupa" boyut={13} />} />
            <IstMadalyon etiket="Çift" deger={ist.cift} simge={<Simge ad="kalp" boyut={13} />} />
            <IstMadalyon etiket="Okey" deger={ist.okeyAtarak} simge={<EkSimge ad="yildiz" boyut={13} />} />
          </div>
        </aside>

        <section className="profil__susler alt-giris" style={sira(2)}>
          <AltSekmeler
            secili={sekme}
            sec={setSekme}
            secenekler={[
              { id: "cerceve", ad: <>Çerçeve <small>{sayac(CERCEVELER)}</small></> },
              { id: "rozet", ad: <>Rozet <small>{sayac(ROZETLER)}</small></> },
              { id: "unvan", ad: <>Unvan <small>{sayac(UNVANLAR)}</small></> },
            ]}
          />
          <div className="sus-izgara" key={sekme}>
            {sekme === "cerceve" &&
              CERCEVELER.map((c, i) => (
                <SusKarti key={c.id} i={i} ad={c.ad} kosul={c.kosul} seviye={p.seviye} ist={ist} secili={etiket.cerceve === c.id}
                  sec={() => setEtiket({ ...etiket, cerceve: c.id })}>
                  <span className={`sus-cerceve ${c.parlak ? "etiket--parlak" : ""}`} style={{ "--cerceve": c.stil } as CSSProperties} />
                </SusKarti>
              ))}
            {sekme === "rozet" &&
              ROZETLER.map((r, i) => (
                <SusKarti key={r.id} i={i} ad={r.ad} kosul={r.kosul} seviye={p.seviye} ist={ist} secili={etiket.rozet === r.id}
                  sec={() => setEtiket({ ...etiket, rozet: r.id })}>
                  <span className="sus-rozet">{r.simge || <span className="sus-bos">—</span>}</span>
                </SusKarti>
              ))}
            {sekme === "unvan" &&
              UNVANLAR.map((u, i) => (
                <SusKarti key={u.id} i={i} ad={u.ad || "Unvan yok"} kosul={u.kosul} seviye={p.seviye} ist={ist} secili={etiket.unvan === u.id}
                  sec={() => setEtiket({ ...etiket, unvan: u.id })}>
                  <span className="sus-unvan" style={{ color: u.renk }}>{u.ad || <span className="sus-bos">—</span>}</span>
                </SusKarti>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function IstMadalyon({ etiket, deger, ek, simge }: { etiket: string; deger: number; ek?: string; simge: ReactNode }) {
  return (
    <div className="ist-madalyon">
      <div className="ist-madalyon__disk">
        <span className="ist-madalyon__simge">{simge}</span>
        <SayiSayaci deger={deger} bicim={(n) => cipBicim(Math.round(n))} className="ist-madalyon__sayi" />
      </div>
      <div className="ist-madalyon__etiket">
        {etiket}
        {ek && <small>{ek}</small>}
      </div>
    </div>
  );
}

function SusKarti(o: { i: number; ad: string; kosul: Kosul; seviye: number; ist: Istatistik; secili: boolean; sec: () => void; children: ReactNode }) {
  const a = kosulSaglandiMi(o.kosul, o.seviye, o.ist);
  const il = a ? null : ilerleme(o.kosul, o.seviye, o.ist);
  return (
    <button
      className={`sus alt-giris ${o.secili ? "sus--secili" : ""} ${a ? "sus--acik" : "sus--kilitli"}`}
      style={sira(o.i * 0.6)}
      disabled={!a}
      aria-pressed={o.secili}
      onClick={o.sec}
    >
      <div className="sus__gorsel">{o.children}</div>
      <div className="sus__ad">{o.ad}</div>
      {o.secili && (
        <span className="sus__tik" aria-hidden>
          <EkSimge ad="tik" boyut={11} />
        </span>
      )}
      {!a && (
        <div className="sus__buz">
          <span className="sus__kilit">
            <Simge ad="kilit" boyut={14} />
          </span>
          <span className="sus__kosul">
            {kosulMetni(o.kosul)}
            {il && ` — ${cipBicim(il.mevcut)}/${cipBicim(il.hedef)}`}
          </span>
          {il && (
            <span className="sus__ilerleme">
              <i style={{ width: `${(il.mevcut / il.hedef) * 100}%` }} />
            </span>
          )}
        </div>
      )}
    </button>
  );
}
