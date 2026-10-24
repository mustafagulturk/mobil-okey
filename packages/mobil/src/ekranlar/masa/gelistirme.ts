// SADECE GELİŞTİRME: sonuç penceresini beklemeden görmek için sahte el sonu.
// MasaEkrani bunu yalnızca `import.meta.env.DEV` iken dinamik olarak yükler; üretim
// paketine girmez. Tarayıcı konsolundan:
//   __okeySonucDene()                         → ben kazandım (normal)
//   __okeySonucDene({ okey: true })           → ben okey atarak kazandım
//   __okeySonucDene({ kazanan: 1 })           → sağdaki kazandı
//   __okeySonucDene(null)                     → gerçek duruma dön
import type { OdaGorunumu } from "@okey/kurallar";

export interface SahteSonuc {
  kazanan?: number; // göreli koltuk: 0 ben, 1 sağ, 2 üst, 3 sol
  okey?: boolean;
}

export function sahteSonucOdasi(oda: OdaGorunumu, s: SahteSonuc): OdaGorunumu {
  const masa = oda.masa!;
  const ben = masa.koltuk;
  const kazanan = (ben + (s.kazanan ?? 0)) % 4;
  const el = [...masa.el];
  const parca = [3, 4, 3, 4];
  const perler: number[][] = [];
  let i = 0;
  for (const p of parca) {
    if (i + p > el.length) break;
    perler.push(el.slice(i, i + p));
    i += p;
  }
  const atilan = el[i] ?? el[0];
  const sonuc = {
    tur: "kazanan" as const,
    koltuk: kazanan,
    bitis: s.okey ? ("okeyAtarak" as const) : ("normal" as const),
    perler,
    atilan,
  };
  const cip = s.okey ? 1600 : 800;
  return {
    ...oda,
    masa: { ...masa, sonuc },
    sonEl: {
      sonuc,
      cipDegisimi: [0, 1, 2, 3].map((k) => (k === kazanan ? cip * 3 : -cip)),
      xp: [0, 1, 2, 3].map((k) => (k === kazanan ? 40 : 12)),
      sonrakiEl: Date.now() + 12_000,
    },
  };
}
