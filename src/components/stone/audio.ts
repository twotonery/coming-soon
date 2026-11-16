// The slab's sound: three recordings of rocks tumbling, each looped and faded
// in and out as needed. Loudest to softest:
//   carve  the cursor cutting as it moves, only as loud as it is fast
//   heal   stone closing back over the logo
//   idle   the cursor resting on the stone, still cutting where it stands
// Nothing sounds until the first click, or while carving is off.

export type StoneSounds = { carve?: string; heal?: string; idle?: string };
export type StoneLevels = { carve: number; heal: number; idle: number }; // each 0..1

export type StoneAudio = {
  /** Call from a click / tap / key handler: browsers only start audio from one. */
  unlock(): void;
  setLevels(levels: StoneLevels): void;
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

// A recording's bytes, from a normal URL or (for the standalone preview,
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

// How loud each recording plays at full level, and how quickly it comes up and
// dies away (seconds). The recordings are quiet; a limiter sits after them.
const TRACKS = {
  carve: { gain: 2.0, rise: 0.07, fall: 0.2 },
  heal: { gain: 0.8, rise: 0.25, fall: 0.5 },
  idle: { gain: 0.4, rise: 0.5, fall: 0.3 },
} as const;
type Name = keyof typeof TRACKS;
const NAMES = Object.keys(TRACKS) as Name[];

export function createStoneAudio(sounds: StoneSounds = {}): StoneAudio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  const gains: Partial<Record<Name, GainNode>> = {};
  let carve: AudioBufferSourceNode | null = null;
  let muted = false;
  let dead = false;
  // fetched up front so there is sound from the first movement after the first click
  const bytes = NAMES.map((name) => {
    const url = sounds[name];
    return url ? loadBytes(url).catch((err) => { console.warn(err); return null; }) : Promise.resolve(null);
  });

  function build() {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ac = (ctx = new AC());
    master = ac.createGain();
    master.gain.value = muted ? 0 : 1;
    const limiter = ac.createDynamicsCompressor();
    limiter.threshold.value = -9; limiter.knee.value = 6; limiter.ratio.value = 6; limiter.attack.value = 0.003; limiter.release.value = 0.15;
    master.connect(limiter).connect(ac.destination);
    NAMES.forEach((name, i) => {
      const gain = (gains[name] = ac.createGain());
      gain.gain.value = 0;
      gain.connect(master!);
      void bytes[i]
        .then((data) => (data ? ac.decodeAudioData(data) : null))
        .then((decoded) => {
          if (!decoded || dead) return;
          const chans = loopChannels(Array.from({ length: decoded.numberOfChannels }, (_, ch) => decoded.getChannelData(ch)), decoded.sampleRate);
          const loop = ac.createBuffer(chans.length, chans[0].length, decoded.sampleRate);
          chans.forEach((data, ch) => loop.getChannelData(ch).set(data));
          const src = ac.createBufferSource();
          src.buffer = loop;
          src.loop = true;
          src.connect(gain);
          src.start(0, Math.random() * loop.duration);
          if (name === "carve") carve = src;
        })
        .catch((err) => console.warn(`stone: the ${name} sound could not be read`, err));
    });
  }

  return {
    unlock() {
      if (dead) return;
      if (!ctx) build();
      if (ctx && ctx.state !== "running") void ctx.resume();
    },
    setLevels(levels) {
      if (!ctx) return;
      const t = ctx.currentTime;
      for (const name of NAMES) {
        const a = Math.min(1, Math.max(0, levels[name])), track = TRACKS[name];
        gains[name]?.gain.setTargetAtTime(a * track.gain, t, a > 0.02 ? track.rise : track.fall);
      }
      // a faster cursor tumbles a touch faster
      carve?.playbackRate.setTargetAtTime(0.94 + Math.min(1, Math.max(0, levels.carve)) * 0.12, t, 0.3);
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
