// The slab's sound, synthesised so there are no audio files to load:
// a low, muffled grind while the hand moves, and a soft "tok" for each strike.
// Nothing sounds while the pointer is still.

export type StoneAudio = {
  /** Call from a click / tap / key handler: browsers only start audio from one. */
  unlock(): void;
  /** 0..1, how fast the hand is moving right now; carving makes it a little fuller. */
  setMotion(amount: number, carving: boolean): void;
  strike(strength?: number): void;
  setMuted(muted: boolean): void;
  destroy(): void;
};

function noiseBuffer(ctx: AudioContext, seconds: number, brown: boolean) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * white) / 1.02; d[i] = last * 3.5; }
    else d[i] = white;
  }
  // crossfade the tail into the head so the loop has no seam
  const fade = Math.floor(ctx.sampleRate * 0.25);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    d[i] = d[i] * t + d[d.length - fade + i] * (1 - t);
  }
  return buf;
}

// A short, dark room so the sounds sit in a space rather than in the speaker.
function roomImpulse(ctx: AudioContext) {
  const len = Math.floor(ctx.sampleRate * 0.9);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      lp += (Math.random() * 2 - 1 - lp) * 0.18;
      d[i] = lp * Math.pow(1 - t, 3.2);
    }
  }
  return buf;
}

export function createStoneAudio(): StoneAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let grind: GainNode | null = null;
  let grit: GainNode | null = null;
  let tone: BiquadFilterNode | null = null;
  let roomIn: ConvolverNode | null = null;
  let muted = false;
  let pendingStrike = 0;
  let dead = false;

  function build() {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14; limiter.ratio.value = 6; limiter.attack.value = 0.004; limiter.release.value = 0.2;
    master.connect(limiter).connect(ctx.destination);

    const room = ctx.createConvolver();
    room.buffer = roomImpulse(ctx);
    roomIn = room;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    room.connect(wet).connect(master);

    // ---- the grind: brown noise through a low, soft filter
    const brown = ctx.createBufferSource();
    brown.buffer = noiseBuffer(ctx, 5, true);
    brown.loop = true;
    tone = ctx.createBiquadFilter();
    tone.type = "lowpass"; tone.frequency.value = 260; tone.Q.value = 0.6;
    const body = ctx.createBiquadFilter();
    body.type = "peaking"; body.frequency.value = 110; body.Q.value = 0.9; body.gain.value = 7;
    grind = ctx.createGain();
    grind.gain.value = 0;
    brown.connect(tone).connect(body).connect(grind);
    grind.connect(master); grind.connect(room);

    // ---- grit: a quieter gravelly layer whose loudness wanders on its own,
    // so the grind crumbles instead of hissing
    const white = ctx.createBufferSource();
    white.buffer = noiseBuffer(ctx, 3, false);
    white.loop = true;
    const gritBand = ctx.createBiquadFilter();
    gritBand.type = "bandpass"; gritBand.frequency.value = 620; gritBand.Q.value = 0.8;
    const crumble = ctx.createGain();
    crumble.gain.value = 0;
    const wander = ctx.createBufferSource();
    wander.buffer = noiseBuffer(ctx, 4, false);
    wander.loop = true; wander.playbackRate.value = 0.9;
    const wanderLp = ctx.createBiquadFilter();
    wanderLp.type = "lowpass"; wanderLp.frequency.value = 14;
    const wanderAmt = ctx.createGain();
    wanderAmt.gain.value = 9;
    wander.connect(wanderLp).connect(wanderAmt).connect(crumble.gain);
    grit = ctx.createGain();
    grit.gain.value = 0;
    white.connect(gritBand).connect(crumble).connect(grit);
    grit.connect(master); grit.connect(room);

    brown.start(); white.start(); wander.start();
  }

  function playStrike(strength: number) {
    if (!ctx || !master || ctx.state !== "running") return;
    const t = ctx.currentTime + 0.005;
    const k = 0.9 + Math.random() * 0.2;
    const out = ctx.createGain();
    out.gain.value = 0.55 * strength;
    out.connect(master);
    if (roomIn) { const send = ctx.createGain(); send.gain.value = 0.6; out.connect(send).connect(roomIn); }

    // the knock: a damped low thud
    const thud = ctx.createOscillator();
    thud.type = "sine";
    thud.frequency.setValueAtTime(190 * k, t);
    thud.frequency.exponentialRampToValueAtTime(82 * k, t + 0.09);
    const thudG = ctx.createGain();
    thudG.gain.setValueAtTime(0.0001, t);
    thudG.gain.exponentialRampToValueAtTime(0.9, t + 0.004);
    thudG.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    thud.connect(thudG).connect(out);
    thud.start(t); thud.stop(t + 0.2);

    // the stone answering: two short, woody partials
    for (const [f, g, dur] of [[540, 0.22, 0.07], [910, 0.10, 0.045]] as const) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f * k * (0.97 + Math.random() * 0.06);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(g, t + 0.002);
      og.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(og).connect(out);
      osc.start(t); osc.stop(t + dur + 0.02);
    }

    // the chip: a breath of filtered noise, then crumbs
    const chip = ctx.createBufferSource();
    chip.buffer = noiseBuffer(ctx, 0.3, false);
    const chipF = ctx.createBiquadFilter();
    chipF.type = "bandpass"; chipF.frequency.value = 1500 * k; chipF.Q.value = 0.9;
    const chipG = ctx.createGain();
    chipG.gain.setValueAtTime(0.0001, t);
    chipG.gain.exponentialRampToValueAtTime(0.16, t + 0.003);
    chipG.gain.exponentialRampToValueAtTime(0.02, t + 0.04);
    chipG.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    chip.connect(chipF).connect(chipG).connect(out);
    chip.start(t); chip.stop(t + 0.3);
  }

  return {
    unlock() {
      if (dead) return;
      if (!ctx) build();
      if (!ctx) return;
      if (ctx.state !== "running") {
        void ctx.resume().then(() => {
          if (pendingStrike > 0) { const s = pendingStrike; pendingStrike = 0; playStrike(s); }
        });
      }
    },
    setMotion(amount, carving) {
      if (!ctx || !grind || !grit || !tone) return;
      const t = ctx.currentTime;
      const a = Math.min(1, Math.max(0, amount));
      // fast to rise, slow to fall: the ground takes a moment to come to rest
      const tc = a > 0.02 ? 0.07 : 0.22;
      grind.gain.setTargetAtTime(a * (carving ? 0.62 : 0.42), t, tc);
      grit.gain.setTargetAtTime(a * a * (carving ? 0.10 : 0.045), t, tc);
      tone.frequency.setTargetAtTime(200 + a * (carving ? 330 : 190), t, 0.12);
    },
    strike(strength = 1) {
      if (!ctx || ctx.state !== "running") { pendingStrike = strength; return; }
      playStrike(strength);
    },
    setMuted(m) {
      muted = m;
      if (ctx && master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.03);
    },
    destroy() {
      dead = true;
      if (ctx) void ctx.close();
      ctx = null;
    },
  };
}
