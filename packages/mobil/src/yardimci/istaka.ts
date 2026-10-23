// İstaka: oyuncunun taşlarını dizdiği 2 sıra x 15 yuvalık raf.
//
// Sunucu sadece elimizde HANGİ taşların olduğunu bilir; taşların istakada nerede
// durduğu tamamen telefona aittir. Bu dosyadaki fonksiyonlar saftır (yan etkisizdir):
// eski yuva dizisini alır, yenisini döndürür. Böylece kolayca test edilebilir.

export const SIRA_UZUNLUGU = 15;
export const YUVA_SAYISI = SIRA_UZUNLUGU * 2;

/** null = boş yuva */
export type Yuvalar = (number | null)[];

export function bosIstaka(): Yuvalar {
  return Array(YUVA_SAYISI).fill(null);
}

/** Yeni dağıtılan eli istakaya sırayla dizer. */
export function eliYerlestir(el: number[]): Yuvalar {
  const y = bosIstaka();
  el.forEach((tas, i) => (y[i] = tas));
  return y;
}

/**
 * İstakayı sunucunun söylediği elle eşitler:
 *  - artık elde olmayan taşlar (atılanlar) yuvadan kalkar,
 *  - yeni gelen taşlar (çekilen) ilk boş yuvaya konur.
 * Diğer taşlar oyuncunun bıraktığı yerde kalır.
 */
export function istakaEsitle(yuvalar: Yuvalar, el: number[]): Yuvalar {
  const eldekiler = new Set(el);
  const y = yuvalar.map((t) => (t !== null && eldekiler.has(t) ? t : null));
  const yerdekiler = new Set(y.filter((t): t is number => t !== null));
  for (const tas of el) {
    if (yerdekiler.has(tas)) continue;
    const bos = y.indexOf(null);
    if (bos === -1) break; // olmaz: 30 yuvaya en fazla 15 taş gelir
    y[bos] = tas;
  }
  return y;
}

/**
 * Bir taşı başka bir yuvaya taşır. Hedef doluysa, hedefteki ve sağındaki taşlar
 * aynı sırada bir boşluğa kadar sağa kayar (gerçek istakada taşı araya sokmak gibi).
 * Sağda boşluk yoksa sola kaydırmayı dener; o da olmazsa iki taş yer değiştirir.
 */
export function tasiTasi(yuvalar: Yuvalar, kaynak: number, hedef: number): Yuvalar {
  if (kaynak === hedef) return yuvalar;
  const y = [...yuvalar];
  const tas = y[kaynak];
  if (tas === null) return yuvalar;
  y[kaynak] = null;

  if (y[hedef] === null) {
    y[hedef] = tas;
    return y;
  }
  const siraBasi = Math.floor(hedef / SIRA_UZUNLUGU) * SIRA_UZUNLUGU;
  const siraSonu = siraBasi + SIRA_UZUNLUGU - 1;

  // Sağa kaydır: hedeften sonraki ilk boşluğu bul, aradaki taşları birer sağa al.
  for (let i = hedef + 1; i <= siraSonu; i++) {
    if (y[i] === null) {
      for (let j = i; j > hedef; j--) y[j] = y[j - 1];
      y[hedef] = tas;
      return y;
    }
  }
  // Sola kaydır.
  for (let i = hedef - 1; i >= siraBasi; i--) {
    if (y[i] === null) {
      for (let j = i; j < hedef; j++) y[j] = y[j + 1];
      y[hedef] = tas;
      return y;
    }
  }
  // Sıra tamamen dolu: yer değiştir.
  y[kaynak] = y[hedef];
  y[hedef] = tas;
  return y;
}

/**
 * Kurallar paketindeki diz() sonucunu (tek uzun dizi) iki sıraya böler.
 * Bir per sıra sonunda bölünmesin diye, sığmayan per alt sıraya geçer.
 */
export function dizilisiYerlestir(dizilis: (number | null)[]): Yuvalar {
  // Diziyi "gruplara" ayır: ardışık taşlar bir grup, null'lar ayraç.
  const gruplar: number[][] = [];
  let grup: number[] = [];
  for (const t of dizilis) {
    if (t === null) {
      if (grup.length) gruplar.push(grup);
      grup = [];
    } else grup.push(t);
  }
  if (grup.length) gruplar.push(grup);

  const y = bosIstaka();
  let konum = 0;
  for (const g of gruplar) {
    const siraSonu = konum < SIRA_UZUNLUGU ? SIRA_UZUNLUGU : YUVA_SAYISI;
    if (konum + g.length > siraSonu && konum < SIRA_UZUNLUGU) konum = SIRA_UZUNLUGU; // alt sıraya geç
    for (const t of g) {
      if (konum >= YUVA_SAYISI) konum = y.indexOf(null); // olası taşmada ilk boşluğa
      y[konum++] = t;
    }
    konum++; // gruplar arasında bir boşluk
  }
  return y;
}
