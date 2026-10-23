// Uçtan uca yük ve dayanıklılık testi.
//
// Sunucuyu geçici bir veritabanı ve kısaltılmış sürelerle (tur süresi, bot gecikmesi,
// sonraki el, eşleştirme bekleme) aynı süreçte başlatır ve N sanal oyuncu bağlar.
// Sanal oyuncular gerçek bir telefon gibi davranır:
//  - giriş yapar (surum: PROTOKOL_SURUMU), kimliğini saklar, kopunca aynı hesapla geri döner,
//  - farklı salonlarda hızlı oyun oynar ya da özel oda kurup kodu paylaşır, diğerleri kodla katılır,
//  - sıra kendisine gelince kurallar paketindeki botHamlesi ile hamle yapar,
//  - ara sıra sohbet eder, günlük hediye/görev/sıralama ister, masadan kalkıp başka masaya geçer,
//  - bazıları rastgele anda bağlantıyı koparır (sert kesme, ikinci cihazdan giriş, düzgün kapatma),
//  - bazıları kötü niyetlidir: başkasının taşını atar, sırası değilken oynar, bozuk JSON,
//    dev mesaj, ikili veri, başkasının hesabıyla giriş ve mesaj seli gönderir.
// Hedef el sayısına ulaşınca her şey kapatılır ve değişmezler (invariant) kontrol edilir:
//  - hiçbir oyuncunun aldığı mesajda başka oyuncunun eli yoktur,
//  - her görünümde taş sayısı 106 ile tutarlıdır,
//  - veritabanında hiçbir bakiye eksi değildir ve her bakiye cip_hareketleri toplamına eşittir,
//  - sunucu çökmemiştir, yakalanmamış hata ya da "Sunucuda bir hata oluştu" yoktur,
//  - hiçbir masa takılı kalmamıştır.
// Sonunda gecikme (ortalama, p95) ve el/saniye ile birlikte bir rapor basılır.
//
// Çalıştırma (packages/sunucu içinde):
//   npm run yuk-testi                     # 40 oyuncu, 200 el
//   npm run yuk-testi -- --oyuncu 80 --el 500 --tohum 7 --kopma 0.05 --sure 300

import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";
import {
  BASLANGIC_CIPI,
  botHamlesi,
  type Eylem,
  type IstemciMesaji,
  KOLTUK_SAYISI,
  type OdaGorunumu,
  type Profil,
  PROTOKOL_SURUMU,
  SALONLAR,
  salonaUygunMu,
  type SalonId,
  type SunucuMesaji,
  TAS_SAYISI,
  tohumluRastgele,
} from "@okey/kurallar";
import WebSocket from "ws";
import { varsayilanAyarlar } from "../src/ayarlar.ts";
import { sunucuBaslat } from "../src/sunucu.ts";

export interface YukSecenekleri {
  oyuncuSayisi: number;
  /** Toplam bu kadar el bitince test durur. */
  hedefEl: number;
  /** Hedefe bu sürede ulaşılamazsa test başarısız sayılır. */
  zamanAsimiMs: number;
  /** Sanal oyuncuların kararları için tohum (aynı tohum, aynı kişilikler). */
  tohum: number;
  /** Sanal oyuncunun her "tik"te bağlantıyı koparma olasılığı (sadece kopan kişilikler). */
  kopmaOlasiligi: number;
  /** İlerleme satırlarını yaz. */
  ayrintili: boolean;
}

export const VARSAYILAN_SECENEKLER: YukSecenekleri = {
  oyuncuSayisi: 40,
  hedefEl: 200,
  zamanAsimiMs: 240_000,
  tohum: 1,
  kopmaOlasiligi: 0.01,
  ayrintili: true,
};

/**
 * Sunucu ayarları: gerçeğinden çok daha kısa süreler. Botlar 900 ms yerine 15 ms beklediği
 * için botlu masadaki oyuncunun sırası saniyede birkaç kez gelir; zaman sıkıştırıldığı için
 * hız sınırı da aynı oranda gevşetilir (yoksa dürüst oyuncu da sınıra takılır).
 */
const SUNUCU_AYARLARI = {
  turSuresiMs: 1_500,
  botGecikmeMs: 15,
  sonrakiElMs: 150,
  eslesmeBeklemeMs: 200,
  pingAraligiMs: 2_000,
  saniyeBasinaMesaj: 60,
};

/** Bir masa bu kadar süre hiç mesaj göndermezse "takıldı" sayılır. */
const DURGUNLUK_SINIRI_MS = 8_000;

export interface Istatistik {
  ortalama: number;
  p95: number;
  enCok: number;
  adet: number;
}

export interface YukRaporu {
  basarili: boolean;
  sureSn: number;
  oyuncuSayisi: number;
  bitenEl: number;
  elSaniye: number;
  gonderilenMesaj: number;
  alinanMesaj: number;
  hamleSayisi: number;
  kopmaSayisi: number;
  kotuNiyetliMesaj: number;
  sohbetSayisi: number;
  ozelOdaKurulan: number;
  toleransliHata: number;
  hesapSilme: number;
  hamleGecikmesi: Istatistik;
  pingGecikmesi: Istatistik;
  sebepler: Record<string, number>;
  /** Değişmez ihlalleri: tür -> {adet, örnekler}. Boşsa test geçti. */
  ihlaller: Record<string, { adet: number; ornekler: string[] }>;
  sunucuGunlukHatalari: string[];
}

type Mesaj<T extends SunucuMesaji["t"]> = Extract<SunucuMesaji, { t: T }>;

// ---------------- Ortak gözlem defteri ----------------

/** Bütün sanal oyuncuların ortak yazdığı sayaçlar, ölçümler ve ihlaller. */
class Gozlem {
  readonly bitenEller = new Set<string>();
  readonly hamleGecikmeleri: number[] = [];
  readonly pingGecikmeleri: number[] = [];
  readonly ihlaller = new Map<string, { adet: number; ornekler: string[] }>();
  /** "kod#elNo" -> koltuk -> el bittiği andaki eli. Dört elin kesişmediğini denetler. */
  readonly durumlar = new Map<string, Map<number, number[]>>();
  /** Kurulan ve hâlâ katılımcı arayan özel odalar. */
  readonly ozelIlanlar: { kod: string; salon: SalonId; zaman: number }[] = [];
  /** oyuncuId -> ad (kötü niyetli oyuncular başkasının hesabını denemek için kullanır). */
  readonly hesaplar = new Map<string, string>();
  gonderilen = 0;
  alinan = 0;
  hamle = 0;
  kopma = 0;
  kotuNiyet = 0;
  sohbet = 0;
  ozelOda = 0;
  tolere = 0;
  hesapSilme = 0;

  ihlal(tur: string, ayrinti: string) {
    const k = this.ihlaller.get(tur) ?? { adet: 0, ornekler: [] };
    k.adet++;
    if (k.ornekler.length < 3) k.ornekler.push(ayrinti);
    this.ihlaller.set(tur, k);
  }
}

// ---------------- Görünüm denetimleri ----------------

/** Hamle yapılacak durumu tanımlar: aynı duruma iki kez hamle gönderilmesin. */
function parmakIzi(o: OdaGorunumu): string {
  const m = o.masa!;
  return [o.kod, o.elNo, m.ortaSayisi, m.sira, m.asama, m.gostergeGosteren, m.atilanlar.map((a) => a.join(".")).join("/"), m.el.length].join("|");
}

/**
 * Bir oyuncuya gelen "oda" mesajının hile korumasını ve taş sayısını denetler.
 * onceki: aynı bağlantıdan gelen bir önceki oda görünümü (elin adım adım değişimini izlemek için).
 */
function odaDenetle(g: Gozlem, ham: string, o: OdaGorunumu, onceki: OdaGorunumu | null, benimId: string, ad: string) {
  if (/"(eller|orta|deste)"/.test(ham)) g.ihlal("başkasının eli sızdı", `${ad}: ham mesajda gizli alan var`);
  const m = o.masa;
  if (!m) return;
  const yer = `${ad} oda ${o.kod} el ${o.elNo}`;
  if (o.benimKoltugum === null) {
    g.ihlal("başkasının eli sızdı", `${yer}: koltuğu olmayan oyuncuya masa görünümü gitti`);
    return;
  }
  if (m.koltuk !== o.benimKoltugum) g.ihlal("başkasının eli sızdı", `${yer}: masa.koltuk=${m.koltuk}, benim=${o.benimKoltugum}`);
  const k = o.koltuklar[o.benimKoltugum];
  if (k.tur !== "insan" || k.oyuncu.id !== benimId) g.ihlal("koltuk tutarsız", `${yer}: benimKoltugum başkasının`);
  if (m.el.length !== m.tasSayilari[m.koltuk]) g.ihlal("taş sayısı tutarsız", `${yer}: el ${m.el.length}, tasSayilari ${m.tasSayilari[m.koltuk]}`);

  // 106 taş: kendi elim + diğerlerinin taş sayıları + atılanlar + orta + gösterge (+ bitirirken atılan taş).
  const digerleri = m.tasSayilari.reduce((t, n, i) => (i === m.koltuk ? t : t + n), 0);
  const atilan = m.atilanlar.reduce((t, a) => t + a.length, 0);
  const bitisTasi = m.sonuc?.tur === "kazanan" ? 1 : 0;
  const toplam = m.el.length + digerleri + atilan + m.ortaSayisi + 1 + bitisTasi;
  if (toplam !== TAS_SAYISI) g.ihlal("taş sayısı 106 değil", `${yer}: toplam ${toplam}`);

  if (!m.sonuc) {
    for (let i = 0; i < KOLTUK_SAYISI; i++) {
      const beklenen = i === m.sira && m.asama === "at" ? 15 : 14;
      if (m.tasSayilari[i] !== beklenen) g.ihlal("taş sayısı tutarsız", `${yer}: koltuk ${i} ${m.tasSayilari[i]} taş`);
    }
  }

  // Görünen taşların hepsi farklı ve geçerli olmalı.
  const gorunen = [...m.el, ...m.atilanlar.flat(), m.gosterge];
  if (m.sonuc?.tur === "kazanan") gorunen.push(m.sonuc.atilan);
  if (new Set(gorunen).size !== gorunen.length) g.ihlal("taş tekrarı", `${yer}: aynı taş iki yerde görünüyor`);
  if (gorunen.some((t) => !Number.isInteger(t) || t < 0 || t >= TAS_SAYISI)) g.ihlal("geçersiz taş", `${yer}`);

  // Elim sadece kendi hamlelerimle değişmeli: mesaj başına en çok bir taş gelir (ortadan ya da
  // soldakinin son attığı), en çok bir taş gider (benim atılanlarıma ya da bitiş taşına).
  const om = onceki?.masa;
  if (om && onceki!.kod === o.kod && onceki!.elNo === o.elNo && om.koltuk === m.koltuk) {
    const gelen = m.el.filter((t) => !om.el.includes(t));
    const giden = om.el.filter((t) => !m.el.includes(t));
    const yan = om.atilanlar[(m.koltuk + KOLTUK_SAYISI - 1) % KOLTUK_SAYISI].at(-1);
    const gorunurdu = new Set([...om.atilanlar.flat(), om.gosterge]);
    if (gelen.length > 1 || giden.length > 1) g.ihlal("el kendiliğinden değişti", `${yer}: +${gelen.join(",")} -${giden.join(",")}`);
    for (const t of gelen) {
      if (gorunurdu.has(t) && t !== yan) g.ihlal("el kendiliğinden değişti", `${yer}: başka yerdeki ${t} elime geldi`);
    }
    for (const t of giden) {
      if (m.atilanlar[m.koltuk].at(-1) !== t && !(m.sonuc?.tur === "kazanan" && m.sonuc.atilan === t)) {
        g.ihlal("el kendiliğinden değişti", `${yer}: ${t} elimden gitti ama atılmadı`);
      }
    }
  }

  // El bittiği an (sonrasında hamle olmadığı için herkesin aynı durumu gördüğü tek an)
  // dört oyuncunun eli kesişmemeli. Elin ortasındaki durumlar açık bilgiden ayırt edilemez:
  // herkes yandan çekerse bir tur sonra masa aynı görünür ama eller farklıdır.
  if (m.sonuc) {
    const an = "son";
    const anahtar = `${o.kod}#${o.elNo}`;
    let d = g.durumlar.get(anahtar);
    if (!d) g.durumlar.set(anahtar, (d = new Map()));
    const sirali = [...m.el].sort((a, b) => a - b);
    const kayitli = d.get(m.koltuk);
    if (kayitli && kayitli.join() !== sirali.join()) g.ihlal("aynı anda farklı el", `${yer} (${an}): koltuk ${m.koltuk}`);
    const benim = new Set(m.el);
    for (const [koltuk, el] of d) {
      if (koltuk !== m.koltuk && el.some((t) => benim.has(t))) g.ihlal("başkasının eli sızdı", `${yer} (${an}): koltuk ${koltuk} ile ortak taş`);
    }
    d.set(m.koltuk, sirali);
  }

  if (o.sonEl) {
    const fark = o.sonEl.cipDegisimi.reduce((t, x) => t + x, 0);
    if (fark !== 0) g.ihlal("el sonu çip toplamı sıfır değil", `${yer}: ${o.sonEl.cipDegisimi.join(",")}`);
    if (m.sonuc) g.bitenEller.add(`${o.kod}#${o.elNo}`);
  }
}

// ---------------- Sanal oyuncu ----------------

/** Meşru oyuncunun bile görebileceği hatalar (yarış durumları ve kurallı retler). */
const TOLERE_EDILEN = /zaten aldın|Görev henüz|bulunamadı|Masa dolu|Oyun zaten başladı|Bir masada değilsin|Biraz yavaş|çip gerekir|çipi olanlar için|sadece masa sahibi/;

const SOHBETLER = ["selam", "kolay gelsin", "hadi bakalım", "okey nerede yahu", "güzel el", "AMK şansa bak", "iyi oyunlar", "çay söyleyelim"];

interface Kisilik {
  kopan: boolean;
  kotuNiyetli: boolean;
  odulcu: boolean;
  sohbetci: boolean;
  ozelci: boolean;
  zengin: boolean;
  gezgin: boolean;
}

class SanalOyuncu {
  private ws: WebSocket | null = null;
  private oyuncuId: string | null = null;
  private anahtar: string | null = null;
  private profil: Profil | null = null;
  private oda: OdaGorunumu | null = null;
  private hizliOdada = false;
  private girisTamam = false;
  private girisZamani = 0;
  private sonOdaMesaji = 0;
  private katilmaBekliyor = false;
  private susBitis = 0;
  private sonSohbet = 0;
  private sonBasla = 0;
  private sonSureDoldu = 0;
  private satinAldi = false;
  /** Özel oda kurduk; kodu ilk "oda" mesajıyla gelince ilan asılır. */
  private ilanAsilacak: SalonId | null = null;
  private bekleyenHamle: { zaman: number; eylem: Eylem } | null = null;
  private pingZamani = 0;
  private islenenDurum = "";
  private beklenenKapanis = false;
  private takilanOdalar = new Set<string>();
  private tik: ReturnType<typeof setTimeout> | null = null;
  private durdu = false;

  constructor(
    readonly ad: string,
    private readonly adres: string,
    private readonly k: Kisilik,
    private readonly g: Gozlem,
    private readonly rnd: () => number,
    private readonly sec: YukSecenekleri,
  ) {}

  baslat() {
    this.baglan();
    this.tikKur();
  }

  durdur() {
    this.durdu = true;
    if (this.tik) clearTimeout(this.tik);
    this.beklenenKapanis = true;
    this.ws?.close();
  }

  // ---- Bağlantı ----

  private baglan() {
    if (this.durdu) return;
    const ws = new WebSocket(this.adres);
    this.ws = ws;
    this.girisTamam = false;
    ws.on("open", () => {
      if (ws !== this.ws) return;
      this.gonder({
        t: "giris",
        ad: this.ad,
        surum: PROTOKOL_SURUMU,
        ...(this.oyuncuId && this.anahtar ? { oyuncuId: this.oyuncuId, anahtar: this.anahtar } : {}),
      });
    });
    ws.on("message", (veri) => {
      if (ws !== this.ws) return; // devredilmiş eski bağlantı
      this.g.alinan++;
      const ham = veri.toString();
      this.mesajGeldi(JSON.parse(ham) as SunucuMesaji, ham);
    });
    ws.on("error", () => {});
    ws.on("close", (kod) => {
      if (ws !== this.ws) return;
      this.baglantiBitti();
      if (this.durdu) return;
      if (!this.beklenenKapanis) this.g.ihlal("beklenmeyen kopma", `${this.ad}: kod ${kod}`);
      this.beklenenKapanis = false;
      setTimeout(() => this.baglan(), 50 + this.rnd() * 600);
    });
  }

  private baglantiBitti() {
    this.girisTamam = false;
    this.oda = null;
    this.hizliOdada = false;
    this.katilmaBekliyor = false;
    this.bekleyenHamle = null;
    this.pingZamani = 0;
  }

  private gonder(m: IstemciMesaji | Record<string, unknown>) {
    this.gonderHam(JSON.stringify(m));
  }

  private gonderHam(veri: string | Buffer) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.g.gonderilen++;
    this.ws.send(veri);
  }

  /** Rastgele bir şekilde bağlantıyı koparır; kapanınca baglan() yeniden girer. */
  private kop() {
    this.g.kopma++;
    const r = this.rnd();
    this.beklenenKapanis = true;
    if (r < 0.5) {
      this.ws?.terminate(); // ağ gitti
    } else if (r < 0.8) {
      // Aynı hesapla ikinci cihazdan giriş: eski bağlantıyı sunucu kapatır.
      const eski = this.ws;
      this.baglantiBitti();
      this.beklenenKapanis = false;
      this.baglan();
      eski?.on("close", (kod) => {
        if (kod !== 4000) this.g.ihlal("devir hatalı", `${this.ad}: eski bağlantı ${kod} ile kapandı`);
      });
    } else {
      this.ws?.close(); // uygulama kapatıldı
    }
  }

  // ---- Gelen mesajlar ----

  private mesajGeldi(m: SunucuMesaji, ham: string) {
    switch (m.t) {
      case "hosgeldin":
        this.oyuncuId = m.oyuncuId;
        this.anahtar = m.anahtar;
        this.profil = m.profil;
        this.girisTamam = true;
        this.girisZamani = Date.now();
        this.g.hesaplar.set(m.oyuncuId, this.ad);
        if (this.k.zengin && !this.satinAldi) {
          this.satinAldi = true;
          this.gonder({ t: "satinAlma", urunId: "cip_100k", satinAlmaJetonu: `test-${randomUUID()}` });
        }
        return;
      case "profil":
        this.profil = m.profil;
        if (m.profil.cip < 0) this.g.ihlal("eksi bakiye", `${this.ad}: profil ${m.profil.cip}`);
        return;
      case "oda":
        return this.odaGeldi(m, ham);
      case "odadanCikti":
        this.oda = null;
        this.hizliOdada = false;
        this.katilmaBekliyor = false;
        return;
      case "gorevler":
        for (const gorev of m.gorevler) {
          if (!gorev.alindi && gorev.ilerleme >= gorev.hedef) this.gonder({ t: "gorevOdulu", gorevId: gorev.id });
        }
        return;
      case "sohbet":
        if (m.mesaj.koltuk === -1 && m.mesaj.metin === `${this.ad} için süre doldu`) this.sonSureDoldu = Date.now();
        return;
      case "pong":
        if (this.pingZamani) this.g.pingGecikmeleri.push(performance.now() - this.pingZamani);
        this.pingZamani = 0;
        return;
      case "hata":
        return this.hataGeldi(m);
      case "hesapSilindi":
        // Sunucu bağlantıyı kapatır; sonraki girişte yeni hesap açılır.
        this.beklenenKapanis = true;
        if (this.oyuncuId) this.g.hesaplar.delete(this.oyuncuId);
        this.oyuncuId = null;
        this.anahtar = null;
        this.satinAldi = false;
        return;
      default:
        return;
    }
  }

  private odaGeldi(m: Mesaj<"oda">, ham: string) {
    const onceki = this.oda;
    this.oda = m.oda;
    this.katilmaBekliyor = false;
    this.sonOdaMesaji = Date.now();
    if (this.ilanAsilacak) {
      this.g.ozelIlanlar.push({ kod: m.oda.kod, salon: this.ilanAsilacak, zaman: Date.now() });
      this.ilanAsilacak = null;
    }
    if (!this.oyuncuId) return;
    odaDenetle(this.g, ham, m.oda, onceki, this.oyuncuId, this.ad);
    if (this.bekleyenHamle) {
      this.g.hamleGecikmeleri.push(performance.now() - this.bekleyenHamle.zaman);
      this.bekleyenHamle = null;
    }
    // Özel oda dolduysa ya da başladıysa ilanı kaldır.
    const insan = m.oda.koltuklar.filter((k) => k.tur === "insan").length;
    if (m.oda.masa || insan >= KOLTUK_SAYISI) {
      const i = this.g.ozelIlanlar.findIndex((x) => x.kod === m.oda.kod);
      if (i !== -1) this.g.ozelIlanlar.splice(i, 1);
    }
    // Biraz "düşünüp" oyna; o arada durum değiştiyse hamle yapılmaz.
    setTimeout(() => this.hamleDene(), this.rnd() * 15);
  }

  private hataGeldi(m: Mesaj<"hata">) {
    this.katilmaBekliyor = false;
    this.ilanAsilacak = null;
    if (/Sunucuda bir hata/.test(m.mesaj)) {
      this.g.ihlal("sunucu hatası", `${this.ad}: ${m.mesaj}`);
      return;
    }
    if (this.k.kotuNiyetli) return; // kötü niyetli mesajlara hata dönmesi beklenen davranış
    const sureYarisi = Date.now() - this.sonSureDoldu < 1_000;
    // Önce kurallı retler: başka bir isteğin (hediye, görev...) cevabı hamleden önce gelebilir.
    if (TOLERE_EDILEN.test(m.mesaj)) {
      this.g.tolere++;
      return;
    }
    if (this.bekleyenHamle) {
      const e = this.bekleyenHamle.eylem;
      this.bekleyenHamle = null;
      if (sureYarisi) {
        this.g.tolere++;
        return;
      }
      this.g.ihlal("meşru hamle reddedildi", `${this.ad}: ${JSON.stringify(e)} -> ${m.mesaj}`);
      return;
    }
    if (sureYarisi) {
      this.g.tolere++;
      return;
    }
    this.g.ihlal("beklenmeyen hata", `${this.ad}: ${m.mesaj}`);
  }

  // ---- Oyun ----

  private hamleDene() {
    const o = this.oda;
    if (!o?.masa || o.masa.sonuc || o.masa.sira !== o.masa.koltuk || !this.girisTamam) return;
    if (Date.now() < this.susBitis) return; // susturulduk: süre dolunca sunucu oynar
    const pi = parmakIzi(o);
    if (pi === this.islenenDurum) return;
    this.islenenDurum = pi;

    if (this.k.kotuNiyetli && this.rnd() < 0.3) {
      // Başkasının taşı: elimde olmayan bir taşı atmaya çalış. Hamle sonrası sıra yine bizde kalır.
      const benim = new Set(o.masa.el);
      let tas = Math.floor(this.rnd() * TAS_SAYISI);
      while (benim.has(tas)) tas = (tas + 1) % TAS_SAYISI;
      this.kotu({ t: "hamle", eylem: { tur: o.masa.asama === "at" ? "at" : "bitir", tas } });
    }
    const eylem = botHamlesi(o.masa);
    this.g.hamle++;
    if (!this.k.kotuNiyetli) this.bekleyenHamle = { zaman: performance.now(), eylem };
    this.gonder({ t: "hamle", eylem });
  }

  // ---- Zamanlı davranışlar ----

  private tikKur() {
    this.tik = setTimeout(() => {
      try {
        this.tikle();
      } finally {
        if (!this.durdu) this.tikKur();
      }
    }, 120 + this.rnd() * 250);
  }

  private tikle() {
    if (!this.girisTamam) return;
    const simdi = Date.now();
    this.durgunlukDenetle(simdi);
    if (simdi < this.susBitis) return;

    if (this.k.kopan && this.rnd() < this.sec.kopmaOlasiligi) return this.kop();
    if (this.k.kotuNiyetli && this.rnd() < 0.12) this.kotuNiyetliDavran();

    if (!this.oda && !this.katilmaBekliyor && simdi - this.girisZamani > 250) this.masayaOtur();

    if (this.oda && this.k.sohbetci && this.rnd() < 0.08 && simdi - this.sonSohbet > 1_300) {
      this.sonSohbet = simdi;
      this.g.sohbet++;
      this.gonder({ t: "sohbet", metin: SOHBETLER[Math.floor(this.rnd() * SOHBETLER.length)] });
    }
    if (this.k.odulcu && this.rnd() < 0.05) {
      const istekler: IstemciMesaji[] = [
        { t: "gunlukHediye" },
        { t: "gorevler" },
        { t: "siralama", tur: "seviye" },
        { t: "siralama", tur: "cip" },
        { t: "salonlar" },
        { t: "adDegistir", ad: this.ad }, // masadaki kart güncellenir
      ];
      this.gonder(istekler[Math.floor(this.rnd() * istekler.length)]);
    }
    if (this.rnd() < 0.04 && !this.pingZamani) {
      this.pingZamani = performance.now();
      this.gonder({ t: "ping" });
    }
    // Özel odada sahibiysek biraz bekleyip başlat.
    const o = this.oda;
    if (o && !o.masa && !this.hizliOdada && o.sahipId === this.oyuncuId && simdi - this.sonOdaMesaji > 400 && simdi - this.sonBasla > 500) {
      this.sonBasla = simdi;
      this.gonder({ t: "basla" });
    }
    if (o && this.k.gezgin && this.rnd() < 0.006) {
      // Masadan kalk; kalkmış sayıldığımız için o masaya artık hamle gönderilmez.
      this.oda = null;
      this.katilmaBekliyor = true; // "odadanCikti" gelince serbest kalır
      this.gonder({ t: "odadanAyril" });
    } else if (this.k.gezgin && this.rnd() < 0.0015) {
      // Hesabını sil (masadaysa el ortasında bile) ve baştan yeni hesapla gel.
      this.g.hesapSilme++;
      this.gonder({ t: "hesapSil" });
    }
  }

  private durgunlukDenetle(simdi: number) {
    const o = this.oda;
    if (!o || this.takilanOdalar.has(`${o.kod}#${o.elNo}`)) return;
    if (simdi - this.sonOdaMesaji > DURGUNLUK_SINIRI_MS) {
      this.takilanOdalar.add(`${o.kod}#${o.elNo}`);
      const durum = o.masa ? (o.masa.sonuc ? "el arası" : `sıra ${o.masa.sira}`) : "başlamadı";
      this.g.ihlal("masa takıldı", `${this.ad}: oda ${o.kod} el ${o.elNo} (${durum}), ${simdi - this.sonOdaMesaji} ms mesaj yok`);
    }
  }

  private salonSec(): SalonId | null {
    const cip = this.profil?.cip ?? 0;
    const uygun = SALONLAR.filter((s) => salonaUygunMu(s, cip).uygun);
    if (uygun.length === 0) return null;
    return uygun[Math.floor(this.rnd() * uygun.length)].id;
  }

  private masayaOtur() {
    const salon = this.salonSec();
    if (!salon) {
      // Çip bitti: önce günlük hediye, o da alındıysa mağaza (test jetonu).
      if (this.profil?.gunlukHediyeAlinabilir) this.gonder({ t: "gunlukHediye" });
      else this.gonder({ t: "satinAlma", urunId: "cip_25k", satinAlmaJetonu: `test-${randomUUID()}` });
      return;
    }
    this.katilmaBekliyor = true;
    this.sonOdaMesaji = Date.now();
    if (this.k.ozelci) {
      const simdi = Date.now();
      const ilan = this.g.ozelIlanlar.find(
        (x) => simdi - x.zaman < 3_000 && salonaUygunMu(SALONLAR.find((s) => s.id === x.salon)!, this.profil?.cip ?? 0).uygun,
      );
      if (ilan) return this.gonder({ t: "odayaKatil", kod: ilan.kod });
      this.g.ozelOda++;
      this.hizliOdada = false;
      this.ilanAsilacak = salon;
      return this.gonder({ t: "odaKur", salon });
    }
    this.hizliOdada = true;
    this.gonder({ t: "hizliOyun", salon });
  }

  // ---- Kötü niyet ----

  private kotu(m: IstemciMesaji | Record<string, unknown>) {
    this.g.kotuNiyet++;
    this.gonder(m);
  }

  private kotuNiyetliDavran() {
    const o = this.oda;
    const secenek = Math.floor(this.rnd() * 14);
    this.g.kotuNiyet++;
    switch (secenek) {
      case 0:
        return this.gonderHam('{"t":"hamle","eylem":{"tur":"at"');
      case 1:
        return this.gonderHam(JSON.stringify({ t: "sohbet", metin: "x".repeat(10_000) })); // 8 KB sınırının üstü
      case 2:
        return this.gonderHam(Buffer.from([0xde, 0xad, 0xbe, 0xef]));
      case 3:
        return this.gonder({ t: "hileYap", cip: 1_000_000 });
      case 4:
        return this.gonderHam(JSON.stringify({ t: "hamle", eylem: { tur: "at", tas: "5" } }));
      case 5:
        return this.gonder({ t: "hamle", eylem: { tur: "at", tas: 999 } });
      case 6:
        return this.gonder({ t: "giris", ad: this.ad, surum: PROTOKOL_SURUMU });
      case 7: {
        // Sırası değilken hamle.
        if (o?.masa && o.masa.sira !== o.masa.koltuk) return this.gonder({ t: "hamle", eylem: { tur: "cek", kaynak: "orta" } });
        return this.gonder({ t: "hamle", eylem: { tur: "gostergeGoster" } });
      }
      case 8: {
        // Mesaj seli: hız sınırı devreye girmeli. Sonra bir saniye susar.
        for (let n = 0; n < SUNUCU_AYARLARI.saniyeBasinaMesaj + 40; n++) this.gonder({ t: "ping" });
        this.susBitis = Date.now() + 1_100;
        return;
      }
      case 9:
        return this.gonder({ t: "odayaKatil", kod: "ZZZZZ" });
      case 10:
        return this.gonder({ t: "basla" });
      case 11:
        return this.gonderHam("[".repeat(3_000) + "]".repeat(3_000));
      case 12:
        return this.baskasininHesabi();
      case 13: {
        // 64 KB üstü: ws bağlantıyı keser, uygulama yeniden bağlanır. Nadiren.
        if (this.rnd() < 0.3) {
          this.beklenenKapanis = true;
          return this.gonderHam(JSON.stringify({ t: "sohbet", metin: "y".repeat(70_000) }));
        }
        return this.gonder({ t: "gorevOdulu", gorevId: "hepsini-ver" });
      }
    }
  }

  /** Başka bir oyuncunun kimliğiyle ve uydurma anahtarla giriş dener: asla kabul edilmemeli. */
  private baskasininHesabi() {
    const idler = [...this.g.hesaplar.keys()].filter((id) => id !== this.oyuncuId);
    if (idler.length === 0) return;
    const hedef = idler[Math.floor(this.rnd() * idler.length)];
    const ws = new WebSocket(this.adres);
    ws.on("error", () => {});
    ws.on("open", () => {
      this.g.gonderilen++;
      ws.send(JSON.stringify({ t: "giris", ad: "Hirsiz", surum: PROTOKOL_SURUMU, oyuncuId: hedef, anahtar: randomUUID() + randomUUID() }));
    });
    ws.on("message", (veri) => {
      this.g.alinan++;
      const m = JSON.parse(veri.toString()) as SunucuMesaji;
      if (m.t === "hosgeldin") this.g.ihlal("başkasının hesabına girildi", `${this.ad} -> ${hedef}`);
      ws.close();
    });
  }
}

// ---------------- Çalıştırıcı ----------------

function istatistik(dizi: number[]): Istatistik {
  if (dizi.length === 0) return { ortalama: 0, p95: 0, enCok: 0, adet: 0 };
  const s = [...dizi].sort((a, b) => a - b);
  const yuvarla = (x: number) => Math.round(x * 100) / 100;
  return {
    ortalama: yuvarla(s.reduce((t, x) => t + x, 0) / s.length),
    p95: yuvarla(s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]),
    enCok: yuvarla(s[s.length - 1]),
    adet: s.length,
  };
}

function kisilikUret(i: number, rnd: () => number): Kisilik {
  return {
    kopan: rnd() < 0.3,
    kotuNiyetli: i % 5 === 4, // her beş oyuncudan biri
    odulcu: rnd() < 0.5,
    sohbetci: rnd() < 0.5,
    ozelci: i % 3 === 1,
    zengin: i % 7 === 3,
    gezgin: rnd() < 0.25,
  };
}

export async function yukTestiCalistir(ek: Partial<YukSecenekleri> = {}): Promise<YukRaporu> {
  const sec = { ...VARSAYILAN_SECENEKLER, ...ek };
  const g = new Gozlem();
  const yaz = (m: string) => sec.ayrintili && console.log(m);

  // Yakalanmamış hatalar: sunucu aynı süreçte çalıştığı için bunlar sunucunun çökmesi demektir.
  const yakalanmamis = (e: unknown) => g.ihlal("yakalanmamış hata", String((e as Error)?.stack ?? e).slice(0, 400));
  process.on("uncaughtException", yakalanmamis);
  process.on("unhandledRejection", yakalanmamis);

  const klasor = mkdtempSync(join(tmpdir(), "okey-yuk-"));
  const vtYolu = join(klasor, "okey.db");
  const gunlukHatalari: string[] = [];
  const sunucu = await sunucuBaslat(
    varsayilanAyarlar({
      port: 0,
      veritabaniYolu: vtYolu,
      satinAlmaTest: true,
      ...SUNUCU_AYARLARI,
      gunluk: (m) => {
        if (/hata|error/i.test(m)) gunlukHatalari.push(m.slice(0, 400));
      },
    }),
  );
  const adres = `ws://127.0.0.1:${sunucu.port}`;
  const rnd = tohumluRastgele(sec.tohum);
  const oyuncular = Array.from(
    { length: sec.oyuncuSayisi },
    (_, i) => new SanalOyuncu(`Oyuncu${i + 1}`, adres, kisilikUret(i, rnd), g, tohumluRastgele(sec.tohum * 1000 + i), sec),
  );

  const baslangic = performance.now();
  // Hepsi aynı milisaniyede değil, kısa aralıklarla bağlansın.
  for (const o of oyuncular) {
    o.baslat();
    await new Promise((r) => setTimeout(r, 10));
  }

  let zamanAsimi = false;
  let sonYazilan = 0;
  while (g.bitenEller.size < sec.hedefEl) {
    if (performance.now() - baslangic > sec.zamanAsimiMs) {
      zamanAsimi = true;
      break;
    }
    if (g.ihlaller.has("yakalanmamış hata")) break;
    await new Promise((r) => setTimeout(r, 100));
    if (g.bitenEller.size - sonYazilan >= Math.max(10, sec.hedefEl / 10)) {
      sonYazilan = g.bitenEller.size;
      const sn = (performance.now() - baslangic) / 1000;
      yaz(`  ${sonYazilan} el bitti (${sn.toFixed(1)} sn, ${(sonYazilan / sn).toFixed(1)} el/sn)`);
    }
  }
  const sureSn = (performance.now() - baslangic) / 1000;
  if (zamanAsimi) g.ihlal("zaman aşımı", `${sec.zamanAsimiMs} ms içinde ${g.bitenEller.size}/${sec.hedefEl} el bitti`);

  for (const o of oyuncular) o.durdur();
  await new Promise((r) => setTimeout(r, 300));

  // Sunucu hâlâ ayakta mı? Sağlık ucu ve yeni bir giriş.
  let iadeBekleyen: string | null = null;
  try {
    const c = await fetch(`http://127.0.0.1:${sunucu.port}/saglik`);
    if (c.status !== 200) g.ihlal("sunucu ayakta değil", `/saglik ${c.status}`);
    iadeBekleyen = await sonDurumDenetle(adres, g);
  } catch (e) {
    g.ihlal("sunucu ayakta değil", String(e));
  }

  await sunucu.kapat(); // yarım ellerin girişi iade edilir
  const sebepler = veritabaniDenetle(vtYolu, g, iadeBekleyen);
  rmSync(klasor, { recursive: true, force: true });
  process.off("uncaughtException", yakalanmamis);
  process.off("unhandledRejection", yakalanmamis);

  for (const h of gunlukHatalari) g.ihlal("sunucu günlüğünde hata", h);

  return {
    basarili: g.ihlaller.size === 0,
    sureSn: Math.round(sureSn * 100) / 100,
    oyuncuSayisi: sec.oyuncuSayisi,
    bitenEl: g.bitenEller.size,
    elSaniye: Math.round((g.bitenEller.size / sureSn) * 100) / 100,
    gonderilenMesaj: g.gonderilen,
    alinanMesaj: g.alinan,
    hamleSayisi: g.hamle,
    kopmaSayisi: g.kopma,
    kotuNiyetliMesaj: g.kotuNiyet,
    sohbetSayisi: g.sohbet,
    ozelOdaKurulan: g.ozelOda,
    toleransliHata: g.tolere,
    hesapSilme: g.hesapSilme,
    hamleGecikmesi: istatistik(g.hamleGecikmeleri),
    pingGecikmesi: istatistik(g.pingGecikmeleri),
    sebepler,
    ihlaller: Object.fromEntries(g.ihlaller),
    sunucuGunlukHatalari: gunlukHatalari,
  };
}

/**
 * Herkes çıktıktan sonra: sunucu yeni girişe cevap veriyor mu ve odalar kapanıyor mu?
 * Bağlantısı kopan oyuncunun yerine el bitene kadar bot oynar, sonraki el başlarken oda
 * kapanmalıdır; salon listesinde hâlâ oyuncu görünüyorsa oda sızmış demektir.
 */
async function sonDurumDenetle(adres: string, g: Gozlem): Promise<string | null> {
  const ws = new WebSocket(adres);
  const gelenler: SunucuMesaji[] = [];
  let uyandir: (() => void) | null = null;
  ws.on("message", (veri) => {
    gelenler.push(JSON.parse(veri.toString()) as SunucuMesaji);
    uyandir?.();
  });
  const bekle = async <T extends SunucuMesaji["t"]>(t: T, sureMs: number): Promise<Mesaj<T>> => {
    const bitis = Date.now() + sureMs;
    for (;;) {
      const i = gelenler.findIndex((m) => m.t === t);
      if (i !== -1) return gelenler.splice(i, 1)[0] as Mesaj<T>;
      if (Date.now() > bitis) throw new Error(`Son kontrolde "${t}" ${sureMs} ms içinde gelmedi`);
      await new Promise<void>((tamam) => {
        uyandir = tamam;
        setTimeout(tamam, 50);
      });
    }
  };
  try {
    await new Promise((tamam, hata) => {
      ws.once("open", tamam);
      ws.once("error", hata);
    });
    ws.send(JSON.stringify({ t: "giris", ad: "Son Kontrol", surum: PROTOKOL_SURUMU }));
    const { oyuncuId } = await bekle("hosgeldin", 3_000);
    const bitis = Date.now() + 8_000;
    for (;;) {
      ws.send(JSON.stringify({ t: "salonlar" }));
      const kalan = (await bekle("salonlar", 3_000)).salonlar.reduce((t, s) => t + s.oyuncuSayisi, 0);
      if (kalan === 0) break;
      if (Date.now() > bitis) {
        g.ihlal("oda kapanmadı", `herkes çıktıktan 8 sn sonra salonlarda ${kalan} oyuncu görünüyor`);
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    // Son olarak bir el başlat: sunucu bu el sürerken kapatılacak, giriş çipi iade edilmeli.
    ws.send(JSON.stringify({ t: "hizliOyun", salon: "caylak" }));
    for (;;) if ((await bekle("oda", 3_000)).oda.oyunda) return oyuncuId;
  } finally {
    ws.close();
  }
}

/** Kapanmış sunucunun veritabanını okur: eksi bakiye yok, her bakiye hareketlerin toplamı. */
function veritabaniDenetle(yol: string, g: Gozlem, iadeBekleyen: string | null): Record<string, number> {
  const db = new DatabaseSync(yol, { readOnly: true });
  try {
    if (iadeBekleyen) {
      // Sunucu el ortasında kapandı: girişi iade edilmiş, bakiyesi başlangıçtaki gibi olmalı.
      const o = db.prepare("SELECT cip FROM oyuncular WHERE id = ?").get(iadeBekleyen) as { cip: number } | undefined;
      if (o?.cip !== BASLANGIC_CIPI) g.ihlal("kapanışta iade yapılmadı", `${iadeBekleyen}: cip ${o?.cip}`);
    }
    const eksi = db.prepare("SELECT id, cip FROM oyuncular WHERE cip < 0").all() as { id: string; cip: number }[];
    for (const s of eksi) g.ihlal("eksi bakiye", `${s.id}: ${s.cip}`);

    const tutarsiz = db
      .prepare(
        `SELECT o.id, o.cip, COALESCE(SUM(h.miktar), 0) AS toplam
         FROM oyuncular o LEFT JOIN cip_hareketleri h ON h.oyuncu_id = o.id
         GROUP BY o.id HAVING o.cip <> toplam`,
      )
      .all() as { id: string; cip: number; toplam: number }[];
    for (const s of tutarsiz) g.ihlal("bakiye hareketlerle tutmuyor", `${s.id}: cip ${s.cip}, hareketler ${s.toplam}`);

    const basi = db
      .prepare(
        `SELECT o.id FROM oyuncular o
         WHERE (SELECT sebep || ':' || miktar FROM cip_hareketleri WHERE oyuncu_id = o.id ORDER BY id LIMIT 1) IS NOT ?`,
      )
      .all(`baslangic:${BASLANGIC_CIPI}`) as { id: string }[];
    for (const s of basi) g.ihlal("başlangıç hareketi eksik", s.id);

    const sahipsiz = db.prepare("SELECT COUNT(*) AS n FROM cip_hareketleri WHERE oyuncu_id NOT IN (SELECT id FROM oyuncular)").get() as {
      n: number;
    };
    if (sahipsiz.n > 0) g.ihlal("sahipsiz çip hareketi", `${sahipsiz.n} satır`);

    const sebepler = db.prepare("SELECT sebep, COUNT(*) AS n FROM cip_hareketleri GROUP BY sebep ORDER BY n DESC").all() as {
      sebep: string;
      n: number;
    }[];
    return Object.fromEntries(sebepler.map((s) => [s.sebep, s.n]));
  } finally {
    db.close();
  }
}

export function raporYazdir(r: YukRaporu) {
  const satirlar: [string, string][] = [
    ["Sonuç", r.basarili ? "GEÇTİ" : "KALDI"],
    ["Oyuncu", String(r.oyuncuSayisi)],
    ["Biten el", String(r.bitenEl)],
    ["Süre", `${r.sureSn} sn`],
    ["El/saniye", String(r.elSaniye)],
    ["Hamle gecikmesi (ort / p95 / en çok)", `${r.hamleGecikmesi.ortalama} / ${r.hamleGecikmesi.p95} / ${r.hamleGecikmesi.enCok} ms (${r.hamleGecikmesi.adet} ölçüm)`],
    ["Ping gecikmesi (ort / p95 / en çok)", `${r.pingGecikmesi.ortalama} / ${r.pingGecikmesi.p95} / ${r.pingGecikmesi.enCok} ms (${r.pingGecikmesi.adet} ölçüm)`],
    ["Gönderilen / alınan mesaj", `${r.gonderilenMesaj} / ${r.alinanMesaj}`],
    ["Oyuncu hamlesi", String(r.hamleSayisi)],
    ["Kopma / yeniden bağlanma", String(r.kopmaSayisi)],
    ["Kötü niyetli mesaj", String(r.kotuNiyetliMesaj)],
    ["Sohbet", String(r.sohbetSayisi)],
    ["Kurulan özel oda", String(r.ozelOdaKurulan)],
    ["Silinen hesap", String(r.hesapSilme)],
    ["Tolere edilen hata (yarış/kurallı ret)", String(r.toleransliHata)],
    ["Çip hareketleri", Object.entries(r.sebepler).map(([s, n]) => `${s}=${n}`).join(", ")],
  ];
  const genislik = Math.max(...satirlar.map(([a]) => a.length));
  console.log("\n=== Yük testi raporu ===");
  for (const [a, b] of satirlar) console.log(`${a.padEnd(genislik)}  ${b}`);
  const ihlaller = Object.entries(r.ihlaller);
  console.log(`\nDeğişmez ihlalleri: ${ihlaller.length === 0 ? "yok" : ""}`);
  for (const [tur, { adet, ornekler }] of ihlaller) {
    console.log(`  - ${tur}: ${adet}`);
    for (const o of ornekler) console.log(`      ${o}`);
  }
}

function argumanlar(): Partial<YukSecenekleri> {
  const a = process.argv.slice(2);
  const deger = (ad: string) => {
    const i = a.indexOf(`--${ad}`);
    return i === -1 ? undefined : Number(a[i + 1]);
  };
  const s: Partial<YukSecenekleri> = {};
  if (deger("oyuncu")) s.oyuncuSayisi = deger("oyuncu");
  if (deger("el")) s.hedefEl = deger("el");
  if (deger("tohum")) s.tohum = deger("tohum");
  if (deger("sure")) s.zamanAsimiMs = deger("sure")! * 1000;
  if (deger("kopma")) s.kopmaOlasiligi = deger("kopma");
  return s;
}

// Doğrudan çalıştırıldıysa (tsx araclar/yuk-testi.ts); testten içe aktarılınca çalışmaz.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const s = { ...VARSAYILAN_SECENEKLER, ...argumanlar() };
  console.log(`Yük testi: ${s.oyuncuSayisi} oyuncu, hedef ${s.hedefEl} el (tohum ${s.tohum})`);
  const r = await yukTestiCalistir(s);
  raporYazdir(r);
  process.exit(r.basarili ? 0 : 1);
}
