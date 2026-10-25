// Oda: 4 koltuklu bir masanın el el yönetimi.
//
// Masa sınıfı tek bir elin kurallarını bilir. Oda ise onun etrafındaki her şeyi yönetir:
// kim hangi koltukta, sıra kimde ve süresi ne zaman doluyor, botlar ne zaman oynuyor,
// el bitince çip nasıl dağıtılıyor, sonraki el ne zaman başlıyor.
//
// İki oyun aynı odada yönetilir (OdaBaglami.oyun):
//  - Okey: her el bağımsızdır; giriş çipi her el başında alınır, el sonunda dağıtılır.
//  - 101: oda bir MAÇ tutar (MAC_EL_SAYISI el). Giriş maç başında bir kez alınır, el
//    puanları maç tablosuna (MacDurumu) yazılır, çip ve XP maç sonunda dağıtılır. Maç
//    sürerken oturma düzeni değişmez: gelenler maç bitene kadar bekler, kalkan ya da
//    kopan oyuncunun koltuğunda bot oynar ve puanı o koltukta kalır.
//
// Oda da ağdan habersizdir. Mesaj göndermek, zamanlayıcı kurmak ve çip işlemleri
// dışarıdan verilen fonksiyonlarla (OdaBaglami) yapılır. Böylece aynı sınıf:
//  - sunucuda gerçek oyuncular ve veritabanıyla,
//  - telefonda çevrim dışı antrenman modunda,
//  - testlerde sahte saatle
// çalışır.

import { botHamlesi } from "./bot.ts";
import { bot101Atis, bot101Hamlesi } from "./bot101.ts";
import { KOLTUK_SAYISI, Masa } from "./masa.ts";
import { type ElSonucu101, type HamleSonucu101, MAC_EL_SAYISI, type MacDurumu, Masa101, type OyunEylemi } from "./masa101.ts";
import type {
  ElOzeti,
  KoltukGorunumu,
  OdaGorunumu,
  OyunTuru,
  OyuncuKarti,
  SohbetMesaji,
  SunucuMesaji,
} from "./protokol.ts";
import type { SalonId } from "./ekonomi.ts";

export interface OdaBaglami {
  kod: string;
  salon: SalonId | "antrenman";
  /** Varsayılan "okey". */
  oyun?: OyunTuru;
  /** Okey'de el başına, 101'de maç başına alınan giriş çipi. */
  giris: number;
  rastgele: () => number;
  simdi: () => number;
  /** fn'i ms sonra çalıştırır; dönen fonksiyon iptal eder. */
  zamanla: (fn: () => void, ms: number) => () => void;
  gonder: (oyuncuId: string, mesaj: SunucuMesaji) => void;
  /** İnsanın hamle süresi. Verilmezse Okey'de 25 sn, 101'de (açma/işleme düşünülür) 45 sn. */
  turSuresiMs?: number;
  botGecikmeMs?: number;
  sonrakiElMs?: number;
  /**
   * El (101'de maç) başlamadan önce çağrılır: oyunculardan giriş çipini alır.
   * Çipi yetmeyenlerin kimliklerini döndürür; onlar koltuktan kaldırılır.
   */
  elBasinda?: (insanlar: string[], giris: number) => string[];
  /**
   * Okey'de her el, 101'de maç bitince çağrılır: çip ve XP dağıtır, koltuk başına
   * değişimi döndürür. 101'in maç içindeki ara ellerinde çağrılmaz.
   */
  elSonunda?: (bilgi: ElSonuBilgisi) => { cipDegisimi: number[]; xp: number[] };
  /** Odada hiç insan kalmayınca çağrılır (sunucu odayı siler). */
  bosaldi?: () => void;
}

/** elSonunda'ya giden bilgi; oyun alanına bakarak hangi hesabın yapılacağı seçilir. */
export type ElSonuBilgisi = OkeyElSonuBilgisi | MacSonuBilgisi;

interface OrtakSonuBilgisi {
  /** Koltuk başına oyuncu kimliği; bot koltukları null. */
  oyuncular: (string | null)[];
  giris: number;
}

export interface OkeyElSonuBilgisi extends OrtakSonuBilgisi {
  oyun: "okey";
  masa: Masa;
}

/** 101: maçın son eli bitti. */
export interface MacSonuBilgisi extends OrtakSonuBilgisi {
  oyun: "101";
  /** Maçın son elinin masası. */
  masa: Masa101;
  /** Bitmiş maç: puan tablosu, toplamlar ve kazananlar (kazananlar dolu). */
  mac: MacDurumu;
  /** Maçtaki her elin sonucu, oynanış sırasıyla (XP: kim bitirdi, okeyle mi). */
  eller: ElSonucu101[];
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
  masa: Masa | Masa101 | null = null;
  /** 101: süren ya da son biten maç; Okey'de hep null. */
  mac: MacDurumu | null = null;
  sonEl: ElOzeti | null = null;
  elNo = 0;
  turBitis: number | null = null;
  readonly sohbetGecmisi: SohbetMesaji[] = [];
  private zamanlayiciIptal: (() => void) | null = null;
  /** 101: maçtaki ellerin sonuçları (maç sonunda XP hesabı için). */
  private macElleri: ElSonucu101[] = [];
  /** 101: maçın ilk elini başlatan koltuk; sonraki ellerde sırayla döner. */
  private macBaslayan = 0;
  /**
   * Sıra ya da aşama (çek/at) her değiştiğinde artar; insan hamle süresinin hangi adım
   * için kurulduğunu ayırt eder. 101'de aynı adımda yapılan açma/işleme süreyi yenilemez.
   */
  private hamleNo = 0;
  private sonAdim = "";
  /** Sıradaki insanın süresinin bittiği an ve hangi hamle için kurulduğu. */
  private insanSureBitis: { hamleNo: number; an: number } | null = null;
  private kapandi = false;

  constructor(private readonly b: OdaBaglami) {}

  get oyun(): OyunTuru {
    return this.b.oyun ?? "okey";
  }

  get turSuresi() {
    return this.b.turSuresiMs ?? (this.oyun === "101" ? 45_000 : 25_000);
  }

  /** 101 maçı sürüyor mu? (Ara ellerde de true; maç bitince ya da başlamadan false.) */
  get macSuruyor() {
    return this.mac !== null && this.mac.kazananlar === null;
  }

  /**
   * Alınan giriş çipi henüz dağıtılmadı mı? Okey'de el sürerken, 101'de maç sürerken.
   * Sunucu kapanırken bu durumdaki odaların girişi iade edilir.
   */
  get potAcik() {
    return this.oyun === "101" ? this.macSuruyor : this.oyunda;
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

  /**
   * Oyuncu odadan isteyerek çıkar. El (101'de maç) sürüyorsa yerine bot oynar, koyduğu çip
   * ortada kalır.
   */
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

  hamle(id: string, eylem: OyunEylemi): HamleSonucu101 {
    const koltuk = this.koltukBul(id);
    if (koltuk === -1 || !this.masa) return { tamam: false, hata: "Masada değilsin" };
    const k = this.koltuklar[koltuk] as Extract<Koltuk, { tur: "insan" }>;
    if (k.ayrildi) return { tamam: false, hata: "Masadan kalktın" };
    const s = this.hamleUygula(koltuk, eylem);
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
    // 101 maçının ara eli: oturma düzeni ve çip olduğu gibi kalır.
    if (this.oyun === "101" && this.macSuruyor) {
      this.masaKur((this.macBaslayan + this.mac!.puanlar.length) % KOLTUK_SAYISI);
      return;
    }
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
    if (this.oyun === "101") {
      // Yeni maç. Her elde başlayan koltuk bir sağa kayar; böylece 4 elde herkes bir kez başlar.
      this.mac = { elNo: 0, elSayisi: MAC_EL_SAYISI, puanlar: [], toplam: [0, 0, 0, 0], kazananlar: null };
      this.macElleri = [];
      this.macBaslayan = baslayan;
    }
    this.masaKur(baslayan);
  }

  /** Yeni elin masasını kurar (101'de maçın sıradaki eli) ve ilk zamanlayıcıyı başlatır. */
  private masaKur(baslayan: number) {
    if (this.mac) {
      this.mac.elNo = this.mac.puanlar.length + 1;
      this.masa = new Masa101(baslayan, this.b.rastgele);
    } else {
      this.masa = new Masa(baslayan, this.b.rastgele);
    }
    this.sonEl = null;
    this.elNo++;
    this.adimKontrol();
    this.zamanlayiciKur();
    this.yayinla();
  }

  /**
   * Masaya hamleyi uygular; 101'de hamlenin sohbete düşen yanlarını (ceza, açılış) yazar.
   * İnsan hamlesi de otomatik oynanan hamle de buradan geçer.
   */
  private hamleUygula(koltuk: number, eylem: OyunEylemi): HamleSonucu101 {
    const masa = this.masa!;
    const acmamisti = masa instanceof Masa101 && eylem.tur === "ac" && masa.gorunum(koltuk).acma[koltuk] === null;
    const s = masa.hamle(koltuk, eylem);
    if (!s.tamam) return s;
    if ("bilgi" in s && s.bilgi) this.sistemMesaji(`${this.koltukAdi(koltuk)}: ${s.bilgi}`);
    if (masa instanceof Masa101 && acmamisti) {
      const g = masa.gorunum(koltuk);
      const deger = g.acmaDegeri[koltuk];
      this.sistemMesaji(
        g.acma[koltuk] === "cift"
          ? `${this.koltukAdi(koltuk)} çift açtı (${deger} çift)`
          : `${this.koltukAdi(koltuk)} elini açtı (${deger})`,
      );
    }
    return s;
  }

  /** Sıra ya da aşama değiştiyse hamleNo'yu artırır (insanın yeni hamle süresi başlar). */
  private adimKontrol() {
    const m = this.masa!;
    const adim = `${this.elNo}/${m.sira}/${m.asama}`;
    if (adim !== this.sonAdim) {
      this.sonAdim = adim;
      this.hamleNo++;
    }
  }

  private hamleSonrasi() {
    if (!this.masa) return;
    this.adimKontrol();
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
    const sonraki = this.b.sonrakiElMs ?? 8_000;
    if (masa instanceof Masa101) {
      this.el101Bitti(masa, sonraki);
    } else {
      this.okeyElBitti(masa, sonraki);
    }
    this.yayinla();
    this.zamanlayiciIptal = this.b.zamanla(() => this.elBaslat(), sonraki);
  }

  private oyuncuIdleri(): (string | null)[] {
    return this.koltuklar.map((k) => (k.tur === "insan" ? k.oyuncu.id : null));
  }

  private okeyElBitti(masa: Masa, sonraki: number) {
    const dagitim = this.b.elSonunda?.({ oyun: "okey", masa, oyuncular: this.oyuncuIdleri(), giris: this.b.giris }) ?? {
      cipDegisimi: [0, 0, 0, 0],
      xp: [0, 0, 0, 0],
    };
    this.sonEl = { sonuc: masa.sonuc!, macBitti: true, ...dagitim, sonrakiEl: this.b.simdi() + sonraki };
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
  }

  /**
   * 101 eli bitti: puanlar maç tablosuna yazılır. Son else maçın kazananı (en düşük toplam;
   * eşitlikte hepsi) belirlenir ve çip/XP için elSonunda çağrılır. Ara ellerde çip ve XP
   * değişmez.
   */
  private el101Bitti(masa: Masa101, sonraki: number) {
    const mac = this.mac!;
    const s = masa.sonuc!;
    mac.puanlar.push([...s.puanlar]);
    mac.toplam = mac.toplam.map((t, k) => t + s.puanlar[k]);
    this.macElleri.push(s);

    if (s.tur === "bitti") {
      const ad = this.koltukAdi(s.koltuk);
      const puan = s.puanlar[s.koltuk];
      if (s.okeyle) this.sistemMesaji(`${ad} okeyle bitirdi (${puan})`);
      else if (s.elden) this.sistemMesaji(`${ad} elden bitirdi (${puan})`);
      else this.sistemMesaji(`${ad} eli bitirdi (${puan})`);
    } else {
      this.sistemMesaji("Ortada taş kalmadı, el kapandı");
    }

    let dagitim = { cipDegisimi: [0, 0, 0, 0], xp: [0, 0, 0, 0] };
    const macBitti = mac.puanlar.length >= mac.elSayisi;
    if (macBitti) {
      const enDusuk = Math.min(...mac.toplam);
      mac.kazananlar = mac.toplam.flatMap((t, k) => (t === enDusuk ? [k] : []));
      dagitim =
        this.b.elSonunda?.({
          oyun: "101",
          masa,
          mac,
          eller: [...this.macElleri],
          oyuncular: this.oyuncuIdleri(),
          giris: this.b.giris,
        }) ?? dagitim;
      const adlar = mac.kazananlar.map((k) => this.koltukAdi(k)).join(", ");
      this.sistemMesaji(
        mac.kazananlar.length === 1 ? `Maçı ${adlar} kazandı (${enDusuk})` : `Maç berabere: ${adlar} (${enDusuk})`,
      );
    } else {
      this.sistemMesaji(`${mac.elNo}. el bitti, sıradaki el: ${mac.elNo + 1}/${mac.elSayisi}`);
    }
    this.sonEl = { sonuc: s, macBitti, ...dagitim, sonrakiEl: this.b.simdi() + sonraki };
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
    const masa = this.masa;
    if (!masa || masa.sonuc || masa.sira !== koltuk) return;
    if (masa instanceof Masa101) this.otomatikOyna101(masa, koltuk, sureDoldu);
    else this.otomatikOynaOkey(masa, koltuk, sureDoldu);
    if (sureDoldu) this.sistemMesaji(`${this.koltukAdi(koltuk)} için süre doldu`);
    this.hamleSonrasi();
  }

  private otomatikOynaOkey(masa: Masa, koltuk: number, sureDoldu: boolean) {
    let adim = 0;
    do {
      const eylem = botHamlesi(masa.gorunum(koltuk));
      if (sureDoldu && eylem.tur === "bitir") {
        // Süresi dolan oyuncunun yerine el bitirilmez, sadece taş atılır.
        masa.hamle(koltuk, { tur: "at", tas: eylem.tas });
      } else {
        masa.hamle(koltuk, eylem);
      }
    } while (sureDoldu && !masa.sonuc && masa.sira === koltuk && ++adim < 4);
  }

  /**
   * 101. Bot: bot101Hamlesi'nin verdiği tek eylemi yapar (çek, aç, işle ya da at); sıra
   * kendisinde kaldıkça oda onu bir sonraki adımda yine çağırır. Süresi dolan oyuncunun
   * yerine ise açılmaz, işlenmez: çekmediyse ortadan çekilir ve cezasız bir taş atılır.
   */
  private otomatikOyna101(masa: Masa101, koltuk: number, sureDoldu: boolean) {
    if (!sureDoldu) {
      const s = this.hamleUygula(koltuk, bot101Hamlesi(masa.gorunum(koltuk)));
      // Bot geçersiz bir eylem önerdiyse takılı kalmasın: sürenin dolduğu gibi oyna.
      if (s.tamam) return;
    }
    if (masa.asama === "cek") {
      const s = this.hamleUygula(koltuk, { tur: "cek", kaynak: "orta" });
      if (!s.tamam) this.hamleUygula(koltuk, { tur: "cek", kaynak: "yan" });
    }
    if (masa.sonuc || masa.sira !== koltuk || masa.asama !== "at") return;
    const s = this.hamleUygula(koltuk, { tur: "at", tas: bot101Atis(masa.gorunum(koltuk)) });
    // Son çare: atılabilen ilk taş (sıra hiçbir durumda bu koltukta takılı kalmaz).
    if (!s.tamam) {
      for (const tas of [...masa.eller[koltuk]]) if (this.hamleUygula(koltuk, { tur: "at", tas }).tamam) break;
    }
  }

  // ---------------- Görünüm ve yayın ----------------

  gorunum(id: string): OdaGorunumu {
    const koltuk = this.koltukBul(id);
    return {
      kod: this.b.kod,
      oyun: this.oyun,
      salon: this.b.salon,
      giris: this.b.giris,
      sahipId: this.sahipId,
      koltuklar: this.koltuklar.map(koltukGorunumu),
      benimKoltugum: koltuk === -1 ? null : koltuk,
      oyunda: this.oyunda,
      masa: this.masa && koltuk !== -1 ? this.masa.gorunum(koltuk) : null,
      // Kopya: yerel antrenmanda mesaj nesnesi doğrudan arayüze gider, sonraki eller onu değiştirmesin.
      mac: this.mac && {
        ...this.mac,
        puanlar: this.mac.puanlar.map((p) => [...p]),
        toplam: [...this.mac.toplam],
        kazananlar: this.mac.kazananlar && [...this.mac.kazananlar],
      },
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
