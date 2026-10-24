// OnizlemeBaglanti: sunucu olmadan arayüzü göstermek için sahte sunucu.
//
// Adres çubuğuna ?onizleme=1 eklenince devreye girer (sadece geliştirme ve ekran
// görüntüsü içindir; telefonda kullanılmaz). Lobi, mağaza, görevler, sıralama ve
// profil ekranlarını örnek verilerle doldurur ve basit isteklere cevap verir.
import {
  CIP_PAKETLERI,
  type GorevDurumu,
  type IstemciMesaji,
  type OdaGorunumu,
  type OyuncuKarti,
  type Profil,
  SALONLAR,
  type SalonBilgisi,
  type SiralamaSatiri,
  type SunucuMesaji,
  seviyeHesapla,
} from "@okey/kurallar";
import { type Baglanti, Yayinci } from "./baglanti.ts";

const OYUNCU_ID = "00000000-0000-4000-8000-000000000001";

function profilUret(xp: number, cip: number): Profil {
  const s = seviyeHesapla(xp);
  return {
    id: OYUNCU_ID,
    ad: "Mustafa",
    cip,
    xp,
    seviye: s.seviye,
    seviyeIlerleme: { mevcut: s.mevcut, gereken: s.gereken },
    etiket: { cerceve: "altin", rozet: "cay", unvan: "usta" },
    istatistik: { oynanan: 412, kazanilan: 118, cift: 9, okeyAtarak: 12, gosterge: 31 },
    gunlukHediyeAlinabilir: true,
    kalanReklamHakki: 7,
  };
}

const RAKIPLER: OyuncuKarti[] = [
  { id: "r1", ad: "Ayşe Hanım", seviye: 53, etiket: { cerceve: "efsane", rozet: "tac", unvan: "aga" } },
  { id: "r2", ad: "Kadir", seviye: 31, etiket: { cerceve: "zumrut", rozet: "joker", unvan: "kurt" } },
  { id: "r3", ad: "Elif", seviye: 18, etiket: { cerceve: "gumus", rozet: "cift", unvan: "mudavim" } },
  { id: "r4", ad: "Burak", seviye: 12, etiket: { cerceve: "bronz", rozet: "zar", unvan: "acemi" } },
  { id: "r5", ad: "Selin", seviye: 9, etiket: { cerceve: "sade", rozet: "yok", unvan: "acemi" } },
];

export class OnizlemeBaglanti extends Yayinci implements Baglanti {
  private profil = profilUret(29_400, 48_750);

  constructor() {
    super();
    setTimeout(() => {
      this.durumYay("bagli");
      this.ilet({ t: "hosgeldin", oyuncuId: OYUNCU_ID, anahtar: "onizleme-anahtari-0123456789", profil: this.profil });
    }, 50);
  }

  gonder(m: IstemciMesaji) {
    switch (m.t) {
      case "salonlar":
        return this.ilet({ t: "salonlar", salonlar: salonlar() });
      case "gunlukHediye":
        this.profil = { ...this.profil, cip: this.profil.cip + 1000, gunlukHediyeAlinabilir: false };
        this.ilet({ t: "profil", profil: this.profil });
        return this.ilet({ t: "bildirim", tur: "basari", metin: "Günlük hediye: +1.000 çip" });
      case "satinAlma": {
        const paket = CIP_PAKETLERI.find((p) => p.urunId === m.urunId);
        this.profil = { ...this.profil, cip: this.profil.cip + (paket?.cip ?? 0) };
        this.ilet({ t: "profil", profil: this.profil });
        return this.ilet({ t: "bildirim", tur: "basari", metin: "Satın alma tamamlandı (önizleme)" });
      }
      case "etiketSec":
        this.profil = { ...this.profil, etiket: { cerceve: m.cerceve, rozet: m.rozet, unvan: m.unvan } };
        return this.ilet({ t: "profil", profil: this.profil });
      case "adDegistir":
        this.profil = { ...this.profil, ad: m.ad };
        return this.ilet({ t: "profil", profil: this.profil });
      case "gorevler":
        return this.ilet({ t: "gorevler", gorevler: GOREVLER });
      case "gorevOdulu":
        return this.ilet({ t: "bildirim", tur: "basari", metin: "Görev ödülü alındı (önizleme)" });
      case "siralama":
        return this.ilet({ t: "siralama", tur: m.tur, ...siralama(m.tur, this.profil) });
      case "odaKur":
      case "hizliOyun":
      case "odayaKatil":
        return this.ilet({ t: "oda", oda: beklemeOdasi(this.profil) });
      case "basla":
        return this.ilet({ t: "hata", mesaj: "Önizlemede online oyun yok; antrenmanı deneyin" });
      case "odadanAyril":
        return this.ilet({ t: "odadanCikti", sebep: null });
      case "hesapSil":
        return this.ilet({ t: "hesapSilindi" });
      default:
        return;
    }
  }

  kapat() {}

  private ilet(m: SunucuMesaji) {
    setTimeout(() => this.mesajYay(m), 30);
  }
}

function salonlar(): SalonBilgisi[] {
  const sayilar = [214, 136, 41, 9];
  return SALONLAR.map((s, i) => ({ ...s, oyuncuSayisi: sayilar[i] }));
}

const GOREVLER: GorevDurumu[] = [
  { id: "oyna5", metin: "5 el oyna", ilerleme: 5, hedef: 5, odulCip: 500, odulXp: 30, alindi: false },
  { id: "kazan2", metin: "2 el kazan", ilerleme: 1, hedef: 2, odulCip: 800, odulXp: 50, alindi: false },
  { id: "gosterge1", metin: "Gösterge göster", ilerleme: 1, hedef: 1, odulCip: 300, odulXp: 20, alindi: true },
];

function siralama(tur: "seviye" | "cip", p: Profil): { satirlar: SiralamaSatiri[]; ben: SiralamaSatiri } {
  const degerler = tur === "seviye" ? [168_200, 72_450, 31_900, 18_300, 9_950] : [12_480_000, 3_250_000, 1_120_500, 640_000, 255_000];
  const satirlar = RAKIPLER.map((oyuncu, i) => ({ sira: i + 1, oyuncu, deger: degerler[i] }));
  const ben = { sira: 27, oyuncu: { id: p.id, ad: p.ad, seviye: p.seviye, etiket: p.etiket }, deger: tur === "seviye" ? p.xp : p.cip };
  return { satirlar, ben };
}

function beklemeOdasi(p: Profil): OdaGorunumu {
  return {
    kod: "K7M2Q",
    salon: "kahvehane",
    giris: 500,
    sahipId: p.id,
    koltuklar: [
      { tur: "insan", oyuncu: { id: p.id, ad: p.ad, seviye: p.seviye, etiket: p.etiket }, bagli: true },
      { tur: "insan", oyuncu: RAKIPLER[2], bagli: true },
      { tur: "bos" },
      { tur: "bos" },
    ],
    benimKoltugum: 0,
    oyunda: false,
    masa: null,
    turBitis: null,
    turKalanMs: null,
    turSuresiMs: 25_000,
    sonEl: null,
    elNo: 0,
  };
}
