import { arcBand, arcPath, CELL, chamferRect, disc, hash01, oval, polygon, ring, shade, star, strokeRound, wedge, type Ink } from "./shapes";
import { halo } from "./material";
import { blend, type GroundFamily } from "./ground";
import type { LandmarkSpot } from "./landmarks";
/**
 * Landmarks: one large set-piece per ground family on the spots of `landmarks.ts`, lit from the upper left like the
 * rest of the board. Every family has two designs (`LandmarkSpot.variant`). `drawLandmark` is static terrain;
 * `landmarkLight` is its animated part for the ambient layer: light on the additive glow layer, motion on the ink.
 */
type Random = () => number;
interface LandmarkTheme {
  ground: readonly [number, number];
  accent: number;
}
/** Each family's own material, mixed into the ground colour so it belongs to the map. */
const TINT: Record<GroundFamily, number> = {
  metal: 0x5d6f7a,
  sand: 0xc49a62,
  rock: 0x6b6a66,
  volcanic: 0x2a2420,
  ice: 0xbfe3f2,
  organic: 0x3d6b3a,
  crystal: 0x9a7bd8,
  water: 0x3a6a6a,
};
/** Centre and half size in pixels of a spot. */
export function landmarkFrame(spot: LandmarkSpot) {
  const s = (spot.size * CELL) / 2;
  return { x: spot.x * CELL + s, y: spot.y * CELL + s, s };
}
/** A soft shadow cast to the lower right, as three stacked ovals. */
export function contactShadow(g: Ink, x: number, y: number, rx: number, ry: number, alpha = 0.32) {
  for (let k = 0; k < 3; k++) oval(g, x + rx * 0.14, y + ry * 0.22, rx * (1.1 - k * 0.14), ry * (1.1 - k * 0.14), 0x000000, alpha / 3);
}
/** An irregular closed outline around (`x`, `y`): `n` corners with radii jittered by `jitter`. */
function blob(g: Ink, x: number, y: number, r: number, n: number, jitter: number, rand: Random, color: number, alpha = 1) {
  const points = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2,
      rr = r * (1 - jitter / 2 + rand() * jitter);
    return { x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr };
  });
  g.fillStyle(color, alpha);
  g.fillPoints(points, true);
  return points;
}
type Painter = (g: Ink, x: number, y: number, s: number, body: number, accent: number, rand: Random) => void;
const PAINTERS: Record<GroundFamily, Painter> = {
  // Silo with a ribbed cap and a dish antenna on its rim.
  metal: (g, x, y, s, body, accent) => {
    disc(g, x, y, s * 0.72, shade(body, -0.45));
    disc(g, x - s * 0.03, y - s * 0.03, s * 0.66, body);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      arcBand(g, x, y, s * 0.5, s * 0.06, a, a + 0.25, shade(body, -0.25));
    }
    disc(g, x - s * 0.06, y - s * 0.06, s * 0.36, shade(body, 0.16));
    disc(g, x - s * 0.12, y - s * 0.12, s * 0.16, shade(body, 0.3));
    const dx = x + s * 0.5,
      dy = y - s * 0.42;
    oval(g, dx + 2, dy + 3, s * 0.24, s * 0.14, 0x000000, 0.3, -0.5);
    oval(g, dx, dy, s * 0.24, s * 0.14, shade(body, 0.22), 1, -0.5);
    oval(g, dx + 1, dy + 1, s * 0.15, s * 0.08, shade(body, -0.2), 1, -0.5);
    disc(g, dx, dy, 2.2, accent);
  },
  // Mesa: a flat-topped rock with strata steps.
  sand: (g, x, y, s, body, _accent, rand) => {
    blob(g, x, y, s * 0.82, 11, 0.22, rand, shade(body, -0.35));
    blob(g, x - s * 0.05, y - s * 0.06, s * 0.7, 10, 0.2, rand, shade(body, -0.08));
    blob(g, x - s * 0.1, y - s * 0.12, s * 0.52, 9, 0.18, rand, shade(body, 0.12));
    blob(g, x - s * 0.14, y - s * 0.16, s * 0.34, 8, 0.2, rand, shade(body, 0.24));
  },
  // A collapsed tower: a broken ring wall with rubble inside and around it.
  rock: (g, x, y, s, body, _accent, rand) => {
    disc(g, x, y, s * 0.6, shade(body, -0.5));
    for (let i = 0; i < 8; i++) {
      if (rand() < 0.25) continue;
      const a = (i / 8) * Math.PI * 2;
      arcBand(g, x + 1.5, y + 2, s * 0.62, s * 0.2, a, a + 0.68, shade(body, -0.45));
      arcBand(g, x, y, s * 0.62, s * 0.2, a, a + 0.68, i < 3 || i > 6 ? shade(body, 0.14) : body);
    }
    for (let i = 0; i < 7; i++) {
      const a = rand() * Math.PI * 2,
        r = s * (0.2 + rand() * 0.7),
        rr = 2 + rand() * s * 0.08;
      oval(g, x + Math.cos(a) * r + 1, y + Math.sin(a) * r + 1.5, rr, rr * 0.8, shade(body, -0.4));
      oval(g, x + Math.cos(a) * r, y + Math.sin(a) * r, rr, rr * 0.8, shade(body, 0.08));
    }
  },
  // A lava vent: a stepped cone with a glowing crater.
  volcanic: (g, x, y, s, body, accent) => {
    for (let k = 0; k < 4; k++) {
      const r = s * (0.84 - k * 0.15),
        o = -k * s * 0.03;
      polygon(g, x + o, y + o, r, 12, shade(body, -0.3 + k * 0.12), k * 0.2);
    }
    disc(g, x - s * 0.12, y - s * 0.12, s * 0.24, 0x150c08);
    disc(g, x - s * 0.12, y - s * 0.12, s * 0.15, blend(accent, 0xff5a1f, 0.5));
    disc(g, x - s * 0.13, y - s * 0.13, s * 0.07, 0xffe2a0);
  },
  // An ice spire: layered spiky star with lit facets.
  ice: (g, x, y, s, body) => {
    star(g, x + 2, y + 3, s * 0.88, s * 0.42, 7, 0x000000, 0.2, 0.25);
    star(g, x, y, s * 0.86, s * 0.42, 7, shade(body, -0.1), 0.2);
    star(g, x - s * 0.05, y - s * 0.05, s * 0.62, s * 0.3, 7, shade(body, 0.18), 0.45);
    star(g, x - s * 0.1, y - s * 0.1, s * 0.34, s * 0.16, 7, shade(body, 0.42), 0.7);
  },
  // A giant tree crown from above: clustered leaf masses, lit on the upper left.
  organic: (g, x, y, s, body, _accent, rand) => {
    const lobes = Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2 + rand() * 0.4;
      return { x: x + Math.cos(a) * s * 0.42, y: y + Math.sin(a) * s * 0.42, r: s * (0.32 + rand() * 0.12) };
    });
    for (const l of lobes) disc(g, l.x, l.y, l.r, shade(body, -0.35));
    disc(g, x, y, s * 0.5, shade(body, -0.25));
    for (const l of lobes) disc(g, l.x - l.r * 0.12, l.y - l.r * 0.12, l.r * 0.8, body);
    for (const l of lobes) disc(g, l.x - l.r * 0.3, l.y - l.r * 0.3, l.r * 0.4, shade(body, 0.18));
    disc(g, x - s * 0.1, y - s * 0.1, s * 0.3, shade(body, 0.1));
  },
  // A giant crystal: prisms radiating from a lit core.
  crystal: (g, x, y, s, body, accent, rand) => {
    disc(g, x, y, s * 0.4, shade(body, -0.45));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rand() * 0.5,
        l = s * (0.55 + rand() * 0.35),
        w = s * 0.14,
        c = Math.cos(a),
        sn = Math.sin(a),
        tip = { x: x + c * l, y: y + sn * l },
        lit = Math.cos(a + 0.75 * Math.PI) > 0;
      g.fillStyle(shade(body, lit ? 0.25 : -0.15));
      g.fillTriangle(x - sn * w, y + c * w, tip.x, tip.y, x + sn * w, y - c * w);
      g.fillStyle(shade(blend(body, accent, 0.4), 0.3), 0.7);
      g.fillTriangle(x, y, tip.x, tip.y, x + sn * w, y - c * w);
    }
    polygon(g, x, y, s * 0.26, 6, blend(body, accent, 0.5), 0.3);
    polygon(g, x - s * 0.04, y - s * 0.04, s * 0.13, 6, shade(accent, 0.35), 0.3);
  },
  // A reef: a rock base grown over with branching coral.
  water: (g, x, y, s, body, accent, rand) => {
    blob(g, x, y, s * 0.72, 10, 0.3, rand, shade(body, -0.3));
    blob(g, x - s * 0.06, y - s * 0.06, s * 0.56, 9, 0.3, rand, shade(body, -0.05));
    const coral = blend(accent, 0xff8a7a, 0.45);
    for (let i = 0; i < 5; i++) {
      let a = rand() * Math.PI * 2,
        px = x + Math.cos(a) * s * 0.2,
        py = y + Math.sin(a) * s * 0.2;
      g.lineStyle(Math.max(2, s * 0.06), shade(coral, -0.2));
      for (let k = 0; k < 3; k++) {
        a += (rand() - 0.5) * 1.2;
        const nx = px + Math.cos(a) * s * 0.18,
          ny = py + Math.sin(a) * s * 0.18;
        g.lineBetween(px, py, nx, ny);
        px = nx;
        py = ny;
      }
      disc(g, px, py, Math.max(1.8, s * 0.06), shade(coral, 0.2));
    }
  },
};
// The second design of each family.
const PAINTERS_B: Record<GroundFamily, Painter> = {
  // A radar bunker: a chamfered block with a lit roof, vents and the dish socket (the dish turns in the light layer).
  metal: (g, x, y, s, body) => {
    chamferRect(g, x + 2, y + 3, s * 0.66, s * 0.6, s * 0.16, shade(body, -0.5));
    chamferRect(g, x, y, s * 0.64, s * 0.58, s * 0.15, shade(body, -0.05));
    chamferRect(g, x - s * 0.04, y - s * 0.04, s * 0.52, s * 0.46, s * 0.12, shade(body, 0.14));
    for (let i = 0; i < 3; i++) chamferRect(g, x - s * 0.3 + i * s * 0.12, y + s * 0.3, s * 0.035, s * 0.12, 1, shade(body, -0.35));
    disc(g, x + s * 0.12, y - s * 0.08, s * 0.3, shade(body, -0.4));
    disc(g, x + s * 0.11, y - s * 0.09, s * 0.24, shade(body, -0.2));
  },
  // An obelisk: a tall stone with a lit face and carved glyphs (they glow in the light layer).
  sand: (g, x, y, s, body) => {
    oval(g, x + s * 0.3, y + s * 0.34, s * 0.6, s * 0.18, 0x000000, 0.25, 0.6);
    polygon(g, x, y, s * 0.5, 4, shade(body, -0.35), Math.PI / 4);
    polygon(g, x - s * 0.04, y - s * 0.04, s * 0.42, 4, shade(body, 0.05), Math.PI / 4);
    polygon(g, x - s * 0.09, y - s * 0.09, s * 0.24, 4, shade(body, 0.22), Math.PI / 4);
    for (let i = -1; i <= 1; i++) chamferRect(g, x - s * 0.04 + i * s * 0.12, y + s * 0.12, s * 0.025, s * 0.07, 0.5, shade(body, -0.4));
  },
  // A stone circle: menhirs around a flat altar stone.
  rock: (g, x, y, s, body, _accent, rand) => {
    disc(g, x, y, s * 0.66, shade(body, -0.2), 0.5);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rand() * 0.3,
        mx = x + Math.cos(a) * s * 0.62,
        my = y + Math.sin(a) * s * 0.62,
        r = s * (0.12 + rand() * 0.05);
      oval(g, mx + 2, my + 3, r, r * 0.8, 0x000000, 0.3);
      oval(g, mx, my, r, r * 0.8, shade(body, -0.25));
      oval(g, mx - r * 0.2, my - r * 0.25, r * 0.65, r * 0.5, shade(body, 0.16));
    }
    chamferRect(g, x + 1.5, y + 2, s * 0.26, s * 0.18, s * 0.06, shade(body, -0.5));
    chamferRect(g, x, y, s * 0.26, s * 0.18, s * 0.06, shade(body, 0.04));
    chamferRect(g, x - 1, y - 1, s * 0.2, s * 0.12, s * 0.04, shade(body, 0.18));
  },
  // A lava lake: a crusted rim around molten rock with floating plates.
  volcanic: (g, x, y, s, body, accent, rand) => {
    blob(g, x, y, s * 0.84, 12, 0.18, rand, shade(body, -0.25));
    blob(g, x - s * 0.04, y - s * 0.04, s * 0.68, 11, 0.2, rand, shade(body, 0.12));
    blob(g, x, y, s * 0.56, 11, 0.2, rand, blend(accent, 0xff5a1f, 0.6));
    blob(g, x + s * 0.02, y + s * 0.02, s * 0.38, 9, 0.25, rand, 0xffa040);
    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2,
        r = s * (0.15 + rand() * 0.3);
      polygon(g, x + Math.cos(a) * r, y + Math.sin(a) * r, s * (0.06 + rand() * 0.05), 5, shade(body, -0.2), rand() * 3);
    }
  },
  // A frozen pond: pale ice in a snowy rim, cut by cracks.
  ice: (g, x, y, s, body, _accent, rand) => {
    blob(g, x, y, s * 0.84, 12, 0.2, rand, shade(body, 0.25));
    blob(g, x + s * 0.03, y + s * 0.03, s * 0.68, 11, 0.18, rand, shade(body, -0.3));
    blob(g, x, y, s * 0.64, 11, 0.18, rand, shade(body, -0.12));
    g.lineStyle(1.2, shade(body, 0.45), 0.7);
    for (let i = 0; i < 4; i++) {
      let a = rand() * Math.PI * 2,
        cx = x + (rand() - 0.5) * s * 0.3,
        cy = y + (rand() - 0.5) * s * 0.3;
      const points = [{ x: cx, y: cy }];
      for (let k = 0; k < 3; k++) {
        a += (rand() - 0.5) * 1.1;
        cx += Math.cos(a) * s * 0.16;
        cy += Math.sin(a) * s * 0.16;
        points.push({ x: cx, y: cy });
      }
      g.strokePoints(points, false);
    }
  },
  // Giant mushrooms: three spotted caps (they glow in the light layer).
  organic: (g, x, y, s, body, accent) => {
    for (const [dx, dy, r] of MUSHROOMS) {
      const cx = x + dx * s,
        cy = y + dy * s,
        rr = r * s;
      oval(g, cx + 2, cy + 3, rr, rr * 0.9, 0x000000, 0.3);
      disc(g, cx, cy, rr, shade(blend(body, accent, 0.3), -0.3));
      disc(g, cx - rr * 0.1, cy - rr * 0.1, rr * 0.86, blend(body, accent, 0.35));
      disc(g, cx - rr * 0.3, cy - rr * 0.3, rr * 0.36, shade(blend(body, accent, 0.35), 0.22));
      for (let i = 0; i < 4; i++) disc(g, cx + Math.cos(i * 1.7 + dx * 9) * rr * 0.55, cy + Math.sin(i * 1.7 + dx * 9) * rr * 0.55, rr * 0.1, shade(accent, 0.5), 0.8);
    }
  },
  // A geode: a broken rock shell lined with crystal teeth around a hollow.
  crystal: (g, x, y, s, body, accent, rand) => {
    blob(g, x, y, s * 0.82, 12, 0.18, rand, shade(body, -0.4));
    blob(g, x - s * 0.04, y - s * 0.04, s * 0.7, 11, 0.15, rand, shade(body, -0.1));
    disc(g, x, y, s * 0.5, shade(blend(body, accent, 0.3), -0.55));
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2,
        c = Math.cos(a),
        sn = Math.sin(a),
        r0 = s * 0.52,
        r1 = s * (0.26 + rand() * 0.12),
        w = s * 0.08,
        lit = Math.cos(a + 0.75 * Math.PI) < 0;
      g.fillStyle(shade(blend(body, accent, 0.5), lit ? 0.3 : -0.1));
      g.fillTriangle(x + c * r0 - sn * w, y + sn * r0 + c * w, x + c * r0 + sn * w, y + sn * r0 - c * w, x + c * r1, y + sn * r1);
    }
  },
  // A whirlpool: a dark pool ringed by rocks (the water turns in the light layer).
  water: (g, x, y, s, body, _accent, rand) => {
    blob(g, x, y, s * 0.82, 12, 0.22, rand, shade(body, -0.25));
    disc(g, x, y, s * 0.6, shade(body, -0.55));
    disc(g, x, y, s * 0.3, shade(body, -0.7));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + rand() * 0.5,
        r = s * 0.1 + rand() * s * 0.05;
      oval(g, x + Math.cos(a) * s * 0.72 + 1, y + Math.sin(a) * s * 0.72 + 1.5, r, r * 0.8, 0x000000, 0.3);
      oval(g, x + Math.cos(a) * s * 0.72, y + Math.sin(a) * s * 0.72, r, r * 0.8, shade(body, 0.1));
    }
  },
};
/** Mushroom caps of the organic landmark B: offset from the centre and radius, in half sizes. */
const MUSHROOMS = [
  [-0.22, -0.18, 0.42],
  [0.34, 0.08, 0.3],
  [-0.08, 0.42, 0.24],
] as const;
/** Draws one landmark into the static terrain. */
export function drawLandmark(g: Ink, spot: LandmarkSpot, family: GroundFamily, theme: LandmarkTheme, rand: Random) {
  const { x, y, s } = landmarkFrame(spot),
    body = blend(blend(blend(theme.ground[0], theme.ground[1], 0.5), TINT[family], 0.45), theme.accent, family === "metal" ? 0.14 : 0);
  contactShadow(g, x, y, s * 0.9, s * 0.75, 0.4);
  (spot.variant ? PAINTERS_B : PAINTERS)[family](g, x, y, s, shade(body, 0.08), theme.accent, rand);
}
/** Mote rising from (`x`, `y`) over `period` seconds: position and remaining life, from the clock and a seed. */
function rising(x: number, y: number, clock: number, period: number, seed: number, height: number, drift: number) {
  const life = (clock / period + hash01(seed)) % 1;
  return { x: x + Math.sin(life * 5 + seed) * drift + life * drift, y: y - life * height, life };
}
/**
 * The landmark's animated part, drawn every frame: light (beacons, glows, glints) on `glow`, the additive layer below
 * the units, and motion (dust, smoke, bubbles, a turning dish) on `g`. `lit` scales the light (`themeGlow`).
 */
export function landmarkLight(g: Ink, glow: Ink, spot: LandmarkSpot, family: GroundFamily, accent: number, clock: number, lit = 1) {
  const { x, y, s } = landmarkFrame(spot),
    phase = (spot.x * 7 + spot.y * 13) % 10,
    seed = spot.x * 31 + spot.y * 17;
  if (spot.variant) return landmarkLightB(g, glow, x, y, s, family, accent, clock, lit, phase, seed);
  switch (family) {
    case "metal": {
      const on = Math.sin(clock * 2.4 + phase) > 0.55 ? 1 : 0.25;
      halo(glow, x + s * 0.5, y - s * 0.42, 10, accent, 0.3 * on * lit);
      disc(g, x + s * 0.5, y - s * 0.42, 2.4, accent, on);
      return;
    }
    case "volcanic": {
      const k = 0.6 + 0.4 * Math.sin(clock * 1.6 + phase);
      halo(glow, x - s * 0.12, y - s * 0.12, s * 0.5, 0xff7a2a, 0.3 * k * lit);
      disc(glow, x - s * 0.12, y - s * 0.12, s * 0.14, 0xffb060, 0.25 * k * lit);
      return;
    }
    case "crystal": {
      const k = 0.5 + 0.5 * Math.sin(clock * 1.2 + phase);
      halo(glow, x, y, s * 0.6, accent, 0.25 * k * lit);
      disc(glow, x - s * 0.04, y - s * 0.04, s * 0.1, 0xffffff, 0.3 * k * lit);
      return;
    }
    // Mesa: dust blown off the top edge, a warm glint on the upper rim.
    case "sand": {
      for (let i = 0; i < 4; i++) {
        const m = rising(x - s * 0.1, y - s * 0.2, clock, 4.5, seed + i * 0.25, -s * 0.2, s * 0.6);
        disc(g, m.x + m.life * s * 0.6, m.y, 2 + m.life * 5, 0xe8d2a8, 0.12 * Math.sin(m.life * Math.PI));
      }
      halo(glow, x - s * 0.22, y - s * 0.3, s * 0.3, 0xffe0a0, (0.08 + 0.06 * Math.sin(clock * 0.7 + phase)) * lit);
      return;
    }
    // Ruined tower: a fire inside the walls, sparks and smoke drifting up.
    case "rock": {
      const f = 0.6 + 0.25 * Math.sin(clock * 9 + phase) + 0.15 * Math.sin(clock * 23 + phase * 3);
      halo(glow, x, y, s * 0.5, 0xff8a3a, 0.28 * f * lit);
      disc(g, x, y, 3.2, 0xffd27a, 0.8 * f);
      for (let i = 0; i < 3; i++) {
        const m = rising(x, y - 2, clock, 1.6, seed + i / 3, s * 0.8, 4);
        disc(g, m.x, m.y, 1.2, m.life < 0.5 ? 0xffd27a : 0xff7a3a, 1 - m.life);
        const smoke = rising(x, y - 6, clock, 3.2, seed + 0.5 + i / 3, s * 1.1, 8);
        disc(g, smoke.x, smoke.y, 3 + smoke.life * 6, 0x9a948c, 0.12 * (1 - smoke.life));
      }
      return;
    }
    // Ice spire: a cold glow and a glint wandering over the facets.
    case "ice": {
      halo(glow, x, y, s * 0.7, 0xbfe8ff, (0.08 + 0.05 * Math.sin(clock * 0.9 + phase)) * lit);
      const a = clock * 0.6 + phase,
        tw = Math.max(0, Math.sin(clock * 1.7 + phase)) ** 4,
        gx = x - s * 0.1 + Math.cos(a) * s * 0.3,
        gy = y - s * 0.1 + Math.sin(a) * s * 0.3,
        r = 2 + 5 * tw;
      if (tw < 0.05) return;
      glow.lineStyle(1.4, 0xffffff, 0.35 * tw * lit);
      glow.lineBetween(gx - r, gy, gx + r, gy);
      glow.lineBetween(gx, gy - r, gx, gy + r);
      return;
    }
    // Giant tree: fireflies circling the crown.
    case "organic": {
      for (let i = 0; i < 5; i++) {
        const a = clock * (0.3 + i * 0.05) + i * 1.3 + phase,
          r = s * (0.75 + 0.12 * Math.sin(clock * 0.8 + i)),
          fx = x + Math.cos(a) * r,
          fy = y + Math.sin(a) * r * 0.8,
          on = 0.5 + 0.5 * Math.sin(clock * 2.2 + i * 2.1);
        halo(glow, fx, fy, 7, 0xd8ff7a, 0.25 * on * lit);
        disc(g, fx, fy, 1.4, 0xf4ffb0, 0.4 + 0.6 * on);
      }
      return;
    }
    // Reef: bubbles rising from the coral and a caustic shimmer.
    case "water": {
      for (let i = 0; i < 4; i++) {
        const m = rising(x + (hash01(seed, i) - 0.5) * s * 0.8, y + s * 0.2, clock, 2.6, seed + i * 0.27, s * 0.9, 3);
        g.lineStyle(1, 0xd8f4ff, 0.5 * (1 - m.life));
        strokeRound(g, m.x, m.y, 1.5 + m.life * 2);
      }
      const k = 0.5 + 0.5 * Math.sin(clock * 0.8 + phase);
      oval(glow, x + Math.sin(clock * 0.5) * s * 0.2, y - s * 0.1, s * 0.5, s * 0.25, accent, 0.06 * k * lit, clock * 0.2);
      return;
    }
  }
}
function landmarkLightB(g: Ink, glow: Ink, x: number, y: number, s: number, family: GroundFamily, accent: number, clock: number, lit: number, phase: number, seed: number) {
  switch (family) {
    // Radar dish turning on the bunker roof, with its sweep on the glow layer.
    case "metal": {
      const cx = x + s * 0.11,
        cy = y - s * 0.09,
        a = clock * 0.9 + phase;
      wedge(glow, cx, cy, s * 1.1, a - 0.35, a, accent, 0.06 * lit);
      oval(g, cx + Math.cos(a) * s * 0.06, cy + Math.sin(a) * s * 0.06, s * 0.22, s * 0.08, 0xc8d4dc, 1, a + Math.PI / 2);
      oval(g, cx + Math.cos(a) * s * 0.09, cy + Math.sin(a) * s * 0.09, s * 0.15, s * 0.045, 0x56646e, 1, a + Math.PI / 2);
      disc(g, cx, cy, 2, accent);
      return;
    }
    // Obelisk: its glyphs breathe in the accent colour.
    case "sand": {
      const k = 0.5 + 0.5 * Math.sin(clock * 1.1 + phase);
      for (let i = -1; i <= 1; i++) disc(glow, x - s * 0.04 + i * s * 0.12, y + s * 0.12, s * 0.09, accent, 0.25 * k * lit);
      halo(glow, x - s * 0.06, y - s * 0.06, s * 0.6, accent, 0.1 * k * lit);
      return;
    }
    // Stone circle: the altar glows and motes rise from it.
    case "rock": {
      const k = 0.5 + 0.5 * Math.sin(clock * 0.9 + phase);
      halo(glow, x, y, s * 0.45, accent, 0.2 * k * lit);
      for (let i = 0; i < 3; i++) {
        const m = rising(x, y, clock, 3, seed + i / 3, s * 0.7, 6);
        disc(glow, m.x, m.y, 1.6, accent, 0.3 * (1 - m.life) * lit);
      }
      return;
    }
    // Lava lake: a pulsing glow and bubbles bursting on the surface.
    case "volcanic": {
      const k = 0.6 + 0.4 * Math.sin(clock * 1.3 + phase);
      halo(glow, x, y, s * 0.8, 0xff7a2a, 0.3 * k * lit);
      for (let i = 0; i < 3; i++) {
        const life = (clock / 1.8 + hash01(seed, i)) % 1,
          bx = x + (hash01(seed, i, Math.floor(clock / 1.8 + hash01(seed, i))) - 0.5) * s * 0.6,
          by = y + (hash01(i, seed) - 0.5) * s * 0.5;
        g.lineStyle(1.2, 0xffe2a0, 0.8 * (1 - life));
        strokeRound(g, bx, by, 1 + life * 4);
      }
      return;
    }
    // Frozen pond: a sheen of light sliding across the ice.
    case "ice": {
      const t = (clock * 0.12 + phase * 0.1) % 1,
        sx = x - s * 0.6 + t * s * 1.2;
      oval(glow, sx, y - s * 0.05, s * 0.18, s * 0.5, 0xdff4ff, 0.12 * Math.sin(t * Math.PI) * lit, 0.5);
      halo(glow, x, y, s * 0.6, 0xbfe8ff, 0.08 * lit);
      return;
    }
    // Mushrooms: the caps glow out of step, spores drift up.
    case "organic": {
      MUSHROOMS.forEach(([dx, dy, r], i) => {
        const k = 0.5 + 0.5 * Math.sin(clock * 1.3 + i * 2.1 + phase);
        halo(glow, x + dx * s, y + dy * s, r * s * 1.5, shade(accent, 0.3), 0.22 * k * lit);
      });
      for (let i = 0; i < 4; i++) {
        const m = rising(x + (hash01(seed, i) - 0.5) * s, y, clock, 3.5, seed + i * 0.25, s, 6);
        disc(glow, m.x, m.y, 1.3, shade(accent, 0.5), 0.3 * (1 - m.life) * lit);
      }
      return;
    }
    // Geode: the hollow glows and a sparkle jumps between the teeth.
    case "crystal": {
      const k = 0.5 + 0.5 * Math.sin(clock * 1.4 + phase);
      halo(glow, x, y, s * 0.55, accent, 0.28 * k * lit);
      const n = Math.floor(clock * 1.5 + phase),
        a = hash01(seed, n) * Math.PI * 2,
        tw = Math.sin(((clock * 1.5 + phase) % 1) * Math.PI),
        gx = x + Math.cos(a) * s * 0.4,
        gy = y + Math.sin(a) * s * 0.4,
        r = 2 + 4 * tw;
      glow.lineStyle(1.2, 0xffffff, 0.35 * tw * lit);
      glow.lineBetween(gx - r, gy, gx + r, gy);
      glow.lineBetween(gx, gy - r, gx, gy + r);
      return;
    }
    // Whirlpool: spiral arms turning towards the centre, a ripple spreading outwards.
    case "water": {
      for (let i = 0; i < 3; i++) {
        const a = -clock * 0.8 + (i * Math.PI * 2) / 3;
        g.lineStyle(1.4, 0xd8f4ff, 0.22);
        g.beginPath();
        arcPath(g, x, y, s * (0.22 + i * 0.1), a, a + 1.6);
        g.strokePath();
      }
      const t = (clock * 0.35 + phase * 0.1) % 1;
      ring(glow, x, y, s * (0.3 + t * 0.35), 1.5, 0xbfe8ff, 0.18 * (1 - t) * lit);
      return;
    }
  }
}
