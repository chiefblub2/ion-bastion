import { facing, halo } from "../render/material";
import { disc, oval, shade, type Ink } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { OUTLINE, X, Y, endFace, onGround, point, fillPoints, towardViewer, tube } from "../render/tower-art/tilt";
import { GUN, castShadow, depth, framer, lampInk, lampLight, paint, part, rect } from "../render/tower-art/tilt-parts";
import { contact, ngon, slab } from "./kit-control-b";
import type { Concept } from "./types";

// Amber: the Resin Clamp. A hex plinth whose deck holds honeycomb cells of set resin; on its bearing turns a cradle with
// three claws gripping a faceted amber gem, and a short nozzle in front that spits the resin.
const TILT = { drop: 5, squash: 0.65, height: 12, deck: 5.7 },
  DROP = TILT.drop,
  HB = TILT.height,
  RECOIL = 3,
  reach = (l: number) => 15 + l;
const R = 19,
  PLINTH = 4.5,
  DECK = 5.7,
  COLLAR = 7.5,
  CRADLE = 10,
  GEM_P = -1.5,
  GEM_H = 18,
  GEM_R = 4.8;
const HEX = ngon(6, R, Math.PI / 6);
const CRADLE_SHAPE = [-7, -5, 3, -5, 5, -3, 5, 3, 3, 5, -7, 5];
const PLATES = [rect(-6, 2, 5, 6.3), rect(-6, 2, -6.3, -5)];
/** Resin cells on the deck rim. */
const CELLS = Array.from({ length: 6 }, (_, i) => (i * Math.PI) / 3);
const amberOf = (c: number, k: number) => shade(c, k);

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, R);
  slab(g, x, y0, HEX, 0, PLINTH, 1.2, GUN.side, GUN.top, GUN.metal);
  onGround(g, x, y0, DECK, () => {
    for (const t of CELLS) {
      const cx = Math.cos(t) * 13.2,
        cy = Math.sin(t) * 13.2;
      for (let i = 0; i < 6; i++) point(i, cx + Math.cos((i * Math.PI) / 3) * 3.1, cy + Math.sin((i * Math.PI) / 3) * 3.1);
      fillPoints(g, 6, OUTLINE, 0.9);
      for (let i = 0; i < 6; i++) point(i, cx + Math.cos((i * Math.PI) / 3) * 2.3, cy + Math.sin((i * Math.PI) / 3) * 2.3);
      fillPoints(g, 6, amberOf(c, -0.45 + 0.25 * facing(t + Math.PI)));
      disc(g, cx - 0.6, cy - 0.6, 0.7, amberOf(c, 0.3), 0.8);
    }
    if (level >= 3)
      for (let i = 0; i < 6; i++) {
        const t = (i * Math.PI) / 3 + Math.PI / 6;
        disc(g, Math.cos(t) * 16.5, Math.sin(t) * 16.5, 1, OUTLINE);
        disc(g, Math.cos(t) * 16.5 - 0.3, Math.sin(t) * 16.5 - 0.3, 0.45, GUN.metal);
      }
    // Trim inlay round the bearing from level 4, in the path colour once specialized.
    if (level >= 4) oval(g, 0, 0, 8.8, 8.8, shade(color, -0.35), 0.9);
  });
  slab(g, x, y0, ngon(10, 7.4), DECK, COLLAR, 0, GUN.deep, shade(GUN.side, 0.1), GUN.metal);
}

/** From level 4 the resin cells light one after another (live; the cradle may cover the far ones). */
function below({ g, glow, x, y, level, clock, definition }: TurretContext) {
  if (level < 4) return;
  const y0 = y + DROP,
    c = definition.color;
  CELLS.forEach((t, i) => {
    const on = Math.max(0, Math.sin(3 * clock - i * 1.05));
    if (on < 0.2) return;
    onGround(g, x, y0, DECK, () => disc(g, Math.cos(t) * 13.2, Math.sin(t) * 13.2, 1.6, amberOf(c, 0.1 + 0.3 * on), on));
    onGround(glow, x, y0, DECK, () => disc(glow, Math.cos(t) * 13.2, Math.sin(t) * 13.2, 3.6, c, 0.25 * on));
  });
}

/** The gem's six equator corners and its two tips, turned with the aim. */
function gem(g: Ink, P: ReturnType<typeof framer>, a: number, c: number, level: number) {
  const eq = Array.from({ length: 6 }, (_, i) => {
      const t = (i * Math.PI) / 3 + Math.PI / 6;
      return { t, p: GEM_P + Math.cos(t) * GEM_R, q: Math.sin(t) * GEM_R };
    }),
    top = P(GEM_P, 0, GEM_H + 6),
    bottom = P(GEM_P, 0, GEM_H - 4.5),
    facets: { d: number; draw: () => void }[] = [];
  for (let i = 0; i < 6; i++) {
    const e0 = eq[i],
      e1 = eq[(i + 1) % 6],
      mid = (e0.t + e1.t) / 2 + (i === 5 ? Math.PI : 0),
      world = a + mid,
      s0 = P(e0.p, e0.q, GEM_H),
      s1 = P(e1.p, e1.q, GEM_H),
      d = depth(a, GEM_P + Math.cos(mid) * GEM_R, Math.sin(mid) * GEM_R);
    facets.push({
      d,
      draw: () => {
        g.fillStyle(amberOf(c, -0.5 + 0.25 * facing(world)));
        g.fillTriangle(...s0, ...s1, ...bottom);
        g.fillStyle(amberOf(c, -0.15 + 0.4 * facing(world)));
        g.fillTriangle(...s0, ...s1, ...top);
        g.lineStyle(0.5, amberOf(c, 0.5), 0.6);
        g.lineBetween(...s0, ...s1);
      },
    });
  }
  // The outline first, then the facets back to front.
  g.lineStyle(2.2, OUTLINE, 0.9);
  for (let i = 0; i < 6; i++) {
    const s0 = P(eq[i].p, eq[i].q, GEM_H),
      s1 = P(eq[(i + 1) % 6].p, eq[(i + 1) % 6].q, GEM_H);
    g.lineBetween(...s0, ...top);
    g.lineBetween(...s0, ...bottom);
    g.lineBetween(...s0, ...s1);
  }
  facets.sort((l, r) => l.d - r.d);
  for (const f of facets) f.draw();
  // A fossil insect in the gem from level 3.
  if (level >= 3) {
    const [fx, fy] = P(GEM_P, 0, GEM_H + 0.6);
    oval(g, fx, fy, 1.5, 0.8, shade(c, -0.8), 0.85);
    g.lineStyle(0.4, shade(c, -0.8), 0.85);
    g.lineBetween(fx - 1.9, fy - 0.9, fx + 1.9, fy + 0.9);
    g.lineBetween(fx - 1.9, fy + 0.9, fx + 1.9, fy - 0.9);
  }
}

/** The cradle, its claws round the gem, the gem and the nozzle, back to front. Ink only. */
function turret({ g, x, y, tower, level, kick, tip, color, definition }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    P = framer(x, y0, a),
    end = reach(level) - kick * RECOIL;
  castShadow(g, x, y0, a, CRADLE_SHAPE, DECK, 0.28);
  const claw = (t: number) => {
      const base = P(GEM_P + Math.cos(t) * 5.6, Math.sin(t) * 5.6, CRADLE),
        knee = P(GEM_P + Math.cos(t) * 6.4, Math.sin(t) * 6.4, GEM_H - 1),
        hook = P(GEM_P + Math.cos(t) * 4, Math.sin(t) * 4, GEM_H + 3);
      g.lineStyle(2.6, OUTLINE, 0.95);
      g.lineBetween(...base, ...knee);
      g.lineBetween(...knee, ...hook);
      g.lineStyle(1.5, GUN.top, 1);
      g.lineBetween(...base, ...knee);
      g.lineStyle(1.5, level >= 6 ? color : shade(c, -0.25), 1);
      g.lineBetween(...knee, ...hook);
    },
    claws = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((t) => t + Math.PI / 3),
    behind = claws.filter((t) => Math.sin(a + t) < 0),
    front = claws.filter((t) => Math.sin(a + t) >= 0),
    core = () => {
      if (level >= 5) for (const plate of PLATES) part(g, x, y0, a, plate, COLLAR + 0.5, CRADLE - 0.8, 0, shade(c, -0.55), shade(c, -0.25), shade(c, 0.2));
      part(g, x, y0, a, CRADLE_SHAPE, COLLAR, CRADLE, 1, GUN.side, GUN.top, GUN.metal);
      if (level >= 2) lampInk(g, ...P(-6, Math.cos(a) > 0 ? 3.4 : -3.4, CRADLE + 1), color);
      for (const t of behind) claw(t);
      gem(g, P, a, c, level);
      for (const t of front) claw(t);
    },
    nozzle = () => {
      tube(g, x, y0, a, HB, 3, end - 2.5, 1.9, GUN.side);
      tube(g, x, y0, a, HB, end - 2.5, end, 2.5, shade(c, -0.35));
      if (tip !== undefined) tube(g, x, y0, a, HB, end - 0.9, end, 2.5, tip, 1, false);
      if (towardViewer(a) > 0.05) {
        endFace(g, x, y0, a, HB, end, 2.5, shade(c, -0.55));
        endFace(g, x, y0, a, HB, end, 1.3, OUTLINE);
      }
    };
  paint([
    [depth(a, -1, 0), core],
    [depth(a, 9, 0), nozzle],
  ]);
}

/** The gem glowing deeper as the resin gathers, a drop swelling at the nozzle, the lamp's light. */
function above({ g, glow, x, y, tower, level, kick, charge, energy, color, definition }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    P = framer(x, y0, a),
    end = reach(level) - kick * RECOIL;
  const [gx, gy] = P(GEM_P, 0, GEM_H + 0.5);
  halo(glow, gx, gy, 7 + 3 * charge, c, Math.min(0.3, 0.08 + 0.2 * charge + energy));
  disc(glow, gx - 1, gy - 1.5, 1.6, 0xffffff, 0.2 + 0.15 * charge);
  if (level >= 2) lampLight(glow, ...P(-6, Math.cos(a) > 0 ? 3.4 : -3.4, CRADLE + 1), color);
  // A drop swells under the nozzle's lip with the charge and is gone after the shot.
  if (kick === 0 && charge > 0.3) {
    const [nx, ny] = P(end - 0.5, 0, HB - 2.2),
      r = 0.6 + 1.2 * charge;
    disc(g, nx, ny + r * 0.6, r, amberOf(c, 0.1));
    disc(g, nx - r * 0.3, ny + r * 0.3, r * 0.35, amberOf(c, 0.6));
  }
  if (kick > 0) {
    const [mx, my] = P(end + 1, 0, HB);
    halo(glow, mx, my, 4 * (1 + kick), c, 0.3 * kick);
  }
}

export const concept: Concept = {
  tower: "amber",
  name: "Resin Clamp",
  idea: "Hex plinth with honeycomb resin cells; three claws grip a faceted amber gem over a turning cradle, a nozzle in front drips with the charge.",
  tilt: TILT,
  reach,
  recoil: RECOIL,
  base,
  below,
  turret,
  above,
};
