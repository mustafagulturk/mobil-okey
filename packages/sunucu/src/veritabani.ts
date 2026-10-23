// Veritabanı: şema ve tüm sorgular tek yerde.
//
// Node'un yerleşik SQLite modülünü (node:sqlite) kullanıyoruz: ek native bağımlılık yok,
// tek dosya, yedeklemesi kolay. Sorgular senkron çalışır; tek süreçli bir oyun sunucusu
// için bu hem yeterince hızlı hem de yarış durumlarını (race condition) ortadan kaldırır.
//
// Çip kuralları:
//  - Çip her zaman "cip = cip + ?" ile ve koşullu güncellenir; eksiye düşecek bir
//    işlem hiç uygulanmaz (ayrıca tabloda CHECK(cip >= 0) son savunma hattıdır).
//  - Her çip değişimi aynı transaction içinde cip_hareketleri tablosuna yazılır.
//    Böylece "bu oyuncunun çipi nereden geldi?" sorusunun cevabı her zaman vardır.
//  - Satın alma jetonu ve reklam işlem kimliği benzersiz indekslidir: aynı satın alma
//    ya da aynı reklam için iki kez çip verilemez.

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { type Etiket, type GorevSayaci, type Istatistik, VARSAYILAN_ETIKET } from "@okey/kurallar";

export interface OyuncuSatiri {
  id: string;
  ad: string;
  anahtar_ozeti: string;
  cip: number;
  xp: number;
  cerceve: string;
  rozet: string;
  unvan: string;
  oynanan: number;
  kazanilan: number;
  cift: number;
  okey_atarak: number;
  gosterge: number;
  son_hediye_gunu: string | null;
  olusturma: number;
}

export interface CipHareketi {
  miktar: number;
  sebep: string;
  zaman: number;
}

const SEMA = `
CREATE TABLE IF NOT EXISTS oyuncular (
  id TEXT PRIMARY KEY,
  ad TEXT NOT NULL,
  anahtar_ozeti TEXT NOT NULL,
  cip INTEGER NOT NULL CHECK (cip >= 0),
  xp INTEGER NOT NULL DEFAULT 0,
  cerceve TEXT NOT NULL,
  rozet TEXT NOT NULL,
  unvan TEXT NOT NULL,
  oynanan INTEGER NOT NULL DEFAULT 0,
  kazanilan INTEGER NOT NULL DEFAULT 0,
  cift INTEGER NOT NULL DEFAULT 0,
  okey_atarak INTEGER NOT NULL DEFAULT 0,
  gosterge INTEGER NOT NULL DEFAULT 0,
  son_hediye_gunu TEXT,
  olusturma INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS oyuncular_xp ON oyuncular (xp DESC);
CREATE INDEX IF NOT EXISTS oyuncular_cip ON oyuncular (cip DESC);

CREATE TABLE IF NOT EXISTS cip_hareketleri (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  oyuncu_id TEXT NOT NULL,
  miktar INTEGER NOT NULL,
  sebep TEXT NOT NULL,
  zaman INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cip_hareketleri_oyuncu ON cip_hareketleri (oyuncu_id);

CREATE TABLE IF NOT EXISTS gorev_sayaclari (
  oyuncu_id TEXT NOT NULL,
  gun TEXT NOT NULL,
  sayac TEXT NOT NULL,
  deger INTEGER NOT NULL,
  PRIMARY KEY (oyuncu_id, gun, sayac)
);

CREATE TABLE IF NOT EXISTS alinan_gorevler (
  oyuncu_id TEXT NOT NULL,
  gun TEXT NOT NULL,
  gorev_id TEXT NOT NULL,
  PRIMARY KEY (oyuncu_id, gun, gorev_id)
);

-- Jetonun kendisi değil SHA-256 özeti saklanır. Hesap silinse de satır kalır
-- (oyuncu_id boşaltılır) ki aynı jeton yeni bir hesapta tekrar kullanılamasın.
CREATE TABLE IF NOT EXISTS satin_almalar (
  jeton_ozeti TEXT NOT NULL UNIQUE,
  oyuncu_id TEXT,
  urun_id TEXT NOT NULL,
  cip INTEGER NOT NULL,
  zaman INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reklam_odulleri (
  islem_id TEXT NOT NULL UNIQUE,
  oyuncu_id TEXT,
  gun TEXT NOT NULL,
  zaman INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reklam_odulleri_gun ON reklam_odulleri (oyuncu_id, gun);
`;

/** Satır sütun adlarını Istatistik alanlarına eşler. */
const ISTATISTIK_SUTUNLARI: Record<keyof Istatistik, string> = {
  oynanan: "oynanan",
  kazanilan: "kazanilan",
  cift: "cift",
  okeyAtarak: "okey_atarak",
  gosterge: "gosterge",
};

export class Veritabani {
  private readonly db: DatabaseSync;
  private islemde = false;

  constructor(yol: string) {
    if (yol !== ":memory:") mkdirSync(dirname(yol), { recursive: true });
    this.db = new DatabaseSync(yol);
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    this.db.exec(SEMA);
  }

  kapat() {
    this.db.close();
  }

  /**
   * fn'i tek bir transaction içinde çalıştırır: ya hepsi yazılır ya hiçbiri.
   * İç içe çağrılırsa dıştaki transaction'a katılır.
   */
  islem<T>(fn: () => T): T {
    if (this.islemde) return fn();
    this.db.exec("BEGIN IMMEDIATE");
    this.islemde = true;
    try {
      const sonuc = fn();
      this.db.exec("COMMIT");
      return sonuc;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    } finally {
      this.islemde = false;
    }
  }

  // ---------------- Oyuncu ----------------

  oyuncuOlustur(id: string, ad: string, anahtarOzeti: string, cip: number, zaman: number) {
    this.islem(() => {
      const e = VARSAYILAN_ETIKET;
      this.db
        .prepare(
          `INSERT INTO oyuncular (id, ad, anahtar_ozeti, cip, cerceve, rozet, unvan, olusturma)
           VALUES (?, ?, ?, 0, ?, ?, ?, ?)`,
        )
        .run(id, ad, anahtarOzeti, e.cerceve, e.rozet, e.unvan, zaman);
      this.cipDegistir(id, cip, "baslangic", zaman);
    });
  }

  oyuncuGetir(id: string): OyuncuSatiri | undefined {
    return this.db.prepare("SELECT * FROM oyuncular WHERE id = ?").get(id) as OyuncuSatiri | undefined;
  }

  adGuncelle(id: string, ad: string) {
    this.db.prepare("UPDATE oyuncular SET ad = ? WHERE id = ?").run(ad, id);
  }

  etiketGuncelle(id: string, e: Etiket) {
    this.db.prepare("UPDATE oyuncular SET cerceve = ?, rozet = ?, unvan = ? WHERE id = ?").run(e.cerceve, e.rozet, e.unvan, id);
  }

  /** Hesabı ve oyuncuya ait tüm verileri siler. Satın alma ve reklam kayıtları anonimleşir. */
  oyuncuSil(id: string) {
    this.islem(() => {
      for (const tablo of ["oyuncular", "cip_hareketleri", "gorev_sayaclari", "alinan_gorevler"]) {
        const sutun = tablo === "oyuncular" ? "id" : "oyuncu_id";
        this.db.prepare(`DELETE FROM ${tablo} WHERE ${sutun} = ?`).run(id);
      }
      this.db.prepare("UPDATE satin_almalar SET oyuncu_id = NULL WHERE oyuncu_id = ?").run(id);
      this.db.prepare("UPDATE reklam_odulleri SET oyuncu_id = NULL WHERE oyuncu_id = ?").run(id);
    });
  }

  // ---------------- Çip ----------------

  /**
   * Oyuncunun çipini miktar kadar değiştirir ve hareketi kaydeder.
   * Çip eksiye düşecekse (ya da oyuncu yoksa) hiçbir şey yapmaz ve false döner.
   */
  cipDegistir(id: string, miktar: number, sebep: string, zaman: number): boolean {
    if (!Number.isSafeInteger(miktar)) throw new Error("Çip miktarı tam sayı olmalı");
    return this.islem(() => {
      const s = this.db.prepare("UPDATE oyuncular SET cip = cip + ? WHERE id = ? AND cip + ? >= 0").run(miktar, id, miktar);
      if (s.changes === 0) return false;
      this.db
        .prepare("INSERT INTO cip_hareketleri (oyuncu_id, miktar, sebep, zaman) VALUES (?, ?, ?, ?)")
        .run(id, miktar, sebep, zaman);
      return true;
    });
  }

  cipHareketleri(id: string): CipHareketi[] {
    return this.db
      .prepare("SELECT miktar, sebep, zaman FROM cip_hareketleri WHERE oyuncu_id = ? ORDER BY id")
      .all(id) as unknown as CipHareketi[];
  }

  // ---------------- İlerleme ----------------

  xpEkle(id: string, miktar: number) {
    this.db.prepare("UPDATE oyuncular SET xp = xp + ? WHERE id = ?").run(miktar, id);
  }

  istatistikArtir(id: string, artis: Partial<Istatistik>) {
    for (const [alan, miktar] of Object.entries(artis) as [keyof Istatistik, number][]) {
      if (!miktar) continue;
      const sutun = ISTATISTIK_SUTUNLARI[alan];
      this.db.prepare(`UPDATE oyuncular SET ${sutun} = ${sutun} + ? WHERE id = ?`).run(miktar, id);
    }
  }

  gorevSayaciArtir(id: string, gun: string, sayac: GorevSayaci, miktar: number) {
    if (!miktar) return;
    this.db
      .prepare(
        `INSERT INTO gorev_sayaclari (oyuncu_id, gun, sayac, deger) VALUES (?, ?, ?, ?)
         ON CONFLICT (oyuncu_id, gun, sayac) DO UPDATE SET deger = deger + excluded.deger`,
      )
      .run(id, gun, sayac, miktar);
  }

  gorevSayaclari(id: string, gun: string): Partial<Record<GorevSayaci, number>> {
    const satirlar = this.db
      .prepare("SELECT sayac, deger FROM gorev_sayaclari WHERE oyuncu_id = ? AND gun = ?")
      .all(id, gun) as { sayac: GorevSayaci; deger: number }[];
    return Object.fromEntries(satirlar.map((s) => [s.sayac, s.deger]));
  }

  alinanGorevler(id: string, gun: string): string[] {
    const satirlar = this.db
      .prepare("SELECT gorev_id FROM alinan_gorevler WHERE oyuncu_id = ? AND gun = ?")
      .all(id, gun) as { gorev_id: string }[];
    return satirlar.map((s) => s.gorev_id);
  }

  /** Görevi "ödülü alındı" olarak işaretler. Daha önce alınmışsa false döner. */
  gorevAlindiKaydet(id: string, gun: string, gorevId: string): boolean {
    const s = this.db
      .prepare("INSERT OR IGNORE INTO alinan_gorevler (oyuncu_id, gun, gorev_id) VALUES (?, ?, ?)")
      .run(id, gun, gorevId);
    return s.changes === 1;
  }

  /** Bugünün hediyesi alınmadıysa verir. Tek bir koşullu UPDATE olduğu için iki kez verilemez. */
  gunlukHediyeVer(id: string, gun: string, miktar: number, zaman: number): boolean {
    return this.islem(() => {
      const s = this.db
        .prepare("UPDATE oyuncular SET son_hediye_gunu = ? WHERE id = ? AND (son_hediye_gunu IS NULL OR son_hediye_gunu <> ?)")
        .run(gun, id, gun);
      if (s.changes === 0) return false;
      return this.cipDegistir(id, miktar, "gunluk_hediye", zaman);
    });
  }

  // ---------------- Mağaza ----------------

  satinAlmaVarMi(jetonOzeti: string): boolean {
    return this.db.prepare("SELECT 1 FROM satin_almalar WHERE jeton_ozeti = ?").get(jetonOzeti) !== undefined;
  }

  /** Satın almayı kaydeder ve çipi verir. Jeton daha önce kullanıldıysa false döner. */
  satinAlmaKaydet(jetonOzeti: string, oyuncuId: string, urunId: string, cip: number, zaman: number): boolean {
    return this.islem(() => {
      const s = this.db
        .prepare("INSERT OR IGNORE INTO satin_almalar (jeton_ozeti, oyuncu_id, urun_id, cip, zaman) VALUES (?, ?, ?, ?, ?)")
        .run(jetonOzeti, oyuncuId, urunId, cip, zaman);
      if (s.changes === 0) return false;
      if (!this.cipDegistir(oyuncuId, cip, `satin_alma:${urunId}`, zaman)) throw new Error("Oyuncu bulunamadı");
      return true;
    });
  }

  // ---------------- Reklam ----------------

  reklamSayisi(id: string, gun: string): number {
    const s = this.db.prepare("SELECT COUNT(*) AS n FROM reklam_odulleri WHERE oyuncu_id = ? AND gun = ?").get(id, gun) as {
      n: number;
    };
    return s.n;
  }

  /** Reklam ödülünü verir. İşlem kimliği tekrar ediyorsa ya da günlük sınır dolduysa vermez. */
  reklamOduluVer(
    islemId: string,
    oyuncuId: string,
    gun: string,
    miktar: number,
    sinir: number,
    zaman: number,
  ): "verildi" | "tekrar" | "sinir" | "oyuncuYok" {
    return this.islem(() => {
      if (this.db.prepare("SELECT 1 FROM reklam_odulleri WHERE islem_id = ?").get(islemId)) return "tekrar";
      if (!this.oyuncuGetir(oyuncuId)) return "oyuncuYok";
      if (this.reklamSayisi(oyuncuId, gun) >= sinir) return "sinir";
      this.db.prepare("INSERT INTO reklam_odulleri (islem_id, oyuncu_id, gun, zaman) VALUES (?, ?, ?, ?)").run(islemId, oyuncuId, gun, zaman);
      this.cipDegistir(oyuncuId, miktar, "reklam", zaman);
      return "verildi";
    });
  }

  // ---------------- Sıralama ----------------

  /** En yüksek XP'li ya da en çok çipli oyuncular. Eşitlikte önce kaydolan önde. */
  enIyiler(tur: "xp" | "cip", sinir: number): OyuncuSatiri[] {
    return this.db
      .prepare(`SELECT * FROM oyuncular ORDER BY ${tur} DESC, olusturma ASC, id ASC LIMIT ?`)
      .all(sinir) as unknown as OyuncuSatiri[];
  }

  /** Oyuncunun sıralamadaki yeri (enIyiler ile aynı sıralama kuralıyla). */
  sira(tur: "xp" | "cip", o: OyuncuSatiri): number {
    const s = this.db
      .prepare(
        `SELECT COUNT(*) AS n FROM oyuncular
         WHERE ${tur} > ? OR (${tur} = ? AND (olusturma < ? OR (olusturma = ? AND id < ?)))`,
      )
      .get(o[tur], o[tur], o.olusturma, o.olusturma, o.id) as { n: number };
    return s.n + 1;
  }
}
