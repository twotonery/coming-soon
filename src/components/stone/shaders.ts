// how much of the blurred logo counts as inside the healing border (see engine.ts)
export const HALO_LEVEL = 0.12;

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

// Packs the logo masks into one texture: r = tight ramp (the cut wall),
// g = wide ramp (soft shade in the hollows), b = the sharp shape.
export const PACK_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_tight;
uniform sampler2D u_wide;
uniform sampler2D u_sharp;
uniform sampler2D u_halo;
void main() {
  o = vec4(texture(u_tight, v_uv).r, texture(u_wide, v_uv).r, texture(u_sharp, v_uv).r, texture(u_halo, v_uv).r);
}`;

// One stretch of the cursor's path, cut into the carve map with MAX blending.
// The map holds "cones": 1 on the stroke's centre line, 0.5 at its edge, 0 one
// stroke-width out, which the stone shader turns into the logo's own edge.
//   r = cuts that stay. They are held out of the logo and a soft border
//       round it (the halo in the band's alpha, see PACK_FRAG: it follows the
//       letters and the mark, and fills the small gaps between them), tapering
//       off as they near it.
//   g = every cut as made, halo or not. This channel slowly closes again
//       (DECAY_FRAG), so a cut across the logo heals and the logo comes back.
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
const float HALO_LO = ${HALO_LEVEL - 0.04};
const float HALO_HI = ${HALO_LEVEL + 0.04};
in vec2 v_p;
out vec4 o;
uniform vec2 u_band;   // top and height of the logo band
uniform float u_tile;  // width of one logo tile
uniform sampler2D u_word; // the logo band (see PACK_FRAG): its alpha is where cuts heal
uniform vec2 u_a;      // stroke start
uniform vec2 u_b;      // stroke end
uniform float u_r;     // half the stroke's width
void main() {
  vec2 ab = u_b - u_a;
  float t = clamp(dot(v_p - u_a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
  float cone = max(1.0 - length(v_p - (u_a + ab * t)) / (2.0 * u_r), 0.0);
  vec2 uv = vec2(v_p.x / u_tile, (v_p.y - u_band.x) / u_band.y);
  float logo = uv.y > 0.0 && uv.y < 1.0 ? smoothstep(HALO_LO, HALO_HI, texture(u_word, uv).a) : 0.0;
  o = vec4(cone * (1.0 - logo), cone, 0.0, 0.0);
}`;

// Closes the healing channel a little (subtractive blend on g).
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
uniform sampler2D u_carve; // the visitor's cuts (see BRUSH_FRAG)
uniform sampler2D u_shade; // leaf shadows over the viewport, one layer per channel
uniform sampler2D u_decor; // laid over the whole slab: r cracks, g and b two kinds of moss
uniform vec2 u_res;        // viewport, CSS px
uniform float u_dpr;
uniform float u_scroll;    // slab drift, CSS px
uniform float u_sway;      // time, for the wind (held at 0 for reduced motion)
uniform float u_tile;      // width of one logo tile
uniform vec2 u_band;       // top and height of the logo band
uniform float u_period;    // width of the carve map
uniform float u_scale;     // 1 on a desktop-sized slab, smaller on phones
uniform float u_edge;      // turns a cone into the same edge ramp the logo has
uniform float u_teal;      // 0 = limestone in evening sun, 1 = the brand's teal stone at sunset

const vec3 SUN = normalize(vec3(-0.58, -0.50, 0.45)); // low, raking in from the upper left
const float DEPTH = 11.0; // one depth for the logo and for every cut

vec3 word(vec2 s) {
  vec2 uv = vec2(s.x / u_tile, (s.y - u_band.x) / u_band.y);
  return texture(u_word, uv).rgb * step(0.0, uv.y) * step(uv.y, 1.0);
}
float carve(vec2 s) { vec4 c = texture(u_carve, vec2(s.x / u_period, s.y / u_res.y)); return max(c.r, c.g); }
float ramp(float cone) { return clamp((cone - 0.5) * u_edge + 0.5, 0.0, 1.0); }

// The hollows: the logo and everything cut by the visitor go through the same
// edge and the same depth, so they read as one hand. wob pushes the edge in
// and out by a few px (it only acts near an edge): the wander of a hand-held
// chisel, and bites where the stone chipped. deep varies how far down it went.
float relief(vec2 s, float wob, float deep, out float m, out float cut) {
  vec3 w = word(s);
  cut = carve(s);
  float v = max(w.r, ramp(cut));
  m = smoothstep(0.36, 0.64, v + wob * 4.0 * v * (1.0 - v));
  return -DEPTH * u_scale * deep * m;
}

// The stone's own surface: grit, the shallow facets left by dressing it by
// hand, the odd hole, and tool tracks on the floors of the hollows; or, where
// moss has taken hold, the moss.
float surface(vec2 s, float hollow, float moss, out float holes) {
  vec4 a = texture(u_stone, s / 300.0);
  vec4 b = texture(u_stone, s.yx / 131.0 + 0.37);
  vec4 f = texture(u_stone, s / 61.0 + 0.53);
  vec4 k = texture(u_rock, s / 420.0);            // holes 1-3 px across
  vec4 K = texture(u_rock, s.yx / 1150.0 + 0.19); // dents up to ~20 px, facets ~28 px
  float h = (f.r - 0.5) * 0.50 + (a.r - 0.5) * 0.40 + (b.a - 0.5) * 0.35;
  h += (K.g * 0.6 + (K.b - 0.5) * 0.7 * smoothstep(0.0, 0.3, K.g)) * 0.7;
  h += (k.g - 0.5) * 0.25;
  float small = max(k.r - 0.70, 0.0) / 0.30;
  float pock = smoothstep(0.60, 1.0, K.r); // the odd wide, shallow dent
  holes = max(small, pock * 0.35);
  h -= small * 2.0 + pock * 1.1 + smoothstep(0.80, 0.98, a.b) * 0.5;
  if (hollow > 0.01) {
    vec2 r = vec2(s.x * 0.80 + s.y * 0.60, -s.x * 0.60 + s.y * 0.80);
    h += (textureLod(u_stone, r / vec2(1300.0, 150.0), 0.0).g - 0.5) * 2.6 * hollow;
  }
  // moss buries the stone's grain under its own pile: small cushions, finely tufted
  return mix(h, k.g * 2.2 + (f.a - 0.5) * 3.4 + (b.r - 0.5) * 1.6, moss);
}

// Leaf shadows, stirred by wind the way real branches are: not all together.
// Gusts cross the slab from the left, so one part moves while another has not
// started or has already settled; some boughs are sheltered and barely stir;
// and each cluster of leaves shivers to its own rhythm. soft blurs the shadow
// (the further the leaves hang from the wall, the softer their shadow); id
// gives each layer its own weather.
vec3 leaves(vec2 p, float soft, float id) {
  float gust = smoothstep(0.38, 0.72, texture(u_stone, p / 1700.0 - vec2(u_sway * 0.045, u_sway * 0.012) + id).g);
  float open = smoothstep(0.30, 0.62, texture(u_stone, p / 560.0 + id * 1.7).g); // 0 where sheltered
  float own = texture(u_stone, p / 760.0 + id * 3.1).a;
  float stir = gust * open;
  vec2 push = vec2(0.92, 0.38) * stir * (9.0 + 3.5 * sin(u_sway * (1.3 + own * 2.2) + own * 40.0))
            + vec2(-0.38, 0.92) * stir * 2.2 * sin(u_sway * (2.0 + own * 2.5) + own * 71.0);
  return texture(u_shade, (p - push * u_scale) / u_res, soft).rgb;
}

// Keeps the brightest sunlit grains from burning out to flat white.
vec3 shoulder(vec3 c) { return mix(c, 1.0 - 0.22 * exp(-(c - 0.78) / 0.22), step(0.78, c)); }

void main() {
  vec2 p = vec2(gl_FragCoord.x, u_res.y * u_dpr - gl_FragCoord.y) / u_dpr;
  vec2 s = p + vec2(u_scroll, 0.0);
  vec2 q = p / u_res;
  float e = 1.0 / u_dpr;

  vec4 nA = texture(u_stone, s / 300.0);
  vec4 nB = texture(u_stone, s.yx / 131.0 + 0.37);
  vec4 nC = texture(u_stone, s / 1790.0 + 0.11);
  vec4 K = texture(u_rock, s.yx / 1150.0 + 0.19);
  vec4 X = texture(u_rock, s / 150.0 + 0.3); // shell and grit, ~3 px

  // ---- relief and its slope
  // stone may chip well away from an edge, but only creeps a little into a
  // hollow, so thin strokes and points survive
  float wob = clamp((nB.g - 0.5) * 0.30 + (nA.a - 0.5) * 0.40 + (nB.r - 0.5) * 0.22
                  + smoothstep(0.25, 0.85, K.r) * 0.35 + (0.55 - K.g) * 0.20, -0.30, 0.48);
  float deep = 1.0 + (nC.r - 0.5) * 0.3;
  float m, tm, cut, tc;
  float h0 = relief(s, wob, deep, m, cut);
  float hx = relief(s + vec2(e, 0.0), wob, deep, tm, tc);
  float hy = relief(s + vec2(0.0, e), wob, deep, tm, tc);
  vec2 slope = vec2(hx - h0, hy - h0) / e;

  // ---- what has grown on the stone, and where it has cracked. Moss sits in
  // soft cushions with a broken, feathered edge; cutting through it clears it.
  vec4 dec = texture(u_decor, vec2(s.x / u_period, s.y / u_res.y));
  float crack = smoothstep(0.04, 0.85, dec.r) * (1.0 - m);
  float mossy = max(dec.g, dec.b) * (1.0 - smoothstep(0.3, 0.7, ramp(cut)));
  float moss = smoothstep(0.20, 0.70, mossy + (nA.a - 0.5) * 0.40 + (nB.r - 0.5) * 0.30);
  float kind = dec.b / max(dec.g + dec.b, 0.001); // 0 = the first moss, 1 = the second
  float damp = smoothstep(0.08, 0.40, mossy) * (1.0 - moss); // stone stays darker around it

  float holes, th;
  float f0 = surface(s, m, moss, holes);
  float fx = surface(s + vec2(e, 0.0), m, moss, th);
  float fy = surface(s + vec2(0.0, e), m, moss, th);
  slope += vec2(fx - f0, fy - f0) / e;
  float grown = moss * 2.6 - crack * 1.6 + (nC.g - 0.5) * 7.0;
  slope += vec2(dFdx(grown), -dFdy(grown)) * u_dpr;

  vec3 n = normalize(vec3(-slope, 1.0));
  float ndl = max(dot(n, SUN), 0.0) / SUN.z;
  ndl = ndl < 1.0 ? ndl : 1.0 + (ndl - 1.0) * 0.5;

  // ---- long shadows thrown into the hollows by their sunward walls
  vec2 toSun = normalize(SUN.xy);
  float rise = SUN.z / length(SUN.xy);
  float lit = 1.0;
  for (int i = 0; i < 3; i++) {
    float d = (i == 0 ? 5.0 : i == 1 ? 11.0 : 19.0) * u_scale;
    float hd = relief(s + toSun * d, wob, deep, tm, tc);
    lit *= 1.0 - smoothstep(0.0, 1.0, (hd - h0 - d * rise) / 2.5) * (0.8 - 0.08 * float(i));
  }
  // close shade where a hollow's floor meets its walls
  vec3 w0 = word(s);
  float ao = m * (1.0 - smoothstep(0.55, 1.0, max(w0.g, cut))) * 0.30 + holes * 0.32 * (1.0 - moss);

  // ---- the sun: open and low across the whole slab, a touch stronger toward
  // the side it comes from. Branches out of frame shade it: a bough across
  // the top, one down the right side, a sprig in the bottom left corner.
  // Each softens and thins together as it reaches in from its edge: sharp and
  // dark near the edge, a blur by the time it gives out, leaving the middle in sun.
  float inTop = smoothstep(0.04, 0.42, q.y);
  float inRight = 1.0 - smoothstep(0.62, 0.97, q.x);
  float inCorner = smoothstep(0.04, 0.40, length((q - vec2(0.0, 1.0)) * vec2(1.0, 1.25)));
  float shade = max(max(leaves(p, 0.6 + 5.2 * inTop, 0.0).r * (1.0 - smoothstep(0.35, 1.0, inTop)),
                        leaves(p, 0.6 + 5.2 * inRight, 0.37).g * 0.92 * (1.0 - smoothstep(0.35, 1.0, inRight))),
                        leaves(p, 0.6 + 4.6 * inCorner, 0.71).b * 0.85 * (1.0 - smoothstep(0.45, 1.0, inCorner)));
  float sunny = (1.0 - shade * 0.60) * (1.05 - 0.10 * (q.x * 0.6 + q.y * 0.4));

  // ---- the stone's colour
  vec3 alb = mix(vec3(0.790, 0.745, 0.655), vec3(0.250, 0.425, 0.455), u_teal);
  alb *= 1.0 + ((nC.g - 0.5) * 0.30 + (nB.g - 0.5) * 0.14 + (nA.r - 0.5) * 0.08) * 0.55;
  float inCell = smoothstep(0.15, 0.5, X.g);
  alb = mix(alb, mix(vec3(0.93, 0.90, 0.83), vec3(0.47, 0.64, 0.65), u_teal), step(0.93, X.b) * inCell * 0.5);  // pale flecks
  alb = mix(alb, mix(vec3(0.58, 0.48, 0.36), vec3(0.12, 0.23, 0.25), u_teal), step(X.b, 0.07) * inCell * 0.6);  // dark grit
  alb *= 1.0 + (texture(u_stone, vec2(s.x / 2600.0, s.y / 240.0)).g - 0.5) * 0.10; // laid down in beds
  alb = mix(alb, mix(vec3(0.74, 0.60, 0.40), vec3(0.17, 0.32, 0.35), u_teal), smoothstep(0.52, 0.80, nC.a) * (0.5 + 0.5 * nB.g) * 0.22); // weathering
  alb *= 1.0 - holes * 0.45;       // holes are dark inside
  alb *= mix(1.0, 0.86, m);        // the hollows hold more grime
  alb = mix(alb, alb * vec3(0.52, 0.47, 0.42), crack); // a hairline, not a gap
  alb *= 1.0 - damp * 0.16;
  // Moss, never one flat colour. On limestone: green, with a golden-brown
  // kind. On the teal stone: forest green with patches of avocado green, and
  // as an accent a kind that is orange in places and rose-pink in others.
  float tone = clamp(nB.a * 1.4 - 0.2 + (nA.r - 0.5) * 0.8, 0.0, 1.0);
  float avo = smoothstep(0.56, 0.70, nC.a), other = smoothstep(0.44, 0.56, nC.r);
  vec3 forest = mix(vec3(0.05, 0.20, 0.09), vec3(0.15, 0.42, 0.17), tone);
  vec3 avocado = mix(vec3(0.33, 0.40, 0.13), vec3(0.55, 0.60, 0.24), tone);
  vec3 orange = mix(vec3(0.72, 0.33, 0.10), vec3(0.96, 0.60, 0.22), tone);
  vec3 rose = mix(vec3(0.70, 0.30, 0.40), vec3(0.94, 0.60, 0.63), tone);
  vec3 mossA = mix(mix(vec3(0.21, 0.29, 0.11), vec3(0.50, 0.56, 0.22), tone), mix(forest, avocado, avo), u_teal);
  vec3 mossB = mix(mix(vec3(0.34, 0.26, 0.10), vec3(0.62, 0.50, 0.22), tone), mix(orange, rose, other), u_teal);
  vec3 pile = mix(mossA, mossB, smoothstep(0.35, 0.65, kind + (nB.g - 0.5) * 0.3));
  pile *= 0.82 + 0.36 * X.b;                          // each little tuft its own shade
  pile *= 0.75 + 0.25 * smoothstep(0.3, 0.9, mossy);  // thinner and darker toward its edge
  alb = mix(alb, pile, moss);

  // ---- light: warm sun, cool sky in the shade. At sunset on the teal stone
  // the sun stays pale enough to leave the teal teal; its orange shows up in
  // what the stone reflects.
  vec3 sunC = mix(vec3(1.00, 0.83, 0.62) * 0.72, vec3(1.00, 0.80, 0.62) * 0.80, u_teal);
  vec3 skyC = mix(vec3(0.66, 0.72, 0.84) * 0.72, vec3(0.50, 0.66, 0.80) * 0.62, u_teal);
  vec3 col = alb * (skyC * (1.0 - ao) * (0.75 + 0.25 * n.z) + sunC * ndl * sunny * lit);
  col += alb * sunC * 0.10 * sunny * m; // sun bounced around inside a hollow, so its shade is not dead
  if (u_teal > 0.5) {
    // the sunset caught on every grain and edge turned toward it
    float facing = max(dot(n, normalize(SUN + vec3(0.0, 0.0, 1.0))), 0.0);
    vec3 ember = vec3(1.00, 0.50, 0.19);
    col += ember * (pow(facing, 26.0) * 0.75 + pow(facing, 7.0) * 0.09) * sunny * lit * (1.0 - 0.6 * moss);
    // the walls and rims that face it glow, and the whole slab warms toward the sun's side
    col += ember * smoothstep(1.05, 1.9, max(dot(n, SUN), 0.0) / SUN.z) * 0.30 * sunny * lit;
    col += ember * 0.11 * clamp(1.0 - q.x * 0.8 - q.y * 0.5, 0.0, 1.0) * sunny;
    // dew on the moss: scattered beads that catch the sun and wink
    vec4 bead = texture(u_rock, s / 120.0 + 0.61);
    float wink = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(u_sway * 2.4 + bead.b * 400.0), 3.0);
    col += vec3(1.00, 0.84, 0.62) * step(0.86, bead.b) * smoothstep(0.25, 0.70, bead.g) * moss * wink * sunny * 1.7;
  }
  col = shoulder(col);

  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  o = vec4(col, 1.0);
}`;

// Debris thrown ahead of the cursor: angular chips and pebbles of the slab's
// own stone (kind 0), and puffs of powder (kind 1).
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
uniform float u_teal;
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
    o = vec4(mix(vec3(1.00, 0.95, 0.84), vec3(0.62, 0.76, 0.76), u_teal) * a * v_alpha, a * v_alpha);
    return;
  }
  float face, unused;
  float d = piece(p, v_look.x, v_look.y, face);
  float body = 1.0 - smoothstep(-0.07, 0.05, d);
  float shade = (1.0 - smoothstep(-0.10, 0.22, piece(p - vec2(0.24, 0.21), v_look.x, v_look.y, unused))) * 0.5 * (1.0 - body);
  // a flat top; toward the rim each broken face catches the low sun or turns from it
  float rim = smoothstep(-0.42, 0.0, d);
  float lit = 0.66 + face * 0.42 * rim + (hash(floor(p * 5.0) + v_look.y * 31.0) - 0.5) * 0.24;
  vec3 rock = mix(vec3(0.93, 0.87, 0.75) * vec3(1.08, 0.96, 0.82), vec3(0.40, 0.60, 0.61), u_teal);
  vec3 col = rock * (0.8 + 0.4 * fract(v_look.y * 13.7)) * lit;
  o = vec4(col * body * v_alpha, max(body, shade) * v_alpha);
}`;
