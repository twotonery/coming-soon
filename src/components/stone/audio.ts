// The slab's sound. Nothing sounds until the first click, and nothing while
// the cursor is still.
//  - bending the stone: a recording of rocks tumbling (public/sfx/stone-roll.mp3),
//    looped, and only as loud as the hand is fast
//  - a strike: a short, dry "tok" of a mallet driving a chisel into stone,
//    synthesised so no two in a row are the same

export type StoneAudio = {
  /** Call from a click / tap / key handler: browsers only start audio from one. */
  unlock(): void;
  /** 0..1, how fast the hand is moving right now. */
  setMotion(amount: number): void;
  strike(strength?: number): void;
  setMuted(muted: boolean): void;
  destroy(): void;
};

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A strike on stone. Short damped knocks in the mids (so it is neither a drum
// nor a ring), the crack of the blow at the front, the crunch of stone giving
// way under it, and a few crumbs falling after.
export function renderTok(sr: number, seed: number): Float32Array {
  const n = Math.floor(sr * 0.32);
  const rnd = rng(seed * 977 + 31);
  const out = new Float32Array(n);
  const f0 = 760 + rnd() * 240;
  const knocks: [number, number, number][] = [ // ratio, level, ring (s)
    [1, 1, 0.020],
    [1.83, 0.7, 0.013],
    [2.71, 0.45, 0.009],
    [4.12, 0.25, 0.006],
  ];
  for (const [ratio, amp, ring] of knocks) {
    const hz = f0 * ratio * (0.97 + rnd() * 0.06), a = amp * (0.75 + rnd() * 0.5), tau = ring * sr * (0.85 + rnd() * 0.3), ph = rnd() * 6.283;
    const len = Math.min(n, Math.floor(tau * 7));
    for (let i = 0; i < len; i++) out[i] += Math.sin(ph + (2 * Math.PI * hz * i) / sr) * Math.exp(-i / tau) * a;
  }
  // the crack of the blow
  let prev = 0;
  const crack = Math.floor(sr * 0.003);
  for (let i = 0; i < crack; i++) { const w = rnd() * 2 - 1; out[i] += (w - prev) * (1 - i / crack) * 0.7; prev = w; }
  // stone crunching under the edge: noise held to the mids, gone in a few ms
  let lo = 0, hi = 0;
  const kLo = 1 - Math.exp((-2 * Math.PI * 2600) / sr), kHi = 1 - Math.exp((-2 * Math.PI * 600) / sr);
  const crunch = Math.floor(sr * 0.05), crunchTau = sr * (0.009 + rnd() * 0.004);
  for (let i = 0; i < crunch; i++) {
    lo += (rnd() * 2 - 1 - lo) * kLo; hi += (lo - hi) * kHi;
    out[i] += (lo - hi) * Math.exp(-i / crunchTau) * 1.5;
  }
  // crumbs
  const crumbs = 2 + Math.floor(rnd() * 3);
  for (let k = 0; k < crumbs; k++) {
    const at = Math.floor(sr * (0.035 + rnd() * 0.17)), hz = 1400 + rnd() * 2200, a = 0.035 + rnd() * 0.045;
    for (let j = 0; j < sr * 0.01 && at + j < n; j++) out[at + j] += Math.sin((2 * Math.PI * hz * j) / sr) * Math.exp(-j / (sr * 0.0022)) * a;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const tail = Math.floor(sr * 0.04);
  for (let i = 0; i < n; i++) out[i] *= (0.9 / peak) * Math.min(1, (n - i) / tail);
  return out;
}

// Finds a loop in a recording with no audible join: silence the encoder added
// at either end is dropped, then the last stretch is blended into the first.
// Works on plain channel arrays so it can be checked outside a browser.
export function loopChannels(channels: Float32Array[], sr: number, fadeSeconds = 0.6): Float32Array[] {
  const first = channels[0];
  let a = 0, b = first.length;
  while (a < b && Math.abs(first[a]) < 1e-4) a++;
  while (b > a && Math.abs(first[b - 1]) < 1e-4) b--;
  const fade = Math.min(Math.floor(sr * fadeSeconds), Math.floor((b - a) / 4));
  const n = Math.max(1, b - a - fade);
  return channels.map((from) => {
    const to = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (i < fade) {
        const t = i / fade; // equal-power, as the two ends are unrelated sound
        to[i] = from[a + i] * Math.sin((t * Math.PI) / 2) + from[a + n + i] * Math.cos((t * Math.PI) / 2);
      } else to[i] = from[a + i];
    }
    return to;
  });
}

// The recording's bytes, from a normal URL or (for the standalone preview,
// which may not fetch) straight out of a base64 data: URL.
async function loadBytes(url: string): Promise<ArrayBuffer> {
  if (url.startsWith("data:")) {
    const raw = atob(url.slice(url.indexOf(",") + 1));
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes.buffer;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`stone: ${url} ${res.status}`);
  return res.arrayBuffer();
}

const TOKS = 6;
const ROLL_GAIN = 2.0; // the recording is quiet; a limiter sits after it

export function createStoneAudio(rollUrl?: string): StoneAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let rollGain: GainNode | null = null;
  let roll: AudioBufferSourceNode | null = null;
  let toks: AudioBuffer[] = [];
  let lastTok = -1;
  let muted = false;
  let pendingStrike = 0;
  let dead = false;
  // fetched up front so the first movement after the first click already has sound
  const rollBytes = rollUrl ? loadBytes(rollUrl).catch((err) => { console.warn(err); return null; }) : Promise.resolve(null);

  function build() {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ac = (ctx = new AC());
    master = ac.createGain();
    master.gain.value = muted ? 0 : 1;
    const limiter = ac.createDynamicsCompressor();
    limiter.threshold.value = -9; limiter.knee.value = 6; limiter.ratio.value = 6; limiter.attack.value = 0.003; limiter.release.value = 0.15;
    master.connect(limiter).connect(ac.destination);
    rollGain = ac.createGain();
    rollGain.gain.value = 0;
    rollGain.connect(master);
    for (let i = 0; i < TOKS; i++) {
      const data = renderTok(ac.sampleRate, i + 1);
      const buf = ac.createBuffer(1, data.length, ac.sampleRate);
      buf.getChannelData(0).set(data);
      toks.push(buf);
    }
    void rollBytes
      .then((bytes) => (bytes ? ac.decodeAudioData(bytes) : null))
      .then((decoded) => {
        if (!decoded || dead || !rollGain) return;
        const chans = loopChannels(Array.from({ length: decoded.numberOfChannels }, (_, ch) => decoded.getChannelData(ch)), decoded.sampleRate);
        const loop = ac.createBuffer(chans.length, chans[0].length, decoded.sampleRate);
        chans.forEach((data, ch) => loop.getChannelData(ch).set(data));
        roll = ac.createBufferSource();
        roll.buffer = loop;
        roll.loop = true;
        roll.connect(rollGain);
        roll.start(0, Math.random() * loop.duration);
      })
      .catch((err) => console.warn("stone: the hover sound could not be read", err));
  }
  function playTok(strength: number) {
    if (!ctx || !master || ctx.state !== "running" || !toks.length) return;
    let pick = Math.floor(Math.random() * toks.length);
    if (pick === lastTok) pick = (pick + 1) % toks.length;
    lastTok = pick;
    const src = ctx.createBufferSource();
    src.buffer = toks[pick];
    src.playbackRate.value = 0.95 + Math.random() * 0.1;
    const g = ctx.createGain();
    g.gain.value = 0.6 * strength;
    src.connect(g).connect(master);
    src.start();
  }

  return {
    unlock() {
      if (dead) return;
      if (!ctx) build();
      if (ctx && ctx.state !== "running") {
        void ctx.resume().then(() => {
          if (pendingStrike > 0) { const s = pendingStrike; pendingStrike = 0; playTok(s); }
        });
      }
    },
    setMotion(amount) {
      if (!ctx || !rollGain) return;
      const t = ctx.currentTime, a = Math.min(1, Math.max(0, amount));
      // quick to start, a little slower to come to rest; a faster hand tumbles a touch faster
      rollGain.gain.setTargetAtTime(a * ROLL_GAIN, t, a > 0.02 ? 0.07 : 0.2);
      roll?.playbackRate.setTargetAtTime(0.94 + a * 0.12, t, 0.3);
    },
    strike(strength = 1) {
      if (!ctx || ctx.state !== "running") { pendingStrike = strength; return; }
      playTok(strength);
    },
    setMuted(m) {
      muted = m;
      if (ctx && master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.03);
    },
    destroy() {
      dead = true;
      if (ctx) void ctx.close();
      ctx = null; toks = [];
    },
  };
}
