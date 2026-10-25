// Lobide seçilen oyun türü (Okey / 101). Bir sonraki açılışta aynı türle başlamak için
// tarayıcı deposunda (localStorage) saklanır. Bu sadece bir kolaylıktır: depo kapalıysa
// ya da hata verirse (gizli sekme, kısıtlı WebView) varsayılan Okey ile devam edilir.
import { OYUN_TURLERI, type OyunTuru } from "@okey/kurallar";

const ANAHTAR = "okey.oyunTuru";

export function kayitliOyunTuru(): OyunTuru {
  try {
    const d = localStorage.getItem(ANAHTAR);
    return OYUN_TURLERI.includes(d as OyunTuru) ? (d as OyunTuru) : "okey";
  } catch {
    return "okey";
  }
}

export function oyunTuruKaydet(oyun: OyunTuru): void {
  try {
    localStorage.setItem(ANAHTAR, oyun);
  } catch {
    /* saklanamazsa bir dahaki açılışta Okey seçili gelir */
  }
}

/** Arayüzde görünen ad. */
export const OYUN_ADI: Record<OyunTuru, string> = { okey: "Okey", "101": "101 Okey" };
