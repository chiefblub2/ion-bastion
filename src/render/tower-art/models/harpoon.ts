import { halo } from "../../material";
import { disc, ring, shade, strokeOval } from "../../shapes";
import type { TurretContext } from "../kit";
import { OUTLINE, drum, endFace, onGround, towardViewer, tube } from "../tilt";
import { GUN, castShadow, framer, rect } from "../tilt-parts";
import { DROP, IRON, chase, ngon, readyLight, readySocket, recess, slab, trapTilt, trim } from "./kit-traps-b";
import type { TiltedConcept as Concept } from "../tilted";

/** Hatch: octagon radius and height; swivel; the launcher's pivot height, pitch, reach and recoil. */
const HATCH = ngon(8, 16, Math.PI / 8),
  HATCH_H = 1.6,
  SWIVEL_R = 4.6,
  PIVOT = 3.4,
  PITCH = 0.95,
  RECOIL = 2,
  reach = (l: number) => 8.5 + 0.2 * l;
const ROPE = 0x8a6d45,
  ROPE_LIT = 0xc8a46b;

function base({ g, x, y, level, definition, color }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  recess(g, x, y0, HATCH, 1.08);
  slab(g, x, y0, HATCH, 0, HATCH_H, 0.8, IRON.wall, IRON.top, IRON.metal, 0.9);
  // The launch well: a dark round shaft in the hatch, ringed by bolts; corner cleats for the rope.
  onGround(g, x, y0, HATCH_H, () => {
    disc(g, 0, 0, 10.6, OUTLINE);
    disc(g, 0, 0, 9.8, 0x06080a);
    if (level >= 5) ring(g, 0, 0, 13.6, 0.9, shade(color, -0.1), 0.95);
    const bolts = level >= 3 ? 8 : 4;
    for (let i = 0; i < bolts; i++) {
      const a = (i * 2 * Math.PI) / bolts + Math.PI / 8;
      disc(g, Math.cos(a) * 12, Math.sin(a) * 12, 0.9, shade(c, -0.45));
    }
  });
  for (const [u, v] of [
    [-12.5, 6],
    [12.5, 6],
  ])
    slab(g, x, y0, ngon(4, 1.6, Math.PI / 4), HATCH_H, HATCH_H + 1.8, 0, GUN.side, GUN.top, GUN.metal, 1, u, v);
  // The swivel: a short drum in the well that the launcher turns on.
  drum(g, x, y0, SWIVEL_R, HATCH_H - 0.6, PIVOT - 0.6, IRON.deep, IRON.wall, 12);
  if (level >= 2) readySocket(g, x, y0, 10.5, -9.5, HATCH_H + 0.2, c);
}
/** The rope coiled in the well (paying out with a shot, winding back as it reloads) and the hatch's chasing lights. */
function below(ctx: TurretContext) {
  const { g, x, y, charge } = ctx,
    y0 = y + DROP,
    coil = 6.2 + 2.6 * charge;
  onGround(g, x, y0, HATCH_H + 0.2, () => {
    for (let k = 0; k < 2; k++) {
      g.lineStyle(1.8, ROPE, 0.95);
      strokeOval(g, 0, 0, 2 * (coil - k * 1.6), 2 * (coil - k * 1.6));
      g.lineStyle(0.5, ROPE_LIT, 0.8);
      strokeOval(g, -0.3, -0.3, 2 * (coil - k * 1.6), 2 * (coil - k * 1.6));
    }
  });
  chase(ctx, x, y0, [-9, -3, 3, 9].map((u) => [u, 13.2] as const), HATCH_H);
}
/** The launcher (cached per aim step and recoil): a yoke on the swivel and a steep tube aimed up the flight line. */
function turret(ctx: TurretContext) {
  const { g, x, y, tower, level, kick, tip, definition } = ctx,
    a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    end = reach(level) - kick * RECOIL,
    P = framer(x, y0, a);
  castShadow(g, x, y0, a, rect(-3, end * Math.cos(PITCH) + 2, -2.6, 2.6), HATCH_H, 0.25);
  // The yoke's cheeks either side of the tube, the far one first.
  const near = Math.cos(a) > 0 ? 1 : -1,
    cheek = (q: number) => slab(g, x, y0, ngon(4, 1.4, a + Math.PI / 4), PIVOT - 1.2, PIVOT + 2.2, 0, GUN.side, GUN.top, GUN.metal, 1, -Math.sin(a) * q, Math.cos(a) * q);
  cheek(-3.2 * near);
  const forward = towardViewer(a, PITCH) > 0;
  tube(g, x, y0, a, PIVOT, -2.4 - kick * RECOIL, end - 1.6, 2.4, shade(c, -0.2), 1, true, PITCH);
  tube(g, x, y0, a, PIVOT, end - 1.6, end, 2.8, tip ?? shade(c, -0.45), 1, true, PITCH);
  if (level >= 3) tube(g, x, y0, a, PIVOT, (end - 2) / 2 - 0.4, (end - 2) / 2 + 0.4, 2.6, shade(c, -0.55), 1, false, PITCH);
  if (forward) endFace(g, x, y0, a, PIVOT, end, 1.6, OUTLINE, PITCH);
  cheek(3.2 * near);
  const [hx, hy] = P(0, 0, PIVOT + 0.4);
  disc(g, hx, hy, 1.2, shade(trim(ctx), -0.2));
}
/** The barbed head in the muzzle once loaded, a flare after a shot (`kick`) and the ready lamp. */
function above(ctx: TurretContext) {
  const { g, glow, x, y, tower, definition, level, charge, kick } = ctx,
    a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    end = reach(level) - kick * RECOIL,
    P = framer(x, y0, a),
    lift = (d: number) => P(d * Math.cos(PITCH), 0, PIVOT + d * Math.sin(PITCH));
  if (charge >= 1) {
    const [nx, ny] = lift(end),
      [tx, ty] = lift(end + 4.5),
      side = 2.6;
    g.fillStyle(OUTLINE, 0.9);
    g.fillTriangle(nx - side - 0.6, ny + 0.6, nx + side + 0.6, ny + 0.6, tx, ty - 0.8);
    g.fillStyle(shade(IRON.metal, 0.35));
    g.fillTriangle(nx - side, ny, nx, ny, tx, ty);
    g.fillStyle(shade(IRON.metal, -0.05));
    g.fillTriangle(nx, ny, nx + side, ny, tx, ty);
    halo(glow, tx, ty, 4, c, 0.18);
  }
  if (kick > 0) {
    const [mx, my] = lift(end + 1);
    halo(glow, mx, my, 7 * (1 + kick), c, 0.3 * kick);
  }
  if (level >= 2) readyLight(ctx, x, y0, 10.5, -9.5, HATCH_H + 0.2);
}

export const concept: Concept = {
  tower: "harpoon",
  name: "Sky Lance",
  idea: "A sunk octagonal hatch with a rope coiled round a swivel; a steep launcher tube follows the flight line, the barbed head showing in its muzzle once loaded.",
  tilt: { ...trapTilt(HATCH_H), height: PIVOT, pitch: PITCH },
  reach,
  recoil: RECOIL,
  base,
  below,
  turret,
  above,
};
