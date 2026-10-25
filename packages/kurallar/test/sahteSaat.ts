// Oda testlerinin ortak sahte saati (Okey ve 101 testleri kullanır).

/** Sahte saat: zamanlayıcıları sırayla elle ilerletiriz. */
export function sahteSaat() {
  let simdi = 0;
  let sayac = 0;
  const bekleyen = new Map<number, { an: number; fn: () => void }>();
  return {
    simdi: () => simdi,
    zamanla: (fn: () => void, ms: number) => {
      const id = ++sayac;
      bekleyen.set(id, { an: simdi + ms, fn });
      return () => bekleyen.delete(id);
    },
    /** En yakın zamanlayıcıyı çalıştırır. */
    ilerle(): boolean {
      let enYakin: [number, { an: number; fn: () => void }] | null = null;
      for (const g of bekleyen) if (!enYakin || g[1].an < enYakin[1].an) enYakin = g;
      if (!enYakin) return false;
      bekleyen.delete(enYakin[0]);
      simdi = enYakin[1].an;
      enYakin[1].fn();
      return true;
    },
    /** Saati ms ilerletir; bu arada vakti gelen zamanlayıcıları sırayla çalıştırır. */
    atla(ms: number) {
      const hedef = simdi + ms;
      for (;;) {
        let enYakin: [number, { an: number; fn: () => void }] | null = null;
        for (const g of bekleyen) if (g[1].an <= hedef && (!enYakin || g[1].an < enYakin[1].an)) enYakin = g;
        if (!enYakin) break;
        bekleyen.delete(enYakin[0]);
        simdi = enYakin[1].an;
        enYakin[1].fn();
      }
      simdi = hedef;
    },
  };
}
