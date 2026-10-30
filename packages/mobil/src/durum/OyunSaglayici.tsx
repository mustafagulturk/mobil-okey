// OyunSaglayici: durumu (useReducer) ve bağlantıları tutan React bağlamı.
//
// Ekranlar useOyun() ile buraya erişir: durumu okur, gonder() ile mesaj yollar.
// Hangi bağlantının kullanılacağına burada karar verilir:
//  - antrenmandaysak masa mesajları YerelBaglanti'ya,
//  - diğer her şey OnlineBaglanti'ya (ya da ?onizleme=1 ile sahte sunucuya) gider.
import { type IstemciMesaji, type OyuncuKarti, type OyunTuru, type SunucuMesaji, VARSAYILAN_ETIKET } from "@okey/kurallar";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import type { Baglanti } from "../baglanti/baglanti.ts";
import { OnizlemeBaglanti } from "../baglanti/OnizlemeBaglanti.ts";
import { OnlineBaglanti } from "../baglanti/OnlineBaglanti.ts";
import { YerelBaglanti } from "../baglanti/YerelBaglanti.ts";
import { type Ayarlar, DEPO, type Hesap, oku, sil, VARSAYILAN_AYARLAR, yaz } from "../platform/depo.ts";
import { ONIZLEME, sunucuAdresi } from "./ayar.ts";
import { magaza, ZATEN_KULLANILDI } from "../platform/magaza.ts";
import { reklam } from "../platform/reklam.ts";
import { sesAcik } from "../platform/ses.ts";
import { type BildirimTuru, type Durum, type Ekran, ilkDurum, indirgeyici, type Kaynak } from "./durum.ts";

interface OyunBaglami {
  durum: Durum;
  gonder: (m: IstemciMesaji) => void;
  /** İlk giriş ya da kurtarma koduyla giriş. */
  girisYap: (ad: string, kurtarma?: { oyuncuId: string; anahtar: string }) => void;
  tekrarDene: () => void;
  /** Telefonda botlara karşı seçilen oyun türünde (Okey / 101) bir masa açar. */
  antrenmanBaslat: (oyun: OyunTuru) => void;
  ekranaGit: (e: Ekran) => void;
  bildir: (metin: string, tur?: BildirimTuru) => void;
  bildirimKapat: (id: number) => void;
  sohbetOkundu: () => void;
  ayarlariKaydet: (a: Ayarlar) => void;
}

/** Sunucunun, tanımadığı ya da anahtarı tutmayan hesap için verdiği hata (hesap.ts). */
const GIRIS_HATALI = "Giriş bilgileri hatalı";

const Baglam = createContext<OyunBaglami | null>(null);

export function useOyun(): OyunBaglami {
  const b = useContext(Baglam);
  if (!b) throw new Error("useOyun, OyunSaglayici içinde kullanılmalı");
  return b;
}

export function OyunSaglayici({ children }: { children: ReactNode }) {
  const [durum, dagit] = useReducer(indirgeyici, ilkDurum);
  const online = useRef<Baglanti | null>(null);
  const yerel = useRef<YerelBaglanti | null>(null);
  /** Son giriş bilgisi: sunucu adresi değişince aynı bilgiyle yeniden bağlanmak için. */
  const sonGiris = useRef<{ ad: string; oyuncuId?: string; anahtar?: string } | null>(null);

  // Geri çağrılarda her zaman en güncel durumu okumak için.
  const durumRef = useRef(durum);
  durumRef.current = durum;

  /** Bir bağlantının mesajlarını reducer'a bağlar ve yan etkileri (kaydetme vb.) yapar. */
  const bagla = useCallback((b: Baglanti, kaynak: Kaynak) => {
    b.dinle((mesaj) => {
      const yut = yanEtkiler(mesaj, kaynak);
      if (!yut) dagit({ tur: "sunucu", kaynak, mesaj, alinma: Date.now() });
    });
    if (kaynak === "online") b.durumDinle((d) => dagit({ tur: "baglanti", durum: d }));
  }, []);

  /**
   * Açılışta yeniden gönderilen (tüketilmemiş) satın almaların jetonları, gönderildikleri sırayla.
   * Sunucu her birine ya başarı bildirimi ya da "daha önce kullanıldı" hatası döner.
   */
  const yenidenGonderilen = useRef<string[]>([]);

  /**
   * Mesajın durumu değiştirmekten başka gerektirdiği işler.
   * true dönerse mesaj "yutulur": kullanıcıya gösterilmez.
   */
  const yanEtkiler = (m: SunucuMesaji, kaynak: Kaynak): boolean => {
    if (kaynak !== "online") return false;
    // Yeniden gönderilen satın alma zaten çipe çevrilmişse bu bir hata değildir:
    // sessizce "tüketildi" say ve bir daha gönderme.
    if (m.t === "hata" && m.mesaj === ZATEN_KULLANILDI && yenidenGonderilen.current.length > 0) {
      void magaza.tuketildiSay(yenidenGonderilen.current.shift()!);
      return true;
    }
    if (m.t === "bildirim" && m.tur === "basari" && yenidenGonderilen.current.length > 0 && m.metin.includes("çip hesabına eklendi")) {
      void magaza.tuketildiSay(yenidenGonderilen.current.shift()!);
    }
    // Kayıtlı hesapla giriş reddedildi: sunucu hesabı tanımıyor. Ücretsiz test sunucusunda
    // (Render) veritabanı her yeniden başlatmada sıfırlanır; oyuncu "bağlanılıyor"da takılı
    // kalmasın diye aynı adla yeni hesap açılır. (Kurtarma koduyla girişte hesap henüz
    // kaydedilmediği için bu yola girilmez; hata kullanıcıya gösterilir.)
    if (m.t === "hata" && m.mesaj === GIRIS_HATALI && !ONIZLEME) {
      const d = durumRef.current;
      if (d.hesap && !d.profil) {
        const ad = d.hesap.ad;
        void sil(DEPO.hesap);
        dagit({ tur: "hesap", hesap: null });
        dagit({ tur: "bildir", bildirimTuru: "bilgi", metin: "Sunucuda eski hesabın bulunamadı, yeni bir hesap açılıyor" });
        // Bu mesajı işleyen bağlantıyı mesaj dağıtımı sırasında kapatmamak için bir sonraki turda.
        setTimeout(() => onlineBaglan({ ad }, durumRef.current.ayarlar), 0);
        return true;
      }
    }
    if (m.t === "hosgeldin" && !ONIZLEME) {
      const hesap: Hesap = { oyuncuId: m.oyuncuId, anahtar: m.anahtar, ad: m.profil.ad };
      void yaz(DEPO.hesap, hesap);
      dagit({ tur: "hesap", hesap });
      if (online.current instanceof OnlineBaglanti) online.current.girisGuncelle(hesap);
      // Ödemesi alınmış ama sunucuya ulaşmamış satın almalar varsa şimdi gönder.
      void magaza.bekleyenler().then((liste) => {
        for (const s of liste) {
          yenidenGonderilen.current.push(s.jeton);
          online.current?.gonder({ t: "satinAlma", urunId: s.urunId, satinAlmaJetonu: s.jeton });
        }
      });
    }
    if (m.t === "hesapSilindi") {
      void sil(DEPO.hesap);
      online.current?.kapat();
      online.current = null;
      sonGiris.current = null;
    }
    return false;
  };

  const onlineBaglan = useCallback(
    (giris: { ad: string; oyuncuId?: string; anahtar?: string }, ayarlar: Ayarlar) => {
      online.current?.kapat();
      online.current = null;
      sonGiris.current = giris;
      if (ONIZLEME) {
        const b = new OnizlemeBaglanti();
        online.current = b;
        bagla(b, "online");
        return;
      }
      const adres = sunucuAdresi(ayarlar);
      // Adres yoksa (telefonda yapılandırılmamış) boşuna denemeyiz; giriş ekranı antrenmanı önerir.
      if (!adres) return dagit({ tur: "baglanti", durum: "ayarsiz" });
      const b = new OnlineBaglanti(adres, giris);
      online.current = b;
      bagla(b, "online");
      dagit({ tur: "baglanti", durum: "baglaniyor" });
    },
    [bagla],
  );

  // Açılış: kayıtlı hesap ve ayarları oku; hesap varsa otomatik giriş yap.
  useEffect(() => {
    let iptal = false;
    void (async () => {
      const [hesap, ayarlar] = await Promise.all([oku<Hesap>(DEPO.hesap), oku<Ayarlar>(DEPO.ayarlar)]);
      if (iptal) return;
      const a = { ...VARSAYILAN_AYARLAR, ...ayarlar };
      sesAcik(a.ses);
      dagit({ tur: "yuklendi", hesap, ayarlar: a });
      if (ONIZLEME) onlineBaglan({ ad: "Mustafa" }, a);
      else if (hesap) onlineBaglan(hesap, a);
      else if (!sunucuAdresi(a)) dagit({ tur: "baglanti", durum: "ayarsiz" });
    })();
    // Reklam SDK'sı ve AB izin formu (telefonda). Hata uygulamayı durdurmasın.
    reklam.hazirla().catch((e) => console.warn("Reklam hazırlanamadı", e));
    return () => {
      iptal = true;
      online.current?.kapat();
      yerel.current?.kapat();
    };
  }, [onlineBaglan]);

  // SADECE GELİŞTİRME: 101 masasını sahte verilerle göstermek için (bkz. masa101/onizleme101.ts).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    void import("../ekranlar/masa101/onizleme101.ts").then((m) => {
      m.elHazirlaKancasiniKur();
      m.onizlemeKancasiniKur((oda, antrenman) => {
        yerel.current?.kapat();
        yerel.current = null;
        if (antrenman) dagit({ tur: "antrenman", acik: true });
        dagit({ tur: "sunucu", kaynak: "yerel", mesaj: { t: "oda", oda }, alinma: Date.now() });
      });
    });
  }, []);

  const gonder = useCallback((m: IstemciMesaji) => {
    const d = durumRef.current;
    if (d.antrenman && yerel.current) yerel.current.gonder(m);
    else online.current?.gonder(m);
  }, []);

  const girisYap = useCallback<OyunBaglami["girisYap"]>(
    (ad, kurtarma) => onlineBaglan({ ad, ...kurtarma }, durumRef.current.ayarlar),
    [onlineBaglan],
  );

  const tekrarDene = useCallback(() => {
    if (online.current instanceof OnlineBaglanti) online.current.simdiDene();
  }, []);

  const antrenmanBaslat = useCallback((oyun: OyunTuru) => {
    const d = durumRef.current;
    yerel.current?.kapat();
    const p = d.profil;
    const ben: OyuncuKarti = p
      ? { id: p.id, ad: p.ad, seviye: p.seviye, etiket: p.etiket }
      : { id: "yerel-oyuncu", ad: d.hesap?.ad ?? "Sen", seviye: 1, etiket: VARSAYILAN_ETIKET };
    const b = new YerelBaglanti(ben, oyun);
    yerel.current = b;
    bagla(b, "yerel");
    dagit({ tur: "antrenman", acik: true });
    b.baslat();
  }, [bagla]);

  const ayarlariKaydet = useCallback(
    (a: Ayarlar) => {
      const eski = durumRef.current.ayarlar;
      sesAcik(a.ses);
      dagit({ tur: "ayarlar", ayarlar: a });
      void yaz(DEPO.ayarlar, a);
      // Sunucu adresi değiştiyse yeni adrese bağlan (hesap ya da önceki bir giriş denemesi varsa).
      if (a.sunucuUrl === eski.sunucuUrl || ONIZLEME) return;
      const g = durumRef.current.hesap ?? sonGiris.current;
      if (g) onlineBaglan(g, a);
      else dagit({ tur: "baglanti", durum: sunucuAdresi(a) ? "yok" : "ayarsiz" });
    },
    [onlineBaglan],
  );

  // Sadece dagit kullanan basit eylemler: bir kez oluşturulur (kimlikleri değişmez).
  const basitEylemler = useMemo(
    () => ({
      ekranaGit: (ekran: Ekran) => dagit({ tur: "ekran", ekran }),
      bildir: (metin: string, tur: BildirimTuru = "bilgi") => dagit({ tur: "bildir", bildirimTuru: tur, metin }),
      bildirimKapat: (id: number) => dagit({ tur: "bildirimKapat", id }),
      sohbetOkundu: () => dagit({ tur: "sohbetOkundu" }),
    }),
    [],
  );

  const deger = useMemo<OyunBaglami>(
    () => ({ durum, gonder, girisYap, tekrarDene, antrenmanBaslat, ayarlariKaydet, ...basitEylemler }),
    [durum, gonder, girisYap, tekrarDene, antrenmanBaslat, ayarlariKaydet, basitEylemler],
  );

  return <Baglam.Provider value={deger}>{children}</Baglam.Provider>;
}
