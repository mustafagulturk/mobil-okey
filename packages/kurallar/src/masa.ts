// Masa: bir elin tüm durumu ve kuralları.
//
// Bu sınıf ağdan, zamanlayıcıdan ve çipten habersizdir; sadece "şu koltuk şu hamleyi
// yaptı" der, hamle kurallara uyuyorsa durumu değiştirir. Sunucu da telefondaki
// antrenman modu da aynı sınıfı kullanır.
//
// Hile koruması burada başlar: oyunculara masanın tamamı değil, gorunum(koltuk)
// gönderilir. Görünümde sadece o oyuncunun kendi taşları vardır; diğerlerinin
// elindeki taşlar ve ortadaki destenin sırası hiçbir zaman istemciye gitmez.

import { bitisBul, type Bitis } from "./el.ts";
import type { OyunEylemi } from "./masa101.ts";
import { type Deger, okeyiBul, okeyMi, sahteMi, yeniDeste, yuzDegeri } from "./tas.ts";

export const KOLTUK_SAYISI = 4;

export type Eylem =
  | { tur: "cek"; kaynak: "orta" | "yan" }
  | { tur: "at"; tas: number }
  | { tur: "bitir"; tas: number }
  | { tur: "gostergeGoster" };

export type BitisTuru = "normal" | "cift" | "okeyAtarak" | "ciftOkeyAtarak";

export type ElSonucu =
  | { tur: "kazanan"; koltuk: number; bitis: BitisTuru; perler: number[][]; atilan: number }
  | { tur: "berabere" };

export interface MasaGorunumu {
  koltuk: number; // benim koltuğum
  el: number[]; // benim taşlarım
  tasSayilari: number[]; // her koltuktaki taş sayısı
  atilanlar: number[][]; // her koltuğun attığı taşlar (herkese açık bilgi)
  ortaSayisi: number;
  gosterge: number;
  okey: Deger;
  sira: number;
  asama: "cek" | "at";
  gostergeGosterebilir: boolean;
  gostergeGosteren: number | null;
  sonuc: ElSonucu | null;
}

export type HamleSonucu = { tamam: true } | { tamam: false; hata: string };

/** Koltuk k'nın "yanı": soldaki oyuncunun (k-1) en son attığı taş. */
export function oncekiKoltuk(k: number) {
  return (k + KOLTUK_SAYISI - 1) % KOLTUK_SAYISI;
}

export class Masa {
  readonly eller: number[][];
  readonly atilanlar: number[][] = [[], [], [], []];
  readonly orta: number[];
  readonly gosterge: number;
  readonly okey: Deger;
  sira: number;
  asama: "cek" | "at" = "at"; // başlayan oyuncu 15 taşla başlar, önce atar
  sonuc: ElSonucu | null = null;
  gostergeGosteren: number | null = null;
  /** Kendi ilk atışını yapmış koltuklar. Gösterge sadece ilk atıştan önce gösterilebilir. */
  private readonly ilkAtisYapti = [false, false, false, false];

  constructor(baslayan: number, rastgele: () => number) {
    const deste = yeniDeste(rastgele);
    // Gösterge sahte okey olamaz; destenin ilk normal taşı gösterge olur.
    const gi = deste.findIndex((id) => !sahteMi(id));
    this.gosterge = deste.splice(gi, 1)[0];
    this.okey = okeyiBul(this.gosterge);
    this.eller = [0, 1, 2, 3].map((k) => deste.splice(0, k === baslayan ? 15 : 14));
    this.orta = deste;
    this.sira = baslayan;
  }

  /**
   * Oda iki oyunun eylemlerini de aynı yoldan gönderir (OyunEylemi). 101'e özel
   * eylemler (aç, işle) Okey masasında geçersizdir.
   */
  hamle(koltuk: number, eylem: OyunEylemi): HamleSonucu {
    if (this.sonuc) return hata("El bitti");
    if (eylem.tur === "ac" || eylem.tur === "isle") return hata("Bu hamle sadece 101'de yapılır");
    if (eylem.tur === "gostergeGoster") return this.gostergeGoster(koltuk);
    if (koltuk !== this.sira) return hata("Sıra sende değil");
    const el = this.eller[koltuk];

    switch (eylem.tur) {
      case "cek": {
        if (this.asama !== "cek") return hata("Önce taş atmalısın");
        if (eylem.kaynak === "orta") {
          if (this.orta.length === 0) return hata("Ortada taş kalmadı");
          el.push(this.orta.pop()!);
        } else {
          const yan = this.atilanlar[oncekiKoltuk(koltuk)];
          if (yan.length === 0) return hata("Yanda taş yok");
          el.push(yan.pop()!);
        }
        this.asama = "at";
        return { tamam: true };
      }
      case "at": {
        if (this.asama !== "at") return hata("Önce taş çekmelisin");
        const i = el.indexOf(eylem.tas);
        if (i === -1) return hata("Bu taş elinde değil");
        el.splice(i, 1);
        this.atilanlar[koltuk].push(eylem.tas);
        this.ilkAtisYapti[koltuk] = true;
        if (this.orta.length === 0) {
          // Orta bitti ve kimse bitiremedi: el berabere.
          this.sonuc = { tur: "berabere" };
          return { tamam: true };
        }
        this.sira = (koltuk + 1) % KOLTUK_SAYISI;
        this.asama = "cek";
        return { tamam: true };
      }
      case "bitir": {
        if (this.asama !== "at") return hata("Bitirmek için önce taş çekmelisin");
        const i = el.indexOf(eylem.tas);
        if (i === -1) return hata("Bu taş elinde değil");
        const kalan = el.filter((id) => id !== eylem.tas);
        const bitis = bitisBul(kalan, this.okey);
        if (!bitis) return hata("Elin henüz bitmedi");
        el.splice(i, 1);
        this.sonuc = {
          tur: "kazanan",
          koltuk,
          bitis: bitisTuru(bitis, okeyMi(eylem.tas, this.okey)),
          perler: bitis.perler,
          atilan: eylem.tas,
        };
        return { tamam: true };
      }
    }
  }

  private gostergeGoster(koltuk: number): HamleSonucu {
    if (!this.gostergeGosterebilir(koltuk)) return hata("Gösterge gösterilemez");
    this.gostergeGosteren = koltuk;
    return { tamam: true };
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

  gorunum(koltuk: number): MasaGorunumu {
    return {
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
      sonuc: this.sonuc,
    };
  }
}

function bitisTuru(b: Bitis, okeyAtti: boolean): BitisTuru {
  if (b.tur === "cift") return okeyAtti ? "ciftOkeyAtarak" : "cift";
  return okeyAtti ? "okeyAtarak" : "normal";
}

function hata(mesaj: string): HamleSonucu {
  return { tamam: false, hata: mesaj };
}
