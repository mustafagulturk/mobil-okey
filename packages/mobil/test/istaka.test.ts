// İstaka yuva düzeninin saf fonksiyonları için testler.
import { describe, expect, it } from "vitest";
import { diz, okeyiBul } from "@okey/kurallar";
import { dizilisiYerlestir, eliYerlestir, istakaEsitle, tasiTasi, YUVA_SAYISI } from "../src/yardimci/istaka.ts";

describe("istaka", () => {
  it("yeni eli sırayla dizer", () => {
    const y = eliYerlestir([5, 9, 13]);
    expect(y.slice(0, 4)).toEqual([5, 9, 13, null]);
    expect(y).toHaveLength(YUVA_SAYISI);
  });

  it("atılan taşı kaldırır, çekilen taşı ilk boş yuvaya koyar, diğerlerine dokunmaz", () => {
    const y = eliYerlestir([1, 2, 3]);
    const sonra = istakaEsitle(tasiTasi(y, 2, 10), [1, 3, 50]); // 2 atıldı, 50 çekildi
    expect(sonra[0]).toBe(1);
    expect(sonra[10]).toBe(3); // oyuncunun taşıdığı yerde kaldı
    expect(sonra[1]).toBe(50); // ilk boş yuva
    expect(sonra.filter((t) => t !== null)).toHaveLength(3);
  });

  it("dolu yuvaya bırakınca taşlar sağa kayar", () => {
    const y = eliYerlestir([1, 2, 3]); // yuva 0,1,2
    const sonra = tasiTasi(y, 2, 0); // 3'ü başa sok
    expect(sonra.slice(0, 4)).toEqual([3, 1, 2, null]);
  });

  it("diz() sonucunu iki sıraya taşırmadan yerleştirir", () => {
    const okey = okeyiBul(0);
    const el = Array.from({ length: 14 }, (_, i) => i * 7);
    const y = dizilisiYerlestir(diz(el, okey, "seri", YUVA_SAYISI));
    expect(y).toHaveLength(YUVA_SAYISI);
    expect(new Set(y.filter((t) => t !== null))).toEqual(new Set(el));
  });
});
