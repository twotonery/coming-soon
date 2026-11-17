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

// The footer's "Sound on" button (the stone's, see stone/engine.ts) speaks for
// the whole site.
const muted = () => document.querySelector<HTMLElement>("[data-stone-sound]")?.dataset.muted === "true";

function audio() {
  ctx ??= new AudioContext();
  const c = ctx;
  if (c.state !== "running") void c.resume();
  if (!noise) {
    noise = c.createBuffer(1, Math.floor(c.sampleRate * 2), c.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return c;
}

function playNotes(notes: readonly Note[], volume = 1) {
  if (typeof window === "undefined" || !("AudioContext" in window) || muted()) return;
  const c = audio();
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
// Played as a pricing ticket comes to the front.
const cardFlip: Note[] = [
  { noise: "bandpass", hz: 3200, ms: 24, gain: 0.03, q: 1.4, atk: 1 },
  { noise: "bandpass", hz: 700, to: 3400, ms: 190, gain: 0.05, q: 0.7, atk: 90, at: 20 },
  { noise: "highpass", hz: 2600, ms: 34, gain: 0.07, atk: 1, at: 235 },
  { noise: "bandpass", hz: 420, ms: 70, gain: 0.09, q: 1.1, atk: 1, at: 237 },
  { hz: 170, to: 80, ms: 80, gain: 0.07, atk: 2, at: 237 },
];

export const playCardFlip = (volume = 1) => playNotes(cardFlip, volume);


// A fingertip brushed across paper, for as long as the page is scrolling: a
// soft hiss of filtered noise whose loudness and brightness follow how fast
// the page moves, with the slight unevenness of skin catching the paper's
// tooth. Browsers keep audio shut until the visitor has clicked, tapped or
// pressed a key (a wheel or trackpad scroll alone doesn't count), so the brush
// is first heard after that. Returns a function that takes it away again.
const BRUSH_PEAK = 0.05; // loudness at a fast scroll (the card flip peaks near 0.09)
const BRUSH_FAST = 2.4;  // px per ms that counts as a fast scroll

export function mountScrollBrush() {
  if (typeof window === "undefined" || !("AudioContext" in window)) return () => {};
  let level: GainNode | null = null;
  let tone: BiquadFilterNode | null = null;
  let source: AudioBufferSourceNode | null = null;
  let flutterSource: AudioBufferSourceNode | null = null;
  let rest = 0;
  let lastY = window.scrollY;
  let lastT = performance.now();

  const start = () => {
    if (level) return;
    const c = audio();
    source = c.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    // paper's hiss lives high: nothing under 900Hz, a broad band above
    const high = c.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 900;
    tone = c.createBiquadFilter();
    tone.type = "bandpass";
    tone.frequency.value = 2400;
    tone.Q.value = 0.55;
    // the catch of skin on the paper's tooth: the hiss wavers at random, a few times a second
    const flutter = c.createGain();
    flutter.gain.value = 0.7;
    flutterSource = c.createBufferSource();
    flutterSource.buffer = noise;
    flutterSource.loop = true;
    flutterSource.playbackRate.value = 0.6;
    const slow = c.createBiquadFilter();
    slow.type = "lowpass";
    slow.frequency.value = 16;
    const depth = c.createGain();
    depth.gain.value = 9;
    flutterSource.connect(slow).connect(depth).connect(flutter.gain);
    level = c.createGain();
    level.gain.value = 0;
    source.connect(high).connect(tone).connect(flutter).connect(level).connect(c.destination);
    source.start();
    flutterSource.start(0, 0.7);
  };

  const hush = () => {
    if (level && ctx) level.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
  };
  const onScroll = () => {
    const now = performance.now();
    const y = window.scrollY;
    const dt = Math.max(now - lastT, 1);
    const speed = Math.abs(y - lastY) / dt;
    lastY = y;
    lastT = now;
    if (!level || !tone || !ctx || ctx.state !== "running") return;
    if (muted() || dt > 250) return hush();
    const push = Math.min(speed / BRUSH_FAST, 1);
    const t = ctx.currentTime;
    level.gain.setTargetAtTime(BRUSH_PEAK * push ** 0.7, t, 0.035);
    tone.frequency.setTargetAtTime(1700 + 2600 * push, t, 0.05);
    window.clearTimeout(rest);
    rest = window.setTimeout(hush, 90);
  };

  const gestures = ["pointerdown", "keydown", "touchend"] as const;
  for (const g of gestures) window.addEventListener(g, start, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", hush);
  return () => {
    for (const g of gestures) window.removeEventListener(g, start);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("visibilitychange", hush);
    window.clearTimeout(rest);
    source?.stop();
    flutterSource?.stop();
    level?.disconnect();
    level = null;
  };
}
