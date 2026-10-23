// Uygulamanın tüm durumu ve onu değiştiren tek fonksiyon (reducer).
//
// Kural: durum sadece burada değişir. Sunucudan gelen her mesaj da, kullanıcının
// ekran değiştirmesi de bir "Islem" olarak buraya gelir. Böylece "bu veri nereden
// geldi?" sorusunun cevabı hep bu dosyadadır.
import type {
  GorevDurumu,
  OdaGorunumu,
  Profil,
  SalonBilgisi,
  SiralamaSatiri,
  SohbetMesaji,
  SunucuMesaji,
} from "@okey/kurallar";
import type { BaglantiDurumu } from "../baglanti/baglanti.ts";
import { type Ayarlar, type Hesap, VARSAYILAN_AYARLAR } from "../platform/depo.ts";

export type Ekran = "giris" | "lobi" | "oda" | "magaza" | "profil" | "ayarlar" | "gorevler" | "siralama";

export type BildirimTuru = "bilgi" | "basari" | "hata" | "seviye";
export interface Bildirim {
  id: number;
  tur: BildirimTuru;
  metin: string;
}

export interface Siralama {
  satirlar: SiralamaSatiri[];
  ben: SiralamaSatiri | null;
}

export interface Durum {
  ekran: Ekran;
  /** Kayıtlı hesap ve ayarlar okundu mu? (Okunana kadar açılış ekranı gösterilir.) */
  yuklendi: boolean;
  hesap: Hesap | null;
  ayarlar: Ayarlar;
  /** Online sunucu bağlantısının durumu; hiç bağlanılmadıysa "yok". */
  baglanti: BaglantiDurumu | "yok";
  profil: Profil | null;
  salonlar: SalonBilgisi[];
  /** Antrenman modunda mıyız? (Masa yerel Oda'dan gelir.) */
  antrenman: boolean;
  oda: OdaGorunumu | null;
  sohbet: SohbetMesaji[];
  okunmamisSohbet: number;
  gorevler: GorevDurumu[] | null;
  siralama: { seviye: Siralama | null; cip: Siralama | null };
  bildirimler: Bildirim[];
}

export const ilkDurum: Durum = {
  ekran: "giris",
  yuklendi: false,
  hesap: null,
  ayarlar: VARSAYILAN_AYARLAR,
  baglanti: "yok",
  profil: null,
  salonlar: [],
  antrenman: false,
  oda: null,
  sohbet: [],
  okunmamisSohbet: 0,
  gorevler: null,
  siralama: { seviye: null, cip: null },
  bildirimler: [],
};

/** Mesaj kaynağı: online sunucu ya da telefondaki antrenman odası. */
export type Kaynak = "online" | "yerel";

export type Islem =
  | { tur: "yuklendi"; hesap: Hesap | null; ayarlar: Ayarlar }
  | { tur: "sunucu"; kaynak: Kaynak; mesaj: SunucuMesaji }
  | { tur: "baglanti"; durum: BaglantiDurumu | "yok" }
  | { tur: "ekran"; ekran: Ekran }
  | { tur: "hesap"; hesap: Hesap | null }
  | { tur: "ayarlar"; ayarlar: Ayarlar }
  | { tur: "antrenman"; acik: boolean }
  | { tur: "bildir"; bildirimTuru: BildirimTuru; metin: string }
  | { tur: "bildirimKapat"; id: number }
  | { tur: "sohbetOkundu" }
  | { tur: "oturumuKapat" };

let bildirimSayaci = 0;

/** Masa ile ilgili mesajlar: antrenmandayken online sunucudan gelenler yok sayılır. */
const MASA_MESAJLARI = new Set(["oda", "odadanCikti", "sohbet", "sohbetGecmisi"]);

export function indirgeyici(d: Durum, i: Islem): Durum {
  switch (i.tur) {
    case "yuklendi":
      return { ...d, yuklendi: true, hesap: i.hesap, ayarlar: i.ayarlar };
    case "baglanti":
      return { ...d, baglanti: i.durum };
    case "ekran":
      return { ...d, ekran: i.ekran };
    case "hesap":
      return { ...d, hesap: i.hesap };
    case "ayarlar":
      return { ...d, ayarlar: i.ayarlar };
    case "antrenman":
      return i.acik
        ? { ...d, antrenman: true, oda: null, sohbet: [], okunmamisSohbet: 0, ekran: "oda" }
        : { ...d, antrenman: false, oda: null, sohbet: [], ekran: d.profil ? "lobi" : "giris" };
    case "bildir":
      return {
        ...d,
        // Ekranda en fazla 3 bildirim; eskiler düşer.
        bildirimler: [...d.bildirimler.slice(-2), { id: ++bildirimSayaci, tur: i.bildirimTuru, metin: i.metin }],
      };
    case "bildirimKapat":
      return { ...d, bildirimler: d.bildirimler.filter((b) => b.id !== i.id) };
    case "sohbetOkundu":
      return { ...d, okunmamisSohbet: 0 };
    case "oturumuKapat":
      return { ...ilkDurum, yuklendi: true, ayarlar: d.ayarlar };
    case "sunucu":
      if (i.kaynak === "online" && d.antrenman && MASA_MESAJLARI.has(i.mesaj.t)) return d;
      return sunucuMesaji(d, i.mesaj);
  }
}

function sunucuMesaji(d: Durum, m: SunucuMesaji): Durum {
  switch (m.t) {
    case "hosgeldin":
      return {
        ...d,
        profil: m.profil,
        // Giriş ekranındaysak lobiye geç; başka ekrandaysak (yeniden bağlanma) yerinde kal.
        ekran: d.ekran === "giris" ? "lobi" : d.ekran,
      };
    case "profil":
      return { ...d, profil: m.profil };
    case "salonlar":
      return { ...d, salonlar: m.salonlar };
    case "oda": {
      // Yeni bir odaya girdiysek sohbeti sıfırla.
      const yeniOda = d.oda?.kod !== m.oda.kod;
      return {
        ...d,
        oda: m.oda,
        ekran: "oda",
        sohbet: yeniOda ? [] : d.sohbet,
        okunmamisSohbet: yeniOda ? 0 : d.okunmamisSohbet,
      };
    }
    case "odadanCikti": {
      const sonraki: Durum = { ...d, oda: null, sohbet: [], antrenman: false, ekran: d.profil ? "lobi" : "giris" };
      return m.sebep ? bildirimEkle(sonraki, "bilgi", m.sebep) : sonraki;
    }
    case "sohbet":
      return {
        ...d,
        sohbet: [...d.sohbet.slice(-59), m.mesaj],
        okunmamisSohbet: m.mesaj.koltuk === -1 ? d.okunmamisSohbet : d.okunmamisSohbet + 1,
      };
    case "sohbetGecmisi":
      return { ...d, sohbet: m.mesajlar };
    case "siralama":
      return { ...d, siralama: { ...d.siralama, [m.tur]: { satirlar: m.satirlar, ben: m.ben } } };
    case "gorevler":
      return { ...d, gorevler: m.gorevler };
    case "bildirim":
      return bildirimEkle(d, m.tur, m.metin);
    case "hata":
      return bildirimEkle(d, "hata", m.mesaj);
    case "hesapSilindi":
      return { ...ilkDurum, yuklendi: true, ayarlar: d.ayarlar };
    case "pong":
      return d;
  }
}

function bildirimEkle(d: Durum, tur: BildirimTuru, metin: string): Durum {
  return indirgeyici(d, { tur: "bildir", bildirimTuru: tur, metin });
}
