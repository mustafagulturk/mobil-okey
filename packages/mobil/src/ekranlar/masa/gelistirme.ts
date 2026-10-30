// SADECE GELİŞTİRME: sonuç penceresini beklemeden görmek için sahte el sonu.
// MasaEkrani bunu yalnızca `import.meta.env.DEV` iken dinamik olarak yükler; üretim
// paketine girmez. Tarayıcı konsolundan:
//   __okeySonucDene()                         → ben kazandım (normal)
//   __okeySonucDene({ okey: true })           → ben okey atarak kazandım
//   __okeySonucDene({ kazanan: 1 })           → sağdaki kazandı
//   __okeySonucDene(null)                     → gerçek duruma dön
import { Oda, type OdaGorunumu } from "@okey/kurallar";

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
      macBitti: true,
      cipDegisimi: [0, 1, 2, 3].map((k) => (k === kazanan ? cip * 3 : -cip)),
      xp: [0, 1, 2, 3].map((k) => (k === kazanan ? 40 : 12)),
      sonrakiEl: Date.now() + 12_000,
    },
  };
}

// ---------------------------------------------------------------------------
// SADECE GELİŞTİRME: sürükleyerek bitirmeyi denemek için kazanan el.
//   __okeyBitirHazirla()  → (sıra bende, taş çekmişken) elim bitmeye hazır 15 taş olur:
//                           kırmızı 1-4, sarı 5-7, mavi 9-12, siyah 1-3 + siyah 13 (atılacak).
// Antrenman odası (kurallar paketindeki Oda) telefonda çalıştığı için, Oda'nın görünüm
// fonksiyonu bir kez sarılarak odaya erişilir. Online oyunda işe yaramaz.
// ---------------------------------------------------------------------------
type OdaIc = { masa: { eller: number[][]; asama: string; sira: number } | null; koltukBul(id: string): number; yayinla(): void };
let sonOda: { oda: OdaIc; id: string } | null = null;
let kuruldu = false;

export function bitirKancasiniKur() {
  if (kuruldu) return;
  kuruldu = true;
  const asil = Oda.prototype.gorunum;
  Oda.prototype.gorunum = function (this: Oda, id: string) {
    sonOda = { oda: this as unknown as OdaIc, id };
    return asil.call(this, id);
  };
  const w = window as unknown as { __okeyBitirHazirla?: () => string };
  w.__okeyBitirHazirla = () => {
    const o = sonOda;
    if (!o?.oda.masa) return "oda yok (bir hamle bekleyin)";
    const k = o.oda.koltukBul(o.id);
    const m = o.oda.masa;
    if (m.sira !== k || m.asama !== "at") return "sıra sende değil ya da önce taş çekmelisin";
    const id = (renk: number, sayi: number) => renk * 26 + (sayi - 1) * 2;
    const el = [
      ...[1, 2, 3, 4].map((s) => id(0, s)),
      ...[5, 6, 7].map((s) => id(1, s)),
      ...[9, 10, 11, 12].map((s) => id(2, s)),
      ...[1, 2, 3].map((s) => id(3, s)),
      id(3, 13),
    ];
    m.eller[k].splice(0, m.eller[k].length, ...el);
    o.oda.yayinla();
    return "tamam";
  };
}
