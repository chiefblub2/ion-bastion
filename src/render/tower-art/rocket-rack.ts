/**
 * Rocket Rack: Skyburst's look in the 3/4 tilt (see `tilt.ts`): a four-tube pod raised on an elevating cradle between
 * two cheeks, over a chamfered plinth. The plinth (`base`) bakes per level and trim colour; the cradle, pod and tubes
 * (`turret`) depend only on the aim and recoil and are cached per angle (`TurretCache`); the plinth's chasing lights
 * (`below`) and the warhead noses, spinning radar, lamp light and tube heat (`above`) are live. The projection lives in
 * `TILTS.battery`, the barrels in `MUZZLES.battery`.
 */
import { MUZZLES, TILTS } from "../muzzles";
import type { TiltedArt } from "./tilted";
import { SX, SY, box, frame, project, rod } from "./tilt-frame";
import { halo } from "../material";
import { disc, oval, shade } from "../shapes";
import type { TurretContext } from "./kit";
import { FOOT, INSET, OUTLINE, SQUASH, X, Y, block, drum, endFace, fillPoints, onGround, point, quad, towardViewer, tube, turn } from "./tilt";

// --- Skyburst: a four-tube rocket rack on an elevating cradle. --------------------------------------------------------
const TILT = TILTS.battery!,
  SPEC = MUZZLES.battery!,
  SIDES = SPEC.sides!,
  reach = SPEC.reach,
  RECOIL = SPEC.recoil;
const GUN = 0x3b4549,
  GUN_TOP = 0x56646a,
  METAL = 0x8a9a9c,
  DEEP = 0x1f272b;
/** The plinth: a chamfered square, flat sides to the viewer. */
const PLINTH = [-19, -12, -12, -19, 12, -19, 19, -12, 19, 12, 12, 19, -12, 19, -19, 12];
const PLINTH_H = 4.5,
  BEVEL = 1.5,
  DECK = PLINTH_H + BEVEL;
/** Cradle cheeks either side of the pod. */
const CHEEK = (s: number) => (s > 0 ? [-4.5, 8, 3.5, 8, 3.5, 10, -4.5, 10] : [-4.5, -10, 3.5, -10, 3.5, -8, -4.5, -8]);
/** Lights in the plinth's front faces (ground u, v at mid height), chasing from level 4. */
const FRONT_LIGHTS = [
  [-15.5, 15.5],
  [-5, 19],
  [5, 19],
  [15.5, 15.5],
];

/** Pitch, aim and the pod's frame of a tower, shared by the turret and its live parts. */
function geometry({ y, tower, level, kick }: TurretContext) {
  const a = tower.angle,
    pitch = TILT.pitch ?? 0;
  return {
    a,
    pitch,
    y0: y + TILT.drop,
    HB: TILT.height,
    ca: Math.cos(a),
    sa: Math.sin(a),
    end: reach(level) - kick * RECOIL,
    back: -kick * RECOIL,
    f: frame(a, pitch, TILT.height),
    toward: towardViewer(a, pitch) > 0.02,
  };
}
/** The pod's back corner lamp, on the side turned to the viewer (from level 2). */
const lampAt = (x: number, y0: number, f: ReturnType<typeof frame>, back: number, ca: number) => {
  project(x, y0, f, -6.4 + back, ca > 0 ? 6.4 : -6.4, 3.3, 1);
  return [SX[1], SY[1]] as const;
};

export const rocketRack: TiltedArt = {
  base: ({ g, x, y, level, definition, color }) => {
    const y0 = y + TILT.drop,
      c = definition.color;
    onGround(g, x, y0, 0, () => {
      oval(g, 5, 7, 25, 21, 0x050b10, 0.2);
      oval(g, 1.5, 2.5, 20, 18, 0x050b10, 0.35);
    });
    const n = turn(PLINTH, 0, FOOT);
    turn(PLINTH, 0, INSET, 0.9);
    block(g, x, y0, FOOT, INSET, n, 0, PLINTH_H, BEVEL, GUN, GUN_TOP, METAL);
    // Hazard stripe along the front lip in the tower colour, and the light sockets in the front faces.
    for (const [u, v] of FRONT_LIGHTS) {
      const lx = X(x, u),
        ly = Y(y0, v, PLINTH_H / 2);
      quad(g, lx - 1.6, ly - 1.1, lx + 1.6, ly - 1.1, lx + 1.6, ly + 1.1, lx - 1.6, ly + 1.1, DEEP);
      if (level < 4) quad(g, lx - 0.9, ly - 0.5, lx + 0.9, ly - 0.5, lx + 0.9, ly + 0.5, lx - 0.9, ly + 0.5, shade(color, level >= 2 ? -0.3 : -0.55));
    }
    onGround(g, x, y0, DECK, () => {
      // Corner studs, from level 3 with a second ring of bolts; an inlay in the trim colour from level 4.
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        disc(g, sx * 13, sy * 13, 2, shade(c, -0.55));
        disc(g, sx * 13 - 0.5, sy * 13 - 0.5, 0.8, shade(c, 0.1));
      }
      if (level >= 3)
        for (let i = 0; i < 8; i++) {
          const t = (i * Math.PI) / 4 + Math.PI / 8;
          disc(g, Math.cos(t) * 11.5, Math.sin(t) * 11.5, 0.8, DEEP);
        }
      if (level >= 4) {
        g.lineStyle(0.9, shade(color, -0.2), 0.95);
        for (let i = 0; i < 8; i++) {
          const j = (i + 1) % 8;
          g.lineBetween(INSET[2 * i] * 0.88, INSET[2 * i + 1] * 0.88, INSET[2 * j] * 0.88, INSET[2 * j + 1] * 0.88);
        }
      }
    });
    // The turntable the cradle stands on.
    drum(g, x, y0, 9, DECK, DECK + 1.8, DEEP, shade(DEEP, 0.15), 14);
    // Level 5: armour skirts on the two front corners.
    if (level >= 5)
      for (const s of [-1, 1]) {
        const skirt = s < 0 ? [-19.6, 12, -12, 19.6, -10.5, 19.6, -18.1, 12] : [12, 19.6, 19.6, 12, 18.1, 12, 10.5, 19.6];
        // Footprints must run clockwise: these are thin slabs hugging the chamfer.
        const m = turn(skirt, 0, FOOT);
        block(g, x, y0, FOOT, FOOT, m, 0.5, PLINTH_H - 0.5, 0, shade(c, -0.55), shade(c, -0.3), shade(c, 0.2));
      }
  },
  // Live, under the turret: from level 4 the lights in the plinth's front faces chase round.
  below: ({ g, glow, x, y, level, clock, color }) => {
    if (level < 4) return;
    const y0 = y + TILT.drop;
    FRONT_LIGHTS.forEach(([u, v], i) => {
      const on = 0.3 + 0.7 * Math.max(0, Math.sin(4 * clock - i * 1.2)),
        lx = X(x, u),
        ly = Y(y0, v, PLINTH_H / 2);
      quad(g, lx - 0.9, ly - 0.5, lx + 0.9, ly - 0.5, lx + 0.9, ly + 0.5, lx - 0.9, ly + 0.5, shade(color, -0.6 + 0.7 * on));
      if (on > 0.5) disc(glow, lx, ly, 2.4, color, 0.25 * on);
    });
  },
  turret: (ctx) => {
    const { g, x, definition, level, tip, color } = ctx,
      { a, pitch, y0, HB, ca, sa, end, back, f, toward } = geometry(ctx),
      c = definition.color,
      podFront = end - 3.5;
    // Shadow of the pod on the deck.
    onGround(g, x, y0, DECK + 1.8, () => {
      const s = turn([-8, -8, podFront * 0.85, -8, podFront * 0.85, 8, -8, 8], a, FOOT);
      for (let i = 0; i < s; i++) point(i, FOOT[2 * i] + 5, FOOT[2 * i + 1] + 7);
      fillPoints(g, s, 0x050b10, 0.25);
    });
    const cheek = (s: number) => {
        const n = turn(CHEEK(s), a, FOOT);
        block(g, x, y0, FOOT, FOOT, n, DECK + 1.8, HB + 2.5, 0.6, GUN, GUN_TOP, METAL);
        // Trunnion hub on the outer face.
        const hx = X(x, -sa * s * 10.2),
          hy = Y(y0, ca * s * 10.2, HB);
        if (ca * s > -0.2) {
          disc(g, hx, hy, 2.2, OUTLINE);
          disc(g, hx, hy, 1.6, METAL);
          disc(g, hx - 0.3, hy - 0.3, 0.6, 0xd4dcdc);
        }
      },
      tubes = () => {
        for (const s of SIDES) {
          const tx = x - sa * s,
            ty = y0 + ca * s * SQUASH;
          tube(g, tx, ty, a, HB, podFront - 1, end, 1.7, shade(c, -0.15), 1, true, pitch);
          if (tip !== undefined) tube(g, tx, ty, a, HB, end - 1, end, 1.7, tip, 1, false, pitch);
          if (toward) endFace(g, tx, ty, a, HB, end, 1.15, OUTLINE, pitch);
        }
      },
      pod = () => {
        box(g, x, y0, f, -7 + back, podFront, -7.6, 7.6, -3.2, 3.2, shade(c, -0.55), shade(c, -0.45));
        // Tube channels along the top, and a warning band at the front from level 3.
        g.lineStyle(0.8, DEEP, 0.9);
        for (const s of SIDES) {
          project(x, y0, f, -5.5 + back, s, 3.25, 0);
          project(x, y0, f, podFront - 0.8, s, 3.25, 1);
          g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
        }
        if (level >= 3) {
          project(x, y0, f, podFront - 2.6, -7.6, 3.25, 0);
          project(x, y0, f, podFront - 1.4, -7.6, 3.25, 1);
          project(x, y0, f, podFront - 1.4, 7.6, 3.25, 2);
          project(x, y0, f, podFront - 2.6, 7.6, 3.25, 3);
          quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], shade(c, 0.15), 0.85);
        }
        // Level 6+: a trim stripe along the pod's spine in the path colour.
        if (level >= 6) {
          project(x, y0, f, -6.5 + back, -0.7, 3.3, 0);
          project(x, y0, f, podFront - 3.2, -0.7, 3.3, 1);
          project(x, y0, f, podFront - 3.2, 0.7, 3.3, 2);
          project(x, y0, f, -6.5 + back, 0.7, 3.3, 3);
          quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], color);
        }
        // Level 5: armour plates on the flanks.
        if (level >= 5)
          for (const s of [-1, 1]) if (ca * s > -0.2) box(g, x, y0, f, -4 + back, podFront - 3, s * 7.6, s * 8.6, -2.6, 2.6, shade(c, -0.35));
        // Radar mast at the back of the pod (its dish is live).
        project(x, y0, f, -5 + back, 0, 3.2, 0);
        rod(g, SX[0], SY[0], 0, 0, 0, 0, 0, 3.5, 1.2, METAL);
        // Level 2: the lamp's socket and glass at the pod's back corner (its light is live).
        if (level >= 2) {
          const [lx, ly] = lampAt(x, y0, f, back, ca);
          disc(g, lx, ly, 1.3, OUTLINE);
          disc(g, lx, ly, 0.8, shade(color, 0.2));
        }
      };
    const near = ca > 0 ? 1 : -1;
    cheek(-near);
    if (toward) {
      pod();
      tubes();
    } else {
      tubes();
      pod();
    }
    cheek(near);
  },
  // Live, over the turret: warhead noses in the frontmost tube mouths, the radar dish, lamp light and tube heat.
  above: (ctx) => {
    const { g, glow, x, tower, definition, level, kick, charge, clock, color, energy } = ctx,
      { a, pitch, y0, HB, ca, sa, end, back, f, toward } = geometry(ctx),
      c = definition.color;
    // Warhead noses return one per quarter of the reload.
    SIDES.forEach((s, i) => {
      if (!toward || charge < 0.25 * (i + 1)) return;
      endFace(g, x - sa * s, y0 + ca * s * SQUASH, a, HB, end - 0.3, 0.8, shade(c, 0.45), pitch);
    });
    // Search radar spinning on its mast.
    project(x, y0, f, -5 + back, 0, 3.2, 0);
    const rx = SX[0],
      ry = SY[0] - 3.5,
      spin = clock * 3 + tower.id;
    oval(g, rx, ry, 3.4, 1.2 + 1.6 * Math.abs(Math.cos(spin)), OUTLINE, 1, Math.sin(spin) * 0.4);
    oval(g, rx, ry, 2.8, 0.8 + 1.4 * Math.abs(Math.cos(spin)), shade(c, 0.1), 1, Math.sin(spin) * 0.4);
    if (level >= 2) disc(glow, ...lampAt(x, y0, f, back, ca), 2.6, color, 0.35);
    // Heat in the tubes right after a salvo; a glow on the mouths from level 5.
    for (const s of SIDES) {
      project(x, y0, { ...f, pu: -sa * s, pv: ca * s }, end, 0, 0, 2);
      if (kick > 0) halo(glow, SX[2], SY[2], 3.5 * (1 + kick), c, 0.25 * kick);
      if (energy > 0) disc(glow, SX[2], SY[2], 1.8, c, energy);
    }
  },
};
