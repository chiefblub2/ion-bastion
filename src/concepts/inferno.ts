/**
 * Ember concept, "Furnace Torch": a squat flamethrower in the 3/4 tilt. An octagonal furnace plinth with glowing
 * vents (still), a low turning body with two fuel tanks on its back and a short flared nozzle (turret), the pilot
 * flame, vent glow, fuel gauge and lamps (live).
 */
import { halo } from "../render/material";
import { disc, oval, ring, shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { FOOT, INSET, OUTLINE, SQUASH, X, Y, block, drum, endFace, fillPoints, onGround, point, quad, towardViewer, tube, turn } from "../render/tower-art/tilt";
import type { Concept } from "./types";

const DROP = 5,
  HB = 10.5,
  RECOIL = 3,
  reach = (l: number) => 15 + 0.5 * l;
/** Plinth: octagon radius and height; turntable top; body heights. */
const R = 20,
  H = 5,
  TABLE = 6.5,
  BODY_TOP = 13,
  BEVEL = 1.2;
/** Warm gunmetal of the furnace and body, its highlight, and the dark interior. */
const WALL = 0x3a3330,
  TOP = 0x5a4e47,
  METAL = 0x9a8a80,
  DEEP = 0x1c1614;

/** Regular octagon with flat faces at the four cardinal directions. */
const OCT = Array.from({ length: 16 }, (_, i) => (i % 2 ? Math.sin : Math.cos)(Math.PI / 8 + (Math.floor(i / 2) * Math.PI) / 4) * R);
/** The turning body: blunt at the back where the tanks sit, tapered toward the nozzle. */
const BODY = [-7.5, -6, 2.5, -6.5, 7.5, -4, 7.5, 4, 2.5, 6.5, -7.5, 6];
/** Level 5: armour skirts on both flanks. */
const SKIRTS = [
  [-5, 6.3, 3, 6.6, 3, 7.8, -5, 7.5],
  [-5, -7.5, 3, -7.8, 3, -6.6, -5, -6.3],
];
const TANK_Q = 4.3,
  TANK_R = 3.6,
  TANK_FROM = -16,
  TANK_TO = -7.8;
/** Vent sockets on the three plinth faces turned to the viewer (face index, angle of its normal). */
const VENTS = [1, 2, 3];

const oct = (i: number) => [OCT[2 * (i % 8)], OCT[2 * (i % 8) + 1]] as const;

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  onGround(g, x, y0, 0, () => {
    oval(g, 5, 7, R + 6, R + 2, 0x050b10, 0.22);
    oval(g, 2, 3, R + 1.5, R, 0x050b10, 0.35);
  });
  const n = turn(OCT, 0, FOOT);
  turn(OCT, 0, INSET, 0.9);
  block(g, x, y0, FOOT, INSET, n, 0, H, 1.2, WALL, TOP, METAL);
  // Vent sockets: dark slits on the front faces with dim embers behind (the glow is live).
  for (const i of VENTS) {
    const [u0, v0] = oct(i),
      [u1, v1] = oct(i + 1);
    for (const f of [0.3, 0.5, 0.7]) {
      const u = u0 + (u1 - u0) * f,
        v = v0 + (v1 - v0) * f;
      quad(g, X(x, u) - 1, Y(y0, v, 1.2), X(x, u) + 1, Y(y0, v, 1.2), X(x, u) + 1, Y(y0, v, H - 1.3), X(x, u) - 1, Y(y0, v, H - 1.3), DEEP);
      quad(g, X(x, u) - 0.4, Y(y0, v, 1.6), X(x, u) + 0.4, Y(y0, v, 1.6), X(x, u) + 0.4, Y(y0, v, H - 1.7), X(x, u) - 0.4, Y(y0, v, H - 1.7), shade(c, -0.6));
    }
  }
  // Deck: a heat-stained ring, bolts from level 3 and an inlay in the trim colour from level 4.
  onGround(g, x, y0, H + 1.2, () => {
    ring(g, 0, 0, 13, 2.2, DEEP, 0.7);
    ring(g, 0, 0, 15.5, 1, shade(c, -0.55), 0.6);
    if (level >= 4) ring(g, 0, 0, 16.4, 0.8, shade(color, -0.25), 0.95);
    const bolts = level >= 3 ? 8 : 4;
    for (let i = 0; i < bolts; i++) {
      const a = (i * Math.PI * 2) / bolts,
        bx = Math.cos(a) * 15.5,
        by = Math.sin(a) * 15.5;
      disc(g, bx, by, 1.3, shade(WALL, -0.4));
      disc(g, bx - 0.35, by - 0.35, 0.6, METAL, 0.9);
    }
  });
  drum(g, x, y0, 9.5, H + 1.2, TABLE, DEEP, shade(DEEP, 0.25), 12);
}

/** Pivot of a part shifted `q` across the aim on the ground plane. */
const across = (x: number, y0: number, a: number, q: number) => [x - Math.sin(a) * q, y0 + Math.cos(a) * q * SQUASH] as const;

function turret({ g, x, y, tower, definition, level, kick, tip, color }: TurretContext) {
  const a = tower.angle,
    ca = Math.cos(a),
    sa = Math.sin(a),
    y0 = y + DROP,
    c = definition.color,
    end = reach(level) - kick * RECOIL,
    back = -kick * RECOIL * 0.4,
    trim = level >= 6 ? color : shade(c, -0.25);
  // The body's shadow on the deck, cast to the lower right.
  turn(BODY, a, FOOT);
  onGround(g, x, y0, H + 1.2, () => {
    for (let i = 0; i < 6; i++) point(i, FOOT[2 * i] + 4, FOOT[2 * i + 1] + 5);
    fillPoints(g, 6, 0x050b10, 0.3);
  });
  const body = () => {
      const n = turn(BODY, a, FOOT, 1, 0, back * ca, back * sa);
      turn(BODY, a, INSET, 0.82, 0, back * ca, back * sa);
      block(g, x, y0, FOOT, INSET, n, TABLE, BODY_TOP, BEVEL, WALL, TOP, METAL);
      // A hatch seam and the burner grille across the top, trim stripe at the front.
      const ht = BODY_TOP + BEVEL,
        S = (p: number, q: number) => [X(x, (p + back) * ca - q * sa), Y(y0, (p + back) * sa + q * ca, ht)] as const;
      g.lineStyle(0.7, DEEP, 0.85);
      g.lineBetween(...S(-2, -4.4), ...S(-2, 4.4));
      quad(g, ...S(1, -3.4), ...S(5, -2.2), ...S(5, 2.2), ...S(1, 3.4), DEEP);
      g.lineStyle(0.6, shade(c, -0.35), 1);
      for (const q of [-1.6, 0, 1.6]) g.lineBetween(...S(1.6, q * 1.4), ...S(4.6, q));
      quad(g, ...S(5.4, -2.8), ...S(6.2, -2.6), ...S(6.2, 2.6), ...S(5.4, 2.8), trim);
      if (level >= 3)
        for (const q of [-4.4, 4.4]) {
          const [bx, by] = S(-5.5, q);
          disc(g, bx, by, 0.9, shade(WALL, -0.5));
          disc(g, bx - 0.3, by - 0.3, 0.4, METAL);
        }
    },
    skirt = (plate: readonly number[]) => {
      const n = turn(plate, a, FOOT, 1, 0, back * ca, back * sa);
      block(g, x, y0, FOOT, FOOT, n, TABLE + 0.8, BODY_TOP - 1.5, 0, shade(WALL, 0.08), shade(TOP, 0.1), METAL);
    },
    tank = (q: number) => {
      const [tx, ty] = across(x, y0, a, q),
        d0 = TANK_FROM + back,
        d1 = TANK_TO + back,
        h = HB + 0.6;
      tube(g, tx, ty, a, h, d0, d1, TANK_R, shade(c, -0.18));
      // Dark straps, and from level 3 a trim band.
      for (const d of [d0 + 2, d1 - 2]) tube(g, tx, ty, a, h, d - 0.5, d + 0.5, TANK_R + 0.25, DEEP, 1, false);
      if (level >= 3) tube(g, tx, ty, a, h, (d0 + d1) / 2 - 0.5, (d0 + d1) / 2 + 0.5, TANK_R + 0.15, trim, 1, false);
      // The cap at the back, when it faces the viewer.
      if (towardViewer(a) < -0.05) {
        endFace(g, tx, ty, a, h, d0, TANK_R, shade(c, -0.45));
        endFace(g, tx, ty, a, h, d0, 1.3, shade(METAL, -0.3));
      }
    },
    nozzle = () => {
      tube(g, x, y0, a, HB, 6 + back, end - 3.4, 2.3, shade(WALL, 0.15));
      // Cooling rings along the barrel.
      for (const d of [9, 11.5]) tube(g, x, y0, a, HB, d + back - 0.5, d + back + 0.5, 2.7, DEEP, 1, false);
      tube(g, x, y0, a, HB, end - 3.6, end - 1.8, 3.4, shade(c, -0.55));
      tube(g, x, y0, a, HB, end - 1.8, end, 4.1, shade(c, -0.45));
      tube(g, x, y0, a, HB, end - 0.9, end, 4.1, tip ?? shade(c, -0.35), 1, false);
      if (towardViewer(a) > 0.05) {
        endFace(g, x, y0, a, HB, end, 4.1, shade(c, -0.7));
        endFace(g, x, y0, a, HB, end, 2, DEEP);
      }
    };
  // Painter's order: parts sorted by how far south (towards the viewer) their centre lies.
  const parts: [number, () => void][] = [
    [0, body],
    [((end + 6) / 2) * sa + 0.01, nozzle],
    [(TANK_FROM / 2 - 4) * sa + TANK_Q * ca, () => tank(TANK_Q)],
    [(TANK_FROM / 2 - 4) * sa - TANK_Q * ca, () => tank(-TANK_Q)],
  ];
  if (level >= 5) for (const s of SKIRTS) parts.push([(s[1] > 0 ? 7 : -7) * ca, () => skirt(s)]);
  parts.sort((p, q) => p[0] - q[0]);
  for (const [, draw] of parts) draw();
}

function live({ g, glow, x, y, tower, definition, level, kick, charge, energy, clock, color }: TurretContext) {
  const a = tower.angle,
    ca = Math.cos(a),
    sa = Math.sin(a),
    y0 = y + DROP,
    c = definition.color,
    flicker = 0.75 + 0.25 * Math.sin(clock * 13 + tower.id * 1.7),
    end = reach(level) - kick * RECOIL,
    back = -kick * RECOIL * 0.4;
  // Furnace vents: embers breathing behind the slits; from level 4 the glow chases round.
  VENTS.forEach((i, k) => {
    const [u0, v0] = oct(i),
      [u1, v1] = oct(i + 1),
      chase = level >= 4 ? 0.4 * Math.max(0, Math.sin(4 * clock - k * 1.6)) : 0,
      on = Math.min(1, 0.45 + 0.3 * flicker + chase + 0.3 * kick);
    for (const f of [0.3, 0.5, 0.7]) {
      const u = X(x, u0 + (u1 - u0) * f),
        v = v0 + (v1 - v0) * f;
      quad(g, u - 0.4, Y(y0, v, 1.6), u + 0.4, Y(y0, v, 1.6), u + 0.4, Y(y0, v, H - 1.7), u - 0.4, Y(y0, v, H - 1.7), shade(c, -0.5 + 0.7 * on));
      quad(glow, u - 1.6, Y(y0, v, 0.6), u + 1.6, Y(y0, v, 0.6), u + 1.6, Y(y0, v, H - 0.6), u - 1.6, Y(y0, v, H - 0.6), c, 0.18 * on + energy * 0.5);
    }
  });
  const ht = BODY_TOP + BEVEL,
    S = (p: number, q: number, h = ht) => [X(x, (p + back) * ca - q * sa), Y(y0, (p + back) * sa + q * ca, h)] as const;
  // Fuel gauge on the roof: fills as the next burst charges.
  const fill = -6 + 4.5 * charge;
  quad(g, ...S(-6.2, -0.9), ...S(-1.5, -0.9), ...S(-1.5, 0.9), ...S(-6.2, 0.9), DEEP);
  if (charge > 0.02) quad(g, ...S(-6, -0.5), ...S(fill, -0.5), ...S(fill, 0.5), ...S(-6, 0.5), shade(c, -0.1 + 0.4 * charge));
  // The burner grille glows with the furnace.
  quad(glow, ...S(1, -3.4), ...S(5, -2.2), ...S(5, 2.2), ...S(1, 3.4), c, 0.12 + 0.1 * flicker + energy);
  // Lamps on the back corners in the trim colour: one at level 1, two from level 2.
  for (const q of level >= 2 ? [-4.6, 4.6] : [4.6]) {
    const [lx, ly] = S(-6.8, q);
    disc(g, lx, ly, 1.2, OUTLINE);
    disc(g, lx, ly, 0.75, shade(color, 0.2));
    disc(glow, lx, ly, 2.3, color, 0.35);
  }
  // Pilot flame licking from the nozzle, a bigger tongue right after a burst.
  const toward = towardViewer(a),
    px = X(x, ca * (end + 1.5)),
    py = Y(y0, sa * (end + 1.5), HB),
    lick = 2.2 * flicker + 4 * kick;
  halo(glow, px, py, 4 + lick, c, 0.3 + 0.2 * kick + energy);
  if (toward > -0.35) {
    disc(g, px + ca * lick * 0.4, py + sa * lick * 0.4 * SQUASH, 0.9 + 0.5 * flicker + kick, shade(c, 0.55));
    disc(g, px, py, 0.7 + 0.3 * flicker, 0xfff1c0);
  }
  // Heat along the nozzle after a burst.
  if (kick > 0) {
    const [hx, hy] = [X(x, ca * (end - 2)), Y(y0, sa * (end - 2), HB)];
    glow.lineStyle(3, c, 0.35 * kick);
    glow.lineBetween(X(x, ca * 7), Y(y0, sa * 7, HB), hx, hy);
  }
}

/** Ember: a squat flamethrower. */
export const concept = {
  tower: "inferno",
  name: "Furnace Torch",
  idea: "Squat flamethrower: octagonal furnace plinth with glowing vents, low body with twin fuel tanks, short flared nozzle with a pilot flame.",
  tilt: { drop: DROP, squash: SQUASH, height: HB, deck: H + 1.2 },
  reach,
  recoil: RECOIL,
  base,
  turret,
  live,
} satisfies Concept;
