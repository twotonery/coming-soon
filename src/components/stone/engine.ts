// The stone slab: a relief the browser lights in real time, so the wordmark,
// the visitor's hand passing over it and the cuts they make all sit in one
// surface under one lamp.
//
// It keeps a "carve map" the size of the slab: r = cuts (kept until reload),
// g = grain the hand has loosened, b = light scratches; g and b settle back.
// The slab drifts sideways as an endless band, and the carve map wraps with it.
//
// Framework-free on purpose: mountStone() is handed a root element holding
//   canvas[data-stone-canvas], [data-stone-hint], button[data-stone-sound]
// and returns null when WebGL2 isn't there (the still image underneath stays).

import { createStoneAudio } from "./audio";
import { ICON_BOX, ICON_PATHS, WORD_BOX, WORD_PATHS } from "./logo";
import { BLUR_FRAG, BRUSH_FRAG, BRUSH_VERT, DECAY_FRAG, GRIT_FRAG, GRIT_VERT, PACK_FRAG, QUAD_VERT, STONE_FRAG } from "./shaders";

export type StoneHandle = { destroy(): void };

// ---- the band's proportions, in logo units (logo.svg is 159 x 30)
const ICON_SCALE = 1.2;   // the mark is cut a little larger than the letters
const GAP_AFTER_WORD = 11;
const GAP_AFTER_ICON = 6;
const TILE_UNITS = WORD_BOX.w + GAP_AFTER_WORD + ICON_BOX.w * ICON_SCALE + GAP_AFTER_ICON;
const BAND_PAD = 40;      // px of plain stone above and below the band in its texture
const BAND_CENTRE = 0.44; // of the viewport height
const DRIFT_SECONDS = 95; // time for one tile to pass

const HINT_DELAY = 2000;
const MAX_GRIT = 320;

type Op = {
  ax: number; ay: number; bx: number; by: number;
  cut: [number, number, number, number];
  stir: [number, number];
  scratch: [number, number];
};

function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tileable noise for the stone, made once: r grain, g mottle, b pits, a second grain.
function stoneNoise(size: number) {
  const rnd = mulberry(20261115);
  const out = new Uint8Array(size * size * 4);
  const layer = new Float32Array(size * size);
  const fbm = (cells: number[], weights: number[]) => {
    layer.fill(0);
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
    return (i: number) => (layer[i] - lo) / (hi - lo);
  };
  const put = (ch: number, get: (i: number) => number) => {
    for (let i = 0; i < size * size; i++) out[i * 4 + ch] = Math.round(get(i) * 255);
  };
  put(0, fbm([32, 64, 128, 256], [0.34, 0.30, 0.22, 0.14]));
  put(1, fbm([3, 6, 12, 24, 48], [0.36, 0.26, 0.18, 0.12, 0.08]));
  put(3, fbm([16, 40, 96, 200, 256], [0.26, 0.24, 0.22, 0.16, 0.12]));
  // pits: scattered soft dots of uneven size
  layer.fill(0);
  for (let k = 0; k < 760; k++) {
    const cx = rnd() * size, cy = rnd() * size, rad = 0.9 + rnd() * rnd() * 3.4, amp = 0.55 + rnd() * 0.45;
    const reach = Math.ceil(rad * 2.5);
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      const x = (((Math.floor(cx) + dx) % size) + size) % size, y = (((Math.floor(cy) + dy) % size) + size) % size;
      const v = amp * Math.exp(-(dx * dx + dy * dy) / (rad * rad));
      if (v > layer[y * size + x]) layer[y * size + x] = v;
    }
  }
  put(2, (i) => Math.min(1, layer[i]));
  return out;
}

function chiselCursor(scale: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 32 * scale;
  const g = c.getContext("2d");
  if (!g) return null;
  g.scale(scale, scale);
  g.translate(4, 4);
  g.rotate(Math.PI / 4);
  g.lineJoin = "round";
  g.lineWidth = 1.5;
  g.strokeStyle = "#0e1f21";
  // handle
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.roundRect(15, -3.6, 15.5, 7.2, 2.6);
  g.fill(); g.stroke();
  // ferrule
  g.fillStyle = "#1f4b50";
  g.beginPath();
  g.rect(13, -3, 3.4, 6);
  g.fill(); g.stroke();
  // blade, flared to its edge
  g.fillStyle = "#dfeaea";
  g.beginPath();
  g.moveTo(0, -3.9); g.lineTo(0, 3.9); g.lineTo(13, 2.1); g.lineTo(13, -2.1); g.closePath();
  g.fill(); g.stroke();
  return c.toDataURL("image/png");
}

export function mountStone(root: HTMLElement): StoneHandle | null {
  const canvas = root.querySelector<HTMLCanvasElement>("[data-stone-canvas]");
  const hint = root.querySelector<HTMLElement>("[data-stone-hint]");
  const soundBtn = root.querySelector<HTMLButtonElement>("[data-stone-sound]");
  if (!canvas) return null;
  const maybeGl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!maybeGl) return null;
  const gl: WebGL2RenderingContext = maybeGl;

  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const audio = createStoneAudio();

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
  let noiseTex: WebGLTexture;
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
    gl.bufferData(gl.ARRAY_BUFFER, MAX_GRIT * 16, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    noiseTex = texture(512, 512, true, stoneNoise(512), true);
  }

  // ------------------------------------------------------------ layout
  const L = { w: 0, h: 0, dpr: 1, unit: 8, tile: 1440, bandTop: 0, bandH: 0, period: 2880, scale: 1, carveScale: 1 };
  let scroll = 0;

  function layout() {
    const w = Math.max(1, root.clientWidth), h = Math.max(1, root.clientHeight);
    if (w === L.w && h === L.h && wordTex) return;
    L.w = w; L.h = h;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const budget = 3.4e6;
    if (w * h * dpr * dpr > budget) dpr = Math.sqrt(budget / (w * h));
    L.dpr = dpr;
    canvas!.width = Math.round(w * dpr);
    canvas!.height = Math.round(h * dpr);
    L.unit = Math.max(w / TILE_UNITS, h / 135);
    L.tile = TILE_UNITS * L.unit;
    L.scale = Math.min(1.25, Math.max(0.6, L.unit / 8.2));
    L.bandH = ICON_BOX.h * ICON_SCALE * L.unit + BAND_PAD * 2;
    L.bandTop = h * BAND_CENTRE - L.bandH / 2;
    L.period = L.tile * Math.max(1, Math.ceil((w + L.tile * 0.5) / L.tile));
    buildWord();
    buildCarve();
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
    const sTight = 2.3 * L.scale * k, sWide = 9 * L.scale * k;
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
  let settleG = 0, settleB = 0, settleUntil = 0;

  function flushOps() {
    if (!ops.length || !carveFbo) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, carveFbo);
    gl.viewport(0, 0, Math.round(L.period * L.carveScale), Math.round(L.h * L.carveScale));
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(pBrush.p);
    gl.bindVertexArray(quad);
    bind(0, noiseTex, pBrush.u.u_stone);
    gl.uniform2f(pBrush.u.u_size, L.period, L.h);
    for (const op of ops) {
      const reach = Math.max(op.cut[0] * 1.6, op.stir[0], op.scratch[0] * 1.4) + 2;
      // bring the stroke into the map's first period, then draw the copy that
      // spills over either edge so the band stays seamless
      const base = Math.floor(Math.min(op.ax, op.bx) / L.period) * L.period;
      const ax = op.ax - base, bx = op.bx - base;
      gl.uniform4f(pBrush.u.u_cut, ...op.cut);
      gl.uniform2f(pBrush.u.u_stir, ...op.stir);
      gl.uniform2f(pBrush.u.u_scratch, ...op.scratch);
      for (const shift of [0, -L.period, L.period]) {
        const x0 = Math.min(ax, bx) - reach + shift, x1 = Math.max(ax, bx) + reach + shift;
        if (x1 < 0 || x0 > L.period) continue;
        gl.uniform4f(pBrush.u.u_rect, x0, Math.min(op.ay, op.by) - reach, x1, Math.max(op.ay, op.by) + reach);
        gl.uniform2f(pBrush.u.u_a, ax + shift, op.ay);
        gl.uniform2f(pBrush.u.u_b, bx + shift, op.by);
        gl.uniform2f(pBrush.u.u_seed, base - shift, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    }
    ops.length = 0;
    gl.disable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
  }

  function settle(dt: number, now: number) {
    if (now > settleUntil || !carveFbo) return;
    settleG += (dt / 2.2) * 255; settleB += (dt / 2.4) * 255;
    const g = Math.floor(settleG), b = Math.floor(settleB);
    if (g < 1 && b < 1) return;
    settleG -= g; settleB -= b;
    gl.bindFramebuffer(gl.FRAMEBUFFER, carveFbo);
    gl.viewport(0, 0, Math.round(L.period * L.carveScale), Math.round(L.h * L.carveScale));
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(pDecay.p);
    gl.uniform2f(pDecay.u.u_amount, g / 255, b / 255);
    gl.bindVertexArray(quad);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
  }

  // ------------------------------------------------------------ grit
  const grit = new Float32Array(MAX_GRIT * 7); // x, y, vx, vy, size, life, span
  const gritOut = new Float32Array(MAX_GRIT * 4);
  let gritNext = 0;
  function throwGrit(x: number, y: number, vx: number, vy: number, count: number, burst: number) {
    if (still) return;
    for (let i = 0; i < count; i++) {
      const o = gritNext * 7; gritNext = (gritNext + 1) % MAX_GRIT;
      const ang = Math.random() * Math.PI * 2, sp = Math.random() * burst;
      grit[o] = x + (Math.random() - 0.5) * 8; grit[o + 1] = y + (Math.random() - 0.5) * 8;
      grit[o + 2] = vx + Math.cos(ang) * sp; grit[o + 3] = vy + Math.sin(ang) * sp - burst * 0.35;
      grit[o + 4] = 1.4 + Math.random() * Math.random() * 3.2;
      grit[o + 6] = 0.45 + Math.random() * 0.65; grit[o + 5] = grit[o + 6];
    }
  }
  function drawGrit(dt: number) {
    let n = 0;
    for (let i = 0; i < MAX_GRIT; i++) {
      const o = i * 7;
      if (grit[o + 5] <= 0) continue;
      grit[o + 5] -= dt;
      grit[o + 3] += 260 * dt;
      const drag = Math.exp(-dt * 3.2);
      grit[o + 2] *= drag; grit[o + 3] *= drag;
      grit[o] += grit[o + 2] * dt - driftSpeed() * dt; grit[o + 1] += grit[o + 3] * dt;
      const life = Math.max(0, grit[o + 5] / grit[o + 6]);
      gritOut[n * 4] = grit[o]; gritOut[n * 4 + 1] = grit[o + 1];
      gritOut[n * 4 + 2] = grit[o + 4] * (0.6 + 0.4 * life); gritOut[n * 4 + 3] = Math.min(1, life * 2.2) * 0.8;
      n++;
    }
    if (!n) return;
    gl.useProgram(pGrit.p);
    gl.bindVertexArray(gritVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gritBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, gritOut, 0, n * 4);
    gl.uniform2f(pGrit.u.u_res, L.w, L.h);
    gl.uniform1f(pGrit.u.u_dpr, L.dpr);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.disable(gl.BLEND);
  }

  // ------------------------------------------------------------ the hand
  const hand = { x: 0, y: 0, known: false, down: false, mouse: true, sx: 0, sy: 0, dirX: 0.8, dirY: 0.6, speed: 0, lastMove: 0, sinceTok: 0 };
  let armed = false;
  let hintShown = false;
  const driftSpeed = () => (still ? 0 : L.tile / DRIFT_SECONDS);

  function local(e: PointerEvent) {
    const r = root.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  }
  function placeHint() {
    if (!hint || !hintShown) return;
    if (hand.known && hand.mouse) {
      const x = Math.min(hand.x + 14, L.w - hint.offsetWidth - 8), y = Math.min(hand.y + 20, L.h - hint.offsetHeight - 8);
      hint.style.left = "0"; hint.style.top = "0";
      hint.style.translate = `${Math.max(8, x)}px ${Math.max(8, y)}px`;
      hint.dataset.follow = "";
    }
  }
  function showHint() {
    if (armed || !hint) return;
    hintShown = true;
    placeHint();
    root.dataset.hint = "on";
  }
  function arm() {
    if (armed) return;
    armed = true;
    hintShown = false;
    delete root.dataset.hint;
    root.dataset.armed = "";
    const one = chiselCursor(1), two = chiselCursor(2);
    if (one) {
      root.style.cursor = `url(${one}) 4 4, crosshair`;
      if (two) root.style.cursor = `image-set(url(${one}) 1x, url(${two}) 2x) 4 4, crosshair`;
    }
  }
  const cutRadius = () => 5.2 * Math.max(0.8, L.scale);

  function onMove(e: PointerEvent) {
    const [x, y] = local(e);
    const now = performance.now();
    hand.mouse = e.pointerType === "mouse";
    if (!hand.known) { hand.known = true; hand.x = x; hand.y = y; hand.sx = x + scroll; hand.sy = y; hand.lastMove = now; placeHint(); return; }
    const sx = x + scroll, sy = y;
    const dx = sx - hand.sx, dy = sy - hand.sy, dist = Math.hypot(dx, dy);
    if (dist < 0.5) return;
    const dt = Math.max(4, now - hand.lastMove) / 1000;
    const inst = Math.min(3000, dist / dt);
    hand.speed += (inst - hand.speed) * 0.35;
    hand.dirX += (dx / dist - hand.dirX) * 0.5; hand.dirY += (dy / dist - hand.dirY) * 0.5;
    const pace = Math.min(1, inst / 1100);
    const op: Op = { ax: hand.sx, ay: hand.sy, bx: sx, by: sy, cut: [0, 0, 0, 0], stir: [0, 0], scratch: [0, 0] };
    if (!still) {
      op.stir = [42 + 18 * pace, 0.5 + 0.5 * pace];
      op.scratch = [2.6, 0.45 + 0.55 * pace];
    }
    if (hand.down) {
      op.cut = [cutRadius(), 0.82, 0.82, 0.55];
      hand.sinceTok += dist;
      if (hand.sinceTok > 52) { hand.sinceTok = 0; audio.strike(0.28 + Math.random() * 0.12); }
    }
    ops.push(op);
    settleUntil = now / 1000 + 2.5;
    const vx = (dx / dt) * 0.10, vy = (dy / dt) * 0.10;
    const share = (hand.down ? 0.09 : 0.035) * (0.4 + pace);
    let count = Math.floor(dist * share);
    if (Math.random() < dist * share - count) count++;
    throwGrit(x, y, vx, vy, Math.min(count, 6), hand.down ? 70 : 34);
    hand.x = x; hand.y = y; hand.sx = sx; hand.sy = sy; hand.lastMove = now;
    placeHint();
  }
  function onDown(e: PointerEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-stone-sound]")) return;
    const [x, y] = local(e);
    hand.mouse = e.pointerType === "mouse";
    hand.known = true; hand.down = true; hand.x = x; hand.y = y; hand.sx = x + scroll; hand.sy = y;
    hand.lastMove = performance.now(); hand.sinceTok = 0;
    try { root.setPointerCapture(e.pointerId); } catch { /* not capturable; carving still works */ }
    arm();
    audio.unlock();
    // one strike: a wedge that bites deeper at its head, along the hand's last travel
    const len = Math.hypot(hand.dirX, hand.dirY) || 1, ux = hand.dirX / len, uy = hand.dirY / len;
    const r = cutRadius();
    ops.push({
      ax: hand.sx - ux * r * 1.3, ay: hand.sy - uy * r * 1.3, bx: hand.sx + ux * r * 1.5, by: hand.sy + uy * r * 1.5,
      cut: [r * 1.15, 0.5, 1, 0.6], stir: still ? [0, 0] : [44, 0.6], scratch: [0, 0],
    });
    settleUntil = performance.now() / 1000 + 2.5;
    throwGrit(x, y, -ux * 30, -uy * 30, 14, 150);
    audio.strike(1);
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
    const drift = driftSpeed() * dt;
    scroll += drift;
    // the slab keeps moving under a chisel that is held still
    if (hand.down && hand.known && drift > 0) {
      const sx = hand.x + scroll;
      ops.push({ ax: hand.sx, ay: hand.sy, bx: sx, by: hand.y, cut: [cutRadius(), 0.82, 0.82, 0.55], stir: [0, 0], scratch: [0, 0] });
      hand.sx = sx;
    } else if (hand.known) hand.sx = hand.x + scroll;

    if (performance.now() - hand.lastMove > 45) hand.speed *= Math.exp(-dt / 0.08);
    audio.setMotion(armed ? Math.pow(Math.min(1, hand.speed / 950), 0.75) : 0, hand.down);

    flushOps();
    settle(dt, now);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas!.width, canvas!.height);
    gl.useProgram(pStone.p);
    gl.bindVertexArray(quad);
    bind(0, noiseTex, pStone.u.u_stone);
    bind(1, wordTex!, pStone.u.u_word);
    bind(2, carveTex!, pStone.u.u_carve);
    gl.uniform2f(pStone.u.u_res, L.w, L.h);
    gl.uniform1f(pStone.u.u_dpr, L.dpr);
    gl.uniform1f(pStone.u.u_scroll, scroll);
    gl.uniform1f(pStone.u.u_time, now % 1000);
    gl.uniform1f(pStone.u.u_tile, L.tile);
    gl.uniform2f(pStone.u.u_band, L.bandTop, L.bandH);
    gl.uniform1f(pStone.u.u_period, L.period);
    gl.uniform1f(pStone.u.u_scale, L.scale);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    drawGrit(dt);
    if (!root.dataset.live) root.dataset.live = "";
  }

  function onLost(e: Event) { e.preventDefault(); lost = true; }
  function onRestored() {
    wordTex = null; carveTex = null; carveFbo = null; L.w = 0;
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
    return null;
  }

  if (hint && coarse) hint.textContent = "tap to carve";
  const hintTimer = window.setTimeout(showHint, HINT_DELAY);
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
      root.style.cursor = "";
      delete root.dataset.live; delete root.dataset.hint; delete root.dataset.armed;
    },
  };
}
