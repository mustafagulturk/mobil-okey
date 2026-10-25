// Salonlar ve odalar: hangi oda nerede, kim hangi odada, hızlı eşleştirme.
//
// Oda sınıfı (kurallar paketi) ağdan ve veritabanından habersizdir. Bu dosya her odaya
// bir OdaBaglami verir: mesajlar bağlı oyuncuya gider, zamanlayıcılar setTimeout'tur,
// el başında ve sonunda çip/XP işlemleri veritabanına yazılır.
//
// Kurallar:
//  - Bir oyuncu aynı anda tek odada olabilir (oyuncuOdasi haritası).
//  - Her oda tek bir oyun türünü oynar (Okey ya da 101).
//  - Hızlı oyun: salonda aynı oyun türünde yeri olan herkese açık bir oda varsa oraya
//    oturulur, yoksa yeni oda açılır. Oda 4 insana ulaşınca hemen, yoksa ilk oyuncudan eslesmeBeklemeMs sonra
//    boş koltuklara botlar oturarak başlar.
//  - Özel oda: 5 karakterlik kodla katılınır, oyunu sahibi başlatır.
//  - Bağlantısı kopan oyuncu odada kalır (yerine bot oynar); tekrar girince aynı masaya döner.

import { randomInt } from "node:crypto";
import {
  MAC101_GIRIS_CARPANI,
  Oda,
  type OyunEylemi,
  type OyunTuru,
  type OyuncuKarti,
  type Salon,
  salonaUygunMu,
  salonBul,
  type SalonBilgisi,
  type SalonId,
  SALONLAR,
  type SunucuMesaji,
} from "@okey/kurallar";
import type { Ayarlar } from "./ayarlar.ts";
import { elSonuIsle, macSonuIsle } from "./ilerleme.ts";
import type { Veritabani } from "./veritabani.ts";

export type Sonuc = { tamam: true } | { tamam: false; hata: string };

/** Karışmasın diye 0/O ve 1/I içermeyen harf ve rakamlar. */
const KOD_ALFABESI = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const KOD_UZUNLUGU = 5;

export interface SalonBaglami {
  vt: Veritabani;
  ayarlar: Ayarlar;
  gonder: (oyuncuId: string, mesaj: SunucuMesaji) => void;
  profilGonder: (oyuncuId: string) => void;
}

interface OdaKaydi {
  oda: Oda;
  salon: Salon;
  oyun: OyunTuru;
  ozel: boolean;
  /** Hızlı oyunda botlarla başlatma zamanlayıcısının iptali. */
  baslatmaIptal: (() => void) | null;
  /** Bu elin (101'de maçın) girişini ödeyenler (sunucu yarıda kapanırsa iade edilir). */
  odeyenler: string[];
}

export class SalonYoneticisi {
  private readonly odalar = new Map<string, OdaKaydi>();
  private readonly oyuncuOdasi = new Map<string, string>();

  constructor(private readonly b: SalonBaglami) {}

  /** Salonlar ve her salondaki oyuncu sayısı; oyuncuSayisi Okey, oyuncuSayisi101 101 odalarını sayar. */
  salonListesi(): SalonBilgisi[] {
    const say = (salon: SalonId, oyun: OyunTuru) =>
      [...this.odalar.values()]
        .filter((k) => k.salon.id === salon && k.oyun === oyun)
        .reduce((t, k) => t + k.oda.insanSayisi(), 0);
    return SALONLAR.map((s) => ({
      id: s.id,
      ad: s.ad,
      giris: s.giris,
      enAzCip: s.enAzCip,
      enFazlaCip: s.enFazlaCip,
      oyuncuSayisi: say(s.id, "okey"),
      oyuncuSayisi101: say(s.id, "101"),
    }));
  }

  /** Oyuncunun bulunduğu oda. Oda onu çoktan çıkardıysa (ör. el başında) kaydı da temizler. */
  bulunduguOda(oyuncuId: string): OdaKaydi | null {
    const kod = this.oyuncuOdasi.get(oyuncuId);
    if (!kod) return null;
    const k = this.odalar.get(kod);
    if (k && k.oda.oyuncuVarMi(oyuncuId)) return k;
    this.oyuncuOdasi.delete(oyuncuId);
    return null;
  }

  hizliOyun(kart: OyuncuKarti, salonId: SalonId, cip: number, oyun: OyunTuru = "okey"): Sonuc {
    const salon = salonBul(salonId);
    const engel = this.oturmaEngeli(kart.id, salon, cip);
    if (engel) return engel;
    // En kalabalık odayı doldurmayı tercih et ki oyuncular botlarla değil birbirleriyle oynasın.
    const aday = [...this.odalar.values()]
      .filter((k) => !k.ozel && k.salon.id === salonId && k.oyun === oyun && k.oda.bosYer() > 0)
      .sort((a, b) => b.oda.insanSayisi() - a.oda.insanSayisi())[0];
    const kayit = aday ?? this.odaAc(salon, oyun, false);
    const s = this.otur(kayit, kart);
    if (!s.tamam) return s;

    if (!kayit.oda.masa) {
      if (kayit.oda.insanSayisi() >= 4) this.hizliBaslat(kayit);
      else if (!kayit.baslatmaIptal) {
        kayit.baslatmaIptal = this.zamanla(() => this.hizliBaslat(kayit), this.b.ayarlar.eslesmeBeklemeMs);
      }
    }
    return { tamam: true };
  }

  odaKur(kart: OyuncuKarti, salonId: SalonId, cip: number, oyun: OyunTuru = "okey"): Sonuc {
    const salon = salonBul(salonId);
    const engel = this.oturmaEngeli(kart.id, salon, cip);
    if (engel) return engel;
    return this.otur(this.odaAc(salon, oyun, true), kart);
  }

  odayaKatil(kart: OyuncuKarti, kod: string, cip: number): Sonuc {
    const kayit = this.odalar.get(kod);
    if (!kayit) return { tamam: false, hata: "Bu kodla bir masa bulunamadı" };
    const engel = this.oturmaEngeli(kart.id, kayit.salon, cip);
    if (engel) return engel;
    const s = this.otur(kayit, kart);
    if (s.tamam && !kayit.ozel && !kayit.oda.masa && kayit.oda.insanSayisi() >= 4) this.hizliBaslat(kayit);
    return s;
  }

  basla(oyuncuId: string): Sonuc {
    const k = this.bulunduguOda(oyuncuId);
    if (!k) return { tamam: false, hata: "Bir masada değilsin" };
    if (!k.ozel) return { tamam: false, hata: "Bu masa oyuncular gelince kendiliğinden başlar" };
    return k.oda.basla(oyuncuId);
  }

  ayril(oyuncuId: string) {
    const k = this.bulunduguOda(oyuncuId);
    this.oyuncuOdasi.delete(oyuncuId);
    if (!k) return;
    k.oda.ayril(oyuncuId);
    this.b.gonder(oyuncuId, { t: "odadanCikti", sebep: null });
  }

  baglantiKoptu(oyuncuId: string) {
    this.bulunduguOda(oyuncuId)?.oda.baglantiKoptu(oyuncuId);
    // Oda onu hemen çıkardıysa (oyun başlamadan kopma) kaydı da temizlenir.
    this.bulunduguOda(oyuncuId);
  }

  /** Tekrar giriş yapan oyuncuyu masasına döndürür. Bir masaya döndüyse true. */
  yenidenBaglandi(oyuncuId: string): boolean {
    const k = this.bulunduguOda(oyuncuId);
    if (!k) return false;
    k.oda.yenidenBaglandi(oyuncuId);
    return true;
  }

  hamle(oyuncuId: string, eylem: OyunEylemi): Sonuc {
    const k = this.bulunduguOda(oyuncuId);
    if (!k) return { tamam: false, hata: "Bir masada değilsin" };
    return k.oda.hamle(oyuncuId, eylem);
  }

  sohbet(oyuncuId: string, metin: string): Sonuc {
    const k = this.bulunduguOda(oyuncuId);
    if (!k) return { tamam: false, hata: "Bir masada değilsin" };
    k.oda.sohbet(oyuncuId, metin);
    return { tamam: true };
  }

  /** Ad ya da etiket değişince masadaki kartı günceller. */
  kartGuncelle(kart: OyuncuKarti) {
    this.bulunduguOda(kart.id)?.oda.kartGuncelle(kart);
  }

  /** Sunucu kapanırken: zamanlayıcıları durdur, yarıda kalan ellerin (101'de maçların) girişini iade et. */
  kapat() {
    const zaman = this.b.ayarlar.simdi();
    for (const k of this.odalar.values()) {
      k.baslatmaIptal?.();
      if (k.oda.potAcik) {
        const giris = this.girisMiktari(k.salon, k.oyun);
        for (const id of k.odeyenler) this.b.vt.cipDegistir(id, giris, "sunucu_kapandi_iade", zaman);
      }
      k.oda.kapat();
    }
    this.odalar.clear();
    this.oyuncuOdasi.clear();
  }

  // ---------------- İç işler ----------------

  private oturmaEngeli(oyuncuId: string, salon: Salon, cip: number): Sonuc | null {
    if (this.bulunduguOda(oyuncuId)) return { tamam: false, hata: "Zaten bir masadasın. Önce masadan kalk." };
    const u = salonaUygunMu(salon, cip);
    return u.uygun ? null : { tamam: false, hata: u.sebep };
  }

  private otur(k: OdaKaydi, kart: OyuncuKarti): Sonuc {
    const s = k.oda.otur(kart);
    if (s.tamam) this.oyuncuOdasi.set(kart.id, k.oda.gorunum(kart.id).kod);
    return s;
  }

  private hizliBaslat(k: OdaKaydi) {
    k.baslatmaIptal?.();
    k.baslatmaIptal = null;
    if (!k.oda.masa && k.oda.insanSayisi() > 0) k.oda.basla(null);
  }

  private zamanla(fn: () => void, ms: number): () => void {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  }

  private yeniKod(): string {
    let kod: string;
    do {
      kod = Array.from({ length: KOD_UZUNLUGU }, () => KOD_ALFABESI[randomInt(KOD_ALFABESI.length)]).join("");
    } while (this.odalar.has(kod));
    return kod;
  }

  /** Okey'de el başına, 101'de maç başına alınan giriş çipi. */
  private girisMiktari(salon: Salon, oyun: OyunTuru): number {
    return oyun === "101" ? salon.giris * MAC101_GIRIS_CARPANI : salon.giris;
  }

  private odaAc(salon: Salon, oyun: OyunTuru, ozel: boolean): OdaKaydi {
    const kod = this.yeniKod();
    const { vt, ayarlar } = this.b;
    const kayit: OdaKaydi = { oda: null!, salon, oyun, ozel, baslatmaIptal: null, odeyenler: [] };
    kayit.oda = new Oda({
      kod,
      salon: salon.id,
      oyun,
      giris: this.girisMiktari(salon, oyun),
      rastgele: ayarlar.rastgele,
      simdi: ayarlar.simdi,
      zamanla: (fn, ms) => this.zamanla(fn, ms),
      gonder: this.b.gonder,
      turSuresiMs: oyun === "101" ? ayarlar.turSuresi101Ms : ayarlar.turSuresiMs,
      botGecikmeMs: ayarlar.botGecikmeMs,
      sonrakiElMs: ayarlar.sonrakiElMs,
      elBasinda: (insanlar, giris) => {
        const zaman = ayarlar.simdi();
        const sebep = oyun === "101" ? "mac_girisi" : "el_girisi";
        const yetmeyenler = insanlar.filter((id) => !vt.cipDegistir(id, -giris, sebep, zaman));
        kayit.odeyenler = insanlar.filter((id) => !yetmeyenler.includes(id));
        for (const id of yetmeyenler) this.oyuncuOdasi.delete(id);
        for (const id of kayit.odeyenler) this.b.profilGonder(id);
        return yetmeyenler;
      },
      elSonunda: (bilgi) => {
        const s = bilgi.oyun === "101" ? macSonuIsle(vt, bilgi, ayarlar.simdi()) : elSonuIsle(vt, bilgi, ayarlar.simdi());
        kayit.odeyenler = [];
        for (const id of bilgi.oyuncular) {
          if (!id) continue;
          for (const b of s.bildirimler.get(id) ?? []) this.b.gonder(id, b);
          this.b.profilGonder(id);
        }
        return { cipDegisimi: s.cipDegisimi, xp: s.xp };
      },
      bosaldi: () => {
        kayit.baslatmaIptal?.();
        this.odalar.delete(kod);
        for (const [id, k] of this.oyuncuOdasi) if (k === kod) this.oyuncuOdasi.delete(id);
      },
    });
    this.odalar.set(kod, kayit);
    return kayit;
  }
}
