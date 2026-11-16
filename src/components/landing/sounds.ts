// Small interface sounds, synthesised with the Web Audio API: no audio files.
// The player is Bencho's (bencho.dev); the notes below are our own.
// Browsers only start audio after a user gesture, so call these from a click,
// tap or key handler.

type Note = {
  hz: number; to?: number; ms: number; gain?: number; wave?: OscillatorType; cut?: number;
  at?: number; atk?: number; noise?: BiquadFilterType; q?: number;
};

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function playNotes(notes: readonly Note[], volume = 1) {
  if (typeof window === "undefined" || !("AudioContext" in window)) return;
  ctx ??= new AudioContext();
  const c = ctx;
  if (c.state !== "running") void c.resume();
  if (!noise) {
    noise = c.createBuffer(1, Math.floor(c.sampleRate * 2), c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const base = c.currentTime + 0.005;
  for (const n of notes) {
    const t0 = base + (n.at ?? 0) / 1000;
    const t1 = t0 + n.ms / 1000;
    let src: AudioScheduledSourceNode;
    let head: AudioNode;
    if (n.noise) {
      const s = c.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = n.noise;
      f.frequency.setValueAtTime(n.hz, t0);
      if (n.to) f.frequency.exponentialRampToValueAtTime(n.to, t1);
      if (n.q !== undefined) f.Q.value = n.q;
      s.connect(f);
      src = s;
      head = f;
    } else {
      const o = c.createOscillator();
      o.type = n.wave ?? "sine";
      o.frequency.setValueAtTime(n.hz, t0);
      if (n.to) o.frequency.exponentialRampToValueAtTime(n.to, t1);
      src = o;
      head = o;
    }
    const g = c.createGain();
    const atk = Math.min((n.atk ?? 4) / 1000, (n.ms / 1000) * 0.6);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime((n.gain ?? 0.05) * volume, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t1);
    let tail: AudioNode = head;
    if (n.cut) {
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = n.cut;
      head.connect(f);
      tail = f;
    }
    tail.connect(g).connect(c.destination);
    if (n.noise) (src as AudioBufferSourceNode).start(t0, Math.random() * 1.5);
    else src.start(t0);
    src.stop(t1 + 0.02);
  }
}

// A card turned over on a table: a thumb catching its edge, the air it pushes
// as it comes round, then the flat slap of card stock landing on the pile.
// Timed to the pricing tickets' flip (pricing.css: the slap lands with the card).
const cardFlip: Note[] = [
  { noise: "bandpass", hz: 3200, ms: 24, gain: 0.03, q: 1.4, atk: 1 },
  { noise: "bandpass", hz: 700, to: 3400, ms: 190, gain: 0.05, q: 0.7, atk: 90, at: 20 },
  { noise: "highpass", hz: 2600, ms: 34, gain: 0.07, atk: 1, at: 235 },
  { noise: "bandpass", hz: 420, ms: 70, gain: 0.09, q: 1.1, atk: 1, at: 237 },
  { hz: 170, to: 80, ms: 80, gain: 0.07, atk: 2, at: 237 },
];

export const playCardFlip = (volume = 1) => playNotes(cardFlip, volume);
