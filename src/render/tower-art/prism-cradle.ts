/**
 * Prism Cradle: Decay's look in the 3/4 tilt (see `tilt.ts`). A round stone dais with a glyph ring and a dark well
 * (`base`, baked per level and trim colour); three claws leaning in (`turret`: a radial tower never aims, so the cache
 * holds one picture per look); the dais lights, the well's glow and the crystal's shadow in it (`below`); and over the
 * claws a triangular bipyramid crystal that floats, turns and bobs, with motes drifting in, shards orbiting from level
 * 3 and a flare on each shot (`above`). Orbs leave the crystal's centre: `TILTS.prism.emit`.
 */
import type { TiltedArt } from "./tilted";
import { facing, halo } from "../material";
import { disc, oval, ring, shade, type Ink } from "../shapes";
import type { TurretContext } from "./kit";
import { OUTLINE, SQUASH, X, Y, drum, fillPoints, onGround, point } from "./tilt";
import { TILTS } from "../muzzles";

const TILT = TILTS.prism,
  DROP = TILT.drop;
/** Dais (the motif's deck) and crystal (the emit point) heights. */
const DAIS = TILT.deck,
  RIM = 1.8,
  CRYSTAL = TILT.emit!,
  CLAW_R = 15.5;
const STONE = 0x3b3846,
  STONE_TOP = 0x585468,
  DEEP = 0x1b1924,
  METAL = 0x9a94ad;
/** The three claws at 90°, 210° and 330°: one in front, two behind. */
const CLAWS = [0, 1, 2].map((i) => Math.PI / 2 + (i * Math.PI * 2) / 3);
/** View direction in (u, v, h): the tilt shows ground depth at SQUASH and heights at full size. */
const VIEW = [0, Math.sqrt(1 - SQUASH * SQUASH), SQUASH];

type P3 = readonly [number, number, number];
/**
 * Fills the faces of a convex solid that turn to the viewer, shaded by how they face the light (flatter faces read
 * as tops). Faces may be wound either way: each normal is turned away from the solid's centre.
 */
function solid(g: Ink, x: number, y0: number, faces: readonly (readonly P3[])[], color: number, edge: number) {
  const centre = [0, 0, 0];
  let count = 0;
  for (const f of faces)
    for (const p of f) {
      centre[0] += p[0];
      centre[1] += p[1];
      centre[2] += p[2];
      count++;
    }
  for (let k = 0; k < 3; k++) centre[k] /= count;
  for (const f of faces) {
    const [a, b, c] = f,
      e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
      e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]],
      n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]],
      out = (a[0] - centre[0]) * n[0] + (a[1] - centre[1]) * n[1] + (a[2] - centre[2]) * n[2] < 0 ? -1 : 1,
      len = (Math.sqrt(n[0] ** 2 + n[1] ** 2 + n[2] ** 2) || 1) * out;
    if ((n[0] * VIEW[0] + n[1] * VIEW[1] + n[2] * VIEW[2]) * out <= 0) continue;
    const up = n[2] / len,
      side = Math.sqrt(n[0] ** 2 + n[1] ** 2) / Math.abs(len),
      lit = up * 0.25 + side * 0.4 * facing(Math.atan2(n[1] * out, n[0] * out));
    f.forEach((p, i) => point(i, X(x, p[0]), Y(y0, p[1], p[2])));
    fillPoints(g, f.length, OUTLINE, 0.9);
    f.forEach((p, i) => point(i, X(x, p[0]), Y(y0, p[1], p[2])));
    fillPoints(g, f.length, shade(color, -0.1 + lit));
    g.lineStyle(0.6, edge, 0.8);
    for (let i = 0; i < f.length; i++) {
      const p = f[i],
        q = f[(i + 1) % f.length];
      g.lineBetween(X(x, p[0]), Y(y0, p[1], p[2]), X(x, q[0]), Y(y0, q[1], q[2]));
    }
  }
}
/** A leaning claw: a frustum from a wide foot at the dais rim to a narrow tip over the well, as faces for `solid`. */
function clawFaces(t: number, top: number, from = 0, to = 1, grow = 0): P3[][] {
  const cu = Math.cos(t),
    cv = Math.sin(t),
    at = (r: number, w: number, h: number): P3 => [cu * r - cv * w, cv * r + cu * w, h],
    /** The claw's cross-section at fraction f of its height, widened by `grow`. */
    section = (f: number) => {
      const mix = (a: number, b: number) => a + (b - a) * f,
        h = mix(DAIS, top);
      return [
        at(mix(18, 12.5) + grow, -mix(3, 1.1) - grow, h),
        at(mix(18, 12.5) + grow, mix(3, 1.1) + grow, h),
        at(mix(12.5, 10) - grow, mix(2.6, 0.9) + grow, h),
        at(mix(12.5, 10) - grow, -mix(2.6, 0.9) - grow, h),
      ];
    },
    foot = section(from),
    tip = section(to),
    faces: P3[][] = [tip];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    faces.push([foot[i], foot[j], tip[j], tip[i]]);
  }
  return faces;
}
/** Faces of a triangular bipyramid crystal: three walls between two rings, a pyramid above and below. */
function crystalFaces(spin: number, r: number, hc: number, half: number, tipUp: number, tipDown: number) {
  const ring = (h: number) => [0, 1, 2].map((i) => [Math.cos(spin + (i * Math.PI * 2) / 3) * r, Math.sin(spin + (i * Math.PI * 2) / 3) * r, h] as P3),
    lo = ring(hc - half),
    hi = ring(hc + half),
    top: P3 = [0, 0, hc + half + tipUp],
    bottom: P3 = [0, 0, hc - half - tipDown],
    faces: P3[][] = [];
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    faces.push([lo[i], lo[j], hi[j], hi[i]], [hi[i], hi[j], top], [lo[j], lo[i], bottom]);
  }
  return faces;
}

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  onGround(g, x, y0, 0, () => {
    oval(g, 5, 7, 25, 21, 0x050b10, 0.2);
    oval(g, 2, 3, 21, 20, 0x050b10, 0.36);
  });
  // A two-step round dais: a dark foot ring, then the stone with a sunken well for the crystal's light.
  drum(g, x, y0, 21, 0, RIM, DEEP, shade(STONE, -0.1), 20);
  drum(g, x, y0, 18.5, RIM, DAIS, STONE, STONE_TOP, 20);
  onGround(g, x, y0, DAIS, () => {
    // Glyph ring engraved in the top, in the path colour from level 6.
    ring(g, 0, 0, 13.6, 0.8, level >= 6 ? color : shade(c, -0.55), 0.95);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      g.lineStyle(0.6, DEEP, 0.8);
      g.lineBetween(Math.cos(a) * 14.6, Math.sin(a) * 14.6, Math.cos(a) * 17.6, Math.sin(a) * 17.6);
    }
    disc(g, 0, 0, 8.5, DEEP);
    ring(g, 0, 0, 8.5, 1, shade(STONE, -0.3));
  });
  // Slots for the level lights in the front wall (lit live); level 3 adds bolts on the foot ring.
  for (let i = 0; i < 5; i++) {
    const t = Math.PI * (0.2 + i * 0.15),
      sx = X(x, Math.cos(t) * 18.6),
      sy = Y(y0, Math.sin(t) * 18.6, (RIM + DAIS) / 2);
    g.fillStyle(DEEP);
    g.fillRect(sx - 1.1, sy - 0.6, 2.2, 1.2);
  }
  if (level >= 3)
    for (let i = 0; i < 6; i++) {
      const t = Math.PI * (0.1 + i * 0.16),
        bx = X(x, Math.cos(t) * 20.4),
        by = Y(y0, Math.sin(t) * 20.4, RIM * 0.5);
      disc(g, bx, by, 0.8, OUTLINE);
      disc(g, bx - 0.25, by - 0.25, 0.4, METAL);
    }
}

/** The three claws leaning in toward the crystal; taller and armoured from level 5, path-coloured tips from level 6. */
function turret({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    top = level >= 5 ? 15.5 : 13.5;
  for (const t of [...CLAWS].sort((a, b) => Math.sin(a) - Math.sin(b))) {
    solid(g, x, y0, clawFaces(t, top), 0x8a84a4, 0x262233);
    // Level 5: an armour band in the tower colour round each claw, a third of the way up.
    if (level >= 5) solid(g, x, y0, clawFaces(t, top, 0.3, 0.45, 0.3), shade(c, -0.55), shade(c, -0.15));
    // A spike on each tip, in the path colour from level 6.
    const tx = X(x, Math.cos(t) * 11.2),
      ty = Y(y0, Math.sin(t) * 11.2, top);
    g.fillStyle(OUTLINE, 0.9);
    g.fillTriangle(tx - 1.7, ty + 0.8, tx + 1.7, ty + 0.8, X(x, Math.cos(t) * 9.6), ty - 5);
    g.fillStyle(level >= 6 ? color : shade(c, -0.25));
    g.fillTriangle(tx - 1.1, ty + 0.4, tx + 1.1, ty + 0.4, X(x, Math.cos(t) * 9.7), ty - 4.2);
  }
}

/** Under the claws: the level lights in the dais wall (lit from 2, chasing from 4), the well's glow and the crystal's shadow. */
function below({ g, glow, x, y, tower, level, color, definition, clock, charge, energy }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    lift = Math.sin(clock * 2 + tower.id) * 1.5;
  for (let i = 0; i < 5; i++) {
    const t = Math.PI * (0.2 + i * 0.15),
      chase = level >= 4 ? 0.6 * Math.max(0, Math.sin(4 * clock - i * 1.1)) : 0,
      on = Math.min(1, (level >= 2 ? 0.35 : 0.1) + chase),
      sx = X(x, Math.cos(t) * 18.7),
      sy = Y(y0, Math.sin(t) * 18.7, (RIM + DAIS) / 2);
    g.fillStyle(shade(color, -0.65 + 0.75 * on));
    g.fillRect(sx - 0.7, sy - 0.35, 1.4, 0.7);
    if (on > 0.4) disc(glow, sx, sy, 2.2, color, 0.25 * on);
  }
  // The well glows, and the crystal casts a shadow into it that shrinks as it rises.
  onGround(glow, x, y0, DAIS, () => disc(glow, 0, 0, 8, c, 0.08 + 0.15 * charge + energy * 0.5));
  onGround(g, x, y0, DAIS, () => disc(g, 2, 3, 5.5 - 0.4 * lift, 0x050b10, 0.4 - 0.04 * lift));
}

/** Over the claws: the floating crystal with its core and halo, the motes drifting into it, the orbiting shards, the shot's flare. */
function above({ g, glow, x, y, tower, level, definition, clock, charge, kick, energy, maxed, peak }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    spin = clock * 0.6 + tower.id,
    lift = Math.sin(clock * 2 + tower.id) * 1.5,
    hc = CRYSTAL + lift;
  // The crystal: a glowing heart behind the faces, the faces, a core facet and a halo with the charge.
  halo(glow, x, Y(y0, 0, hc), 13, c, Math.min(peak, 0.08 + 0.16 * charge + energy));
  solid(g, x, y0, crystalFaces(spin, 7, hc, 3, 6, 7.5), shade(c, -0.15), shade(c, 0.45));
  // The core shows through the front facets: white when maxed, dark otherwise, flaring on a shot.
  const cy = Y(y0, 0, hc);
  disc(g, x, cy, 1.9, maxed ? 0xffffff : shade(c, -0.6 + 0.9 * kick));
  disc(glow, x, cy, 3.5, c, 0.2 + 0.3 * charge);
  // Motes drift in from the claws' tips and vanish into the crystal.
  for (let i = 0; i < 3; i++) {
    const phase = (clock * 0.5 + i / 3 + tower.id * 0.11) % 1,
      t = CLAWS[i] - clock * 0.4,
      r = (CLAW_R - 6) * (1 - phase),
      h = 13 + (hc - 13) * phase;
    disc(glow, X(x, Math.cos(t) * r), Y(y0, Math.sin(t) * r, h), 1.5, shade(c, 0.4), 0.35 * Math.min(1, phase * 3));
  }
  // Level 3: three shards orbit the crystal.
  if (level >= 3)
    for (let i = 0; i < 3; i++) {
      const t = -spin * 1.4 + (i * Math.PI * 2) / 3,
        sx = X(x, Math.cos(t) * 12),
        sy = Y(y0, Math.sin(t) * 12, hc - 1),
        front = Math.sin(t) > 0;
      g.fillStyle(OUTLINE, 0.9);
      g.fillTriangle(sx, sy - 2.6, sx + 1.7, sy + 0.6, sx - 1.7, sy + 0.6);
      g.fillStyle(shade(c, front ? 0.3 : -0.1));
      g.fillTriangle(sx, sy - 2, sx + 1.1, sy + 0.2, sx - 1.1, sy + 0.2);
    }
  if (kick > 0) ring(glow, x, cy, 9 + (1 - kick) * 7, 1.5, 0xffffff, 0.35 * kick);
}

export const prismCradle: TiltedArt = { base, below, turret, above };
