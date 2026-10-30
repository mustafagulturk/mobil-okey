// Masa101: 101 Okey'de tek bir elin durumu ve kuralları.
//
// Okey'deki Masa sınıfının 101 karşılığıdır; o da ağdan, zamanlayıcıdan ve çipten
// habersizdir. Oda, oyun türüne göre Masa ya da Masa101 kurar.
//
// Kurallar (tekli 101):
//  - 4 oyuncu, başlayan 22, diğerleri 21 taş alır. Gösterge ve okey Okey'deki gibidir.
//  - Tur: ortadan ya da soldakinin attığı taştan (yan) çek, isteğe bağlı aç / işle, bir taş at.
//  - İlk açılış: perlerin toplamı en az 101 (seri açma) ya da en az 5 çift (çift açma).
//  - Açılışı yapan oyuncu aynı turda işleyemez; sonraki turlardan itibaren masadaki her
//    pere (kendi ya da başkasının) taş işleyebilir, okeyin yerine geçtiği taşı koyup okeyi alabilir.
//  - Seri açan sonraki turlarda yeni seri/grup, çift açan yeni çift açabilir.
//  - Yandan alınan taş o turda kullanılmalıdır (açmamışsa açılışta, açmışsa per/işlek olarak).
//    Kullanmadan taş atarsa 101 ceza yazılır.
//  - Masadaki bir pere işlenebilecek taşı atmak ve okey atmak (bitirme hariç) 101 cezadır.
//  - Gösterge taşının eşini ilk atışından önce gösteren oyuncunun puanından 101 düşülür.
//  - Elindeki son taşı atan oyuncu eli bitirir.
//
// El puanı (düşük iyidir):
//  - Biten oyuncu: -101. Çarpan: okeyle bitirdiyse x2, elden bitirdiyse (aynı turda açıp
//    bitirdi) x2, çift açmışsa x2.
//  - Açmamış oyuncu: 202 x çarpan.
//  - Açmış oyuncu: elinde kalan taşların toplamı x çarpan (çift açtıysa ayrıca x2).
//  - Cezalar (101'ler) ve gösterge (-101) çarpansız eklenir.
//  - Orta biterse el kimse bitirmeden kapanır, çarpan 1, biten olmaz.

import { type Eylem, KOLTUK_SAYISI, oncekiKoltuk } from "./masa.ts";
import { type Deger, okeyiBul, okeyMi, sahteMi, yeniDeste, yuzDegeri } from "./tas.ts";
import {
  ACMA_SINIRI,
  CIFT_ACMA_SINIRI,
  ciftGecerli,
  isle,
  islenebilirMi,
  kalanPuan,
  perGecerli,
  type PerTuru,
} from "./yuzbir.ts";

/** Bir maç kaç elden oluşur (her oyuncu bir kez başlar). */
export const MAC_EL_SAYISI = 4;
export const CEZA = 101;

export type Eylem101 =
  | { tur: "cek"; kaynak: "orta" | "yan" }
  | { tur: "at"; tas: number }
  | { tur: "gostergeGoster" }
  /** Per(ler) aç. Açmamış oyuncu için ilk açılıştır ve 101 / 5 çift sınırı aranır. */
  | { tur: "ac"; perler: number[][] }
  /** Masadaki bir pere taş işle. okeyAl: taşı perdeki okeyin yerine koy, okeyi al. */
  | { tur: "isle"; tas: number; koltuk: number; per: number; okeyAl?: boolean };

/** Oda'nın kabul ettiği her iki oyunun eylemleri. */
export type OyunEylemi = Eylem | Eylem101;

export interface AcikPer {
  tur: PerTuru;
  /** Ekrandaki sırayla taşlar (jokerler yerinde). */
  taslar: number[];
}

export type ElSonucu101 =
  | {
      tur: "bitti";
      koltuk: number;
      okeyle: boolean;
      elden: boolean;
      /** Bu elin koltuk başına puanı (ceza dahil). */
      puanlar: number[];
    }
  | { tur: "orta"; puanlar: number[] };

export interface MasaGorunumu101 {
  oyun: "101";
  koltuk: number;
  el: number[];
  tasSayilari: number[];
  atilanlar: number[][];
  ortaSayisi: number;
  gosterge: number;
  okey: Deger;
  sira: number;
  asama: "cek" | "at";
  gostergeGosterebilir: boolean;
  gostergeGosteren: number | null;
  /** Koltuk başına açma türü; açmamışsa null. */
  acma: ("seri" | "cift" | null)[];
  /** Koltuk başına açılışta yazılan değer (seri: toplam, çift: çift sayısı). */
  acmaDegeri: (number | null)[];
  /** Koltuk başına masadaki perler. isle eyleminde koltuk + per sırası kullanılır. */
  perler: AcikPer[][];
  /** Bu turda yandan alınıp henüz kullanılmamış taş (sadece sıradaki oyuncu için anlamlı). */
  yandanAlinan: number | null;
  /** Sıradaki oyuncu bu turda mı açtı? (Açtığı turda işleyemez.) */
  buTurActi: boolean;
  /** Koltuk başına bu eldeki cezalar (gösterge için negatif). */
  cezalar: number[];
  sonuc: ElSonucu101 | null;
}

/** Odanın tuttuğu maç durumu (sadece 101). */
export interface MacDurumu {
  /** Kaçıncı el (1'den başlar). */
  elNo: number;
  elSayisi: number;
  /** Biten ellerin puanları: puanlar[el][koltuk]. */
  puanlar: number[][];
  toplam: number[];
  /** Maç bittiyse kazanan koltuk(lar) (en düşük toplam). */
  kazananlar: number[] | null;
}

export type HamleSonucu101 = { tamam: true; bilgi?: string } | { tamam: false; hata: string };


export class Masa101 {
  readonly eller: number[][];
  readonly atilanlar: number[][] = [[], [], [], []];
  readonly orta: number[];
  readonly gosterge: number;
  readonly okey: Deger;
  sira: number;
  asama: "cek" | "at" = "at"; // başlayan 22 taşla başlar, önce atar (ya da açar)
  sonuc: ElSonucu101 | null = null;
  gostergeGosteren: number | null = null;
  /** Koltuk başına masadaki perler; isle eylemi bunlara { koltuk, per sırası } ile ulaşır. */
  readonly perler: AcikPer[][] = [[], [], [], []];
  /** Koltuk başına açma türü (açmamışsa null) ve açılışta yazılan değer. */
  readonly acma: ("seri" | "cift" | null)[] = [null, null, null, null];
  readonly acmaDegeri: (number | null)[] = [null, null, null, null];
  /** Koltuk başına bu eldeki cezalar: +101'ler, gösterge için -101. */
  readonly cezalar: number[] = [0, 0, 0, 0];
  /** Kendi ilk atışını yapmış koltuklar. Gösterge sadece ilk atıştan önce gösterilebilir. */
  private readonly ilkAtisYapti = [false, false, false, false];

  // Sıradaki oyuncunun bu turuna ait durum; her yeni turda sıfırlanır.
  /** Bu turda yandan alınıp henüz bir pere girmemiş taş. Atış anında hâlâ duruyorsa ceza. */
  private yandanAlinan: number | null = null;
  /** Oyuncu ilk açılışını bu turda mı yaptı? Öyleyse işleyemez; bu turda biterse "elden" biter. */
  private buTurActi = false;

  constructor(baslayan: number, rastgele: () => number) {
    const deste = yeniDeste(rastgele);
    // Gösterge sahte okey olamaz; destenin ilk normal taşı gösterge olur.
    const gi = deste.findIndex((id) => !sahteMi(id));
    this.gosterge = deste.splice(gi, 1)[0];
    this.okey = okeyiBul(this.gosterge);
    this.eller = [0, 1, 2, 3].map((k) => deste.splice(0, k === baslayan ? 22 : 21));
    this.orta = deste; // 106 - 85 - 1 = 20 taş
    this.sira = baslayan;
  }

  hamle(koltuk: number, eylem: OyunEylemi): HamleSonucu101 {
    if (this.sonuc) return hata("El bitti");
    if (eylem.tur === "bitir") return hata("101'de bitirmek için son taşını at");
    if (eylem.tur === "gostergeGoster") return this.gostergeGoster(koltuk);
    if (koltuk !== this.sira) return hata("Sıra sende değil");
    switch (eylem.tur) {
      case "cek":
        return this.cek(koltuk, eylem.kaynak);
      case "ac":
        return this.ac(koltuk, eylem.perler);
      case "isle":
        return this.isle(koltuk, eylem.tas, eylem.koltuk, eylem.per, eylem.okeyAl ?? false);
      case "at":
        return this.at(koltuk, eylem.tas);
      default:
        return hata("Bilinmeyen hamle");
    }
  }

  private cek(koltuk: number, kaynak: "orta" | "yan"): HamleSonucu101 {
    if (this.asama !== "cek") return hata("Önce taş atmalısın");
    const el = this.eller[koltuk];
    if (kaynak === "orta") {
      if (this.orta.length === 0) return hata("Ortada taş kalmadı");
      el.push(this.orta.pop()!);
    } else {
      const yan = this.atilanlar[oncekiKoltuk(koltuk)];
      if (yan.length === 0) return hata("Yanda taş yok");
      const tas = yan.pop()!;
      el.push(tas);
      // Yandan alınan taş bu turda bir pere girmeli; girmezse atışta ceza yazılır.
      this.yandanAlinan = tas;
    }
    this.asama = "at";
    return { tamam: true };
  }

  /**
   * Per(ler) açma. Açmamış oyuncu için ilk açılıştır: hepsi seri/grup ise toplam en az 101,
   * hepsi çift ise en az 5 çift olmalıdır. Açmış oyuncu açtığı türde (seri açan seri/grup,
   * çift açan çift) sınırsız per açabilir.
   */
  private ac(koltuk: number, perler: number[][]): HamleSonucu101 {
    if (this.asama !== "at") return hata("Önce taş çekmelisin");
    const el = this.eller[koltuk];
    if (perler.length === 0) return hata("Açılacak per yok");
    const hepsi = perler.flat();
    if (new Set(hepsi).size !== hepsi.length) return hata("Aynı taş iki kez kullanılamaz");
    if (hepsi.some((id) => !el.includes(id))) return hata("Bu taşlar elinde değil");
    // Elde en az bir taş kalmalı: el, son taşı atarak biter.
    if (el.length - hepsi.length < 1) return hata("Atmak için elinde en az bir taş kalmalı");

    const ciftMi = perler.every((p) => p.length === 2);
    if (!ciftMi && perler.some((p) => p.length === 2)) return hata("Çift ve seri birlikte açılamaz");
    const bilgiler = perler.map((p) => (ciftMi ? ciftGecerli(p, this.okey) : perGecerli(p, this.okey)));
    if (bilgiler.some((b) => b === null)) return hata("Geçersiz per");
    const toplam = bilgiler.reduce((t, b) => t + b!.deger, 0);

    const acma = this.acma[koltuk];
    let bilgi: string | undefined;
    if (acma === null) {
      if (ciftMi && perler.length < CIFT_ACMA_SINIRI) return hata(`Çift açmak için en az ${CIFT_ACMA_SINIRI} çift gerekir`);
      if (!ciftMi && toplam < ACMA_SINIRI) return hata(`Açmak için en az ${ACMA_SINIRI} gerekir (${toplam})`);
      if (this.yandanAlinan !== null && !hepsi.includes(this.yandanAlinan)) {
        return hata("Yandan aldığın taşı açılışta kullanmalısın");
      }
      this.acma[koltuk] = ciftMi ? "cift" : "seri";
      this.acmaDegeri[koltuk] = ciftMi ? perler.length : toplam;
      this.buTurActi = true;
      bilgi = ciftMi ? `${perler.length} çift açtın` : `${toplam} ile açtın`;
    } else if (acma === "seri" && ciftMi) {
      return hata("Seri açtın, çift açamazsın");
    } else if (acma === "cift" && !ciftMi) {
      return hata("Çift açtın, sadece çift açabilirsin");
    }

    for (const id of hepsi) el.splice(el.indexOf(id), 1);
    bilgiler.forEach((b) => this.perler[koltuk].push({ tur: b!.tur, taslar: b!.sirali }));
    if (this.yandanAlinan !== null && hepsi.includes(this.yandanAlinan)) this.yandanAlinan = null;
    return bilgi ? { tamam: true, bilgi } : { tamam: true };
  }

  /** Masadaki bir pere (perKoltuk'un per'inci perine) taş işleme ya da okey alma. */
  private isle(koltuk: number, tas: number, perKoltuk: number, perNo: number, okeyAl: boolean): HamleSonucu101 {
    if (this.asama !== "at") return hata("Önce taş çekmelisin");
    if (this.acma[koltuk] === null) return hata("İşlemek için önce açmalısın");
    if (this.buTurActi) return hata("Açtığın turda işleyemezsin");
    const el = this.eller[koltuk];
    if (!el.includes(tas)) return hata("Bu taş elinde değil");
    const hedef = this.perler[perKoltuk]?.[perNo];
    if (!hedef) return hata("Böyle bir per yok");
    const sonuc = isle(hedef.taslar, hedef.tur, tas, this.okey, okeyAl);
    if (!sonuc) return hata(okeyAl ? "Bu taş okeyin yerine geçmiyor" : "Bu taş bu pere işlenmez");
    // Okey almada el küçülmez (taş gider, okey gelir); uzatmada elde bir taş kalmalı.
    if (sonuc.alinanOkey === null && el.length < 2) return hata("Atmak için elinde en az bir taş kalmalı");

    el.splice(el.indexOf(tas), 1);
    if (sonuc.alinanOkey !== null) el.push(sonuc.alinanOkey);
    hedef.taslar = sonuc.per;
    if (tas === this.yandanAlinan) this.yandanAlinan = null;
    return sonuc.alinanOkey !== null ? { tamam: true, bilgi: "Okeyi aldın" } : { tamam: true };
  }

  private at(koltuk: number, tas: number): HamleSonucu101 {
    if (this.asama !== "at") return hata("Önce taş çekmelisin");
    const el = this.eller[koltuk];
    const i = el.indexOf(tas);
    if (i === -1) return hata("Bu taş elinde değil");

    // Cezalar hamleyi reddetmez; puana yazılır ve oyuncuya bilgi olarak söylenir.
    const bilgiler: string[] = [];
    const ceza = (mesaj: string) => {
      this.cezalar[koltuk] += CEZA;
      bilgiler.push(`${mesaj}: ${CEZA} ceza`);
    };
    const bitiyor = el.length === 1;
    if (this.yandanAlinan !== null) ceza("Yandan aldığın taşı kullanmadın");
    // Son taşı atan biter: okeyle bitirmek ceza değil ödüldür, işlek taşla bitirmek de serbesttir.
    if (!bitiyor) {
      if (okeyMi(tas, this.okey)) ceza("Okey attın");
      else if (islenebilirMi(tas, this.perler.flat(), this.okey)) ceza("İşlek taş attın");
    }

    el.splice(i, 1);
    this.atilanlar[koltuk].push(tas);
    this.ilkAtisYapti[koltuk] = true;
    if (bitiyor) {
      this.sonuc = this.bitisSonucu(koltuk, okeyMi(tas, this.okey));
      bilgiler.push("Eli bitirdin");
    } else if (this.orta.length === 0) {
      // Orta bitti ve kimse bitiremedi.
      this.sonuc = { tur: "orta", puanlar: this.puanlar(null, 1) };
    } else {
      this.sira = (koltuk + 1) % KOLTUK_SAYISI;
      this.asama = "cek";
      this.yandanAlinan = null;
      this.buTurActi = false;
    }
    return bilgiler.length ? { tamam: true, bilgi: bilgiler.join(" · ") } : { tamam: true };
  }

  private bitisSonucu(koltuk: number, okeyle: boolean): ElSonucu101 {
    // Elden: tur başında açmamıştı, bu turda açıp bitirdi.
    const elden = this.buTurActi;
    const carpan = (okeyle ? 2 : 1) * (elden ? 2 : 1) * (this.acma[koltuk] === "cift" ? 2 : 1);
    return { tur: "bitti", koltuk, okeyle, elden, puanlar: this.puanlar(koltuk, carpan) };
  }

  /** Elin koltuk başına puanı. biten: eli bitiren koltuk (orta bittiyse null). */
  private puanlar(biten: number | null, carpan: number): number[] {
    return this.eller.map((el, k) => {
      let puan: number;
      if (k === biten) puan = -CEZA * carpan;
      else if (this.acma[k] === null) puan = 2 * CEZA * carpan;
      else puan = kalanPuan(el, this.okey) * carpan * (this.acma[k] === "cift" ? 2 : 1);
      // Cezalar ve gösterge çarpansız eklenir.
      return puan + this.cezalar[k];
    });
  }

  private gostergeGoster(koltuk: number): HamleSonucu101 {
    if (!this.gostergeGosterebilir(koltuk)) return hata("Gösterge gösterilemez");
    this.gostergeGosteren = koltuk;
    this.cezalar[koltuk] -= CEZA;
    return { tamam: true, bilgi: `Gösterge: -${CEZA}` };
  }

  /** Gösterge taşının eşi elindeyse ve henüz ilk taşını atmadıysa, sırası gelmişken gösterebilir. */
  gostergeGosterebilir(koltuk: number): boolean {
    if (this.sonuc || this.gostergeGosteren !== null) return false;
    if (this.sira !== koltuk || this.ilkAtisYapti[koltuk]) return false;
    const g = yuzDegeri(this.gosterge)!;
    return this.eller[koltuk].some((id) => {
      const d = yuzDegeri(id);
      return d !== null && d.renk === g.renk && d.sayi === g.sayi;
    });
  }

  /**
   * Oyuncuya gönderilen görünüm. Sadece kendi taşları vardır; diğerlerinin elleri ve
   * ortadaki destenin sırası gitmez. Masadaki perler ve atılanlar zaten herkese açıktır.
   */
  gorunum(koltuk: number): MasaGorunumu101 {
    const siradaMi = koltuk === this.sira;
    return {
      oyun: "101",
      koltuk,
      el: [...this.eller[koltuk]],
      tasSayilari: this.eller.map((e) => e.length),
      atilanlar: this.atilanlar.map((a) => [...a]),
      ortaSayisi: this.orta.length,
      gosterge: this.gosterge,
      okey: this.okey,
      sira: this.sira,
      asama: this.asama,
      gostergeGosterebilir: this.gostergeGosterebilir(koltuk),
      gostergeGosteren: this.gostergeGosteren,
      acma: [...this.acma],
      acmaDegeri: [...this.acmaDegeri],
      perler: this.perler.map((ps) => ps.map((p) => ({ tur: p.tur, taslar: [...p.taslar] }))),
      yandanAlinan: siradaMi ? this.yandanAlinan : null,
      buTurActi: this.buTurActi,
      cezalar: [...this.cezalar],
      sonuc: this.sonuc,
    };
  }
}

function hata(mesaj: string): HamleSonucu101 {
  return { tamam: false, hata: mesaj };
}
