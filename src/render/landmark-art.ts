import { arcBand, CELL, disc, oval, polygon, shade, star, type Ink } from "./shapes";
import { blend, type GroundFamily } from "./ground";
import type { LandmarkSpot } from "./landmarks";
/**
 * Landmarks: one large set-piece per ground family on the spots of `landmarks.ts`, lit from the upper left like the
 * rest of the board. `drawLandmark` is static terrain; `landmarkLight` is its animated light for the ambient layer.
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
/** Draws one landmark into the static terrain. */
export function drawLandmark(g: Ink, spot: LandmarkSpot, family: GroundFamily, theme: LandmarkTheme, rand: Random) {
  const { x, y, s } = landmarkFrame(spot),
    body = blend(blend(blend(theme.ground[0], theme.ground[1], 0.5), TINT[family], 0.45), theme.accent, family === "metal" ? 0.14 : 0);
  contactShadow(g, x, y, s * 0.9, s * 0.75, 0.4);
  PAINTERS[family](g, x, y, s, shade(body, 0.08), theme.accent, rand);
}
/** The landmark's animated light (beacon, crater glow, crystal core), drawn every frame on the ambient layer. */
export function landmarkLight(g: Ink, spot: LandmarkSpot, family: GroundFamily, accent: number, clock: number) {
  const { x, y, s } = landmarkFrame(spot),
    phase = (spot.x * 7 + spot.y * 13) % 10;
  if (family === "metal") {
    const on = Math.sin(clock * 2.4 + phase) > 0.55 ? 1 : 0.25;
    disc(g, x + s * 0.5, y - s * 0.42, 6, accent, 0.16 * on);
    disc(g, x + s * 0.5, y - s * 0.42, 2.4, accent, on);
  } else if (family === "volcanic") {
    const k = 0.6 + 0.4 * Math.sin(clock * 1.6 + phase);
    disc(g, x - s * 0.12, y - s * 0.12, s * 0.34, 0xff7a2a, 0.12 * k);
    disc(g, x - s * 0.12, y - s * 0.12, s * 0.16, 0xffb060, 0.35 * k);
  } else if (family === "crystal") {
    const k = 0.5 + 0.5 * Math.sin(clock * 1.2 + phase);
    disc(g, x, y, s * 0.42, accent, 0.08 * k);
    disc(g, x - s * 0.04, y - s * 0.04, s * 0.12, 0xffffff, 0.25 * k);
  }
}
