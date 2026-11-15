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

// One stroke into the carve map, drawn with MAX blending. The map holds
// "cones": 1 on the stroke's centre line, 0.5 at its edge, 0 one stroke-width
// out. r = cuts the visitor has set (kept), g = stone the hand is holding open
// (it closes again: see DECAY_FRAG, which shrinks the cone so the gap narrows).
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
uniform vec2 u_a;      // stroke start
uniform vec2 u_b;      // stroke end
uniform float u_r;     // half the stroke's width
uniform vec2 u_keep;   // how much to take off the kept cone at a and at b
uniform vec2 u_open;   // the same for the held-open cone; 9 = don't draw
void main() {
  vec2 ab = u_b - u_a;
  float t = clamp(dot(v_p - u_a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
  float cone = 1.0 - length(v_p - (u_a + ab * t)) / (2.0 * u_r);
  o = vec4(max(cone - mix(u_keep.x, u_keep.y, t), 0.0), max(cone - mix(u_open.x, u_open.y, t), 0.0), 0.0, 0.0);
}`;

// Lets the held-open stone close (subtractive blend on g).
export const DECAY_FRAG = `#version 300 es
precision highp float;
out vec4 o;
uniform float u_amount;
void main() { o = vec4(0.0, u_amount, 0.0, 0.0); }`;

export const STONE_FRAG = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D u_stone; // tileable noise: r grain, g mottle, b pits, a second grain
uniform sampler2D u_word;  // the logo band (see PACK_FRAG)
uniform sampler2D u_carve; // r kept cuts, g stone held open (see BRUSH_FRAG)
uniform vec2 u_res;        // viewport, CSS px
uniform float u_dpr;
uniform float u_scroll;    // slab drift, CSS px
uniform float u_time;
uniform float u_tile;      // width of one logo tile
uniform vec2 u_band;       // top and height of the logo band
uniform float u_period;    // width of the carve map
uniform float u_scale;     // 1 on a desktop-sized slab, smaller on phones
uniform float u_edge;      // turns a cone into the same edge ramp the logo has

const vec3 LIGHT = normalize(vec3(-0.50, -0.62, 0.60)); // from the upper left
const float DEPTH = 11.0; // one depth for the logo and for every cut

vec3 word(vec2 s) {
  vec2 uv = vec2(s.x / u_tile, (s.y - u_band.x) / u_band.y);
  return texture(u_word, uv).rgb * step(0.0, uv.y) * step(uv.y, 1.0);
}
vec4 carve(vec2 s) { return texture(u_carve, vec2(s.x / u_period, s.y / u_res.y)); }
float ramp(float cone) { return clamp((cone - 0.5) * u_edge + 0.5, 0.0, 1.0); }

// The hollows: the debossed logo and everything cut by the visitor go through
// the same edge, the same wobble and the same depth, so they read as one hand.
float relief(vec2 s, float wob, out float m, out vec4 c) {
  vec3 w = word(s);
  c = carve(s);
  m = smoothstep(0.26, 0.74, max(w.r, ramp(max(c.r, c.g))) + wob);
  return -DEPTH * u_scale * m;
}

// The small stuff: a fine honed grain, the odd pit, and where the stone is
// being held open, the rubble pushed up along the gap and churning in it.
float fine(vec2 s, float hollow, float berm, float churn) {
  vec4 a = texture(u_stone, s / 300.0);
  vec4 b = texture(u_stone, s.yx / 131.0 + 0.37);
  vec4 f = texture(u_stone, s / 61.0 + 0.53);
  float h = (f.r - 0.5) * 0.34 + (a.r - 0.5) * 0.30 + (b.a - 0.5) * 0.26;
  h -= smoothstep(0.80, 0.98, a.b) * 0.9 * (1.0 - 0.5 * hollow);
  if (berm + churn > 0.003) {
    vec2 flow = vec2(u_time * 0.035, -u_time * 0.022);
    float loose = textureLod(u_stone, s / 210.0 + flow, 0.0).r + textureLod(u_stone, s / 97.0 - flow * 1.6, 0.0).a - 1.0;
    float lumps = smoothstep(0.35, 0.8, textureLod(u_stone, s / 150.0 + flow * 0.5, 0.0).b);
    h += berm * (0.8 + loose * 1.6 + lumps * 0.9) + churn * loose * 0.9;
  }
  return h;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_res.y * u_dpr - gl_FragCoord.y) / u_dpr;
  vec2 s = p + vec2(u_scroll, 0.0);
  float e = 1.0 / u_dpr;

  vec4 nA = texture(u_stone, s / 300.0);
  vec4 nB = texture(u_stone, s.yx / 131.0 + 0.37);
  vec4 nC = texture(u_stone, s / 1790.0 + 0.11);
  vec4 nF = texture(u_stone, s / 61.0 + 0.53);

  // ---- relief and its slope
  float wob = (nA.a - 0.5) * 0.10 + (nB.r - 0.5) * 0.07;
  float m, mx, my; vec4 c, cx, cy;
  float h0 = relief(s, wob, m, c);
  float hx = relief(s + vec2(e, 0.0), wob, mx, cx);
  float hy = relief(s + vec2(0.0, e), wob, my, cy);
  vec2 slope = vec2(hx - h0, hy - h0) / e;

  // ---- stone the hand is holding open: rubble banked along the gap, and a
  // floor that keeps shifting until the cut is set
  vec3 w0 = word(s);
  float open = ramp(c.g);
  float held = open * (1.0 - ramp(c.r)) * (1.0 - smoothstep(0.3, 0.7, w0.r));
  float berm = smoothstep(0.24, 0.47, c.g) * (1.0 - smoothstep(0.47, 0.56, c.g)) * (1.0 - m);
  float churn = held * m;

  float f0 = fine(s, m, berm, churn);
  float fx = fine(s + vec2(e, 0.0), m, berm, churn);
  float fy = fine(s + vec2(0.0, e), m, berm, churn);
  slope += vec2(fx - f0, fy - f0) / e;
  float swell = (nC.g - 0.5) * 5.0;
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
  // close shade where a hollow floor meets its walls
  float wide = max(w0.g, max(c.r, c.g));
  float ao = m * (1.0 - smoothstep(0.55, 1.0, wide)) * 0.30;

  // ---- colour
  vec2 q = p / u_res;
  vec3 base = vec3(0.262, 0.428, 0.438);
  // the light pools toward the upper right, as in the design
  base *= 0.93 + 0.34 * clamp(q.x * 0.45 + (1.0 - q.y) * 0.72 - 0.25, 0.0, 1.0);
  base *= 1.0 + (nC.g - 0.5) * 0.16 + (nB.g - 0.5) * 0.06 + (nA.r - 0.5) * 0.03;
  base = mix(base, base.grb * vec3(0.96, 0.99, 1.0), (nC.a - 0.5) * 0.08 + 0.04); // faint mineral drift in hue
  base = mix(base, base * vec3(0.90, 0.95, 0.96), m * 0.55);                      // hollows sit a shade deeper
  base *= 1.0 - smoothstep(0.80, 0.98, nA.b) * 0.08;                               // pits
  base += vec3(0.05, 0.06, 0.06) * smoothstep(0.86, 0.98, nF.a) * (0.4 + 0.6 * nB.r); // pale flecks
  // freshly broken stone is a little paler
  base = mix(base, vec3(0.50, 0.63, 0.63), berm * 0.10 + churn * 0.03);

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

// Chips of stone thrown ahead of the hand. Each is a small angular flake, lit
// from the same side as the slab, with a short shadow under it.
export const GRIT_VERT = `#version 300 es
in vec4 a_grit; // x, y, size, alpha
in vec2 a_look; // turn, tone
uniform vec2 u_res;
uniform float u_dpr;
out float v_alpha;
out vec2 v_look;
void main() {
  v_alpha = a_grit.w;
  v_look = a_look;
  gl_Position = vec4(a_grit.x / u_res.x * 2.0 - 1.0, 1.0 - a_grit.y / u_res.y * 2.0, 0.0, 1.0);
  gl_PointSize = max(a_grit.z * 2.6 * u_dpr, 3.0);
}`;

export const GRIT_FRAG = `#version 300 es
precision highp float;
in float v_alpha;
in vec2 v_look;
out vec4 o;
float flake(vec2 p, float turn) {
  float c = cos(turn), s = sin(turn);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  // a lopsided four-sided chip
  return max(abs(p.x) * 1.15 + p.y * 0.35, abs(p.y) * 1.5 - p.x * 0.25);
}
void main() {
  vec2 p = (gl_PointCoord - 0.5) * 2.6; // the chip fills about 0.4 of its sprite; the rest holds its shadow
  float body = 1.0 - smoothstep(0.52, 0.72, flake(p, v_look.x));
  float shade = (1.0 - smoothstep(0.45, 0.85, flake(p - vec2(0.22, 0.27), v_look.x))) * 0.42;
  // lit on the upper left, in the slab's own colours
  float lit = clamp(0.55 - dot(p, vec2(0.50, 0.62)) * 0.9, 0.0, 1.0);
  vec3 col = mix(vec3(0.20, 0.34, 0.35), vec3(0.52, 0.67, 0.67), lit) * (0.85 + 0.3 * v_look.y);
  float a = max(body, shade * (1.0 - body)) * v_alpha;
  o = vec4(col * body * v_alpha, a);
}`;
