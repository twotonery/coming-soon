// The slab's sound, synthesised so there are no audio files to load.
// Nothing sounds until the first click, and nothing while the cursor is still.

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
    seed |= 0;
    seed = seed + 1831565813 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// One-pole lowpass, run twice round so a looped buffer joins without a click.
function lowpassLoop(x: Float32Array, hz: number, sr: number) {
  const k = 1 - Math.exp(-2 * Math.PI * hz / sr);
  let y = 0;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < x.length; i++) {
    y += (x[i] - y) * k;
    if (pass) x[i] = y;
  }
}
const ROLL_SECONDS = 6;
const TURN_HZ = 4.5; // how often the rolling "comes round": the rumble's pulse
// Bending the stone: a dry, seamless loop of rock rolling over rock. A low
// weight underneath, many small knocks and scrapes on top, all swelling and
// easing on an uneven turn so it rolls instead of hissing. No air, no room.
export function renderRoll(sr: number): Float32Array {
  const n = Math.floor(sr * ROLL_SECONDS);
  const rnd = rng(7741);
  const out = new Float32Array(n);
  const turns = Math.round(TURN_HZ * ROLL_SECONDS);
  const weight = new Float32Array(turns), late = new Float32Array(turns);
  for (let i = 0; i < turns; i++) {
    weight[i] = 0.55 + rnd() * 0.45;
    late[i] = (rnd() - 0.5) * 0.22;
  }
  const turning = (i: number) => {
    const ph = i / n * turns, k = Math.floor(ph) % turns;
    let f = ph - Math.floor(ph) - late[k];
    f -= Math.floor(f);
    const bump = Math.pow(Math.sin(Math.PI * Math.pow(f, 0.6)), 2);
    const swell = 0.8 + 0.2 * Math.sin(2 * Math.PI * i * 2 / n + 1.3);
    return (0.45 + 0.55 * bump * weight[k]) * swell;
  };
  const fade = Math.floor(sr * 0.3);
  const raw = new Float32Array(n + fade);
  let brown = 0;
  for (let i = 0; i < raw.length; i++) {
    brown = (brown + 0.02 * (rnd() * 2 - 1)) / 1.02;
    raw[i] = brown;
  }
  const bed = raw.subarray(0, n);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    bed[i] = raw[i] * t + raw[n + i] * (1 - t);
  }
  lowpassLoop(bed, 170, sr);
  lowpassLoop(bed, 170, sr);
  let bedPeak = 0;
  for (let i = 0; i < n; i++) bedPeak = Math.max(bedPeak, Math.abs(bed[i]));
  for (let i = 0; i < n; i++) out[i] += bed[i] / bedPeak * 0.3 * turning(i);
  const knocks = Math.floor(ROLL_SECONDS * 130);
  const grit = new Float32Array(n);
  for (let k = 0; k < knocks; k++) {
    let at = 0;
    for (let tries = 0; tries < 8; tries++) {
      at = Math.floor(rnd() * n);
      if (rnd() < turning(at)) break;
    }
    const big = rnd() < 0.12;
    const hz = big ? 85 + rnd() * 95 : 190 * Math.pow(5, Math.pow(rnd(), 1.3));
    const ring = (big ? 0.05 + rnd() * 0.05 : 0.012 + rnd() * 0.03) * sr;
    const amp = (big ? 0.4 : 0.34) * (0.25 + 0.75 * rnd() * rnd()) * (0.5 + 0.5 * turning(at));
    const len = Math.floor(ring * 5), ph0 = rnd() * 6.283, w = 2 * Math.PI * hz / sr;
    const drop = 1 - rnd() * 0.12;
    for (let j = 0; j < len; j++) {
      const env = Math.exp(-j / ring) * Math.min(1, j / (sr * 12e-4));
      out[(at + j) % n] += Math.sin(ph0 + w * j * (1 - (1 - drop) * (j / len))) * env * amp;
    }
    const gl = Math.floor(sr * (4e-3 + rnd() * 9e-3));
    for (let j = 0; j < gl; j++) grit[(at + j) % n] += (rnd() * 2 - 1) * (1 - j / gl) * amp;
  }
  lowpassLoop(grit, 2400, sr);
  lowpassLoop(grit, 2400, sr);
  const low = Float32Array.from(grit);
  lowpassLoop(low, 500, sr);
  for (let i = 0; i < n; i++) out[i] += (grit[i] - low[i]) * 2.4;
  const d = Math.round(sr / 124);
  const wet = new Float32Array(n);
  let damp = 0;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) {
    damp += (wet[(i - d + n) % n] - damp) * 0.5;
    wet[i] = out[i] + damp * 0.42;
  }
  for (let i = 0; i < n; i++) out[i] = out[i] * 0.6 + wet[i] * 0.4;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    out[i] = Math.tanh(out[i] * 1.6);
    peak = Math.max(peak, Math.abs(out[i]));
  }
  for (let i = 0; i < n; i++) out[i] *= 0.9 / peak;
  return out;
}
// A strike: hammer on a steel chisel. A handful of partials that don't line
// up (so it rings like metal, not like a bell or a drum), a hard tick at the
// front, the stone's brief knock under it, and a few crumbs after.
export function renderTing(sr: number, seed: number): Float32Array {
  const n = Math.floor(sr * 0.6);
  const rnd = rng(seed * 977 + 31);
  const out = new Float32Array(n);
  const f0 = 2250 + rnd() * 500;
  const partials: [number, number, number][] = [ // ratio, level, ring (s)
    [1, 1, 0.13],
    [1.47, 0.5, 0.1],
    [2.09, 0.62, 0.075],
    [2.76, 0.34, 0.055],
    [3.51, 0.2, 0.04],
    [4.3, 0.1, 0.028]
  ];
  for (const [ratio, amp, ring] of partials) {
    const hz = f0 * ratio * (0.985 + rnd() * 0.03);
    if (hz > sr * 0.45) continue;
    const a = amp * (0.75 + rnd() * 0.5), tau = ring * sr * (0.85 + rnd() * 0.3), ph = rnd() * 6.283;
    for (let i = 0; i < n; i++) {
      const env = Math.exp(-i / tau);
      out[i] += (Math.sin(ph + 2 * Math.PI * hz * i / sr) + 0.45 * Math.sin(2 * Math.PI * hz * 1.004 * i / sr)) * env * a;
    }
  }
  let prev = 0;
  const click = Math.floor(sr * 2e-3);
  for (let i = 0; i < click; i++) {
    const w = rnd() * 2 - 1;
    out[i] += (w - prev) * (1 - i / click) * 0.9;
    prev = w;
  }
  const tick = 300 + rnd() * 80;
  for (let i = 0; i < sr * 0.05; i++) out[i] += Math.sin(2 * Math.PI * tick * i / sr) * Math.exp(-i / (sr * 9e-3)) * 0.22;
  for (let k = 0; k < 3; k++) {
    const at = Math.floor(sr * (0.04 + rnd() * 0.16)), hz = 900 + rnd() * 1800, a = 0.03 + rnd() * 0.03;
    for (let j = 0; j < sr * 0.012 && at + j < n; j++) out[at + j] += Math.sin(2 * Math.PI * hz * j / sr) * Math.exp(-j / (sr * 3e-3)) * a;
  }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  const tail = Math.floor(sr * 0.05);
  for (let i = 0; i < n; i++) out[i] *= 0.9 / peak * Math.min(1, (n - i) / tail);
  return out;
}


const TINGS = 6; // a few different strikes, so no two in a row are the same

export function createStoneAudio(): StoneAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let rollGain: GainNode | null = null;
  let roll: AudioBufferSourceNode | null = null;
  let tings: AudioBuffer[] = [];
  let lastTing = -1;
  let muted = false;
  let pendingStrike = 0;
  let dead = false;

  function toBuffer(data: Float32Array) {
    const buf = ctx!.createBuffer(1, data.length, ctx!.sampleRate);
    buf.getChannelData(0).set(data);
    return buf;
  }
  function build() {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10; limiter.ratio.value = 4; limiter.attack.value = 0.003; limiter.release.value = 0.15;
    master.connect(limiter).connect(ctx.destination);
    roll = ctx.createBufferSource();
    roll.buffer = toBuffer(renderRoll(ctx.sampleRate));
    roll.loop = true;
    rollGain = ctx.createGain();
    rollGain.gain.value = 0;
    roll.connect(rollGain).connect(master);
    roll.start(0, Math.random() * ROLL_SECONDS);
    for (let i = 0; i < TINGS; i++) tings.push(toBuffer(renderTing(ctx.sampleRate, i + 1)));
  }
  function playTing(strength: number) {
    if (!ctx || !master || ctx.state !== "running" || !tings.length) return;
    let pick = Math.floor(Math.random() * tings.length);
    if (pick === lastTing) pick = (pick + 1) % tings.length;
    lastTing = pick;
    const src = ctx.createBufferSource();
    src.buffer = tings[pick];
    src.playbackRate.value = 0.97 + Math.random() * 0.06;
    const g = ctx.createGain();
    g.gain.value = 0.34 * strength;
    src.connect(g).connect(master);
    src.start();
  }

  return {
    unlock() {
      if (dead) return;
      if (!ctx) build();
      if (ctx && ctx.state !== "running") {
        void ctx.resume().then(() => {
          if (pendingStrike > 0) { const s = pendingStrike; pendingStrike = 0; playTing(s); }
        });
      }
    },
    setMotion(amount) {
      if (!ctx || !rollGain || !roll) return;
      const t = ctx.currentTime, a = Math.min(1, Math.max(0, amount));
      // quick to start, a little slower to come to rest; faster hands roll faster
      rollGain.gain.setTargetAtTime(a * 0.8, t, a > 0.02 ? 0.06 : 0.16);
      roll.playbackRate.setTargetAtTime(0.86 + a * 0.3, t, 0.25);
    },
    strike(strength = 1) {
      if (!ctx || ctx.state !== "running") { pendingStrike = strength; return; }
      playTing(strength);
    },
    setMuted(m) {
      muted = m;
      if (ctx && master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.03);
    },
    destroy() {
      dead = true;
      if (ctx) void ctx.close();
      ctx = null; tings = [];
    },
  };
}
