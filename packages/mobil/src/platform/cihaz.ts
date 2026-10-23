// Cihaza özgü küçük işler: titreşim, panoya kopyalama, paylaşma, sürüm.
// Her biri tarayıcıda da çalışır (ya da sessizce hiçbir şey yapmaz).
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Clipboard } from "@capacitor/clipboard";
import { Share } from "@capacitor/share";

export const yerelMi = () => Capacitor.isNativePlatform();

export async function titret(guclu = false) {
  try {
    await Haptics.impact({ style: guclu ? ImpactStyle.Heavy : ImpactStyle.Medium });
  } catch {
    /* titreşim yoksa önemli değil */
  }
}

export async function kopyala(metin: string): Promise<boolean> {
  try {
    await Clipboard.write({ string: metin });
    return true;
  } catch {
    return false;
  }
}

/** Paylaşım penceresini açar; açılamazsa panoya kopyalar. Dönen değer: "paylasildi" | "kopyalandi" | "olmadi" */
export async function paylas(baslik: string, metin: string): Promise<"paylasildi" | "kopyalandi" | "olmadi"> {
  try {
    const { value } = await Share.canShare();
    if (value) {
      await Share.share({ title: baslik, text: metin, dialogTitle: baslik });
      return "paylasildi";
    }
  } catch {
    /* kullanıcı vazgeçti ya da paylaşım yok */
  }
  return (await kopyala(metin)) ? "kopyalandi" : "olmadi";
}

export const SURUM = __UYGULAMA_SURUMU__;
