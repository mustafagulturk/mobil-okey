// İlerleme: profil, XP ve seviye, istatistik, günlük görevler ve ödüller.
//
// Sayılar (kaç XP, kaç çip) kurallar paketindeki ekonomi.ts'den gelir; bu dosya sadece
// onları veritabanına uygular. Seviye ayrıca saklanmaz, her zaman toplam XP'den
// hesaplanır (seviyeHesapla); böylece seviye tablosu değişse bile veri tutarlı kalır.
//
// "Ne değişti?" sorusu tek bir yerde cevaplanır: degisiklikleriIzle oyuncunun önceki
// ve sonraki halini karşılaştırır, seviye atladıysa ödülünü verir ve yeni açılan
// süsler için bildirim üretir. El sonu, görev ödülü gibi XP veren her işlem onu kullanır.

import {
  acikSusler,
  bugun,
  CERCEVELER,
  type ElSonuBilgisi,
  GUNLUK_HEDIYE,
  GUNLUK_REKLAM_SINIRI,
  gunlukGorevler,
  type GorevDurumu,
  type Istatistik,
  KOLTUK_SAYISI,
  type OyuncuKarti,
  type Profil,
  ROZETLER,
  seviyeHesapla,
  seviyeOdulu,
  type SunucuMesaji,
  UNVANLAR,
  XP,
} from "@okey/kurallar";
import type { OyuncuSatiri, Veritabani } from "./veritabani.ts";

export type Bildirim = Extract<SunucuMesaji, { t: "bildirim" }>;

export function istatistik(o: OyuncuSatiri): Istatistik {
  return { oynanan: o.oynanan, kazanilan: o.kazanilan, cift: o.cift, okeyAtarak: o.okey_atarak, gosterge: o.gosterge };
}

/** Masada ve sıralamada başkalarına görünen bilgi (çip ve istatistik görünmez). */
export function oyuncuKarti(o: OyuncuSatiri): OyuncuKarti {
  return {
    id: o.id,
    ad: o.ad,
    seviye: seviyeHesapla(o.xp).seviye,
    etiket: { cerceve: o.cerceve, rozet: o.rozet, unvan: o.unvan },
  };
}

export function profilOlustur(vt: Veritabani, id: string, simdi: number): Profil | null {
  const o = vt.oyuncuGetir(id);
  if (!o) return null;
  const s = seviyeHesapla(o.xp);
  const gun = bugun(simdi);
  return {
    id: o.id,
    ad: o.ad,
    cip: o.cip,
    xp: o.xp,
    seviye: s.seviye,
    seviyeIlerleme: { mevcut: s.mevcut, gereken: s.gereken },
    etiket: { cerceve: o.cerceve, rozet: o.rozet, unvan: o.unvan },
    istatistik: istatistik(o),
    gunlukHediyeAlinabilir: o.son_hediye_gunu !== gun,
    kalanReklamHakki: Math.max(0, GUNLUK_REKLAM_SINIRI - vt.reklamSayisi(id, gun)),
  };
}

/**
 * fn'i çalıştırır (XP/istatistik değiştirir), sonra oyuncunun önceki ve sonraki halini
 * karşılaştırır: atlanan her seviye için seviye ödülünü verir, yeni açılan süsleri bildirir.
 */
function degisiklikleriIzle(vt: Veritabani, id: string, zaman: number, fn: () => void): Bildirim[] {
  return vt.islem(() => {
    const once = vt.oyuncuGetir(id);
    if (!once) return [];
    fn();
    const sonra = vt.oyuncuGetir(id)!;
    const bildirimler: Bildirim[] = [];

    const eskiSeviye = seviyeHesapla(once.xp).seviye;
    const yeniSeviye = seviyeHesapla(sonra.xp).seviye;
    for (let s = eskiSeviye + 1; s <= yeniSeviye; s++) {
      const odul = seviyeOdulu(s);
      vt.cipDegistir(id, odul, `seviye:${s}`, zaman);
      bildirimler.push({ t: "bildirim", tur: "seviye", metin: `Tebrikler, seviye ${s} oldun! +${odul} çip` });
    }

    const eski = acikSusler(eskiSeviye, istatistik(once));
    const yeni = acikSusler(yeniSeviye, istatistik(sonra));
    const adlar = [
      ...yeni.cerceve.filter((x) => !eski.cerceve.includes(x)).map((x) => `${CERCEVELER.find((c) => c.id === x)!.ad} çerçeve`),
      ...yeni.rozet.filter((x) => !eski.rozet.includes(x)).map((x) => `${ROZETLER.find((r) => r.id === x)!.ad} rozeti`),
      ...yeni.unvan.filter((x) => !eski.unvan.includes(x)).map((x) => `${UNVANLAR.find((u) => u.id === x)!.ad} unvanı`),
    ];
    for (const ad of adlar) bildirimler.push({ t: "bildirim", tur: "basari", metin: `Yeni süs açıldı: ${ad}` });
    return bildirimler;
  });
}

// ---------------- El sonu ----------------

export interface ElSonuSonucu {
  cipDegisimi: number[];
  xp: number[];
  /** Oyuncu başına gönderilecek bildirimler. */
  bildirimler: Map<string, Bildirim[]>;
}

/**
 * Biten elin çip, XP, istatistik ve görev hesabını yapar.
 * Pot = 4 x giriş (bot koltukları da sanal olarak giriş koyar). Kazanan potun tamamını
 * alır; berabere biterse herkes girişini geri alır.
 */
export function elSonuIsle(vt: Veritabani, bilgi: ElSonuBilgisi, zaman: number): ElSonuSonucu {
  const { masa, oyuncular, giris } = bilgi;
  const sonuc = masa.sonuc!;
  const pot = giris * KOLTUK_SAYISI;
  const gun = bugun(zaman);
  const cipDegisimi = [0, 0, 0, 0];
  const xp = [0, 0, 0, 0];
  const bildirimler = new Map<string, Bildirim[]>();

  for (let koltuk = 0; koltuk < KOLTUK_SAYISI; koltuk++) {
    const kazandi = sonuc.tur === "kazanan" && sonuc.koltuk === koltuk;
    const bitis = sonuc.tur === "kazanan" ? sonuc.bitis : null;
    const cift = kazandi && (bitis === "cift" || bitis === "ciftOkeyAtarak");
    const okeyAtarak = kazandi && (bitis === "okeyAtarak" || bitis === "ciftOkeyAtarak");
    const gosterdi = masa.gostergeGosteren === koltuk;

    if (sonuc.tur === "kazanan") cipDegisimi[koltuk] = kazandi ? pot - giris : -giris;

    const id = oyuncular[koltuk];
    if (!id) continue; // bot

    if (sonuc.tur === "berabere") vt.cipDegistir(id, giris, "el_berabere_iade", zaman);
    if (kazandi) vt.cipDegistir(id, pot, "el_kazanildi", zaman);

    xp[koltuk] =
      XP.elOynadi +
      (kazandi ? XP.elKazandi : 0) +
      (cift ? XP.ciftBitis : 0) +
      (okeyAtarak ? XP.okeyAtarakBitis : 0) +
      (gosterdi ? XP.gostergeGosterdi : 0);

    const artis: Istatistik = {
      oynanan: 1,
      kazanilan: kazandi ? 1 : 0,
      cift: cift ? 1 : 0,
      okeyAtarak: okeyAtarak ? 1 : 0,
      gosterge: gosterdi ? 1 : 0,
    };
    const b = degisiklikleriIzle(vt, id, zaman, () => {
      vt.xpEkle(id, xp[koltuk]);
      vt.istatistikArtir(id, artis);
      for (const [sayac, miktar] of Object.entries(artis) as [keyof Istatistik, number][]) {
        vt.gorevSayaciArtir(id, gun, sayac, miktar);
      }
    });
    if (b.length) bildirimler.set(id, b);
  }
  return { cipDegisimi, xp, bildirimler };
}

// ---------------- Günlük görevler ve hediye ----------------

export function gorevDurumlari(vt: Veritabani, id: string, zaman: number): GorevDurumu[] {
  const gun = bugun(zaman);
  const sayaclar = vt.gorevSayaclari(id, gun);
  const alinan = vt.alinanGorevler(id, gun);
  return gunlukGorevler(id, gun).map((g) => ({
    id: g.id,
    metin: g.metin,
    ilerleme: Math.min(sayaclar[g.sayac] ?? 0, g.hedef),
    hedef: g.hedef,
    odulCip: g.odulCip,
    odulXp: g.odulXp,
    alindi: alinan.includes(g.id),
  }));
}

export type OdulSonucu = { tamam: true; bildirimler: Bildirim[] } | { tamam: false; hata: string };

export function gorevOduluAl(vt: Veritabani, id: string, gorevId: string, zaman: number): OdulSonucu {
  const gorev = gorevDurumlari(vt, id, zaman).find((g) => g.id === gorevId);
  if (!gorev) return { tamam: false, hata: "Bu görev bugünkü görevlerin arasında yok" };
  if (gorev.alindi) return { tamam: false, hata: "Bu görevin ödülünü zaten aldın" };
  if (gorev.ilerleme < gorev.hedef) return { tamam: false, hata: "Görev henüz tamamlanmadı" };
  return vt.islem(() => {
    if (!vt.gorevAlindiKaydet(id, bugun(zaman), gorevId)) return { tamam: false, hata: "Bu görevin ödülünü zaten aldın" };
    vt.cipDegistir(id, gorev.odulCip, `gorev:${gorevId}`, zaman);
    const bildirimler = degisiklikleriIzle(vt, id, zaman, () => vt.xpEkle(id, gorev.odulXp));
    bildirimler.unshift({ t: "bildirim", tur: "basari", metin: `Görev tamamlandı: +${gorev.odulCip} çip, +${gorev.odulXp} XP` });
    return { tamam: true, bildirimler };
  });
}

export function gunlukHediyeAl(vt: Veritabani, id: string, zaman: number): OdulSonucu {
  if (!vt.gunlukHediyeVer(id, bugun(zaman), GUNLUK_HEDIYE, zaman)) {
    return { tamam: false, hata: "Bugünün hediyesini zaten aldın. Yarın tekrar gel!" };
  }
  return { tamam: true, bildirimler: [{ t: "bildirim", tur: "basari", metin: `Günlük hediye: +${GUNLUK_HEDIYE} çip` }] };
}
