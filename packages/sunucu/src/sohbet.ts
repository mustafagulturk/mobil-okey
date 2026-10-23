// Masa sohbeti için basit küfür filtresi.
//
// Amaç her küfrü yakalamak değil, en yaygın olanları maskeleyip masadaki havayı korumak.
// Liste bilerek kısa tutuldu. Kısa kökler ("göt", "aq" gibi) sadece tam kelime olarak,
// uzun kökler ise kelimenin başında geçiyorsa maskelenir ("orospuluk" da yakalanır,
// ama "sıkıcı" ya da "götürmek" gibi masum kelimeler yakalanmaz).

const TAM_KELIMELER = ["aq", "amk", "amq", "oç", "göt", "piç", "sik"];
const KOKLER = ["orospu", "siktir", "sikerim", "sikeyim", "yarrak", "amına", "amina", "pezevenk", "kahpe", "ibne", "gavat"];

function kufurMu(kelime: string): boolean {
  // "SIKTIR" Türkçe kurala göre "sıktır" olur; büyük harfle yazılanı da yakalamak için iki türlü küçültüyoruz.
  return [kelime.toLocaleLowerCase("tr"), kelime.toLowerCase()].some(
    (k) => TAM_KELIMELER.includes(k) || KOKLER.some((kok) => k.startsWith(kok)),
  );
}

/** Metindeki küfürleri *** ile değiştirir; diğer her şeyi olduğu gibi bırakır. */
export function kufurMaskele(metin: string): string {
  return metin.replace(/[\p{L}\p{N}]+/gu, (kelime) => (kufurMu(kelime) ? "***" : kelime));
}
