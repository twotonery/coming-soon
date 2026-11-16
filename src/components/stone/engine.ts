// The stone slab: a relief the browser lights in real time, so the wordmark
// and everything the visitor cuts sit in one surface under one sun.
//
// The stone is limestone in evening sun, with a palm's shadow swaying over one
// corner, a little moss and wild grass, and a few small cracks.
//
// Nothing answers the cursor until the first click. From then on, wherever the
// cursor goes it carves, at the logo's own stroke width, depth and edge, and
// throws chips and dust ahead. Cuts last until the page is reloaded.
//
// It keeps a "carve map" the size of the slab (see BRUSH_FRAG). The slab drifts
// sideways as an endless band, and the carve map, cracks, moss and grass all
// wrap with it.
//
// data-look="before" on the root shows the earlier lighting (a round pool of
// sun, no plants or cracks), kept for comparing the two.
//
// Framework-free on purpose: mountStone() is handed a root element holding
//   canvas[data-stone-canvas], [data-stone-hint], button[data-stone-sound]
// and returns null when WebGL2 isn't there (the still image underneath stays).

import { createStoneAudio } from "./audio";
import { ICON_BOX, ICON_PATHS, WORD_BOX, WORD_PATHS } from "./logo";
import { BLUR_FRAG, BRUSH_FRAG, BRUSH_VERT, GRIT_FRAG, GRIT_VERT, PACK_FRAG, QUAD_VERT, STONE_FRAG } from "./shaders";

export type StoneHandle = { destroy(): void };
export type StoneOptions = {
  /** The hover sound: a URL (or data: URL) of the rocks-tumbling recording. */
  rollUrl?: string;
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

const HINT_DELAY = 500;
const MAX_CHIPS = 640;
const CHIP = 12; // floats per piece: x, y, vx, vy, size, life, span, drag, turn, spin, id, kind (0 stone, 1 powder)

// A stretch of the cursor's path, to be cut into the carve map.
type Op = { ax: number; ay: number; bx: number; by: number };
type Blade = { dx: number; h: number; lean: number; w: number; tone: number; phase: number; seeds: boolean };
type Tuft = { x: number; y: number; blades: Blade[] };

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
  const audio = createStoneAudio(options.rollUrl);
  const before = () => root.dataset.look === "before";
  // grass is drawn on its own canvas, over the stone and under the page's text
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
  let pStone: Prog, pBlur: Prog, pPack: Prog, pBrush: Prog, pGrit: Prog;
  let quad: WebGLVertexArrayObject, gritVao: WebGLVertexArrayObject, gritBuf: WebGLBuffer;
  let noiseTex: WebGLTexture, rockTex: WebGLTexture, leafTex: WebGLTexture;
  let decorTex: WebGLTexture | null = null;
  let tufts: Tuft[] = [];
  let wordTex: WebGLTexture | null = null;
  let carveTex: WebGLTexture | null = null, carveFbo: WebGLFramebuffer | null = null;

  function setupStatic() {
    pStone = program(QUAD_VERT, STONE_FRAG);
    pBlur = program(QUAD_VERT, BLUR_FRAG);
    pPack = program(QUAD_VERT, PACK_FRAG);
    pBrush = program(BRUSH_VERT, BRUSH_FRAG);
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
    buildLeaf();
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

  function flushOps() {
    if (!ops.length || !carveFbo) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, carveFbo);
    gl.viewport(0, 0, Math.round(L.period * L.carveScale), Math.round(L.h * L.carveScale));
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(pBrush.p);
    gl.bindVertexArray(quad);
    gl.uniform2f(pBrush.u.u_size, L.period, L.h);
    gl.uniform1f(pBrush.u.u_r, L.r);
    const reach = L.r * 2 + 2;
    for (const op of ops) {
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
  }

  // ------------------------------------------------------------ leaves, moss, cracks, grass
  // The shadow of one palm frond, drawn once: white leaf on black, its stem at
  // the middle of the left edge, reaching right. The shader lays it over the
  // slab (softened, since the palm is some way off) and sways it.
  function buildLeaf() {
    const S = 1024, c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    g.fillStyle = "#000"; g.fillRect(0, 0, S, S);
    g.fillStyle = "#fff"; g.strokeStyle = "#fff";
    const rnd = mulberry(9102);
    const x0 = 0.04 * S, len = 0.92 * S, mid = S / 2;
    const rib = (t: number) => [x0 + len * t, mid + len * 0.10 * t * t] as const; // it sags toward the tip
    g.lineWidth = S * 0.006;
    g.beginPath();
    for (let t = 0; t <= 1.001; t += 0.02) g.lineTo(...rib(t));
    g.stroke();
    const N = 46;
    for (let i = 0; i < N; i++) {
      const t = 0.06 + (0.92 * i) / (N - 1);
      const [bx, by] = rib(t);
      // leaflets are short near the stem and at the tip, and sweep forward
      const reach = len * 0.30 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.08)), 0.6) * (0.85 + rnd() * 0.3);
      for (const side of [-1, 1]) {
        if (rnd() < 0.06) continue; // one missing here and there
        const ang = side * (1.15 - 0.55 * t + (rnd() - 0.5) * 0.16);
        const droop = reach * (0.18 + rnd() * 0.2);
        const ex = bx + Math.cos(ang) * reach, ey = by + Math.sin(ang) * reach + droop * (side > 0 ? 0.5 : 0.15);
        const nx = -Math.sin(ang), ny = Math.cos(ang), wd = len * 0.011 * (0.8 + rnd() * 0.5);
        const mx = (bx + ex) / 2, my = (by + ey) / 2 + droop * 0.15;
        g.beginPath();
        g.moveTo(bx, by);
        g.quadraticCurveTo(mx + nx * wd, my + ny * wd, ex, ey);
        g.quadraticCurveTo(mx - nx * wd, my - ny * wd, bx, by);
        g.fill();
      }
    }
    leafTex = texture(S, S, false, c, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  // What grows on the slab and where it has cracked, laid out once per size
  // and painted into a texture the stone shader reads: r = cracks, g = moss.
  // Kept to the slab's edges, clear of the wordmark and the copy, and sparse.
  function buildDecor() {
    const rnd = mulberry(7700 + Math.round(L.period));
    const k = Math.min(1, 2048 / L.period), big = Math.max(0.75, L.scale);
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(L.period * k)); c.height = Math.max(2, Math.round(L.h * k));
    const g = c.getContext("2d")!;
    g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "lighter";
    g.scale(k, k);
    g.lineCap = "round";
    const wrapped = (draw: () => void) => { for (const dx of [0, -L.period, L.period]) { g.save(); g.translate(dx, 0); draw(); g.restore(); } };
    const moss = (x: number, y: number, r: number, a: number) => wrapped(() => {
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(0,255,0,${a})`); grad.addColorStop(1, "rgba(0,255,0,0)");
      g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
    });
    const clump = (x: number, y: number, n: number, sx: number, sy: number) => {
      for (let i = 0; i < n; i++) moss(x + (rnd() + rnd() + rnd() - 1.5) * sx, y + (rnd() + rnd() - 1) * sy, (6 + rnd() * 12) * big, 0.3 + rnd() * 0.3);
    };
    const tuft = (x: number, y: number, tall: number, n: number) => {
      const blades: Blade[] = [];
      for (let i = 0; i < n; i++) blades.push({
        dx: (rnd() + rnd() - 1) * 9 * big, h: tall * (0.45 + 0.55 * rnd()), lean: (rnd() + rnd() - 1) * 0.55,
        w: (1.7 + rnd() * 1.7) * big, tone: rnd(), phase: rnd() * 6.3, seeds: rnd() < 0.22,
      });
      tufts.push({ x, y, blades });
      clump(x, y, 5, 10 * big, 4 * big); // grass grows out of a little moss
    };
    // a crack: a wandering line that thins as it goes, now and then forking
    const crack = (x: number, y: number, ang: number, length: number, width: number, onPoint?: (x: number, y: number, t: number) => void) => {
      const steps = Math.max(2, Math.round(length / 5));
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        ang += (rnd() - 0.5) * 0.4;
        if (rnd() < 0.08) ang += (rnd() - 0.5) * 1.3; // a kink
        const nx = x + Math.cos(ang) * 5, ny = y + Math.sin(ang) * 5;
        const x0 = x, y0 = y;
        const wd = Math.max(0.7, width * (1 - 0.75 * t));
        wrapped(() => {
          // a faint wide stroke under a fine one, so the line has a soft edge
          for (const [mul, a] of [[2.6, 0.22], [1, 0.75]] as const) {
            g.strokeStyle = `rgba(255,0,0,${a})`; g.lineWidth = wd * mul; g.beginPath(); g.moveTo(x0, y0); g.lineTo(nx, ny); g.stroke();
          }
        });
        if (length > 40 && rnd() < 0.05) crack(nx, ny, ang + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.5), length * (1 - t) * 0.5, width * (1 - 0.6 * t) * 0.7);
        onPoint?.(nx, ny, t);
        x = nx; y = ny;
      }
    };

    tufts = [];
    const grassTall = Math.min(46 * big, L.h * 0.056);
    const n = Math.max(2, Math.round(L.period / 950));
    for (let i = 0; i < n; i++) {
      // one crack down from the top edge, with moss along its upper part and a tuft on a ledge
      const tx = ((i + 0.15 + rnd() * 0.5) / n) * L.period;
      let ledge = 0.25 + rnd() * 0.3, grown = false;
      crack(tx, -2, Math.PI / 2 + (rnd() - 0.5) * 0.7, L.h * (0.12 + rnd() * 0.12), 1.5 * big, (x, y, t) => {
        if (t < 0.6 && rnd() < 0.5) moss(x + (rnd() - 0.5) * 8, y + (rnd() - 0.5) * 6, (4 + rnd() * 7) * big, 0.4);
        if (!grown && t > ledge) { grown = true; tuft(x, y, grassTall * 0.7, 6 + Math.floor(rnd() * 4)); ledge = 2; }
      });
      // one shorter crack up from the bottom edge, where grass has taken hold
      const bx = ((i + 0.6 + rnd() * 0.35) / n) * L.period;
      crack(bx, L.h + 2, -Math.PI / 2 + (rnd() - 0.5) * 0.8, L.h * (0.05 + rnd() * 0.05), 1.4 * big);
      tuft(bx + (rnd() - 0.5) * 14, L.h + 2, grassTall, 9 + Math.floor(rnd() * 6));
      // moss creeping in over the top edge, and a smaller patch at the foot
      clump(((i + rnd()) / n) * L.period, L.h * 0.01, 18 + Math.floor(rnd() * 12), 46 * big, 12 * big);
      clump(((i + rnd()) / n) * L.period, L.h * 0.995, 9 + Math.floor(rnd() * 6), 24 * big, 6 * big);
    }
    if (decorTex) gl.deleteTexture(decorTex);
    decorTex = texture(c.width, c.height, true, c);
  }

  // Wild grass: each blade a tapered sliver that leans with the wind, drawn
  // with its shadow on the stone behind it. Tufts ride the slab as it drifts.
  const GREENS = ["#4f7426", "#6a8f33", "#86a544", "#3f6424", "#a4ae58"];
  function drawPlants(t: number) {
    if (!pg) return;
    pg.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    pg.clearRect(0, 0, L.w, L.h);
    if (before()) return;
    for (const tf of tufts) {
      const x = ((((tf.x - scroll) % L.period) + L.period) % L.period);
      for (const sx of [x, x - L.period]) {
        if (sx < -80 || sx > L.w + 80) continue;
        const gust = still ? 0 : Math.sin(t * 1.25 + tf.x * 0.013) * 0.55 + Math.sin(t * 0.47 + tf.x * 0.004) * 0.45;
        for (const pass of [0, 1]) for (const b of tf.blades) {
          const bend = b.lean + (still ? 0 : (gust + Math.sin(t * 2.3 + b.phase) * 0.25) * 0.16 * (b.h / 30 + 0.4));
          const up = b.h * Math.sqrt(1 - Math.min(0.8, bend * bend));
          const ox = pass ? 0 : 3.5, oy = pass ? 0 : 2.5; // the shadow falls down and to the right
          const bx = sx + b.dx + ox, by = tf.y + oy, tx = bx + bend * b.h, ty = by - up, cx = bx + bend * b.h * 0.22, cy = by - up * 0.6;
          pg.fillStyle = pass ? GREENS[Math.floor(b.tone * GREENS.length)] : "rgba(70,48,18,0.20)";
          pg.beginPath();
          pg.moveTo(bx - b.w / 2, by);
          pg.quadraticCurveTo(cx - b.w * 0.35, cy, tx, ty);
          pg.quadraticCurveTo(cx + b.w * 0.35, cy, bx + b.w / 2, by);
          pg.fill();
          if (pass && b.seeds) {
            // a seed head: a few grains up the last third of the blade
            pg.fillStyle = "#b8ab68";
            for (let i = 0; i < 5; i++) {
              const u = 0.68 + i * 0.07, v = 1 - u;
              const px = v * v * bx + 2 * v * u * cx + u * u * tx, py = v * v * by + 2 * v * u * cy + u * u * ty;
              pg.beginPath();
              pg.ellipse(px + (i % 2 ? 1.3 : -1.3), py, 1.5, 0.9, bend + (i % 2 ? 0.6 : -0.6), 0, 6.3);
              pg.fill();
            }
          }
        }
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
  let armed = false; // nothing answers the hand until the first click
  const driftSpeed = () => (still ? 0 : L.tile / DRIFT_SECONDS);

  function local(e: PointerEvent) {
    const r = root.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  }
  // the pill trails the cursor with a little give
  function followHint(dt: number) {
    if (!hint || armed || !hand.known || !hand.mouse) return;
    const tx = Math.max(8, Math.min(hand.x + 16, L.w - hint.offsetWidth - 8));
    const ty = Math.max(8, Math.min(hand.y + 22, L.h - hint.offsetHeight - 8));
    if (!pill.placed) { pill.x = tx; pill.y = ty; pill.placed = true; hint.style.left = "0"; hint.style.top = "0"; hint.dataset.follow = ""; }
    const k = 1 - Math.exp(-dt * 13);
    pill.x += (tx - pill.x) * k; pill.y += (ty - pill.y) * k;
    hint.style.translate = `${pill.x.toFixed(1)}px ${pill.y.toFixed(1)}px`;
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
    if ((e.target as HTMLElement).closest("button")) return;
    const [x, y] = local(e);
    hand.mouse = e.pointerType === "mouse";
    if (!hand.known || !hand.mouse) hand.fresh = true;
    hand.known = true; hand.down = true; hand.x = x; hand.y = y;
    hand.lastMove = performance.now();
    try { root.setPointerCapture(e.pointerId); } catch { /* not capturable; carving still works */ }
    audio.unlock();
    if (!armed) {
      // the first click wakes the stone: from here on the cursor carves wherever it goes
      armed = true;
      hand.fresh = true;
      delete root.dataset.hint;
      root.dataset.armed = "";
    }
    if (hand.fresh) {
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
    scroll += driftSpeed() * dt;
    // the slab keeps moving under a cursor that is held still, and it keeps cutting
    if (hand.known) {
      const sx = hand.x + scroll;
      if (armed) cutTo(sx, hand.y);
      hand.sx = sx; hand.sy = hand.y;
    }

    if (performance.now() - hand.lastMove > 45) hand.speed *= Math.exp(-dt / 0.09);
    audio.setMotion(armed ? Math.pow(Math.min(1, hand.speed / 900), 0.7) : 0);
    followHint(dt);

    flushOps();

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas!.width, canvas!.height);
    gl.useProgram(pStone.p);
    gl.bindVertexArray(quad);
    bind(0, noiseTex, pStone.u.u_stone);
    bind(1, wordTex!, pStone.u.u_word);
    bind(2, carveTex!, pStone.u.u_carve);
    bind(3, rockTex, pStone.u.u_rock);
    bind(4, leafTex, pStone.u.u_leaf);
    bind(5, decorTex!, pStone.u.u_decor);
    gl.uniform1f(pStone.u.u_look, before() ? 0 : 1);
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
    drawPlants(now);
    if (!root.dataset.live) root.dataset.live = "";
  }

  function onLost(e: Event) { e.preventDefault(); lost = true; }
  function onRestored() {
    wordTex = null; carveTex = null; carveFbo = null; decorTex = null; L.w = 0;
    setupStatic();
    lost = false;
  }

  try {
    setupStatic();
    // start with the band placed as in the design: the mark near the middle
    layout();
    scroll = (GAP_AFTER_ICON / 2 + WORD_BOX.w + GAP_AFTER_WORD + (ICON_BOX.w * ICON_SCALE) / 2) * L.unit - L.w * 0.5;
  } catch (err) {
    console.warn("stone: falling back to the still image", err);
    plants.remove();
    return null;
  }

  if (hint && coarse) hint.textContent = "Tap to carve";
  const hintTimer = window.setTimeout(() => { if (!armed) root.dataset.hint = "on"; }, HINT_DELAY);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", onUp);
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
