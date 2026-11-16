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
uniform sampler2D u_rock;  // tileable: r holes, g cell (0 at its border, 1 at its heart), b the cell's own number
uniform sampler2D u_word;  // the logo band (see PACK_FRAG)
uniform sampler2D u_carve; // r kept cuts, g stone held open (see BRUSH_FRAG)
uniform vec2 u_res;        // viewport, CSS px
uniform float u_dpr;
uniform float u_scroll;    // slab drift, CSS px
uniform float u_time;
uniform float u_sway;      // time for the light's slow stir (held at 0 for reduced motion)
uniform float u_tile;      // width of one logo tile
uniform vec2 u_band;       // top and height of the logo band
uniform float u_period;    // width of the carve map
uniform float u_scale;     // 1 on a desktop-sized slab, smaller on phones
uniform float u_edge;      // turns a cone into the same edge ramp the logo has
uniform float u_light;     // 0 = andesite / lava stone (dark mode), 1 = limestone (light mode)

const vec3 SUN = normalize(vec3(-0.58, -0.50, 0.45)); // golden hour: low, from the upper left
const float DEPTH = 11.0; // one depth for the logo and for every cut

vec3 word(vec2 s) {
  vec2 uv = vec2(s.x / u_tile, (s.y - u_band.x) / u_band.y);
  return texture(u_word, uv).rgb * step(0.0, uv.y) * step(uv.y, 1.0);
}
vec4 carve(vec2 s) { return texture(u_carve, vec2(s.x / u_period, s.y / u_res.y)); }
float ramp(float cone) { return clamp((cone - 0.5) * u_edge + 0.5, 0.0, 1.0); }

// The hollows: the logo and everything cut by the visitor go through the same
// edge and the same depth, so they read as one hand. wob pushes the edge in
// and out by a few px (it only acts near an edge): the wander of a hand-held
// chisel, and bites where the stone chipped. deep varies how far down it went.
float relief(vec2 s, float wob, float deep, out float m, out vec4 c) {
  vec3 w = word(s);
  c = carve(s);
  float v = max(w.r, ramp(max(c.r, c.g)));
  m = smoothstep(0.36, 0.64, v + wob * 4.0 * v * (1.0 - v));
  return -DEPTH * u_scale * deep * m;
}

// The stone's own surface: grit, the shallow facets left by dressing it by
// hand, holes (many in lava stone, few in limestone), tool
// tracks on the floors of the hollows, and rubble where it is being bent.
float surface(vec2 s, float hollow, float berm, float churn, out float holes) {
  vec4 a = texture(u_stone, s / 300.0);
  vec4 b = texture(u_stone, s.yx / 131.0 + 0.37);
  vec4 f = texture(u_stone, s / 61.0 + 0.53);
  vec4 k = texture(u_rock, s / 420.0);            // holes 1-5 px across
  vec4 K = texture(u_rock, s.yx / 1150.0 + 0.19); // pocks up to ~30 px, facets ~28 px
  float h = (f.r - 0.5) * 0.50 + (a.r - 0.5) * 0.40 + (b.a - 0.5) * 0.35;
  h += (K.g * 0.6 + (K.b - 0.5) * 0.7 * smoothstep(0.0, 0.3, K.g)) * mix(1.0, 0.7, u_light);
  h += (k.g - 0.5) * 0.25;
  float fewer = 0.38 + 0.32 * u_light;
  float small = max(k.r - fewer, 0.0) / (1.0 - fewer);
  float pock = smoothstep(0.30 + 0.3 * u_light, 1.0, K.r); // the odd wide, shallow dent
  holes = max(small, pock * 0.35);
  h -= small * 2.0 + pock * 1.1 + smoothstep(0.80, 0.98, a.b) * 0.5;
  if (hollow > 0.01) {
    vec2 r = vec2(s.x * 0.80 + s.y * 0.60, -s.x * 0.60 + s.y * 0.80);
    h += (textureLod(u_stone, r / vec2(1300.0, 150.0), 0.0).g - 0.5) * 2.6 * hollow;
  }
  if (berm + churn > 0.003) {
    vec2 flow = vec2(u_time * 0.035, -u_time * 0.022);
    float loose = textureLod(u_stone, s / 210.0 + flow, 0.0).r + textureLod(u_stone, s / 97.0 - flow * 1.6, 0.0).a - 1.0;
    float lumps = smoothstep(0.35, 0.8, textureLod(u_stone, s / 150.0 + flow * 0.5, 0.0).b);
    h += berm * (0.8 + loose * 1.6 + lumps * 0.9) + churn * loose * 0.9;
  }
  return h;
}

// Keeps the brightest sunlit grains from burning out to flat white.
vec3 shoulder(vec3 c) { return mix(c, 1.0 - 0.22 * exp(-(c - 0.78) / 0.22), step(0.78, c)); }

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_res.y * u_dpr - gl_FragCoord.y) / u_dpr;
  vec2 s = p + vec2(u_scroll, 0.0);
  float e = 1.0 / u_dpr;

  vec4 nA = texture(u_stone, s / 300.0);
  vec4 nB = texture(u_stone, s.yx / 131.0 + 0.37);
  vec4 nC = texture(u_stone, s / 1790.0 + 0.11);
  vec4 K = texture(u_rock, s.yx / 1150.0 + 0.19);
  vec4 X = texture(u_rock, s / 150.0 + 0.3); // crystals and flecks, ~3 px

  // ---- relief and its slope
  // stone may chip well away from an edge, but only creeps a little into a
  // hollow, so thin strokes and points survive
  float wob = clamp((nB.g - 0.5) * 0.30 + (nA.a - 0.5) * 0.40 + (nB.r - 0.5) * 0.22
                  + smoothstep(0.25, 0.85, K.r) * 0.35 + (0.55 - K.g) * 0.20, -0.30, 0.48);
  float deep = 1.0 + (nC.r - 0.5) * 0.3;
  float m, tm; vec4 c, tc;
  float h0 = relief(s, wob, deep, m, c);
  float hx = relief(s + vec2(e, 0.0), wob, deep, tm, tc);
  float hy = relief(s + vec2(0.0, e), wob, deep, tm, tc);
  vec2 slope = vec2(hx - h0, hy - h0) / e;

  // ---- stone the hand is holding open: rubble banked along the gap, and a
  // floor that keeps shifting until the cut is set
  vec3 w0 = word(s);
  float open = ramp(c.g);
  float held = open * (1.0 - ramp(c.r)) * (1.0 - smoothstep(0.3, 0.7, w0.r));
  float berm = smoothstep(0.24, 0.47, c.g) * (1.0 - smoothstep(0.47, 0.56, c.g)) * (1.0 - m);
  float churn = held * m;

  float holes, th;
  float f0 = surface(s, m, berm, churn, holes);
  float fx = surface(s + vec2(e, 0.0), m, berm, churn, th);
  float fy = surface(s + vec2(0.0, e), m, berm, churn, th);
  slope += vec2(fx - f0, fy - f0) / e;
  float swell = (nC.g - 0.5) * 7.0;
  slope += vec2(dFdx(swell), -dFdy(swell)) * u_dpr;

  vec3 n = normalize(vec3(-slope, 1.0));
  float ndl = max(dot(n, SUN), 0.0) / SUN.z;
  ndl = ndl < 1.0 ? ndl : 1.0 + (ndl - 1.0) * 0.5;

  // ---- long evening shadows thrown into the hollows by their sunward walls
  vec2 toSun = normalize(SUN.xy);
  float rise = SUN.z / length(SUN.xy);
  float lit = 1.0;
  for (int i = 0; i < 3; i++) {
    float d = (i == 0 ? 5.0 : i == 1 ? 11.0 : 19.0) * u_scale;
    float hd = relief(s + toSun * d, wob, deep, tm, tc);
    lit *= 1.0 - smoothstep(0.0, 1.0, (hd - h0 - d * rise) / 2.5) * (0.8 - 0.08 * float(i));
  }
  // close shade where a hollow's floor meets its walls
  float wide = max(w0.g, max(c.r, c.g));
  float ao = m * (1.0 - smoothstep(0.55, 1.0, wide)) * 0.30 + holes * 0.32;

  // ---- the sun: a pool of low light over the middle of the slab, its edge
  // broken and gently stirred as if by leaves overhead
  vec2 q = p / u_res;
  float rag = texture(u_stone, p / 1500.0 + vec2(u_sway * 0.004, 0.0)).g - 0.5;
  float pool = 1.0 - smoothstep(0.40, 1.05, length((q - vec2(0.5, 0.56)) / vec2(0.70, 0.60)) + rag * 0.35);
  float leaf = texture(u_stone, p / 620.0 + vec2(u_sway * 0.007, u_sway * 0.004)).g
             + (texture(u_stone, p / 260.0 - vec2(u_sway * 0.009, 0.0)).g - 0.5) * 0.5;
  float sunny = clamp(pool + (smoothstep(0.30, 0.70, leaf) - 0.5) * pool * (1.0 - pool) * 2.2, 0.0, 1.0);
  sunny = mix(mix(0.13, 0.34, u_light), 1.0, sunny);

  // ---- the stone's colour
  vec3 alb = mix(vec3(0.268, 0.280, 0.298), vec3(0.790, 0.745, 0.655), u_light);
  alb *= 1.0 + ((nC.g - 0.5) * 0.30 + (nB.g - 0.5) * 0.14 + (nA.r - 0.5) * 0.08) * mix(1.0, 0.55, u_light);
  // crystals in the andesite; shell and grit in the limestone
  float inCell = smoothstep(0.15, 0.5, X.g);
  alb = mix(alb, mix(vec3(0.56, 0.55, 0.53), vec3(0.93, 0.90, 0.83), u_light), step(0.93, X.b) * inCell * mix(0.6, 0.5, u_light));
  alb = mix(alb, mix(vec3(0.10, 0.10, 0.105), vec3(0.58, 0.48, 0.36), u_light), step(X.b, 0.07) * inCell * 0.6);
  // limestone is laid down in beds
  alb *= 1.0 + (texture(u_stone, vec2(s.x / 2600.0, s.y / 240.0)).g - 0.5) * 0.10 * u_light;
  // weathering: moss creeping over the andesite, ochre staining the limestone
  float stain = smoothstep(0.52, 0.80, nC.a) * (0.5 + 0.5 * nB.g);
  alb = mix(alb, mix(vec3(0.23, 0.27, 0.18), vec3(0.74, 0.60, 0.40), u_light), stain * mix(0.30, 0.22, u_light));
  alb *= 1.0 - holes * 0.45;                                 // holes are dark inside
  alb *= mix(1.0, 0.86, m);                                  // the hollows hold more grime
  alb = mix(alb, alb * 1.5 + 0.03, berm * 0.25 + churn * 0.08); // freshly broken stone is paler

  // ---- light: warm sun, cool sky in the shade
  vec3 sunC = mix(vec3(1.00, 0.86, 0.68) * 1.22, vec3(1.00, 0.83, 0.62) * 0.72, u_light);
  vec3 skyC = vec3(0.66, 0.72, 0.84) * mix(0.50, 0.72, u_light);
  vec3 col = alb * (skyC * (1.0 - ao) * (0.75 + 0.25 * n.z) + sunC * ndl * sunny * lit);
  col += alb * sunC * 0.10 * sunny * m; // sun bounced around inside a hollow, so its shade is not dead
  col = shoulder(col);

  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;

// Debris thrown ahead of the hand: angular chips and pebbles of the slab's own
// stone (kind 0), and puffs of powder (kind 1).
export const GRIT_VERT = `#version 300 es
in vec4 a_grit; // x, y, size, alpha
in vec3 a_look; // turn, the piece's own number, kind
uniform vec2 u_res;
uniform float u_dpr;
out float v_alpha;
out vec3 v_look;
void main() {
  v_alpha = a_grit.w;
  v_look = a_look;
  gl_Position = vec4(a_grit.x / u_res.x * 2.0 - 1.0, 1.0 - a_grit.y / u_res.y * 2.0, 0.0, 1.0);
  gl_PointSize = max(a_grit.z * 2.6 * u_dpr, 3.0);
}`;

export const GRIT_FRAG = `#version 300 es
precision highp float;
in float v_alpha;
in vec3 v_look;
uniform float u_light;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// A broken piece of stone seen from above: a convex shape left by five uneven
// cuts. Returns how far inside its outline p is (negative inside) and, in
// face, how squarely the nearest face is turned to the sun.
float piece(vec2 p, float turn, float id, out float face) {
  float d = -9.0;
  face = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float ang = turn + fi * 1.2566 + (hash(vec2(id, fi)) - 0.5) * 0.9;
    vec2 nrm = vec2(cos(ang), sin(ang));
    float di = dot(p, nrm) - (0.40 + 0.30 * hash(vec2(fi, id * 7.0)));
    if (di > d) { d = di; face = dot(nrm, vec2(-0.76, -0.65)); }
  }
  return d;
}
void main() {
  vec2 p = (gl_PointCoord - 0.5) * 2.6;
  if (v_look.z > 0.5) {
    // powder: a soft heap of separate grains, not a mist
    float a = 1.0 - smoothstep(0.0, 1.25, length(p));
    a *= a * (0.35 + 1.3 * hash(floor(gl_FragCoord.xy) + v_look.y * 91.0));
    vec3 dust = mix(vec3(0.60, 0.56, 0.50), vec3(1.00, 0.95, 0.84), u_light);
    o = vec4(dust * a * v_alpha, a * v_alpha);
    return;
  }
  float face, unused;
  float d = piece(p, v_look.x, v_look.y, face);
  float body = 1.0 - smoothstep(-0.07, 0.05, d);
  float shade = (1.0 - smoothstep(-0.10, 0.22, piece(p - vec2(0.24, 0.21), v_look.x, v_look.y, unused))) * 0.5 * (1.0 - body);
  // a flat top; toward the rim each broken face catches the low sun or turns from it
  float rim = smoothstep(-0.42, 0.0, d);
  float lit = 0.66 + face * 0.42 * rim + (hash(floor(p * 5.0) + v_look.y * 31.0) - 0.5) * 0.24;
  vec3 rock = mix(vec3(0.36, 0.35, 0.34), vec3(0.93, 0.87, 0.75), u_light) * (0.8 + 0.4 * fract(v_look.y * 13.7));
  vec3 col = rock * lit * mix(vec3(1.04, 0.98, 0.90), vec3(1.08, 0.96, 0.82), u_light); // a little of the evening sun
  o = vec4(col * body * v_alpha, max(body, shade) * v_alpha);
}`;
