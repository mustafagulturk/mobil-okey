// Bağlantı: tek bir telefonun WebSocket bağlantısı.
//
// Gelen her mesaj sırayla şu kapılardan geçer:
//   1. Boyut (en fazla 8 KB) ve hız sınırı (saniyede en fazla N mesaj).
//   2. JSON çözümleme.
//   3. zod şeması (kurallar paketindeki istemciMesajiSemasi): türü, alanları ve uzunlukları
//      tutmayan mesaj işlenmez.
//   4. Giriş kontrolü: "giris" ve "ping" dışındaki mesajlar için önce giriş yapılmış olmalı.
// Bunlardan geçen mesaj isle() içinde ilgili modüle (hesap, salon, ilerleme, mağaza) yönlendirilir.
// Hata olduğunda bağlantı kapatılmaz, Türkçe bir {t:"hata"} mesajı döner.

import {
  etiketGecerliMi,
  istemciMesajiSemasi,
  PROTOKOL_SURUMU,
  type IstemciMesaji,
  seviyeHesapla,
  type SunucuMesaji,
} from "@okey/kurallar";
import type { WebSocket } from "ws";
import type { z } from "zod";
import type { Ayarlar } from "./ayarlar.ts";
import { girisYap } from "./hesap.ts";
import {
  gorevDurumlari,
  gorevOduluAl,
  gunlukHediyeAl,
  istatistik,
  type OdulSonucu,
  oyuncuKarti,
  profilOlustur,
} from "./ilerleme.ts";
import type { Magaza } from "./magaza.ts";
import type { SalonYoneticisi } from "./salon.ts";
import { siralamaGetir } from "./siralama.ts";
import { kufurMaskele } from "./sohbet.ts";
import type { Veritabani } from "./veritabani.ts";

/** Bağlantıların ortak kullandığı sunucu parçaları. */
export interface SunucuBaglami {
  ayarlar: Ayarlar;
  vt: Veritabani;
  salon: SalonYoneticisi;
  magaza: Magaza;
  /** oyuncuId -> o oyuncunun açık bağlantısı. */
  cevrimici: Map<string, Baglanti>;
  profilGonder: (oyuncuId: string) => void;
}

/** zod'un İngilizce hata mesajları yerine kısa Türkçe mesajlar. Şemadaki özel mesajlar (ör. ad kuralları) aynen kalır. */
const turkceHatalar: z.ZodErrorMap = (sorun) => {
  const alan = sorun.path.join(".") || "mesaj";
  switch (sorun.code) {
    case "invalid_union_discriminator":
      return { message: alan === "t" ? "Bilinmeyen mesaj türü" : `${alan} geçersiz` };
    case "invalid_type":
      return { message: sorun.received === "undefined" ? `${alan} alanı eksik` : `${alan} alanının türü yanlış` };
    case "too_small":
      return { message: `${alan} çok kısa ya da küçük` };
    case "too_big":
      return { message: `${alan} çok uzun ya da büyük` };
    default:
      return { message: `${alan} geçersiz` };
  }
};

export class Baglanti {
  oyuncuId: string | null = null;
  /** Son ping'e pong geldi mi? Gelmediyse bir sonraki turda bağlantı kapatılır. */
  canli = true;
  /** Aynı hesap başka cihazdan girdiyse true: kapanınca oyuncuyu odadan düşürme. */
  private devredildi = false;
  private pencereBasi = 0;
  private pencereSayaci = 0;
  private sonSohbet = 0;

  constructor(
    private readonly ws: WebSocket,
    private readonly s: SunucuBaglami,
  ) {
    ws.on("message", (veri, ikili) => this.mesajGeldi(veri as Buffer, ikili));
    ws.on("pong", () => (this.canli = true));
    ws.on("close", () => this.kapandi());
    ws.on("error", () => {}); // hata ardından "close" gelir
  }

  gonder(m: SunucuMesaji) {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(m));
  }

  hata(mesaj: string) {
    this.gonder({ t: "hata", mesaj });
  }

  kapat(kod = 1000, sebep = "") {
    this.ws.close(kod, sebep);
  }

  /** Ping turu: önceki ping'e cevap gelmediyse bağlantı ölüdür. */
  pingAt() {
    if (!this.canli) {
      this.ws.terminate();
      return;
    }
    this.canli = false;
    this.ws.ping();
  }

  /** Aynı hesap başka bir cihazdan girdi: bu bağlantıyı oyuncuyu odadan düşürmeden kapat. */
  devret() {
    this.devredildi = true;
    this.gonder({ t: "bildirim", tur: "bilgi", metin: "Hesabına başka bir cihazdan giriş yapıldı" });
    this.kapat(4000, "Başka cihazdan giriş");
  }

  private kapandi() {
    const id = this.oyuncuId;
    if (!id || this.devredildi || this.s.cevrimici.get(id) !== this) return;
    this.s.cevrimici.delete(id);
    this.s.salon.baglantiKoptu(id);
  }

  /** Saniyelik pencerede mesaj sayar. Sınır aşılırsa mesaj işlenmez (uyarı pencere başına bir kez). */
  private hizSiniriAsildi(): boolean {
    const simdi = Date.now();
    if (simdi - this.pencereBasi >= 1000) {
      this.pencereBasi = simdi;
      this.pencereSayaci = 0;
    }
    this.pencereSayaci++;
    if (this.pencereSayaci === this.s.ayarlar.saniyeBasinaMesaj + 1) this.hata("Çok hızlı mesaj gönderiyorsun");
    return this.pencereSayaci > this.s.ayarlar.saniyeBasinaMesaj;
  }

  private async mesajGeldi(veri: Buffer, ikili: boolean) {
    if (this.hizSiniriAsildi()) return;
    if (ikili) return this.hata("Sadece metin mesajı kabul edilir");
    if (veri.byteLength > this.s.ayarlar.enBuyukMesajBayt) return this.hata("Mesaj çok büyük");

    let ham: unknown;
    try {
      ham = JSON.parse(veri.toString("utf8"));
    } catch {
      return this.hata("Mesaj okunamadı (geçersiz JSON)");
    }
    const sonuc = istemciMesajiSemasi.safeParse(ham, { errorMap: turkceHatalar });
    if (!sonuc.success) return this.hata(sonuc.error.issues[0]?.message ?? "Geçersiz mesaj");

    const m = sonuc.data;
    if (!this.oyuncuId && m.t !== "giris" && m.t !== "ping") return this.hata("Önce giriş yapmalısın");
    try {
      await this.isle(m);
    } catch (e) {
      this.s.ayarlar.gunluk(`Mesaj işlenirken hata (${m.t}): ${(e as Error).stack ?? e}`);
      this.hata("Sunucuda bir hata oluştu");
    }
  }

  private async isle(m: IstemciMesaji) {
    const { vt, salon, ayarlar } = this.s;
    const zaman = ayarlar.simdi();

    if (m.t === "ping") return this.gonder({ t: "pong" });
    if (m.t === "giris") return this.giris(m);

    const id = this.oyuncuId!;
    const oyuncu = vt.oyuncuGetir(id);
    if (!oyuncu) return this.kapat(4001, "Hesap bulunamadı");

    switch (m.t) {
      case "adDegistir":
        vt.adGuncelle(id, m.ad);
        salon.kartGuncelle(oyuncuKarti({ ...oyuncu, ad: m.ad }));
        return this.s.profilGonder(id);

      case "etiketSec": {
        const etiket = { cerceve: m.cerceve, rozet: m.rozet, unvan: m.unvan };
        if (!etiketGecerliMi(etiket, seviyeHesapla(oyuncu.xp).seviye, istatistik(oyuncu))) {
          return this.hata("Bu süsü henüz açmadın");
        }
        vt.etiketGuncelle(id, etiket);
        salon.kartGuncelle(oyuncuKarti({ ...oyuncu, ...etiket }));
        return this.s.profilGonder(id);
      }

      case "hesapSil":
        salon.ayril(id);
        vt.oyuncuSil(id);
        ayarlar.gunluk(`Hesap silindi: ${id}`);
        this.s.cevrimici.delete(id);
        this.oyuncuId = null;
        this.gonder({ t: "hesapSilindi" });
        return this.kapat(1000, "Hesap silindi");

      case "salonlar":
        return this.gonder({ t: "salonlar", salonlar: salon.salonListesi() });

      case "hizliOyun":
        return this.sonucBildir(salon.hizliOyun(oyuncuKarti(oyuncu), m.salon, oyuncu.cip, m.oyun));
      case "odaKur":
        return this.sonucBildir(salon.odaKur(oyuncuKarti(oyuncu), m.salon, oyuncu.cip, m.oyun));
      case "odayaKatil":
        return this.sonucBildir(salon.odayaKatil(oyuncuKarti(oyuncu), m.kod, oyuncu.cip));
      case "odadanAyril":
        return salon.ayril(id);
      case "basla":
        return this.sonucBildir(salon.basla(id));
      case "hamle":
        return this.sonucBildir(salon.hamle(id, m.eylem));

      case "sohbet": {
        if (Date.now() - this.sonSohbet < 1000) return this.hata("Biraz yavaş: saniyede en fazla bir mesaj");
        this.sonSohbet = Date.now();
        return this.sonucBildir(salon.sohbet(id, kufurMaskele(m.metin)));
      }

      case "siralama":
        return this.gonder({ t: "siralama", tur: m.tur, ...siralamaGetir(vt, m.tur, id) });
      case "gorevler":
        return this.gonder({ t: "gorevler", gorevler: gorevDurumlari(vt, id, zaman) });
      case "gorevOdulu":
        this.odulBildir(gorevOduluAl(vt, id, m.gorevId, zaman));
        return this.gonder({ t: "gorevler", gorevler: gorevDurumlari(vt, id, zaman) });
      case "gunlukHediye":
        return this.odulBildir(gunlukHediyeAl(vt, id, zaman));

      case "satinAlma": {
        const s = await this.s.magaza.satinAl(id, m.urunId, m.satinAlmaJetonu);
        if (!s.tamam) return this.hata(s.hata);
        this.gonder({ t: "bildirim", tur: "basari", metin: `+${s.cip.toLocaleString("tr-TR")} çip hesabına eklendi` });
        return this.s.profilGonder(id);
      }
    }
  }

  private giris(m: Extract<IstemciMesaji, { t: "giris" }>) {
    if (this.oyuncuId) return this.hata("Zaten giriş yaptın");
    if ((m.surum ?? 0) < PROTOKOL_SURUMU) return this.hata("Uygulamanın yeni sürümü var, lütfen Google Play'den güncelle");
    const { vt, ayarlar, cevrimici, salon } = this.s;
    const g = girisYap(vt, m, ayarlar.simdi());
    if (!g.tamam) return this.hata(g.hata);
    if (g.yeni) ayarlar.gunluk(`Yeni hesap: ${g.oyuncuId}`);

    // Aynı hesap başka bir bağlantıda açıksa o bağlantı kapanır; en son giren kazanır.
    cevrimici.get(g.oyuncuId)?.devret();
    cevrimici.set(g.oyuncuId, this);
    this.oyuncuId = g.oyuncuId;

    this.gonder({ t: "hosgeldin", oyuncuId: g.oyuncuId, anahtar: g.anahtar, profil: profilOlustur(vt, g.oyuncuId, ayarlar.simdi())! });
    // Bir masadaysa (bağlantısı kopmuştu) masaya geri döner ve oda görünümünü alır.
    salon.yenidenBaglandi(g.oyuncuId);
  }

  private sonucBildir(s: { tamam: true } | { tamam: false; hata: string }) {
    if (!s.tamam) this.hata(s.hata);
  }

  private odulBildir(s: OdulSonucu) {
    if (!s.tamam) return this.hata(s.hata);
    for (const b of s.bildirimler) this.gonder(b);
    this.s.profilGonder(this.oyuncuId!);
  }
}
