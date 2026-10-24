// Lobideki salon kartı: her salonun kendi görsel kimliği (çuha, bakır, kadife, siyah-altın),
// küçük masa illüstrasyonu, büyük giriş çipi, çip aralığı ve çevrimiçi oyuncu sayısı.
// Dokununca kart parmağın olduğu yöne hafifçe 3B eğilir (efektler açıksa).
import { salonaUygunMu, type SalonBilgisi } from "@okey/kurallar";
import { useRef, type CSSProperties, type PointerEvent } from "react";
import { CipSimgesi, Simge } from "../../bilesenler/Simge.tsx";
import { efektlerAcik } from "../../efektler/ayar.ts";
import { kisaCip, metindekiSayilariBicimle } from "../../yardimci/bicim.ts";

const ALT_YAZI: Record<string, string> = {
  caylak: "Yeni başlayanlar",
  kahvehane: "Mahallenin müdavimleri",
  usta: "Usta eller",
  aga: "Yüksek bahis",
};

interface Ozellikler {
  salon: SalonBilgisi;
  sira: number;
  cip: number;
  secili: boolean;
  sec: () => void;
}

export function SalonKarti({ salon, sira, cip, secili, sec }: Ozellikler) {
  const u = salonaUygunMu(salon, cip);
  const ref = useRef<HTMLButtonElement>(null);

  const egil = (e: PointerEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el || !u.uygun || !efektlerAcik()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--egim-x", `${(-y * 10).toFixed(2)}deg`);
    el.style.setProperty("--egim-y", `${(x * 12).toFixed(2)}deg`);
    el.style.setProperty("--isik-x", `${((x + 0.5) * 100).toFixed(0)}%`);
    el.style.setProperty("--isik-y", `${((y + 0.5) * 100).toFixed(0)}%`);
    el.classList.add("salon--basili");
  };
  const birak = () => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("salon--basili");
    el.style.setProperty("--egim-x", "0deg");
    el.style.setProperty("--egim-y", "0deg");
  };

  return (
    <div className="salon-yuva" style={{ "--sira": sira } as CSSProperties}>
      <button
        ref={ref}
        className={`salon salon--${salon.id} ${secili ? "salon--secili" : ""} ${u.uygun ? "" : "salon--kapali"}`}
        disabled={!u.uygun}
        aria-pressed={secili}
        onClick={sec}
        onPointerDown={egil}
        onPointerMove={(e) => e.buttons && egil(e)}
        onPointerUp={birak}
        onPointerLeave={birak}
        onPointerCancel={birak}
      >
        <span className="salon__doku" aria-hidden />
        <MasaCizimi />
        <span className="salon__isik" aria-hidden />

        <span className="salon__ust">
          <span className="salon__baslik">
            <span className="salon__ad">{salon.ad}</span>
            <span className="salon__alt">{ALT_YAZI[salon.id]}</span>
          </span>
          {u.uygun ? (
            <span className="salon__oyuncu" title="Çevrimiçi oyuncu">
              <i className="salon__nokta" />
              {salon.oyuncuSayisi}
            </span>
          ) : (
            <span className="salon__kilit">
              <Simge ad="kilit" boyut={14} />
            </span>
          )}
        </span>

        <span className="salon__giris">
          <CipSimgesi boyut={24} />
          <b>{kisaCip(salon.giris)}</b>
          <small>el başı</small>
        </span>

        <span className="salon__aralik">
          {u.uygun
            ? `${kisaCip(salon.enAzCip)} – ${salon.enFazlaCip === null ? "sınırsız" : kisaCip(salon.enFazlaCip)} çip`
            : metindekiSayilariBicimle(u.sebep)}
        </span>
      </button>
    </div>
  );
}

/** Kartın sağındaki küçük masa: ahşap/metal çerçeve, çuha ve üstünde birkaç taş. Renkler CSS'ten (salon temasına göre). */
function MasaCizimi() {
  return (
    <svg className="salon__cizim" viewBox="0 0 140 96" aria-hidden>
      <ellipse cx="70" cy="86" rx="62" ry="8" className="cz-golge" />
      <rect x="6" y="20" width="128" height="62" rx="16" className="cz-cerceve" />
      <rect x="13" y="27" width="114" height="48" rx="11" className="cz-cuha" />
      <rect x="13" y="27" width="114" height="48" rx="11" className="cz-cuha-isik" />
      {/* ortadaki deste */}
      <g transform="translate(60 40)">
        <rect width="20" height="14" rx="3" className="cz-deste" />
        <rect y="-3" width="20" height="14" rx="3" className="cz-deste cz-deste--ust" />
      </g>
      {/* öndeki dik duran taşlar */}
      <g className="cz-taslar">
        <Tas x={30} y={46} a={-14} renk="var(--tas-kirmizi)" sayi="7" />
        <Tas x={47} y={50} a={-5} renk="var(--tas-mavi)" sayi="8" />
        <Tas x={84} y={50} a={6} renk="var(--tas-siyah)" sayi="9" />
        <Tas x={101} y={46} a={15} renk="var(--tas-sari)" sayi="★" />
      </g>
    </svg>
  );
}

function Tas({ x, y, a, renk, sayi }: { x: number; y: number; a: number; renk: string; sayi: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${a} 8 11)`}>
      <rect y="2" width="16" height="22" rx="3" fill="#b9a57c" />
      <rect width="16" height="22" rx="3" fill="url(#cz-tas)" className="cz-tas" />
      <text x="8" y="14" textAnchor="middle" fontSize="11" fontWeight="900" fill={renk}>
        {sayi}
      </text>
    </g>
  );
}

/** Taş gradyanı bir kez tanımlanır (her kart aynı tanımı kullanır). */
export function SalonCizimTanimlari() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <linearGradient id="cz-tas" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf0" />
          <stop offset="0.7" stopColor="#f6ecd6" />
          <stop offset="1" stopColor="#e3d2ae" />
        </linearGradient>
      </defs>
    </svg>
  );
}
