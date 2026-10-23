// Bağlantı: Masa ekranının (ve tüm uygulamanın) sunucuyla konuştuğu ortak arayüz.
//
// Uygulama, mesajın gerçekten internetten mi gittiğini yoksa telefonda çalışan bir
// oda motoruna mı gittiğini bilmez. İki uygulaması var:
//  - OnlineBaglanti: WebSocket ile gerçek sunucu.
//  - YerelBaglanti: kurallar paketindeki Oda sınıfını telefonda çalıştırır (antrenman).
// Bu sayede online oyun ile antrenman AYNI masa ekranını kullanır.
import type { IstemciMesaji, SunucuMesaji } from "@okey/kurallar";

export type BaglantiDurumu = "baglaniyor" | "bagli" | "koptu";

export type MesajDinleyici = (mesaj: SunucuMesaji) => void;
export type DurumDinleyici = (durum: BaglantiDurumu) => void;

export interface Baglanti {
  gonder(mesaj: IstemciMesaji): void;
  /** Gelen mesajları dinler; dönen fonksiyon dinlemeyi bırakır. */
  dinle(fn: MesajDinleyici): () => void;
  durumDinle(fn: DurumDinleyici): () => void;
  kapat(): void;
}

/** İki uygulamanın ortak dinleyici listesi. */
export class Yayinci {
  private mesajDinleyicileri = new Set<MesajDinleyici>();
  private durumDinleyicileri = new Set<DurumDinleyici>();

  dinle(fn: MesajDinleyici) {
    this.mesajDinleyicileri.add(fn);
    return () => void this.mesajDinleyicileri.delete(fn);
  }

  durumDinle(fn: DurumDinleyici) {
    this.durumDinleyicileri.add(fn);
    return () => void this.durumDinleyicileri.delete(fn);
  }

  protected mesajYay(m: SunucuMesaji) {
    for (const fn of this.mesajDinleyicileri) fn(m);
  }

  protected durumYay(d: BaglantiDurumu) {
    for (const fn of this.durumDinleyicileri) fn(d);
  }
}
