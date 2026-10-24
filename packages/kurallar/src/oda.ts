// Oda: 4 koltuklu bir masanın el el yönetimi.
//
// Masa sınıfı tek bir elin kurallarını bilir. Oda ise onun etrafındaki her şeyi yönetir:
// kim hangi koltukta, sıra kimde ve süresi ne zaman doluyor, botlar ne zaman oynuyor,
// el bitince çip nasıl dağıtılıyor, sonraki el ne zaman başlıyor.
//
// Oda da ağdan habersizdir. Mesaj göndermek, zamanlayıcı kurmak ve çip işlemleri
// dışarıdan verilen fonksiyonlarla (OdaBaglami) yapılır. Böylece aynı sınıf:
//  - sunucuda gerçek oyuncular ve veritabanıyla,
//  - telefonda çevrim dışı antrenman modunda,
//  - testlerde sahte saatle
// çalışır.

import { botHamlesi } from "./bot.ts";
import { type Eylem, KOLTUK_SAYISI, Masa } from "./masa.ts";
import type {
  ElOzeti,
  KoltukGorunumu,
  OdaGorunumu,
  OyuncuKarti,
  SohbetMesaji,
  SunucuMesaji,
} from "./protokol.ts";
import type { SalonId } from "./ekonomi.ts";

export interface OdaBaglami {
  kod: string;
  salon: SalonId | "antrenman";
  giris: number;
  rastgele: () => number;
  simdi: () => number;
  /** fn'i ms sonra çalıştırır; dönen fonksiyon iptal eder. */
  zamanla: (fn: () => void, ms: number) => () => void;
  gonder: (oyuncuId: string, mesaj: SunucuMesaji) => void;
  turSuresiMs?: number;
  botGecikmeMs?: number;
  sonrakiElMs?: number;
  /**
   * El başlamadan önce çağrılır: oyunculardan giriş çipini alır.
   * Çipi yetmeyenlerin kimliklerini döndürür; onlar koltuktan kaldırılır.
   */
  elBasinda?: (insanlar: string[], giris: number) => string[];
  /** El bitince çağrılır: çip ve XP dağıtır, koltuk başına değişimi döndürür. */
  elSonunda?: (bilgi: ElSonuBilgisi) => { cipDegisimi: number[]; xp: number[] };
  /** Odada hiç insan kalmayınca çağrılır (sunucu odayı siler). */
  bosaldi?: () => void;
}

export interface ElSonuBilgisi {
  masa: Masa;
  /** Koltuk başına oyuncu kimliği; bot koltukları null. */
  oyuncular: (string | null)[];
  giris: number;
}

type Koltuk =
  | { tur: "bos" }
  | { tur: "insan"; oyuncu: OyuncuKarti; bagli: boolean; ayrildi: boolean }
  | { tur: "bot"; ad: string };

const BOT_ADLARI = ["Hasan", "Ayşe", "Mehmet", "Zeynep", "Ali", "Fatma", "Murat", "Elif", "Emre", "Selin"];

export class Oda {
  readonly koltuklar: Koltuk[] = [{ tur: "bos" }, { tur: "bos" }, { tur: "bos" }, { tur: "bos" }];
  /** El sürerken gelen oyuncular sonraki elde oturur. */
  readonly bekleyenler: OyuncuKarti[] = [];
  sahipId: string | null = null;
  masa: Masa | null = null;
  sonEl: ElOzeti | null = null;
  elNo = 0;
  turBitis: number | null = null;
  readonly sohbetGecmisi: SohbetMesaji[] = [];
  private zamanlayiciIptal: (() => void) | null = null;
  /** Her hamlede artar; insan hamle süresinin hangi hamle için kurulduğunu ayırt eder. */
  private hamleNo = 0;
  /** Sıradaki insanın süresinin bittiği an ve hangi hamle için kurulduğu. */
  private insanSureBitis: { hamleNo: number; an: number } | null = null;
  private kapandi = false;

  constructor(private readonly b: OdaBaglami) {}

  get turSuresi() {
    return this.b.turSuresiMs ?? 25_000;
  }

  get oyunda() {
    return this.masa !== null && this.masa.sonuc === null;
  }

  insanSayisi(): number {
    return this.koltuklar.filter((k) => k.tur === "insan" && !k.ayrildi).length + this.bekleyenler.length;
  }

  /** Boş ya da botun oturduğu (el aralarında insana verilebilen) koltuk sayısı. */
  bosYer(): number {
    return KOLTUK_SAYISI - this.koltuklar.filter((k) => k.tur === "insan" && !k.ayrildi).length - this.bekleyenler.length;
  }

  oyuncuVarMi(id: string): boolean {
    return this.koltukBul(id) !== -1 || this.bekleyenler.some((o) => o.id === id);
  }

  // ---------------- Oturma, kalkma, bağlantı ----------------

  otur(oyuncu: OyuncuKarti): { tamam: true } | { tamam: false; hata: string } {
    if (this.oyuncuVarMi(oyuncu.id)) {
      this.yenidenBaglandi(oyuncu.id);
      return { tamam: true };
    }
    if (this.bosYer() <= 0) return { tamam: false, hata: "Masa dolu" };
    if (this.sahipId === null) this.sahipId = oyuncu.id;
    if (this.oyunda || this.elArasi()) {
      this.bekleyenler.push(oyuncu);
    } else {
      const i = this.koltuklar.findIndex((k) => k.tur !== "insan");
      this.koltuklar[i] = { tur: "insan", oyuncu, bagli: true, ayrildi: false };
    }
    this.sistemMesaji(`${oyuncu.ad} masaya geldi`);
    this.yayinla();
    return { tamam: true };
  }

  /** Oyuncu odadan isteyerek çıkar. El sürüyorsa yerine bot oynar, koyduğu çip ortada kalır. */
  ayril(id: string) {
    const bi = this.bekleyenler.findIndex((o) => o.id === id);
    if (bi !== -1) {
      const [o] = this.bekleyenler.splice(bi, 1);
      this.sistemMesaji(`${o.ad} masadan kalktı`);
    }
    const i = this.koltukBul(id);
    if (i !== -1) {
      const k = this.koltuklar[i] as Extract<Koltuk, { tur: "insan" }>;
      this.sistemMesaji(`${k.oyuncu.ad} masadan kalktı`);
      if (this.masa) {
        // El sürüyor ya da el arası: koltuk sonraki elde boşalır, o zamana kadar bot oynar.
        k.ayrildi = true;
        k.bagli = false;
      } else {
        this.koltuklar[i] = { tur: "bos" };
      }
    }
    if (this.sahipId === id) this.sahipId = this.ilkInsan();
    this.kapanisKontrol();
    if (!this.kapandi) {
      this.koltukDegisti(i);
      this.yayinla();
    }
  }

  baglantiKoptu(id: string) {
    const i = this.koltukBul(id);
    if (i === -1) {
      // Bekleyen oyuncunun bağlantısı koptuysa listeden çıkar.
      const bi = this.bekleyenler.findIndex((o) => o.id === id);
      if (bi !== -1) this.bekleyenler.splice(bi, 1);
      this.kapanisKontrol();
      return;
    }
    const k = this.koltuklar[i] as Extract<Koltuk, { tur: "insan" }>;
    k.bagli = false;
    if (!this.masa) this.koltuklar[i] = { tur: "bos" };
    if (this.sahipId === id) this.sahipId = this.ilkInsan();
    this.kapanisKontrol();
    if (!this.kapandi) {
      this.koltukDegisti(i);
      this.yayinla();
    }
  }

  yenidenBaglandi(id: string) {
    const i = this.koltukBul(id);
    if (i !== -1) {
      const k = this.koltuklar[i] as Extract<Koltuk, { tur: "insan" }>;
      k.bagli = true;
      k.ayrildi = false;
      this.koltukDegisti(i);
    }
    this.yayinla();
    this.b.gonder(id, { t: "sohbetGecmisi", mesajlar: this.sohbetGecmisi });
  }

  /** Oyuncunun adı/etiketi değişince masadaki kartını günceller. */
  kartGuncelle(kart: OyuncuKarti) {
    const i = this.koltukBul(kart.id);
    if (i !== -1) (this.koltuklar[i] as Extract<Koltuk, { tur: "insan" }>).oyuncu = kart;
    this.yayinla();
  }

  // ---------------- Oyun akışı ----------------

  /** Oda sahibi (ya da id=null ile sunucunun eşleştirmesi) oyunu başlatır. Boş koltuklara bot oturur. */
  basla(id: string | null): { tamam: true } | { tamam: false; hata: string } {
    if (this.masa) return { tamam: false, hata: "Oyun zaten başladı" };
    if (id !== null && id !== this.sahipId) return { tamam: false, hata: "Oyunu sadece masa sahibi başlatabilir" };
    this.elBaslat();
    return { tamam: true };
  }

  hamle(id: string, eylem: Eylem): { tamam: true } | { tamam: false; hata: string } {
    const koltuk = this.koltukBul(id);
    if (koltuk === -1 || !this.masa) return { tamam: false, hata: "Masada değilsin" };
    const k = this.koltuklar[koltuk] as Extract<Koltuk, { tur: "insan" }>;
    if (k.ayrildi) return { tamam: false, hata: "Masadan kalktın" };
    const s = this.masa.hamle(koltuk, eylem);
    if (!s.tamam) return s;
    this.hamleSonrasi();
    return s;
  }

  sohbet(id: string, metin: string) {
    const koltuk = this.koltukBul(id);
    const kart =
      koltuk !== -1
        ? (this.koltuklar[koltuk] as Extract<Koltuk, { tur: "insan" }>).oyuncu
        : this.bekleyenler.find((o) => o.id === id);
    if (!kart) return;
    this.sohbetEkle({ koltuk, ad: kart.ad, metin, zaman: this.b.simdi() });
  }

  /** Sunucu kapanırken ya da oda silinirken zamanlayıcıları durdurur. */
  kapat() {
    this.kapandi = true;
    this.zamanlayiciIptal?.();
    this.zamanlayiciIptal = null;
  }

  private elArasi() {
    return this.masa !== null && this.masa.sonuc !== null;
  }

  private elBaslat() {
    if (this.kapandi) return;
    this.zamanlayiciIptal?.();
    // Ayrılanları kaldır, bekleyenleri oturt.
    this.koltuklar.forEach((k, i) => {
      if (k.tur === "insan" && (k.ayrildi || !k.bagli)) this.koltuklar[i] = { tur: "bos" };
    });
    for (const o of this.bekleyenler.splice(0)) {
      const i = this.koltuklar.findIndex((k) => k.tur !== "insan");
      if (i === -1) break;
      this.koltuklar[i] = { tur: "insan", oyuncu: o, bagli: true, ayrildi: false };
    }
    // Çip toplama: yetmeyenler masadan kalkar.
    const insanlar = this.insanIdleri();
    const yetmeyenler = this.b.elBasinda?.(insanlar, this.b.giris) ?? [];
    for (const id of yetmeyenler) {
      const i = this.koltukBul(id);
      this.koltuklar[i] = { tur: "bos" };
      this.b.gonder(id, { t: "odadanCikti", sebep: "Bu masa için çipin yetmiyor" });
    }
    if (this.sahipId && !this.oyuncuVarMi(this.sahipId)) this.sahipId = this.ilkInsan();
    if (this.insanIdleri().length === 0) {
      this.masa = null;
      this.kapanisKontrol();
      return;
    }
    // Boş koltuklara bot.
    const kullanilan = new Set(this.koltuklar.flatMap((k) => (k.tur === "bot" ? [k.ad] : [])));
    this.koltuklar.forEach((k, i) => {
      if (k.tur === "bos") {
        const uygun = BOT_ADLARI.filter((a) => !kullanilan.has(a));
        const ad = uygun[Math.floor(this.b.rastgele() * uygun.length)];
        kullanilan.add(ad);
        this.koltuklar[i] = { tur: "bot", ad };
      }
    });
    const baslayan = Math.floor(this.b.rastgele() * KOLTUK_SAYISI);
    this.masa = new Masa(baslayan, this.b.rastgele);
    this.sonEl = null;
    this.elNo++;
    this.hamleNo++;
    this.zamanlayiciKur();
    this.yayinla();
  }

  private hamleSonrasi() {
    if (!this.masa) return;
    this.hamleNo++;
    if (this.masa.sonuc) {
      this.elBitti();
      return;
    }
    this.zamanlayiciKur();
    this.yayinla();
  }

  private elBitti() {
    const masa = this.masa!;
    this.zamanlayiciIptal?.();
    this.turBitis = null;
    const oyuncular = this.koltuklar.map((k) => (k.tur === "insan" ? k.oyuncu.id : null));
    const dagitim = this.b.elSonunda?.({ masa, oyuncular, giris: this.b.giris }) ?? {
      cipDegisimi: [0, 0, 0, 0],
      xp: [0, 0, 0, 0],
    };
    const sonraki = this.b.sonrakiElMs ?? 8_000;
    this.sonEl = { sonuc: masa.sonuc!, ...dagitim, sonrakiEl: this.b.simdi() + sonraki };
    const s = masa.sonuc!;
    if (s.tur === "kazanan") {
      const metin: Record<string, string> = {
        normal: "eli bitirdi",
        cift: "çift bitirdi",
        okeyAtarak: "okey atarak bitirdi",
        ciftOkeyAtarak: "çift ve okey atarak bitirdi",
      };
      this.sistemMesaji(`${this.koltukAdi(s.koltuk)} ${metin[s.bitis]}!`);
    } else {
      this.sistemMesaji("Ortada taş kalmadı, el berabere");
    }
    this.yayinla();
    this.zamanlayiciIptal = this.b.zamanla(() => this.elBaslat(), sonraki);
  }

  /**
   * Koltuktaki insanın durumu değişti (koptu, döndü, kalktı). Sıra ondaysa zamanlayıcı yeniden
   * kurulur (bağlıysa kalan hamle süresi, değilse bot). Başkasının sırasındaki süre sıfırlanmaz.
   */
  private koltukDegisti(koltuk: number) {
    if (koltuk !== -1 && this.masa && !this.masa.sonuc && this.masa.sira === koltuk) this.zamanlayiciKur();
  }

  /** Sıradaki koltuğa göre zamanlayıcı kurar: insan için hamle süresi, bot için kısa bekleme. */
  private zamanlayiciKur() {
    // El arasında bekleyen zamanlayıcı sonraki eli başlatır; kopma/kalkma/geri dönme onu
    // iptal ederse oda sonsuza kadar el arasında takılı kalır.
    if (this.elArasi()) return;
    this.zamanlayiciIptal?.();
    this.zamanlayiciIptal = null;
    if (!this.masa || this.masa.sonuc || this.kapandi) return;
    const sira = this.masa.sira;
    const k = this.koltuklar[sira];
    const insanOynuyor = k.tur === "insan" && k.bagli && !k.ayrildi;
    if (insanOynuyor) {
      // Aynı hamle için süre yeniden kurulursa (ör. oyuncu kopup geri döndü) eski bitiş korunur;
      // yoksa kopup geri dönerek süre sonsuza kadar uzatılabilirdi.
      if (this.insanSureBitis?.hamleNo !== this.hamleNo) {
        this.insanSureBitis = { hamleNo: this.hamleNo, an: this.b.simdi() + this.turSuresi };
      }
      this.turBitis = this.insanSureBitis.an;
      const kalan = Math.max(0, this.turBitis - this.b.simdi());
      this.zamanlayiciIptal = this.b.zamanla(() => this.otomatikOyna(sira, true), kalan);
    } else {
      this.turBitis = null;
      this.zamanlayiciIptal = this.b.zamanla(() => this.otomatikOyna(sira, false), this.b.botGecikmeMs ?? 900);
    }
  }

  /**
   * Bot ya da süresi dolan oyuncu adına oynar. Süre dolduysa sıra geçene kadar
   * oynar (çek + at); bot ise tek adım atar ki hamleleri ekranda tek tek görünsün.
   */
  private otomatikOyna(koltuk: number, sureDoldu: boolean) {
    if (!this.masa || this.masa.sonuc || this.masa.sira !== koltuk) return;
    let adim = 0;
    do {
      const eylem = botHamlesi(this.masa.gorunum(koltuk));
      if (sureDoldu && eylem.tur === "bitir") {
        // Süresi dolan oyuncunun yerine el bitirilmez, sadece taş atılır.
        this.masa.hamle(koltuk, { tur: "at", tas: eylem.tas });
      } else {
        this.masa.hamle(koltuk, eylem);
      }
    } while (sureDoldu && !this.masa.sonuc && this.masa.sira === koltuk && ++adim < 4);
    if (sureDoldu) this.sistemMesaji(`${this.koltukAdi(koltuk)} için süre doldu`);
    this.hamleSonrasi();
  }

  // ---------------- Görünüm ve yayın ----------------

  gorunum(id: string): OdaGorunumu {
    const koltuk = this.koltukBul(id);
    return {
      kod: this.b.kod,
      salon: this.b.salon,
      giris: this.b.giris,
      sahipId: this.sahipId,
      koltuklar: this.koltuklar.map(koltukGorunumu),
      benimKoltugum: koltuk === -1 ? null : koltuk,
      oyunda: this.oyunda,
      masa: this.masa && koltuk !== -1 ? this.masa.gorunum(koltuk) : null,
      turBitis: this.turBitis,
      turKalanMs: this.turBitis === null ? null : Math.max(0, this.turBitis - this.b.simdi()),
      turSuresiMs: this.turSuresi,
      sonEl: this.sonEl,
      elNo: this.elNo,
    };
  }

  /** Her oyuncuya kendi görünümünü gönderir (kimse başkasının taşlarını almaz). */
  yayinla() {
    if (this.kapandi) return;
    for (const id of this.bagliIdler()) this.b.gonder(id, { t: "oda", oda: this.gorunum(id) });
  }

  private sohbetEkle(m: SohbetMesaji) {
    this.sohbetGecmisi.push(m);
    if (this.sohbetGecmisi.length > 40) this.sohbetGecmisi.shift();
    for (const id of this.bagliIdler()) this.b.gonder(id, { t: "sohbet", mesaj: m });
  }

  private sistemMesaji(metin: string) {
    this.sohbetEkle({ koltuk: -1, ad: "", metin, zaman: this.b.simdi() });
  }

  // ---------------- Yardımcılar ----------------

  private koltukBul(id: string): number {
    return this.koltuklar.findIndex((k) => k.tur === "insan" && k.oyuncu.id === id);
  }

  private koltukAdi(i: number): string {
    const k = this.koltuklar[i];
    return k.tur === "insan" ? k.oyuncu.ad : k.tur === "bot" ? k.ad : "?";
  }

  private insanIdleri(): string[] {
    return this.koltuklar.flatMap((k) => (k.tur === "insan" && !k.ayrildi ? [k.oyuncu.id] : []));
  }

  private bagliIdler(): string[] {
    return [
      ...this.koltuklar.flatMap((k) => (k.tur === "insan" && k.bagli ? [k.oyuncu.id] : [])),
      ...this.bekleyenler.map((o) => o.id),
    ];
  }

  private ilkInsan(): string | null {
    const k = this.koltuklar.find((k) => k.tur === "insan" && k.bagli && !k.ayrildi);
    return k && k.tur === "insan" ? k.oyuncu.id : (this.bekleyenler[0]?.id ?? null);
  }

  private kapanisKontrol() {
    // El sürerken ya da el arasında oda kapanmaz: bağlantısı kopan geri dönebilir.
    // Sonraki el başlarken hâlâ kimse yoksa elBaslat odayı kapatır.
    if (this.masa) return;
    const bagliInsan = this.koltuklar.some((k) => k.tur === "insan" && k.bagli) || this.bekleyenler.length > 0;
    if (!bagliInsan && !this.kapandi) {
      this.kapat();
      this.b.bosaldi?.();
    }
  }
}

function koltukGorunumu(k: Koltuk): KoltukGorunumu {
  if (k.tur === "insan") return { tur: "insan", oyuncu: k.oyuncu, bagli: k.bagli && !k.ayrildi };
  return k;
}
