// SADECE GELİŞTİRME: 101 masasını oyunun ortasında, sahte verilerle görmek için.
// OyunSaglayici bunu yalnızca `import.meta.env.DEV` iken dinamik olarak yükler; üretim
// paketine girmez. Tarayıcı konsolundan (ya da ekran görüntüsü betiğinden):
//   __okey101Onizle("orta")     → iki rakip açmış, ben açabilirim (Aç düğmesi etkin)
//   __okey101Onizle("yan")      → sıra bende, çekeceğim; yandaki taş işime yaramıyor (101 uyarısı)
//   __okey101Onizle("acik")     → ben de açmışım; elimdeki taşlar masadaki perlere işlenebilir
//   __okey101Onizle("bos")      → kimse açmamış, sıra bende ve çekeceğim (boş masa, deste yuvası)
//   __okey101Onizle("kalabalik")→ herkes açmış: iki seri, iki çift; çok per (taşlar küçülür)
//   __okey101Onizle("elSonu")   → 2. el bitti (sağdaki okeyle bitirdi)
//   __okey101Onizle("macSonu")  → 4. el bitti, maçı ben kazandım
//   __okey101Onizle(s, true)    → antrenman yerine online oda gibi (çip ve XP görünür; ?onizleme=1 ile)
// Hamleler bir yere gitmez (antrenman odası yok); sadece görünüm içindir.
//
// Gerçek 101 antrenmanında (telefondaki Oda) elimi hazırlamak için:
//   __okey101ElHazirla("ac")    → (sıra bende, taş çekmişken) elim 106 ile açılabilir olur
//   __okey101ElHazirla("isle")  → elime kırmızı 9 ve sarı 11 eklenir (açtıktan sonra işlemek için)
import { type AcikPer, ciftGecerli, type MasaGorunumu101, Oda, okeyiBul, type OdaGorunumu, perGecerli } from "@okey/kurallar";

export type Senaryo101 = "orta" | "yan" | "acik" | "bos" | "kalabalik" | "elSonu" | "macSonu";

/** Taş kimliği: renk (0 kırmızı, 1 sarı, 2 mavi, 3 siyah), sayı, kopya (0/1). */
const t = (renk: number, sayi: number, kopya = 0) => renk * 26 + (sayi - 1) * 2 + kopya;
const [K, S, M, Y] = [0, 1, 2, 3];

const GOSTERGE = t(M, 6); // okey: mavi 7
const OKEY = okeyiBul(GOSTERGE);
const OKEY_TASI = t(M, 7, 1);

function per(taslar: number[]): AcikPer {
  const p = perGecerli(taslar, OKEY);
  return { tur: p?.tur ?? "seri", taslar: p?.sirali ?? taslar };
}
const cift = (a: number, b: number): AcikPer => ({ tur: "cift", taslar: ciftGecerli([a, b], OKEY)?.sirali ?? [a, b] });
const deger = (perler: AcikPer[]) => perler.reduce((n, p) => n + (perGecerli(p.taslar, OKEY)?.deger ?? 0), 0);

// Soldaki (koltuk 3) seri açmış; perlerinden birinde okey sarı 5'in yerinde duruyor.
const SOL: AcikPer[] = [per([t(M, 10, 1), t(M, 11, 1), t(M, 12), t(M, 13)]), per([t(K, 12, 1), t(S, 12), t(Y, 12)]), per([t(S, 4), OKEY_TASI, t(S, 6)]), per([t(Y, 8), t(Y, 9), t(Y, 10)])];
// Karşıdaki (koltuk 2) çift açmış.
const UST: AcikPer[] = [cift(t(K, 3), t(K, 3, 1)), cift(t(M, 8), t(M, 8, 1)), cift(t(Y, 13), t(Y, 13, 1)), cift(t(S, 13), t(S, 13, 1)), cift(t(K, 1), t(K, 1, 1))];

// Sağdaki (koltuk 1) de çift açmış (kalabalık masa).
const SAG: AcikPer[] = [cift(t(S, 2), t(S, 2, 1)), cift(t(M, 5), t(M, 5, 1)), cift(t(Y, 9), t(Y, 9, 1)), cift(t(K, 11), t(K, 11, 1)), cift(t(M, 12), t(M, 12, 1)), cift(t(S, 7), t(S, 7, 1))];
// Kalabalık masada soldakinin ek perleri.
const SOL_EK: AcikPer[] = [per([t(M, 1, 1), t(M, 2, 1), t(M, 3, 1), t(M, 4, 1)]), per([t(Y, 4), t(S, 4, 1), t(K, 4, 1)])];

// Benim açılabilecek elim: kırmızı 10-13 (46) + sarı 8-10 (27) + 11'ler grubu (33) = 106.
const BENIM_PERLER = [
  [t(K, 10), t(K, 11), t(K, 12), t(K, 13)],
  [t(S, 8), t(S, 9), t(S, 10)],
  [t(M, 11), t(Y, 11), t(S, 11)],
];
const BENIM_DIGER = [t(K, 2), t(S, 3), t(M, 4), t(Y, 6), t(M, 1), t(K, 5), t(S, 1), t(Y, 2), t(M, 13, 1), t(K, 7), t(S, 5), t(Y, 7)];

function masa(s: Senaryo101): MasaGorunumu101 {
  const acik = s !== "orta" && s !== "yan" && s !== "bos";
  const kalabalik = s === "kalabalik";
  const bos = s === "bos";
  const benimPerler = acik ? BENIM_PERLER.map(per) : [];
  const el = acik ? [...BENIM_DIGER] : [...BENIM_PERLER.flat(), ...BENIM_DIGER];
  // "yan": henüz çekmedim (21 taş)
  if (s === "yan" || bos) el.pop();
  return {
    oyun: "101",
    koltuk: 0,
    el,
    tasSayilari: [el.length, 20, 11, 9],
    atilanlar: [
      [t(Y, 1), t(K, 8)],
      [t(M, 2), t(S, 2), t(K, 4)],
      [t(Y, 5), t(M, 3)],
      [t(K, 6), t(S, 7, 1), t(Y, 3, 1)],
    ],
    ortaSayisi: 31,
    gosterge: GOSTERGE,
    okey: OKEY,
    sira: 0,
    asama: s === "yan" || bos ? "cek" : "at",
    gostergeGosterebilir: false,
    gostergeGosteren: null,
    acma: bos ? [null, null, null, null] : [acik ? "seri" : null, kalabalik ? "cift" : null, "cift", "seri"],
    acmaDegeri: bos ? [null, null, null, null] : [acik ? deger(benimPerler) : null, kalabalik ? SAG.length : null, UST.length, deger(SOL)],
    perler: bos ? [[], [], [], []] : [benimPerler, kalabalik ? SAG : [], UST, kalabalik ? [...SOL, ...SOL_EK] : SOL],
    yandanAlinan: null,
    buTurActi: false,
    cezalar: bos ? [0, 0, 0, 0] : [0, 0, 101, 0],
    sonuc: null,
  };
}

function oda(s: Senaryo101, online: boolean): OdaGorunumu {
  const m = masa(s);
  const base: OdaGorunumu = {
    kod: online ? "K7M2Q" : "ANTRN",
    oyun: "101",
    salon: online ? "kahvehane" : "antrenman",
    giris: online ? 500 : 0,
    sahipId: "onizleme",
    koltuklar: [
      { tur: "insan", oyuncu: { id: "onizleme", ad: "Mustafa", seviye: 33, etiket: { cerceve: "altin", rozet: "cay", unvan: "usta" } }, bagli: true },
      { tur: "bot", ad: "Elif" },
      { tur: "bot", ad: "Hasan" },
      { tur: "bot", ad: "Zeynep" },
    ],
    benimKoltugum: 0,
    oyunda: true,
    masa: m,
    mac: { elNo: 2, elSayisi: 4, puanlar: [[34, 202, -101, 15]], toplam: [34, 202, -101, 15], kazananlar: null },
    turBitis: Date.now() + 22_000,
    turKalanMs: 22_000,
    turSuresiMs: 30_000,
    sonEl: null,
    elNo: 2,
  };
  if (s === "elSonu") {
    const puanlar = [92, -202, 60, 404];
    const sonuc = { tur: "bitti" as const, koltuk: 1, okeyle: true, elden: false, puanlar };
    return {
      ...base,
      masa: { ...m, sonuc, sira: 1 },
      turBitis: null,
      turKalanMs: null,
      mac: { elNo: 2, elSayisi: 4, puanlar: [[34, 202, -101, 15], puanlar], toplam: [126, 0, -41, 419], kazananlar: null },
      sonEl: { sonuc, macBitti: false, cipDegisimi: [0, 0, 0, 0], xp: [0, 0, 0, 0], sonrakiEl: Date.now() + 12_000 },
    };
  }
  if (s === "macSonu") {
    const puanlar = [-202, 64, 202, 101];
    const sonuc = { tur: "bitti" as const, koltuk: 0, okeyle: false, elden: true, puanlar };
    const tablo = [[34, 202, -101, 15], [92, -202, 60, 404], [-101, 58, 120, 33], puanlar];
    const toplam = [0, 1, 2, 3].map((k) => tablo.reduce((n, el) => n + el[k], 0));
    return {
      ...base,
      elNo: 4,
      masa: { ...m, sonuc },
      turBitis: null,
      turKalanMs: null,
      mac: { elNo: 4, elSayisi: 4, puanlar: tablo, toplam, kazananlar: [0] },
      sonEl: { sonuc, macBitti: true, cipDegisimi: [1500, -500, -500, -500], xp: [60, 0, 0, 0], sonrakiEl: Date.now() + 15_000 },
    };
  }
  return base;
}

/** window.__okey101Onizle(senaryo, online) kancasını kurar; goster, odayı duruma yazar. */
export function onizlemeKancasiniKur(goster: (oda: OdaGorunumu, antrenman: boolean) => void) {
  const w = window as unknown as { __okey101Onizle?: (s?: Senaryo101, online?: boolean) => string };
  w.__okey101Onizle = (s = "orta", online = false) => {
    goster(oda(s, online), !online);
    return "tamam";
  };
}

// ---------------------------------------------------------------------------
// Gerçek antrenman odasında elimi hazırlamak (gelistirme.ts'teki __okeyBitirHazirla gibi):
// Oda'nın görünüm fonksiyonu bir kez sarılarak odaya erişilir. Online oyunda işe yaramaz.
// ---------------------------------------------------------------------------
type OdaIc = { masa: { eller: number[][]; asama: string; sira: number } | null; koltukBul(id: string): number; yayinla(): void };
let sonOda: { oda: OdaIc; id: string } | null = null;
let kuruldu = false;

export function elHazirlaKancasiniKur() {
  if (kuruldu) return;
  kuruldu = true;
  const asil = Oda.prototype.gorunum;
  Oda.prototype.gorunum = function (this: Oda, id: string) {
    sonOda = { oda: this as unknown as OdaIc, id };
    return asil.call(this, id);
  };
  const w = window as unknown as { __okey101ElHazirla?: (n?: "ac" | "isle") => string };
  w.__okey101ElHazirla = (n = "ac") => {
    const o = sonOda;
    if (!o?.oda.masa) return "oda yok (bir hamle bekleyin)";
    const k = o.oda.koltukBul(o.id);
    const m = o.oda.masa;
    if (m.sira !== k || m.asama !== "at") return "sıra sende değil ya da önce taş çekmelisin";
    const el = m.eller[k];
    if (n === "ac") el.splice(0, el.length, ...BENIM_PERLER.flat(), ...BENIM_DIGER);
    else el.push(t(K, 9, 1), t(S, 11, 1));
    o.oda.yayinla();
    return "tamam";
  };
}
