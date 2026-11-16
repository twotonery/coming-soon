// The slab's sound: a recording of rocks tumbling (public/sfx/stone-roll.mp3),
// looped, and only as loud as the cursor is fast. Nothing sounds until the
// first click, and nothing while the cursor is still.

export type StoneAudio = {
  /** Call from a click / tap / key handler: browsers only start audio from one. */
  unlock(): void;
  /** 0..1, how fast the cursor is moving right now. */
  setMotion(amount: number): void;
  setMuted(muted: boolean): void;
  destroy(): void;
};

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

const ROLL_GAIN = 2.0; // the recording is quiet; a limiter sits after it

export function createStoneAudio(rollUrl?: string): StoneAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let rollGain: GainNode | null = null;
  let roll: AudioBufferSourceNode | null = null;
  let muted = false;
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

  return {
    unlock() {
      if (dead) return;
      if (!ctx) build();
      if (ctx && ctx.state !== "running") void ctx.resume();
    },
    setMotion(amount) {
      if (!ctx || !rollGain) return;
      const t = ctx.currentTime, a = Math.min(1, Math.max(0, amount));
      // quick to start, a little slower to come to rest; a faster cursor tumbles a touch faster
      rollGain.gain.setTargetAtTime(a * ROLL_GAIN, t, a > 0.02 ? 0.07 : 0.2);
      roll?.playbackRate.setTargetAtTime(0.94 + a * 0.12, t, 0.3);
    },
    setMuted(m) {
      muted = m;
      if (ctx && master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.03);
    },
    destroy() {
      dead = true;
      if (ctx) void ctx.close();
      ctx = null;
    },
  };
}
