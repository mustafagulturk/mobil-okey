// Küçük ses efektleri. Ses dosyası yerine Web Audio ile anında üretilir:
// uygulama boyutu büyümez, internet gerekmez.

let baglam: AudioContext | null = null;
let acik = true;

export function sesAcik(deger: boolean) {
  acik = deger;
}

function ton(frekans: number, sure: number, tur: OscillatorType, ses = 0.12, gecikme = 0) {
  if (!acik) return;
  try {
    baglam ??= new AudioContext();
    const t = baglam.currentTime + gecikme;
    const osc = baglam.createOscillator();
    const kazanc = baglam.createGain();
    osc.type = tur;
    osc.frequency.setValueAtTime(frekans, t);
    kazanc.gain.setValueAtTime(ses, t);
    kazanc.gain.exponentialRampToValueAtTime(0.0001, t + sure);
    osc.connect(kazanc).connect(baglam.destination);
    osc.start(t);
    osc.stop(t + sure);
  } catch {
    /* ses desteklenmiyorsa sessiz kal */
  }
}

/** Taş masaya konunca: kısa, tok bir "tak". */
export const sesTas = () => ton(180, 0.08, "triangle", 0.25);
/** Taş çekilince: hafif bir "tık". */
export const sesCek = () => ton(420, 0.06, "sine", 0.12);
/** Sıra sana gelince: iki notalı zil. */
export const sesSira = () => {
  ton(660, 0.18, "sine", 0.1);
  ton(880, 0.25, "sine", 0.1, 0.12);
};
/** El kazanılınca: yükselen üç nota. */
export const sesKazandin = () => {
  ton(523, 0.2, "sine", 0.12);
  ton(659, 0.2, "sine", 0.12, 0.12);
  ton(784, 0.35, "sine", 0.12, 0.24);
};
