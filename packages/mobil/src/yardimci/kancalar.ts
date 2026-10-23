// Küçük React kancaları (hooks).
import { useEffect, useRef, useState } from "react";

/** Belirli aralıkla güncellenen "şimdi" (geri sayımlar için). calis=false iken durur. */
export function useSimdi(aralikMs = 250, calis = true): number {
  const [simdi, setSimdi] = useState(Date.now);
  useEffect(() => {
    if (!calis) return;
    const z = setInterval(() => setSimdi(Date.now()), aralikMs);
    return () => clearInterval(z);
  }, [aralikMs, calis]);
  return simdi;
}

/** Bir değerin bir önceki render'daki hali. */
export function useOnceki<T>(deger: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = deger;
  }, [deger]);
  return ref.current;
}
