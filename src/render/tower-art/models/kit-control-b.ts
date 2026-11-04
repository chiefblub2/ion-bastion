/**
 * Small helpers for the Control B concepts (Amber, Magnetar, Cyclone, Tether, Shrink Ray, Hex, Siphon), on top of the
 * tilt kit: regular footprints, extruded slabs, contact shadows, ground points and cylinders lying across the aim.
 */
import { oval, type Ink } from "../../shapes";
import { FOOT, INSET, SQUASH, block, endFace, onGround, towardViewer, tube, turn } from "../tilt";

/** A regular n-gon footprint of radius r (along, across pairs, clockwise on the screen), first corner at `rot`. */
export const ngon = (n: number, r: number, rot = 0) =>
  Array.from({ length: 2 * n }, (_, i) => (i % 2 ? Math.sin : Math.cos)(rot + (Math.floor(i / 2) * 2 * Math.PI) / n) * r);

/** An extruded slab over `shape` turned by `a`, from h0 to h1, its top inset by `k` behind a bevel. */
export function slab(g: Ink, x: number, y0: number, shape: readonly number[], h0: number, h1: number, bevel: number, wall: number, top: number, glint: number, a = 0, k = 0.86) {
  const n = turn(shape, a, FOOT);
  turn(shape, a, INSET, bevel >= 1 ? k : 1);
  block(g, x, y0, FOOT, INSET, n, h0, h1, bevel, wall, top, glint);
}

/** The usual two-step contact shadow under a foundation of radius r. */
export function contact(g: Ink, x: number, y0: number, r: number) {
  onGround(g, x, y0, 0, () => {
    oval(g, 5, 7, r + 5, r, 0x050b10, 0.22);
    oval(g, 2, 3, r, r - 3, 0x050b10, 0.35);
  });
}

/** Screen x and the ground-centre y of the ground point (u, v): pass them as a part's own centre to the kit. */
export const ground = (x: number, y0: number, u: number, v: number) => [x + u, y0 + v * SQUASH] as const;

/** A cylinder lying across the aim `a`, centred `p` along it at height h, from q0 to q1 across, with its visible end. */
export function crossTube(g: Ink, x: number, y0: number, a: number, p: number, h: number, q0: number, q1: number, r: number, color: number, cap: number, detail = true) {
  const [cx, cy] = ground(x, y0, Math.cos(a) * p, Math.sin(a) * p),
    dir = a + Math.PI / 2;
  tube(g, cx, cy, dir, h, q0, q1, r, color, 1, detail);
  const toward = towardViewer(dir);
  if (toward > 0.05) endFace(g, cx, cy, dir, h, q1, r, cap);
  else if (toward < -0.05) endFace(g, cx, cy, dir, h, q0, r, cap);
}
