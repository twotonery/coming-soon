// GLSL for the stone slab. Everything is measured in CSS pixels with y down;
// "stone space" is screen space plus the slab's sideways drift.

export const QUAD_VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Separable gaussian, used once at start-up to turn the flat logo mask into
// the soft ramps the relief is cut from.
export const BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_tex;
uniform vec2 u_step;   // one texel along the blur axis
uniform float u_sigma; // in texels
void main() {
  float sum = 0.0, wsum = 0.0;
  float spread = max(u_sigma * 3.0 / 16.0, 1.0);
  for (int i = -16; i <= 16; i++) {
    float x = float(i) * spread;
    float w = exp(-0.5 * x * x / (u_sigma * u_sigma));
    sum += texture(u_tex, v_uv + u_step * x).r * w;
    wsum += w;
  }
  o = vec4(sum / wsum);
}`;

// Packs the three logo masks into one texture: r = tight ramp (the cut wall),
// g = wide ramp (soft shade in the hollows), b = the sharp shape.
export const PACK_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_tight;
uniform sampler2D u_wide;
uniform sampler2D u_sharp;
void main() {
  o = vec4(texture(u_tight, v_uv).r, texture(u_wide, v_uv).r, texture(u_sharp, v_uv).r, 1.0);
}`;

// One chisel stroke (or one pass of the hand over the surface), drawn into the
// carve map with MAX blending. r = permanent cut, g = loosened grain, b = scratch.
export const BRUSH_VERT = `#version 300 es
in vec2 a_pos;
uniform vec4 u_rect;  // x0, y0, x1, y1 in stone px
uniform vec2 u_size;  // carve map size in stone px (period, height)
out vec2 v_p;
void main() {
  vec2 uv = a_pos * 0.5 + 0.5;
  v_p = mix(u_rect.xy, u_rect.zw, uv);
  gl_Position = vec4(v_p / u_size * 2.0 - 1.0, 0.0, 1.0);
}`;

export const BRUSH_FRAG = `#version 300 es
precision highp float;
in vec2 v_p;
out vec4 o;
uniform sampler2D u_stone;
uniform vec2 u_a;       // stroke start
uniform vec2 u_b;       // stroke end
uniform vec2 u_seed;    // lets a shifted copy read the same grain
uniform vec4 u_cut;     // radius, depth at a, depth at b, raggedness
uniform vec2 u_stir;    // radius, strength
uniform vec2 u_scratch; // radius, strength
void main() {
  vec2 ab = u_b - u_a;
  float t = clamp(dot(v_p - u_a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
  float d = length(v_p - (u_a + ab * t));
  vec2 q = v_p + u_seed;
  float n1 = texture(u_stone, q / 53.0).a;
  float n2 = texture(u_stone, q / 141.0).g;
  float cut = 0.0;
  if (u_cut.x > 0.0) {
    // a ragged V: the rim wanders and the floor is never quite even
    float r = u_cut.x * (1.0 + (n1 - 0.5) * u_cut.w + (n2 - 0.5) * u_cut.w * 0.6);
    float v = 1.0 - smoothstep(0.0, 1.0, d / max(r, 0.01));
    cut = pow(v, 0.8) * mix(u_cut.y, u_cut.z, t) * (0.86 + 0.28 * n2);
  }
  float stir = 0.0;
  if (u_stir.x > 0.0) {
    float f = 1.0 - smoothstep(0.0, 1.0, d / u_stir.x);
    stir = min(1.0, f * sqrt(f) * u_stir.y * (0.7 + 0.9 * n1));
  }
  float scratch = 0.0;
  if (u_scratch.x > 0.0) {
    float f = 1.0 - smoothstep(0.35, 1.0, d / (u_scratch.x * (0.7 + 0.6 * n2)));
    scratch = f * u_scratch.y;
  }
  o = vec4(cut, stir, scratch, 0.0);
}`;

// Lets the loosened grain and the scratches settle (subtractive blend).
export const DECAY_FRAG = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 u_amount;
void main() { o = vec4(0.0, u_amount.x, u_amount.y, 0.0); }`;

export const STONE_FRAG = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D u_stone; // tileable noise: r grain, g mottle, b pits, a second grain
uniform sampler2D u_word;  // the logo band (see PACK_FRAG)
uniform sampler2D u_carve; // r cut, g loosened grain, b scratch
uniform vec2 u_res;        // viewport, CSS px
uniform float u_dpr;
uniform float u_scroll;    // slab drift, CSS px
uniform float u_time;
uniform float u_tile;      // width of one logo tile
uniform vec2 u_band;       // top and height of the logo band
uniform float u_period;    // width of the carve map
uniform float u_scale;     // 1 on a desktop-sized slab, smaller on phones

const vec3 LIGHT = normalize(vec3(-0.50, -0.62, 0.60)); // from the upper left
const float WORD_DEPTH = 11.0;
const float CUT_DEPTH = 6.0;

vec3 word(vec2 s) {
  vec2 uv = vec2(s.x / u_tile, (s.y - u_band.x) / u_band.y);
  return texture(u_word, uv).rgb * step(0.0, uv.y) * step(uv.y, 1.0);
}
vec4 carve(vec2 s) { return texture(u_carve, vec2(s.x / u_period, s.y / u_res.y)); }

// The big shapes: the debossed logo and whatever the visitor has cut.
// wob nudges the logo's edge so it reads as cut by hand.
float relief(vec2 s, float wob, out float m, out vec4 c) {
  vec3 w = word(s);
  m = smoothstep(0.28, 0.72, w.r + wob);
  c = carve(s);
  return -WORD_DEPTH * u_scale * m - CUT_DEPTH * c.r - 2.4 * smoothstep(0.0, 0.7, c.b);
}

// The small stuff: grain, pits, and inside the hollows the tracks the tool left.
// Grain the hand has loosened (stir) shifts while it settles.
float fine(vec2 s, float hollow, float stir, float pitGate) {
  vec4 a = texture(u_stone, s / 512.0);
  vec4 b = texture(u_stone, s.yx / 211.0 + 0.37);
  vec4 f = texture(u_stone, s / 96.0 + 0.53);
  float h = ((f.r - 0.5) * 0.55 + (a.r - 0.5) * 0.55 + (b.a - 0.5) * 0.5) * mix(1.0, 1.25, hollow);
  h -= (smoothstep(0.55, 0.95, a.b) * 1.2 + smoothstep(0.7, 0.97, b.b) * 0.7) * (0.25 + 0.75 * pitGate) * (1.0 - 0.4 * hollow);
  if (hollow > 0.01) {
    vec2 r = vec2(s.x * 0.80 + s.y * 0.60, -s.x * 0.60 + s.y * 0.80);
    float tool = textureLod(u_stone, r / vec2(1300.0, 160.0), 0.0).g - 0.5;
    float peck = textureLod(u_stone, s / 57.0 + 0.2, 0.0).b;
    h += (tool * 2.4 - smoothstep(0.55, 0.9, peck) * 0.9) * hollow;
  }
  if (stir > 0.004) {
    float loose = textureLod(u_stone, s / 380.0 + vec2(u_time * 0.045, -u_time * 0.03), 0.0).r
                + textureLod(u_stone, s / 170.0 - vec2(u_time * 0.07, u_time * 0.05), 0.0).a - 1.0;
    h += loose * stir * 6.5;
  }
  return h;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_res.y * u_dpr - gl_FragCoord.y) / u_dpr;
  vec2 s = p + vec2(u_scroll, 0.0);
  float e = 1.0 / u_dpr;

  vec4 nA = texture(u_stone, s / 512.0);
  vec4 nB = texture(u_stone, s.yx / 211.0 + 0.37);
  vec4 nC = texture(u_stone, s / 1790.0 + 0.11);
  vec4 nF = texture(u_stone, s / 96.0 + 0.53);

  // ---- relief and its slope
  float wob = (nA.a - 0.5) * 0.10 + (nB.r - 0.5) * 0.07;
  float m, mx, my; vec4 c, cx, cy;
  float h0 = relief(s, wob, m, c);
  float hx = relief(s + vec2(e, 0.0), wob, mx, cx);
  float hy = relief(s + vec2(0.0, e), wob, my, cy);
  vec2 slope = vec2(hx - h0, hy - h0) / e;

  // ---- fine surface: grain, slow swells, pits, tool marks in the hollows
  float cutIn = smoothstep(0.02, 0.35, c.r);
  float hollow = max(m, cutIn);
  float stir = smoothstep(0.0, 0.55, c.g); // eases out as the grain settles
  float pitGate = smoothstep(0.42, 0.62, nC.a); // pits gather in patches
  float f0 = fine(s, hollow, stir, pitGate);
  float fx = fine(s + vec2(e, 0.0), hollow, stir, pitGate);
  float fy = fine(s + vec2(0.0, e), hollow, stir, pitGate);
  slope += vec2(fx - f0, fy - f0) / e;
  float swell = (nC.g - 0.5) * 7.0;
  slope += vec2(dFdx(swell), dFdy(swell)) * u_dpr;

  vec3 n = normalize(vec3(-slope, 1.0));
  float lit = max(dot(n, LIGHT), 0.0) / LIGHT.z;

  // ---- shadow thrown into the hollows by the walls on the light's side
  vec2 toLight = normalize(LIGHT.xy);
  float sh = 0.0, tm; vec4 tc;
  float d1 = 6.0 * u_scale, d2 = 15.0 * u_scale;
  float ha = relief(s + toLight * d1, wob, tm, tc);
  float hb = relief(s + toLight * d2, wob, tm, tc);
  sh += smoothstep(0.0, 1.0, (ha - h0 - d1 * 0.55) / 3.0) * 0.6;
  sh += smoothstep(0.0, 1.0, (hb - h0 - d2 * 0.55) / 3.0) * 0.4;
  vec3 w0 = word(s);
  // close shade where a hollow floor meets its walls
  float ao = m * (1.0 - smoothstep(0.55, 1.0, w0.g)) * 0.30 + cutIn * (1.0 - c.r) * 0.10;

  // ---- colour
  vec2 q = p / u_res;
  vec3 base = vec3(0.262, 0.428, 0.438);
  // the light pools toward the upper right, as in the design
  base *= 0.93 + 0.34 * clamp(q.x * 0.45 + (1.0 - q.y) * 0.72 - 0.25, 0.0, 1.0);
  base *= 1.0 + (nC.g - 0.5) * 0.22 + (nB.g - 0.5) * 0.12 + (nA.r - 0.5) * 0.05;
  base = mix(base, base.grb * vec3(0.96, 0.99, 1.0), (nC.a - 0.5) * 0.10 + 0.05); // faint mineral drift in hue
  base = mix(base, base * vec3(0.90, 0.95, 0.96), m * 0.55);     // hollows sit a shade deeper
  base *= 1.0 - smoothstep(0.55, 0.95, nA.b) * 0.07 * (0.25 + 0.75 * pitGate);               // pits
  base += vec3(0.07, 0.08, 0.08) * smoothstep(0.80, 0.97, nF.a) * (0.4 + 0.6 * nB.r); // pale flecks

  vec3 dust = vec3(0.62, 0.72, 0.72);
  float rim = smoothstep(0.03, 0.25, c.r) * (1.0 - smoothstep(0.30, 0.85, c.r));
  float dusty = rim * 0.20 + cutIn * 0.07 + stir * 0.13 + smoothstep(0.0, 0.7, c.b) * 0.22
              + m * (1.0 - smoothstep(0.5, 0.9, w0.g)) * 0.05 * smoothstep(0.4, 0.8, nB.a);
  base = mix(base, dust, clamp(dusty, 0.0, 0.6));

  vec3 col = base * (0.30 + 0.70 * lit);
  col *= 1.0 - sh * 0.50;
  col *= 1.0 - ao;
  // a dry, matte catch of light on edges that face the lamp
  vec3 hv = normalize(LIGHT + vec3(0.0, 0.0, 1.0));
  col += vec3(0.75, 0.85, 0.85) * pow(max(dot(n, hv), 0.0), 18.0) * 0.045;

  // edge falloff and a breath of dither against banding
  vec2 vq = q - 0.5;
  col *= 1.0 - dot(vq, vq) * 0.22;
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;

// Grit thrown up by the tool.
export const GRIT_VERT = `#version 300 es
in vec4 a_grit; // x, y, size, alpha
uniform vec2 u_res;
uniform float u_dpr;
out float v_alpha;
void main() {
  v_alpha = a_grit.w;
  gl_Position = vec4(a_grit.x / u_res.x * 2.0 - 1.0, 1.0 - a_grit.y / u_res.y * 2.0, 0.0, 1.0);
  gl_PointSize = a_grit.z * u_dpr;
}`;

export const GRIT_FRAG = `#version 300 es
precision highp float;
in float v_alpha;
out vec4 o;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.45, 1.0, d)) * v_alpha;
  o = vec4(vec3(0.70, 0.80, 0.80) * a, a);
}`;
