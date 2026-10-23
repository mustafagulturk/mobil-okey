// Sayı ve metin biçimlendirme yardımcıları (Türkçe).

const tamSayi = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

/** 1250000 → "1.250.000" */
export function cipBicim(n: number): string {
  return tamSayi.format(n);
}

/** Dar yerler için kısaltma: 1250000 → "1,2 Mn", 25000 → "25 B", 950 → "950". */
export function kisaCip(n: number): string {
  const mutlak = Math.abs(n);
  const kirp = (x: number) => (Math.floor(x * 10) / 10).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
  if (mutlak >= 1_000_000_000) return `${kirp(n / 1_000_000_000)} Mr`;
  if (mutlak >= 1_000_000) return `${kirp(n / 1_000_000)} Mn`;
  if (mutlak >= 10_000) return `${kirp(n / 1_000)} B`;
  return cipBicim(n);
}

/** İşaretli çip değişimi: +1.200 / -100 / 0 */
export function cipDegisimiBicim(n: number): string {
  if (n > 0) return `+${cipBicim(n)}`;
  if (n < 0) return `−${cipBicim(-n)}`;
  return "0";
}

/** Kurallar paketindeki hata metinlerinde geçen ham sayıları biçimler ("10000 çip" → "10.000 çip"). */
export function metindekiSayilariBicimle(metin: string): string {
  return metin.replace(/\d{4,}/g, (s) => cipBicim(Number(s)));
}

export const RENK_ADLARI = ["Kırmızı", "Sarı", "Mavi", "Siyah"] as const;
