// The stone slab: a relief the browser lights in real time, so the wordmark
// and everything the visitor cuts sit in one surface under one sun.
//
// Two stones, chosen by data-stone on the root:
//   (default)  limestone in evening sun, with green and golden moss
//   "teal"     the brand's teal stone at sunset, with orange and rose moss,
//              dew on the moss, and the sunset caught on the stone's grain
// Both have fine cracks running in from the slab's edges and out from the logo,
// with moss along them and mats of stonecrop, a little moss in the logo's own
// shaded corners, and the shadows of branches (top, right, a little bottom
// left) stirring over them.
//
// A click turns carving on, the next click turns it off. While it is on, the
// cursor carves wherever it goes, at the logo's own stroke width, depth and
// edge, throwing chips and dust ahead. Cuts last until the page is reloaded,
// except in the strip the logo runs along, where the stone slowly closes again
// so the logo always comes back.
//
// It keeps a "carve map" the size of the slab (see BRUSH_FRAG). The slab drifts
// sideways as an endless band, and the carve map, cracks, moss and plants all
// wrap with it.
//
// Framework-free on purpose: mountStone() is handed a root element holding
//   canvas[data-stone-canvas], [data-stone-hint], button[data-stone-sound]
// and returns null when WebGL2 isn't there (the still image underneath stays).

import { createStoneAudio, type StoneSounds } from "./audio";
import { ICON_BOX, ICON_PATHS, WORD_BOX, WORD_PATHS } from "./logo";
import { BLUR_FRAG, BRUSH_FRAG, BRUSH_VERT, DECAY_FRAG, GRIT_FRAG, GRIT_VERT, PACK_FRAG, QUAD_VERT, STONE_FRAG } from "./shaders";

export type StoneHandle = { destroy(): void };
export type StoneOptions = {
  /** URLs (or data: URLs) of the three rock recordings: see audio.ts. */
  sounds?: StoneSounds;
};

// ---- the band's proportions, in logo units (logo.svg is 159 x 30)
const ICON_SCALE = 1.2;   // the mark is cut a little larger than the letters
const GAP_AFTER_WORD = 11;
const GAP_AFTER_ICON = 6;
const TILE_UNITS = WORD_BOX.w + GAP_AFTER_WORD + ICON_BOX.w * ICON_SCALE + GAP_AFTER_ICON;
const BAND_PAD = 40;      // px of plain stone above and below the band in its texture
const BAND_CENTRE = 0.437; // of the viewport height
const DRIFT_SECONDS = 95; // time for one tile to pass
const STEM_UNITS = 3.4;   // the wordmark's stroke width: every cut is this wide
const EDGE_SIGMA = 2.9;   // px over which a cut's edge can wander and chip (at scale 1)

const HEAL_SECONDS = 3.5;  // how long a cut across the logo's strip takes to close again
const HEAL_MARGIN = 26;    // px beyond the logo, above and below, that heal (before the strip was narrowed)
const HEAL_STRIP = 0.8;    // the healing strip's height, as a share of the one with that margin
const HEAL_MIN_MARGIN = 6; // ...but never so narrow that the tips of the mark stop healing
const HINT_DELAY = 500;
const MAX_CHIPS = 640;
const CHIP = 12; // floats per piece: x, y, vx, vy, size, life, span, drag, turn, spin, id, kind (0 stone, 1 powder)

// A stretch of the cursor's path, to be cut into the carve map.
type Op = { ax: number; ay: number; bx: number; by: number };
// A plant, drawn once to a small canvas (with its silhouette, for its shadow).
// ax, ay: where it is rooted, in the sprite. Sizes in CSS px.
type Sprite = { img: HTMLCanvasElement; shade: HTMLCanvasElement; ax: number; ay: number; w: number; h: number };
// One plant on the slab: x in stone space, turned by ang.
type Plant = { x: number; y: number; sprite: Sprite; ang: number; scale: number };

// What grows along the cracks besides moss: stonecrop, in tight mats of small
// rosettes. Mostly green; some flush pink and orange, as it does in strong sun
// (more of them on the teal stone, where they echo the orange and rose moss).
const FLORA = {
  limestone: { crop: ["#7f9f72", "#93b083", "#6f9068"], cropDark: "#3f5a44", cropTip: "#cbd8ae", flush: ["#b98f84", "#c9a08e"], flushTip: "#ead0ba", flushed: 0.12, shadow: "#2a1c08" },
  teal: { crop: ["#3f7a58", "#56906a", "#2f6a4e"], cropDark: "#17392f", cropTip: "#a9d6a8", flush: ["#d9827a", "#e79a86", "#cf6f86"], flushTip: "#f6cfae", flushed: 0.28, shadow: "#06181a" },
};

function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth tileable noise: several grids of random values, each finer than the last.
function fbmField(size: number, rnd: () => number, cells: number[], weights: number[]) {
  const layer = new Float32Array(size * size);
  cells.forEach((n, o) => {
    const grid = new Float32Array(n * n);
    for (let i = 0; i < grid.length; i++) grid[i] = rnd();
    const w = weights[o];
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * n, y0 = Math.floor(fy), ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty), ya = (y0 % n) * n, yb = ((y0 + 1) % n) * n;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * n, x0 = Math.floor(fx), tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx), xa = x0 % n, xb = (x0 + 1) % n;
        const top = grid[ya + xa] + (grid[ya + xb] - grid[ya + xa]) * sx;
        const bot = grid[yb + xa] + (grid[yb + xb] - grid[yb + xa]) * sx;
        layer[y * size + x] += (top + (bot - top) * sy) * w;
      }
    }
  });
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < layer.length; i++) { if (layer[i] < lo) lo = layer[i]; if (layer[i] > hi) hi = layer[i]; }
  for (let i = 0; i < layer.length; i++) layer[i] = (layer[i] - lo) / (hi - lo);
  return layer;
}
function pack(size: number, channels: (Float32Array | ((i: number) => number))[]) {
  const out = new Uint8Array(size * size * 4);
  channels.forEach((ch, c) => {
    for (let i = 0; i < size * size; i++) out[i * 4 + c] = Math.round(Math.min(1, Math.max(0, typeof ch === "function" ? ch(i) : ch[i])) * 255);
  });
  return out;
}
// Scattered holes of uneven size, tileable. Each is 1 at its centre.
function holesField(size: number, rnd: () => number, count: number, radius: () => number, hard: number) {
  const layer = new Float32Array(size * size);
  for (let k = 0; k < count; k++) {
    const cx = rnd() * size, cy = rnd() * size, rad = radius(), amp = 0.55 + rnd() * 0.45;
    const squash = 0.7 + rnd() * 0.6, th = rnd() * Math.PI, co = Math.cos(th), si = Math.sin(th);
    const reach = Math.ceil(rad * 2.5), x0 = Math.floor(cx), y0 = Math.floor(cy);
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      const px = x0 + dx - cx, py = y0 + dy - cy;
      const u = (px * co + py * si) / (rad * squash), v = (-px * si + py * co) / (rad / squash);
      // hard = 0: a soft dimple; higher: a hole with a floor and a definite rim
      const val = hard ? amp * Math.min(1, Math.max(0, (1 - Math.hypot(u, v)) * hard)) : amp * Math.exp(-(u * u + v * v));
      const i = ((((y0 + dy) % size) + size) % size) * size + ((((x0 + dx) % size) + size) % size);
      if (val > layer[i]) layer[i] = val;
    }
  }
  return layer;
}

// Tileable noise for the stone, made once: r grain, g mottle, b pits, a second grain.
function stoneNoise(size: number) {
  const rnd = mulberry(20261115);
  const grain = fbmField(size, rnd, [32, 64, 128, 256], [0.34, 0.30, 0.22, 0.14]);
  const mottle = fbmField(size, rnd, [3, 6, 12, 24, 48], [0.36, 0.26, 0.18, 0.12, 0.08]);
  const grain2 = fbmField(size, rnd, [16, 40, 96, 200, 256], [0.26, 0.24, 0.22, 0.16, 0.12]);
  const pits = holesField(size, rnd, 760, () => 0.9 + rnd() * rnd() * 3.4, 0);
  return pack(size, [grain, mottle, pits, grain2]);
}

// A second tileable texture, for what makes it rock rather than paper:
// r holes (a few large, many small), g cells (0 at a cell's border, 1 at its
// heart), b each cell's own random number.
function rockNoise(size: number) {
  const rnd = mulberry(4401);
  const holes = holesField(size, rnd, 2600, () => 0.7 + Math.pow(rnd(), 3) * 3.5, 1.3);
  const G = 40, cell = size / G;
  const sx = new Float32Array(G * G), sy = new Float32Array(G * G), id = new Float32Array(G * G);
  for (let i = 0; i < G * G; i++) { sx[i] = ((i % G) + rnd()) * cell; sy[i] = (Math.floor(i / G) + rnd()) * cell; id[i] = rnd(); }
  const border = new Float32Array(size * size), own = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    let d1 = 1e9, d2 = 1e9, who = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const cx = gx + ox, cy = gy + oy, wx = ((cx % G) + G) % G, wy = ((cy % G) + G) % G, k = wy * G + wx;
      const d = Math.hypot(sx[k] + (cx - wx) * cell - x, sy[k] + (cy - wy) * cell - y);
      if (d < d1) { d2 = d1; d1 = d; who = id[k]; } else if (d < d2) d2 = d;
    }
    border[y * size + x] = (d2 - d1) / (cell * 0.6);
    own[y * size + x] = who;
  }
  return pack(size, [holes, border, own]);
}

export function mountStone(root: HTMLElement, options: StoneOptions = {}): StoneHandle | null {
  const canvas = root.querySelector<HTMLCanvasElement>("[data-stone-canvas]");
  const hint = root.querySelector<HTMLElement>("[data-stone-hint]");
  const soundBtn = root.querySelector<HTMLButtonElement>("[data-stone-sound]");
  if (!canvas) return null;
  const maybeGl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!maybeGl) return null;
  const gl: WebGL2RenderingContext = maybeGl;

  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const audio = createStoneAudio(options.sounds);
  const teal = () => root.dataset.stone === "teal";
  // plants are drawn on their own canvas, over the stone and under the page's text
  const plants = document.createElement("canvas");
  plants.setAttribute("aria-hidden", "true");
  plants.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
  canvas.after(plants);
  const pg = plants.getContext("2d");

  // ------------------------------------------------------------ GL plumbing
  function program(vs: string, fs: string) {
    const p = gl.createProgram()!;
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) ?? "shader");
      gl.attachShader(p, sh);
    }
    gl.bindAttribLocation(p, 0, type0(vs));
    if (type0(vs) === "a_grit") gl.bindAttribLocation(p, 1, "a_look");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
    const u: Record<string, WebGLUniformLocation | null> = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i)!; u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  const type0 = (vs: string) => (vs.includes("a_grit") ? "a_grit" : "a_pos");

  function texture(w: number, h: number, repeatX: boolean, data: TexImageSource | Uint8Array | null = null, mips = false) {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (data && !(data instanceof Uint8Array)) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeatX ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, mips ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    if (mips) gl.generateMipmap(gl.TEXTURE_2D);
    return t;
  }
  function target(tex: WebGLTexture) {
    const f = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return f;
  }
  function bind(unit: number, tex: WebGLTexture, loc: WebGLUniformLocation | null) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(loc, unit);
  }

  type Prog = ReturnType<typeof program>;
  let pStone: Prog, pBlur: Prog, pPack: Prog, pBrush: Prog, pDecay: Prog, pGrit: Prog;
  let quad: WebGLVertexArrayObject, gritVao: WebGLVertexArrayObject, gritBuf: WebGLBuffer;
  let noiseTex: WebGLTexture, rockTex: WebGLTexture;
  let decorTex: WebGLTexture | null = null, shadeTex: WebGLTexture | null = null;
  let flora: Plant[] = [];
  let maskAt: (x: number, y: number) => boolean = () => false; // is this point of the slab inside the logo's shape?
  let floraTeal = false;
  let wordTex: WebGLTexture | null = null;
  let carveTex: WebGLTexture | null = null, carveFbo: WebGLFramebuffer | null = null;

  function setupStatic() {
    pStone = program(QUAD_VERT, STONE_FRAG);
    pBlur = program(QUAD_VERT, BLUR_FRAG);
    pPack = program(QUAD_VERT, PACK_FRAG);
    pBrush = program(BRUSH_VERT, BRUSH_FRAG);
    pDecay = program(QUAD_VERT, DECAY_FRAG);
    pGrit = program(GRIT_VERT, GRIT_FRAG);

    quad = gl.createVertexArray()!;
    gl.bindVertexArray(quad);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gritVao = gl.createVertexArray()!;
    gl.bindVertexArray(gritVao);
    gritBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, gritBuf);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_CHIPS * 28, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 16);
    gl.bindVertexArray(null);

    noiseTex = texture(512, 512, true, stoneNoise(512), true);
    rockTex = texture(512, 512, true, rockNoise(512), true);
  }

  // ------------------------------------------------------------ layout
  const L = { w: 0, h: 0, dpr: 1, unit: 8, tile: 1440, bandTop: 0, bandH: 0, period: 2880, scale: 1, carveScale: 1, r: 12 };
  let scroll = 0;

  function layout() {
    const w = Math.max(1, root.clientWidth), h = Math.max(1, root.clientHeight);
    if (w === L.w && h === L.h && wordTex) return;
    L.w = w; L.h = h;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const budget = 2.8e6; // pixels drawn per frame: the stone's shading is not cheap
    if (w * h * dpr * dpr > budget) dpr = Math.sqrt(budget / (w * h));
    L.dpr = dpr;
    canvas!.width = Math.round(w * dpr);
    canvas!.height = Math.round(h * dpr);
    plants.width = Math.round(w * dpr);
    plants.height = Math.round(h * dpr);
    L.unit = Math.max(w / TILE_UNITS, h / 135);
    L.tile = TILE_UNITS * L.unit;
    L.scale = Math.min(1.25, Math.max(0.6, L.unit / 8.2));
    L.r = (STEM_UNITS / 2) * L.unit;
    L.bandH = ICON_BOX.h * ICON_SCALE * L.unit + BAND_PAD * 2;
    L.bandTop = h * BAND_CENTRE - L.bandH / 2;
    L.period = L.tile * Math.max(1, Math.ceil((w + L.tile * 0.5) / L.tile));
    buildWord();
    buildCarve();
    buildShade();
    buildDecor();
    ops.length = 0;
  }

  // The band, cut from the logo's vector: one tile of "twotonery <mark>".
  function buildWord() {
    const maxTex = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, 4096);
    const k = Math.min(L.dpr, maxTex / L.tile);
    const tw = Math.max(2, Math.round(L.tile * k)), th = Math.max(2, Math.round(L.bandH * k));
    const c = document.createElement("canvas");
    c.width = tw; c.height = th;
    const g = c.getContext("2d")!;
    g.fillStyle = "#000"; g.fillRect(0, 0, tw, th);
    g.fillStyle = "#fff";
    // the footer art is cut a touch bolder than the nav logo, so fatten the outlines
    g.strokeStyle = "#fff"; g.lineJoin = "miter"; g.miterLimit = 6;
    const px = (tw / L.tile) * L.unit; // texels per logo unit
    const midY = th / 2;
    // letters: centred on the logo's own optical centre (y = 15)
    g.save();
    g.translate((GAP_AFTER_ICON / 2) * px, midY);
    g.scale(px, px);
    g.translate(-WORD_BOX.x, -15);
    g.lineWidth = 0.7;
    for (const d of WORD_PATHS) { const path = new Path2D(d); g.fill(path); g.stroke(path); }
    g.restore();
    // the mark
    g.save();
    g.translate((GAP_AFTER_ICON / 2 + WORD_BOX.w + GAP_AFTER_WORD) * px, midY);
    g.scale(px * ICON_SCALE, px * ICON_SCALE);
    g.translate(-ICON_BOX.x, -15);
    g.lineWidth = 1.0;
    for (const d of ICON_PATHS) { const path = new Path2D(d); g.fill(path); g.stroke(path); }
    g.restore();

    // a small copy to ask "is the logo here?" of, when laying out cracks and moss
    const small = document.createElement("canvas");
    small.width = Math.min(1024, tw); small.height = Math.max(1, Math.round((th * small.width) / tw));
    const sg = small.getContext("2d", { willReadFrequently: true })!;
    sg.drawImage(c, 0, 0, small.width, small.height);
    const seen = sg.getImageData(0, 0, small.width, small.height).data, mw = small.width, mh = small.height;
    maskAt = (x, y) => {
      const v = (y - L.bandTop) / L.bandH;
      if (v < 0 || v >= 1) return false;
      const u = (((x % L.tile) + L.tile) % L.tile) / L.tile;
      return seen[(Math.floor(v * mh) * mw + Math.floor(u * mw)) * 4] > 127;
    };

    const sharp = texture(tw, th, true, c);
    const tmp = texture(tw, th, true), tight = texture(tw, th, true), wide = texture(tw, th, true);
    const fTmp = target(tmp), fTight = target(tight), fWide = target(wide);
    gl.disable(gl.BLEND);
    gl.viewport(0, 0, tw, th);
    gl.bindVertexArray(quad);
    gl.useProgram(pBlur.p);
    const blur = (src: WebGLTexture, dst: WebGLFramebuffer, dx: number, dy: number, sigma: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst);
      bind(0, src, pBlur.u.u_tex);
      gl.uniform2f(pBlur.u.u_step, dx / tw, dy / th);
      gl.uniform1f(pBlur.u.u_sigma, sigma);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const sTight = EDGE_SIGMA * L.scale * k, sWide = 9 * L.scale * k;
    blur(sharp, fTmp, 1, 0, sTight); blur(tmp, fTight, 0, 1, sTight);
    blur(tight, fTmp, 1, 0, sWide); blur(tmp, fWide, 0, 1, sWide);

    if (wordTex) gl.deleteTexture(wordTex);
    wordTex = texture(tw, th, true);
    const fWord = target(wordTex);
    gl.useProgram(pPack.p);
    bind(0, tight, pPack.u.u_tight); bind(1, wide, pPack.u.u_wide); bind(2, sharp, pPack.u.u_sharp);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    for (const t of [sharp, tmp, tight, wide]) gl.deleteTexture(t);
    for (const f of [fTmp, fTight, fWide, fWord]) gl.deleteFramebuffer(f);
  }

  function buildCarve() {
    const maxTex = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, 4096);
    L.carveScale = Math.min(L.dpr, 1.5, maxTex / L.period);
    if (carveTex) gl.deleteTexture(carveTex);
    if (carveFbo) gl.deleteFramebuffer(carveFbo);
    carveTex = texture(Math.round(L.period * L.carveScale), Math.round(L.h * L.carveScale), true);
    carveFbo = target(carveTex);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // ------------------------------------------------------------ carving
  const ops: Op[] = [];
  let healCarry = 0, healUntil = 0, stripOpenUntil = 0;
  const carveTarget = () => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, carveFbo);
    gl.viewport(0, 0, Math.round(L.period * L.carveScale), Math.round(L.h * L.carveScale));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.bindVertexArray(quad);
  };

  function flushOps(now: number) {
    if (!ops.length || !carveFbo) return;
    carveTarget();
    gl.blendEquation(gl.MAX);
    gl.useProgram(pBrush.p);
    gl.uniform2f(pBrush.u.u_band, L.bandTop, L.bandH);
    gl.uniform1f(pBrush.u.u_pad, BAND_PAD);
    // the strip that heals: the logo's height and a margin above and below it
    const logoH = L.bandH - BAND_PAD * 2;
    const margin = Math.max(HEAL_MIN_MARGIN, ((logoH + HEAL_MARGIN * 2) * HEAL_STRIP - logoH) / 2);
    gl.uniform1f(pBrush.u.u_margin, margin);
    const stripTop = L.bandTop + BAND_PAD - margin, stripBottom = L.bandTop + L.bandH - BAND_PAD + margin;
    gl.uniform2f(pBrush.u.u_size, L.period, L.h);
    gl.uniform1f(pBrush.u.u_r, L.r);
    const reach = L.r * 2 + 2;
    for (const op of ops) {
      // a cut in the logo's strip will be closing for a while yet (it has a sound)
      if (Math.max(op.ay, op.by) + L.r > stripTop && Math.min(op.ay, op.by) - L.r < stripBottom) stripOpenUntil = now + HEAL_SECONDS;
      // bring the stroke into the map's first period, then draw the copy that
      // spills over either edge so the band stays seamless
      const base = Math.floor(Math.min(op.ax, op.bx) / L.period) * L.period;
      const ax = op.ax - base, bx = op.bx - base;
      for (const shift of [0, -L.period, L.period]) {
        const x0 = Math.min(ax, bx) - reach + shift, x1 = Math.max(ax, bx) + reach + shift;
        if (x1 < 0 || x0 > L.period) continue;
        gl.uniform4f(pBrush.u.u_rect, x0, Math.min(op.ay, op.by) - reach, x1, Math.max(op.ay, op.by) + reach);
        gl.uniform2f(pBrush.u.u_a, ax + shift, op.ay);
        gl.uniform2f(pBrush.u.u_b, bx + shift, op.by);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
    ops.length = 0;
    gl.disable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    healUntil = now + HEAL_SECONDS * 2.2;
  }

  // Cuts across the logo's strip close again: their channel shrinks a little each
  // frame, so the gap narrows to nothing and the logo's own shape is left.
  function heal(dt: number, now: number) {
    if (now > healUntil || !carveFbo) return;
    healCarry += (dt * 0.5 * 255) / HEAL_SECONDS;
    const step = Math.floor(healCarry);
    if (step < 1) return;
    healCarry -= step;
    carveTarget();
    gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
    gl.useProgram(pDecay.p);
    gl.uniform1f(pDecay.u.u_amount, step / 255);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
  }

  // ------------------------------------------------------------ leaf shadows
  // The shadows of branches somewhere out of frame, painted once per size in
  // the viewport's own shape: three layers, one per colour channel, so the
  // shader can sway each from its own root. Red: a bough across the top.
  // Green: one down the right side. Blue: a sprig in the bottom left corner.
  // (The roots here must match the ones the stone shader swings them from.)
  function buildShade() {
    const W = 1024, H = Math.max(384, Math.min(1536, Math.round((1024 * L.h) / L.w)));
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "lighter";
    g.lineCap = "round";
    const rnd = mulberry(5150);
    const leaf = (x: number, y: number, ang: number, len: number) => {
      const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
      const nx = -Math.sin(ang) * len * 0.2, ny = Math.cos(ang) * len * 0.2;
      const mx = x + (ex - x) * 0.45, my = y + (ey - y) * 0.45;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(mx + nx, my + ny, ex, ey);
      g.quadraticCurveTo(mx - nx, my - ny, x, y);
      g.fill();
    };
    // wood that wanders and thins, forks into twigs, and carries leaves in
    // pairs along its thinner parts and a tuft at each tip
    const bough = (x: number, y: number, ang: number, len: number, width: number, depth: number) => {
      const steps = Math.max(3, Math.round(len / (W * 0.018)));
      const seg = len / steps, curl = (rnd() - 0.5) * 0.05;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        ang += curl + (rnd() - 0.5) * 0.12;
        const nx = x + Math.cos(ang) * seg, ny = y + Math.sin(ang) * seg;
        g.lineWidth = Math.max(1, width * (1 - 0.8 * t));
        g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
        if (depth >= 1 || t > 0.45) for (const side of [-1, 1]) if (rnd() < 0.7) leaf(nx, ny, ang + side * (0.45 + rnd() * 0.7), W * (0.020 + rnd() * 0.022));
        if (depth < 3 && i > 0 && rnd() < 0.22) {
          bough(nx, ny, ang + (rnd() < 0.5 ? -1 : 1) * (0.4 + rnd() * 0.6), len * (1 - t) * (0.3 + rnd() * 0.3) + W * 0.04, width * (1 - 0.7 * t) * 0.6, depth + 1);
        }
        x = nx; y = ny;
      }
      for (let k = 0; k < 3; k++) leaf(x, y, ang + (k - 1) * 0.5 + (rnd() - 0.5) * 0.3, W * (0.022 + rnd() * 0.02));
    };
    g.fillStyle = g.strokeStyle = "#f00";
    bough(W * 1.03, -H * 0.06, 3.02, W * 0.86, W * 0.011, 0);
    bough(W * 0.55, -H * 0.06, 2.35, W * 0.30, W * 0.007, 1);
    g.fillStyle = g.strokeStyle = "#0f0";
    bough(W * 1.05, H * 0.22, 2.0, H * 0.62, W * 0.009, 0);
    g.fillStyle = g.strokeStyle = "#00f";
    bough(-W * 0.04, H * 0.97, -0.45, W * 0.20, W * 0.006, 1);
    if (shadeTex) gl.deleteTexture(shadeTex);
    shadeTex = texture(W, H, false, c, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  // ------------------------------------------------------------ cracks, moss, plants
  function sprite(w: number, h: number, ax: number, ay: number, shadow: string, draw: (g: CanvasRenderingContext2D) => void): Sprite {
    const k = Math.max(2, L.dpr); // drawn large, so they stay smooth when turned
    const img = document.createElement("canvas");
    img.width = Math.ceil(w * k); img.height = Math.ceil(h * k);
    const g = img.getContext("2d")!;
    g.scale(k, k);
    draw(g);
    const shade = document.createElement("canvas");
    shade.width = img.width; shade.height = img.height;
    const sg = shade.getContext("2d")!;
    sg.drawImage(img, 0, 0);
    sg.globalCompositeOperation = "source-in";
    sg.fillStyle = shadow; sg.fillRect(0, 0, shade.width, shade.height);
    return { img, shade, ax, ay, w, h };
  }
  const oval = (g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, 6.2832); g.fill(); };

  // Where the stone has cracked and what grows there, laid out once per size
  // and stone. Cracks and moss are painted into a texture the stone shader
  // reads (r = cracks, g and b = two kinds of moss); the stonecrop is sprites.
  //
  // The cracks are hairlines, and each has somewhere to come from: the top or
  // bottom edge of the slab, or the edge of the logo. None crosses the logo.
  function buildDecor() {
    const rnd = mulberry(7700 + Math.round(L.period));
    const onTeal = (floraTeal = teal());
    const pal = onTeal ? FLORA.teal : FLORA.limestone;
    const lushness = onTeal ? 1.8 : 1; // the teal stone is the mossier of the two
    const accent = onTeal ? 0.14 : 0.42; // how much of the moss is the second kind
    // drawn at the screen's own sharpness (up to 2x), so the hairlines stay smooth
    const maxW = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
    const k = Math.min(Math.max(1, Math.min(2, L.dpr)), maxW / L.period), big = Math.max(0.75, L.scale);
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(L.period * k)); c.height = Math.max(2, Math.round(L.h * k));
    const g = c.getContext("2d")!;
    g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "lighter";
    g.scale(k, k);
    g.lineCap = "round";
    const wrapped = (draw: () => void) => { for (const dx of [0, -L.period, L.period]) { g.save(); g.translate(dx, 0); draw(); g.restore(); } };
    // The cracks go on layers of their own, solid, so where their strokes
    // overlap they don't add up into beads; each is laid on once at the end.
    const layer = () => {
      const lc = document.createElement("canvas"); lc.width = c.width; lc.height = c.height;
      const lg = lc.getContext("2d")!; lg.scale(k, k); lg.lineCap = "round"; lg.lineJoin = "round"; lg.strokeStyle = "#f00";
      return { lc, lg };
    };
    const fine = layer(), soft = layer();
    // a crack's path, drawn as one smooth curve through the midpoints of its steps
    const strokeCrack = (pts: number[], wds: number[]) => {
      for (const [{ lg }, mul] of [[soft, 2.4], [fine, 1]] as const) for (const dx of [0, -L.period, L.period]) {
        lg.save(); lg.translate(dx, 0);
        for (let i = 1; i < pts.length / 2; i++) {
          const ax = i === 1 ? pts[0] : (pts[2 * i - 4] + pts[2 * i - 2]) / 2, ay = i === 1 ? pts[1] : (pts[2 * i - 3] + pts[2 * i - 1]) / 2;
          const last = i === pts.length / 2 - 1;
          const bx = last ? pts[2 * i] : (pts[2 * i - 2] + pts[2 * i]) / 2, by = last ? pts[2 * i + 1] : (pts[2 * i - 1] + pts[2 * i + 1]) / 2;
          lg.lineWidth = wds[i - 1] * mul;
          lg.beginPath(); lg.moveTo(ax, ay); lg.quadraticCurveTo(pts[2 * i - 2], pts[2 * i - 1], bx, by); lg.stroke();
        }
        lg.restore();
      }
    };
    const moss = (x: number, y: number, r: number, a: number, second: boolean) => wrapped(() => {
      const grad = g.createRadialGradient(x, y, 0, x, y, r), rgb = second ? "0,0,255" : "0,255,0";
      grad.addColorStop(0, `rgba(${rgb},${a})`); grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
    });
    const cushion = (x: number, y: number, n: number, sx: number, sy: number, second: boolean) => {
      for (let i = 0; i < n; i++) moss(x + (rnd() + rnd() + rnd() - 1.5) * sx, y + (rnd() + rnd() - 1) * sy, (7 + rnd() * 9) * big, 0.5 + rnd() * 0.35, second);
    };

    // ---- stonecrop: a rosette of fleshy leaves in three rings, each leaf dark
    // at its base and pale at its tip. A few are drawn once and reused.
    const crop = (r: number, tones: readonly string[], tip: string) => sprite(r * 2 + 6, r * 2 + 6, r + 3, r + 3, pal.shadow, (q) => {
      const cx = r + 3, cy = r + 3, turn = rnd() * 6.3;
      q.fillStyle = pal.cropDark; oval(q, cx, cy, r * 0.8, r * 0.8, 0);
      for (const [count, at, long, wide] of [[9, 0.60, 0.42, 0.23], [7, 0.36, 0.34, 0.20], [5, 0.16, 0.22, 0.15]] as const) {
        for (let i = 0; i < count; i++) {
          const a = turn + ((i + (count === 7 ? 0.5 : 0)) / count) * 6.2832 + (rnd() - 0.5) * 0.3;
          const reach = r * at * (0.9 + rnd() * 0.2), px = cx + Math.cos(a) * reach, py = cy + Math.sin(a) * reach;
          const dx = Math.cos(a) * r * long, dy = Math.sin(a) * r * long;
          const grad = q.createLinearGradient(px - dx, py - dy, px + dx, py + dy);
          grad.addColorStop(0, pal.cropDark); grad.addColorStop(0.45, tones[Math.floor(rnd() * tones.length)]); grad.addColorStop(1, tip);
          q.fillStyle = grad; oval(q, px, py, r * long, r * wide * (0.85 + rnd() * 0.3), a);
        }
      }
    });
    const green = [4.5, 5.5, 7, 8.5].map((r) => crop(r * big, pal.crop, pal.cropTip));
    const flushed = [5, 6.5].map((r) => crop(r * big, pal.flush, pal.flushTip));
    const pick = <T,>(list: T[]) => list[Math.floor(rnd() * list.length)];
    flora = [];
    // a mat of rosettes packed along a stretch of crack
    const mat = (x: number, y: number, along: number) => {
      const count = 6 + Math.floor(rnd() * 10), co = Math.cos(along), si = Math.sin(along);
      for (let i = 0; i < count; i++) {
        const u = (rnd() + rnd() - 1) * 17 * big, v = (rnd() + rnd() - 1) * 6 * big;
        flora.push({ x: x + co * u - si * v, y: y + si * u + co * v, sprite: pick(rnd() < pal.flushed ? flushed : green), ang: rnd() * 6.3, scale: 0.8 + rnd() * 0.4 });
      }
    };

    // A crack: a hairline that wanders, pulled gently back toward the way it
    // set out, fading as it goes, with the odd short fork. Moss follows it in
    // patches, not all the way along, and here and there stonecrop has rooted.
    const crack = (x: number, y: number, heading: number, length: number, lush: number, stop?: (x: number, y: number) => boolean) => {
      const steps = Math.max(2, Math.round(length / 4));
      const pts = [x, y], wds: number[] = [];
      let ang = heading, mossy = rnd() < 0.7, second = rnd() < accent, untilSwap = 20 + rnd() * 60, untilMat = (30 + rnd() * 90) * big;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        ang += (rnd() - 0.5) * 0.42 + (heading - ang) * 0.10;
        if (rnd() < 0.06) ang += (rnd() - 0.5) * 1.0; // a kink
        const nx = x + Math.cos(ang) * 4, ny = y + Math.sin(ang) * 4;
        if (stop?.(nx, ny)) break;
        wds.push(Math.max(0.5, 1.5 * big * (1 - 0.8 * t)));
        pts.push(nx, ny);
        if ((untilSwap -= 4) < 0) { mossy = mossy ? rnd() < 0.55 : true; second = rnd() < accent; untilSwap = 25 + rnd() * 70; }
        if (mossy && rnd() < 0.8 * lush) moss(nx + (rnd() - 0.5) * 6, ny + (rnd() - 0.5) * 6, (6 + rnd() * 8) * big, 0.5 + rnd() * 0.35, second);
        if (mossy && rnd() < 0.06 * lush) moss(nx + (rnd() - 0.5) * 22, ny + (rnd() - 0.5) * 16, (13 + rnd() * 11) * big, 0.7, second);
        if ((untilMat -= 4) < 0) { untilMat = ((70 + rnd() * 150) * big) / lush; if (rnd() < 0.75) mat(nx, ny, ang); }
        if (length > 50 && rnd() < 0.035) crack(nx, ny, ang + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.5), length * (1 - t) * 0.45, lush * 0.7, stop);
        x = nx; y = ny;
      }
      strokeCrack(pts, wds);
    };
    // where the logo's outline is first met at x, coming in from above or below
    const logoEdge = (x: number, fromAbove: boolean) => {
      for (let i = 2; i < L.bandH - 2; i += 2) {
        const y = fromAbove ? L.bandTop + i : L.bandTop + L.bandH - i;
        if (maskAt(x, y)) return y;
      }
      return null;
    };
    const stripTop = L.bandTop + BAND_PAD - 18, stripBottom = L.bandTop + L.bandH - BAND_PAD + 18;
    const inLogoStrip = (_: number, y: number) => y > stripTop && y < stripBottom;

    const tiles = Math.round(L.period / L.tile);
    for (let j = 0; j < tiles; j++) {
      const X0 = j * L.tile, across = () => X0 + rnd() * L.tile;
      // in from the top edge, where the branches keep the stone shaded and moss does best
      for (let i = 0; i < 3; i++) crack(X0 + L.tile * ((i + 0.15 + rnd() * 0.7) / 3), -3, Math.PI / 2 + (rnd() - 0.5) * 0.9, L.h * (0.08 + rnd() * 0.13), 1.2 * lushness, inLogoStrip);
      // in from the foot of the slab
      for (let i = 0; i < 2; i++) crack(X0 + L.tile * ((i + 0.15 + rnd() * 0.7) / 2), L.h + 3, -Math.PI / 2 + (rnd() - 0.5) * 0.9, L.h * (0.04 + rnd() * 0.06), 0.8 * lushness);
      // out from the logo's edge, upward and downward, never across it
      for (let i = 0; i < 5; i++) {
        const x = across(), above = i < 3, y = logoEdge(x, above);
        if (y === null) continue;
        crack(x, y + (above ? -1 : 1), (above ? -1 : 1) * Math.PI / 2 + (rnd() - 0.5) * 1.1, (40 + rnd() * 75) * big, 0.9 * lushness, (cx, cy) => maskAt(cx, cy));
      }
      // moss creeping in over the shaded top edge, and a few loose cushions below it
      for (let i = 0; i < Math.round(3 * lushness); i++) cushion(across(), L.h * 0.008, 12 + Math.floor(rnd() * 10), 42 * big, 10 * big, rnd() < accent);
      for (let i = 0; i < Math.round(3 * lushness); i++) cushion(across(), L.h * (0.04 + rnd() * 0.13), 4 + Math.floor(rnd() * 5), 16 * big, 10 * big, rnd() < accent);
      // a little on the logo itself: in the hollows, tucked under the walls that shade them
      let spots = 0;
      for (let tries = 0; tries < 400 && spots < (onTeal ? 6 : 4); tries++) {
        const x = across(), y = L.bandTop + BAND_PAD + rnd() * (L.bandH - BAND_PAD * 2);
        if (!maskAt(x, y) || maskAt(x - 0.757 * 7 * big, y - 0.653 * 7 * big)) continue;
        spots++;
        const second = rnd() < accent;
        for (let i = 0, n = 3 + Math.floor(rnd() * 3); i < n; i++) moss(x + (rnd() - 0.5) * 14, y + (rnd() - 0.5) * 10, (4 + rnd() * 5) * big, 0.6 + rnd() * 0.3, second);
      }
    }
    // a faint wider line under a fine one, so each crack has a soft edge
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 0.18; g.drawImage(soft.lc, 0, 0);
    g.globalAlpha = 0.7; g.drawImage(fine.lc, 0, 0);
    g.globalAlpha = 1;
    if (decorTex) gl.deleteTexture(decorTex);
    decorTex = texture(c.width, c.height, true, c);
  }

  // The stonecrop, each rosette with its shadow on the stone behind it. It
  // rides the slab as it drifts.
  function drawPlants() {
    if (!pg) return;
    pg.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    pg.clearRect(0, 0, L.w, L.h);
    for (const pass of [0, 1]) for (const pl of flora) {
      const sp = pl.sprite, reach = Math.max(sp.w, sp.h) * pl.scale + 8;
      const x = ((((pl.x - scroll) % L.period) + L.period) % L.period);
      for (const sx of [x, x - L.period]) {
        if (sx < -reach || sx > L.w + reach) continue;
        pg.save();
        pg.translate(sx + (pass ? 0 : 2.2), pl.y + (pass ? 0 : 1.8)); // the shadow falls down and to the right
        pg.rotate(pl.ang);
        pg.scale(pl.scale, pl.scale);
        pg.globalAlpha = pass ? 1 : 0.3;
        pg.drawImage(pass ? sp.img : sp.shade, -sp.ax, -sp.ay, sp.w, sp.h);
        pg.restore();
      }
    }
  }

  // ------------------------------------------------------------ debris
  const chips = new Float32Array(MAX_CHIPS * CHIP);
  const chipOut = new Float32Array(MAX_CHIPS * 7);
  let chipNext = 0;
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 1.15;
  // Broken stone thrown ahead of the hand, not all round it: mostly grit, some
  // chips, the odd pebble, and a little powder. Pieces shoot out, tumble, and
  // come to rest on the slab for a moment; most fall short, a few skitter far.
  function throwChips(x: number, y: number, ux: number, uy: number, speed: number, count: number, spread: number) {
    if (still) return;
    const heading = Math.atan2(uy, ux), big = Math.max(0.8, L.scale);
    for (let i = 0; i < count; i++) {
      const o = chipNext * CHIP; chipNext = (chipNext + 1) % MAX_CHIPS;
      const roll = Math.random();
      const powder = roll < 0.10;
      const ang = heading + gauss() * spread * (powder ? 0.6 : 1);
      const far = Math.pow(Math.random(), 2.4);
      const side = (Math.random() * 2 - 1) * L.r, ahead = (0.2 + Math.random() * 0.9) * L.r;
      chips[o] = x + ux * ahead - uy * side; chips[o + 1] = y + uy * ahead + ux * side;
      let v: number;
      if (powder) {
        v = 20 + speed * 0.12 * Math.random();
        chips[o + 4] = (7 + Math.random() * 10) * big;
        chips[o + 6] = 0.45 + Math.random() * 0.6;
        chips[o + 7] = 2.5;
      } else {
        // grit under 2 px, chips to 5, pebbles to 9: the bigger the piece, the shorter it flies
        const size = roll < 0.62 ? 0.8 + Math.random() * 1.1 : roll < 0.94 ? 1.9 + Math.random() * 3 : 5 + Math.random() * 4;
        v = Math.min(1300, (40 + speed * (0.3 + 1.7 * far) + Math.random() * 60) * (1.25 - size * 0.08));
        chips[o + 4] = size * big;
        chips[o + 6] = 0.5 + Math.random() * 1.2 + size * 0.12 + far * 0.3;
        chips[o + 7] = 5 + Math.random() * 6;
      }
      chips[o + 2] = Math.cos(ang) * v; chips[o + 3] = Math.sin(ang) * v;
      chips[o + 5] = chips[o + 6];
      chips[o + 8] = Math.random() * 6.283; chips[o + 9] = (Math.random() - 0.5) * 0.09;
      chips[o + 10] = Math.random();
      chips[o + 11] = powder ? 1 : 0;
    }
  }
  function drawChips(dt: number) {
    let n = 0;
    const drift = driftSpeed() * dt;
    for (let i = 0; i < MAX_CHIPS; i++) {
      const o = i * CHIP;
      if (chips[o + 5] <= 0) continue;
      chips[o + 5] -= dt;
      const drag = Math.exp(-dt * chips[o + 7]);
      chips[o + 2] *= drag; chips[o + 3] *= drag;
      const vx = chips[o + 2], vy = chips[o + 3];
      chips[o] += vx * dt - drift; chips[o + 1] += vy * dt;
      chips[o + 8] += chips[o + 9] * Math.hypot(vx, vy) * dt * 4; // they tumble only while they travel
      const left = Math.max(0, chips[o + 5]), spent = 1 - left / chips[o + 6];
      const q = n * 7;
      chipOut[q] = chips[o]; chipOut[q + 1] = chips[o + 1];
      if (chips[o + 11]) {
        chipOut[q + 2] = chips[o + 4] * (0.6 + 1.3 * spent);                 // powder spreads as it thins
        chipOut[q + 3] = 0.22 * Math.min(1, spent / 0.12) * Math.pow(1 - spent, 1.3);
      } else {
        chipOut[q + 2] = chips[o + 4];                                        // stone keeps its size; it lies there, then is gone
        chipOut[q + 3] = Math.min(1, left / 0.35);
      }
      chipOut[q + 4] = chips[o + 8]; chipOut[q + 5] = chips[o + 10]; chipOut[q + 6] = chips[o + 11];
      n++;
    }
    if (!n) return;
    gl.useProgram(pGrit.p);
    gl.bindVertexArray(gritVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gritBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, chipOut, 0, n * 7);
    gl.uniform2f(pGrit.u.u_res, L.w, L.h);
    gl.uniform1f(pGrit.u.u_dpr, L.dpr);
    gl.uniform1f(pGrit.u.u_teal, teal() ? 1 : 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.disable(gl.BLEND);
  }

  // ------------------------------------------------------------ the hand
  // x, y: where the pointer is on screen. sx, sy: where it last touched the
  // stone. fresh: the next touch starts a new cut instead of joining the last.
  const hand = { x: 0, y: 0, known: false, down: false, mouse: true, sx: 0, sy: 0, dirX: 1, dirY: 0, speed: 0, lastMove: 0, fresh: true };
  const pill = { x: 0, y: 0, placed: false };
  let armed = false; // carving is off until a click turns it on
  let invited = false;
  const driftSpeed = () => (still ? 0 : L.tile / DRIFT_SECONDS);

  function local(e: PointerEvent) {
    const r = root.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  }
  // the pill trails the cursor with a little give, whenever carving is off
  function followHint(dt: number) {
    if (!hint || armed || !hand.known || !hand.mouse) return;
    const tx = Math.max(8, Math.min(hand.x + 16, L.w - hint.offsetWidth - 8));
    const ty = Math.max(8, Math.min(hand.y + 22, L.h - hint.offsetHeight - 8));
    if (!pill.placed) { pill.x = tx; pill.y = ty; pill.placed = true; hint.style.left = "0"; hint.style.top = "0"; hint.dataset.follow = ""; }
    const k = 1 - Math.exp(-dt * 13);
    pill.x += (tx - pill.x) * k; pill.y += (ty - pill.y) * k;
    hint.style.translate = `${pill.x.toFixed(1)}px ${pill.y.toFixed(1)}px`;
  }
  function setArmed(on: boolean) {
    armed = on;
    if (on) { hand.fresh = true; delete root.dataset.hint; root.dataset.armed = ""; }
    else { delete root.dataset.armed; if (invited) root.dataset.hint = "on"; }
  }
  // Cut from where the hand last touched the stone to (sx, sy).
  function cutTo(sx: number, sy: number) {
    ops.push(hand.fresh ? { ax: sx, ay: sy, bx: sx, by: sy } : { ax: hand.sx, ay: hand.sy, bx: sx, by: sy });
    hand.fresh = false;
  }

  function onMove(e: PointerEvent) {
    const [x, y] = local(e);
    const nowMs = performance.now();
    hand.mouse = e.pointerType === "mouse";
    const sx = x + scroll, sy = y;
    if (!hand.known) {
      if (!hand.mouse && !hand.down) return; // a finger carves only while it is on the glass
      hand.known = true; hand.fresh = true; hand.x = x; hand.y = y; hand.sx = sx; hand.sy = sy; hand.lastMove = nowMs;
      return;
    }
    const dx = sx - hand.sx, dy = sy - hand.sy, dist = Math.hypot(dx, dy);
    if (dist < 0.5) return;
    const dt = Math.max(4, nowMs - hand.lastMove) / 1000;
    const inst = Math.min(3000, dist / dt);
    hand.speed += (inst - hand.speed) * 0.35;
    hand.dirX += (dx / dist - hand.dirX) * 0.5; hand.dirY += (dy / dist - hand.dirY) * 0.5;
    if (armed) {
      cutTo(sx, sy);
      const len = Math.hypot(hand.dirX, hand.dirY) || 1;
      const share = 0.4 * (0.35 + Math.min(1, inst / 900));
      let count = Math.floor(dist * share);
      if (Math.random() < dist * share - count) count++;
      throwChips(x, y, hand.dirX / len, hand.dirY / len, inst, Math.min(count, 16), 0.42);
    }
    hand.x = x; hand.y = y; hand.sx = sx; hand.sy = sy; hand.lastMove = nowMs;
  }
  function onDown(e: PointerEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button, a")) return; // the page's own controls are not the stone
    const [x, y] = local(e);
    hand.mouse = e.pointerType === "mouse";
    if (!hand.known || !hand.mouse) hand.fresh = true;
    hand.known = true; hand.down = true; hand.x = x; hand.y = y;
    hand.lastMove = performance.now();
    try { root.setPointerCapture(e.pointerId); } catch { /* not capturable; carving still works */ }
    audio.unlock();
    // A click turns carving on, the next turns it off. A finger has no hover,
    // so its first touch turns carving on and it then carves while it is down.
    if (hand.mouse) setArmed(!armed);
    else if (!armed) setArmed(true);
    if (armed && hand.fresh) {
      cutTo(x + scroll, y);
      const len = Math.hypot(hand.dirX, hand.dirY) || 1;
      throwChips(x, y, hand.dirX / len, hand.dirY / len, 220, 14, 3.2);
    }
    hand.sx = x + scroll; hand.sy = y;
  }
  function onUp(e: PointerEvent) {
    hand.down = false;
    audio.unlock(); // touch only counts as a gesture once the finger lifts
    if (e.pointerType !== "mouse") hand.known = false;
  }
  function onLeave(e: PointerEvent) {
    if (e.pointerType === "mouse" && !hand.down) hand.known = false;
  }

  let muted = false;
  function onSound(e: Event) {
    e.stopPropagation();
    muted = !muted;
    audio.setMuted(muted);
    audio.unlock();
    if (soundBtn) {
      soundBtn.setAttribute("aria-pressed", String(!muted));
      soundBtn.dataset.muted = String(muted);
    }
  }

  // ------------------------------------------------------------ frame
  let raf = 0, last = 0, lost = false;
  function frame(tms: number) {
    raf = requestAnimationFrame(frame);
    if (lost) return;
    const now = tms / 1000;
    const dt = Math.min(0.05, last ? now - last : 0.016);
    last = now;
    layout();
    if (teal() !== floraTeal) buildDecor(); // the other stone grows different things
    scroll += driftSpeed() * dt;
    // the slab keeps moving under a cursor that is held still, and it keeps cutting
    if (hand.known) {
      const sx = hand.x + scroll;
      if (armed) cutTo(sx, hand.y);
      hand.sx = sx; hand.sy = hand.y;
    }

    if (performance.now() - hand.lastMove > 45) hand.speed *= Math.exp(-dt / 0.09);
    // loudest while the cursor cuts as it moves; softer while stone closes over
    // the logo; softest while the cursor rests, still cutting where it stands
    const moving = armed ? Math.pow(Math.min(1, hand.speed / 900), 0.7) : 0;
    // the sound of the stone closing fades as the gap narrows: quieter the smaller it gets
    const closing = Math.max(0, Math.min(1, (stripOpenUntil - now) / HEAL_SECONDS));
    audio.setLevels({ carve: moving, heal: closing ** 1.4, idle: armed && hand.known ? 1 - Math.min(1, moving * 3) : 0 });
    followHint(dt);

    flushOps(now);
    heal(dt, now);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas!.width, canvas!.height);
    gl.useProgram(pStone.p);
    gl.bindVertexArray(quad);
    bind(0, noiseTex, pStone.u.u_stone);
    bind(1, wordTex!, pStone.u.u_word);
    bind(2, carveTex!, pStone.u.u_carve);
    bind(3, rockTex, pStone.u.u_rock);
    bind(4, shadeTex!, pStone.u.u_shade);
    bind(5, decorTex!, pStone.u.u_decor);
    gl.uniform1f(pStone.u.u_teal, floraTeal ? 1 : 0);
    gl.uniform1f(pStone.u.u_sway, still ? 0 : now % 4000);
    gl.uniform2f(pStone.u.u_res, L.w, L.h);
    gl.uniform1f(pStone.u.u_dpr, L.dpr);
    gl.uniform1f(pStone.u.u_scroll, scroll);
    gl.uniform1f(pStone.u.u_tile, L.tile);
    gl.uniform2f(pStone.u.u_band, L.bandTop, L.bandH);
    gl.uniform1f(pStone.u.u_period, L.period);
    gl.uniform1f(pStone.u.u_scale, L.scale);
    // a cone falls 1/(2r) per px; the logo's blurred edge about 0.4/sigma
    gl.uniform1f(pStone.u.u_edge, (2 * L.r * 0.4) / (EDGE_SIGMA * L.scale));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    drawChips(dt);
    drawPlants();
    if (!root.dataset.live) root.dataset.live = "";
  }

  function onLost(e: Event) { e.preventDefault(); lost = true; }
  function onRestored() {
    wordTex = null; carveTex = null; carveFbo = null; decorTex = null; shadeTex = null; L.w = 0;
    setupStatic();
    lost = false;
  }

  try {
    setupStatic();
    // start with the band placed as in the design: the mark near the middle.
    // An upright screen (a phone) starts on the name instead, from its first letter,
    // since the whole name is wider than a phone.
    layout();
    scroll = L.w < L.h
      ? (GAP_AFTER_ICON / 2) * L.unit - L.w * 0.07
      : (GAP_AFTER_ICON / 2 + WORD_BOX.w + GAP_AFTER_WORD + (ICON_BOX.w * ICON_SCALE) / 2) * L.unit - L.w * 0.5;
  } catch (err) {
    console.warn("stone: falling back to the still image", err);
    plants.remove();
    return null;
  }

  if (hint && coarse) hint.textContent = "Tap to carve";
  const hintTimer = window.setTimeout(() => { invited = true; if (!armed) root.dataset.hint = "on"; }, HINT_DELAY);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", onUp);
  // Phones only let sound start from a tap, and count different moments as one:
  // listen for all of them, anywhere on the page, with the sound already loaded.
  const wake = () => audio.unlock();
  const WAKE = ["touchend", "click", "keydown"] as const;
  for (const type of WAKE) document.addEventListener(type, wake, { capture: true, passive: true });
  audio.prepare();
  root.addEventListener("pointerleave", onLeave);
  soundBtn?.addEventListener("click", onSound);
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.clearTimeout(hintTimer);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointerup", onUp);
      for (const type of WAKE) document.removeEventListener(type, wake, { capture: true });
      root.removeEventListener("pointercancel", onUp);
      root.removeEventListener("pointerleave", onLeave);
      soundBtn?.removeEventListener("click", onSound);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      audio.destroy();
      plants.remove();
      delete root.dataset.live; delete root.dataset.hint; delete root.dataset.armed;
    },
  };
}
