// Alt ekranların (mağaza, profil, görevler, sıralama, ayarlar) ortak parçaları:
// tutarlı üst çubuk, sıralı açılış animasyonu yardımcısı ve birkaç küçük simge.
import type { CSSProperties, ReactNode } from "react";
import { CipSimgesi, Simge } from "../../bilesenler/Simge.tsx";
import { useOyun } from "../../durum/OyunSaglayici.tsx";
import { SayiSayaci } from "../../efektler/SayiSayaci.tsx";
import { cipBicim } from "../../yardimci/bicim.ts";

/** Öğelerin sırayla gelmesi için: style={sira(2)} → CSS'te --i: 2. */
export function sira(i: number, ek?: CSSProperties): CSSProperties {
  return { ...ek, "--i": i } as CSSProperties;
}

/** Üst çubuk: geri düğmesi + başlık + (isteğe bağlı orta/sağ içerik) + çip. */
export function AltUstCubuk({
  baslik,
  alt,
  geri,
  orta,
  sag,
  cipGizle,
}: {
  baslik: string;
  alt?: ReactNode;
  geri: () => void;
  orta?: ReactNode;
  sag?: ReactNode;
  cipGizle?: boolean;
}) {
  const { durum } = useOyun();
  const cip = durum.profil?.cip;
  return (
    <header className="alt-ust alt-giris" style={sira(0)}>
      <button className="alt-ust__geri" onClick={geri} aria-label="Geri">
        <Simge ad="geri" boyut={22} />
      </button>
      <div className="alt-ust__baslik">
        <h1>{baslik}</h1>
        {alt && <span className="alt-ust__alt">{alt}</span>}
      </div>
      {orta && <div className="alt-ust__orta">{orta}</div>}
      <div className="alt-ust__sag">
        {sag}
        {!cipGizle && cip !== undefined && (
          <span className="alt-cip" aria-label={`${cipBicim(cip)} çip`}>
            <CipSimgesi boyut={20} />
            <SayiSayaci deger={cip} bicim={(n) => cipBicim(Math.round(n))} />
          </span>
        )}
      </div>
    </header>
  );
}

/** Sekme grubu (kayan altın gösterge ile). */
export function AltSekmeler<T extends string>({
  secenekler,
  secili,
  sec,
}: {
  secenekler: { id: T; ad: ReactNode }[];
  secili: T;
  sec: (id: T) => void;
}) {
  const i = Math.max(0, secenekler.findIndex((s) => s.id === secili));
  return (
    <div className="alt-sekmeler" role="tablist" style={{ "--n": secenekler.length, "--s": i } as CSSProperties}>
      <span className="alt-sekmeler__gosterge" aria-hidden />
      {secenekler.map((s) => (
        <button
          key={s.id}
          role="tab"
          aria-selected={s.id === secili}
          className={`alt-sekme ${s.id === secili ? "alt-sekme--secili" : ""}`}
          onClick={() => sec(s.id)}
        >
          {s.ad}
        </button>
      ))}
    </div>
  );
}

/** Simge.tsx'te olmayan birkaç çizgi simge (sadece alt ekranlarda kullanılır). */
const EK_YOLLAR = {
  saat: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2",
  ses: "M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14",
  titresim: "M8 3h8v18H8zM4 8v8M20 8v8M1.5 10v4M22.5 10v4",
  yildiz: "M12 2l2.9 6.9L22 9.6l-5.4 4.8L18.2 22 12 18.3 5.8 22l1.6-7.6L2 9.6l7.1-.7z",
  sunucu: "M3 4h18v6H3zM3 14h18v6H3zM7 7h.01M7 17h.01",
  kalkan: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  cop: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",
  goz: "M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12zM12 15a3 3 0 100-6 3 3 0 000 6z",
  disari: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3",
  tik: "M20 6L9 17l-5-5",
  hedef: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z",
} as const;

export function EkSimge({ ad, boyut = 20 }: { ad: keyof typeof EK_YOLLAR; boyut?: number }) {
  return (
    <svg
      className="simge"
      width={boyut}
      height={boyut}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={EK_YOLLAR[ad]} />
    </svg>
  );
}
