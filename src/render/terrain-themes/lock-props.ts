import { disc, hash01, type Ink, oval, shade, strokeOval } from "../shapes";
import { OUTLINE, SQUASH, X, Y, drum, endFace, quad, tube } from "../tower-art/tilt";
import { box, frame, project, rod, SX, SY } from "../tower-art/tilt-frame";
import type { Random } from "./kit";

// The props of Lock Ring (`lock.ts`), a canal lock and dock complex at night, drawn in the towers' 3/4 tilt: mooring
// bollards, capstans, pipe racks with valve wheels, cargo pallets, gas cylinders, harbour lanterns and control kiosks;
// the gantry crane and the lock control tower as landmarks; tyre fenders on the quay walls and a moored barge in the
// basins. Every prop stands on a ground point (gx, gy) in pixels and is rolled up front into a plain record.

/** Shadow colour on the quay: cold and see-through. */
export const SHADE = 0x03070c;
export const SUN = { x: 0.5, y: 0.3 } as const;
const STEEL = 0x56636e,
  HAZARD = 0xd8b040,
  CONCRETE = 0x7c8894;

/** The shadow of a box footprint (ground half sizes, turned by a) of height h, thrown to the lower right in steps. */
export function boxShadow(g: Ink, gx: number, gy: number, a: number, hp: number, hq: number, h: number, alpha = 0.32) {
  const c = Math.cos(a),
    s = Math.sin(a),
    corner = (p: number, q: number, k: number) => ({ x: gx + p * c - q * s + h * SUN.x * k, y: gy + (p * s + q * c) * SQUASH + h * SUN.y * k });
  g.fillStyle(SHADE, alpha / 3);
  for (const k of [0, 0.5, 1]) g.fillPoints([corner(-hp, -hq, k), corner(hp, -hq, k), corner(hp, hq, k), corner(-hp, hq, k)], true);
}
const roundShadow = (g: Ink, gx: number, gy: number, r: number, h: number, alpha = 0.3) => {
  for (const k of [0.5, 1]) oval(g, gx + h * SUN.x * k * 0.7, gy + h * SUN.y * k * 0.7, r, r * SQUASH, SHADE, alpha / 2);
};

// ── Bollards ────────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Bollard { du: number; dv: number; double: boolean }
/** A mooring bollard: a squat cast-iron post with a flared cap painted yellow; a double one has two heads on one foot. */
export function bollard(g: Ink, gx: number, gy: number, b: Bollard) {
  const x = gx + b.du,
    y = gy + b.dv * SQUASH;
  if (b.double) box(g, x, y, frame(0, 0, 0), -8, 8, -4, 4, 0, 2, 0x2a3036);
  for (const u of b.double ? [-4.5, 4.5] : [0]) {
    drum(g, x + u, y, 3.2, 0, 7, 0x2a3036, 0x3a4046, 10);
    drum(g, x + u, y, 4.2, 7, 9, HAZARD, shade(HAZARD, 0.2), 10);
  }
}
export function bollardShadow(g: Ink, gx: number, gy: number, b: Bollard) {
  roundShadow(g, gx + b.du, gy + b.dv * SQUASH, b.double ? 9 : 5, 9);
}
/** A rope coil lying on the deck: a few concentric hawser loops. */
export function ropeCoil(g: Ink, gx: number, gy: number) {
  for (let i = 0; i < 4; i++) {
    const r = 7 - i * 1.5;
    oval(g, gx, gy - 0.6 * i, r + 0.8, (r + 0.8) * SQUASH, OUTLINE, 0.5);
    oval(g, gx, gy - 0.6 * i, r, r * SQUASH, i % 2 ? 0xb89a62 : 0xa88a54);
  }
  oval(g, gx, gy - 2.6, 1.6, 1, 0x3a3020);
}
export interface Mooring { bollards: Bollard[]; coil: boolean }
export const mooringOf = (rand: Random): Mooring => {
  const n = rand();
  return {
    bollards: n < 0.4 ? [{ du: 0, dv: -2, double: true }] : n < 0.75 ? [{ du: -8, dv: -5, double: false }, { du: 8, dv: 3, double: false }] : [{ du: -10, dv: -6, double: false }, { du: 2, dv: -8, double: false }, { du: 9, dv: 5, double: false }],
    coil: rand() < 0.6,
  };
};
export function drawMooring(g: Ink, gx: number, gy: number, m: Mooring) {
  if (m.coil) ropeCoil(g, gx - 9, gy + 9);
  for (const b of [...m.bollards].sort((p, q) => p.dv - q.dv)) bollard(g, gx, gy, b);
  // A rope from the first bollard trailing off to the coil.
  if (m.coil) {
    const b = m.bollards[0];
    g.lineStyle(1.4, 0xa88a54, 0.9);
    g.strokePoints([{ x: gx + b.du, y: gy + b.dv * SQUASH - 7 }, { x: gx + b.du - 4, y: gy + b.dv * SQUASH + 2 }, { x: gx - 6, y: gy + 7 }], false);
  }
}
export function mooringShadow(g: Ink, gx: number, gy: number, m: Mooring) {
  for (const b of m.bollards) bollardShadow(g, gx, gy, b);
}

// ── Capstan ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A capstan winch: a steel drum on a gear housing with a coil of cable wound on it and a red brake lever. */
export function drawCapstan(g: Ink, gx: number, gy: number, a: number) {
  box(g, gx, gy, frame(a, 0, 0), -11, 11, -8, 8, 0, 6, 0x3e4a54);
  drum(g, gx, gy, 6.5, 6, 15, 0x6a7680, 0x8a96a0, 12);
  for (let h = 7.5; h < 14; h += 1.6) drum(g, gx, gy, 6.9, h, h + 0.8, 0x2a2e30, 0x3a3e40, 12);
  drum(g, gx, gy, 7.6, 15, 16.5, 0x56636e, 0x6a7680, 12);
  const lx = Math.cos(a) * 9,
    ly = Math.sin(a) * 9;
  rod(g, gx, gy, lx, ly, 6, lx * 1.2, ly * 1.2, 15, 1.4, 0xb8402e);
  disc(g, X(gx, lx * 1.2), Y(gy, ly * 1.2, 15), 1.6, 0x2a2a2a);
}
export function capstanShadow(g: Ink, gx: number, gy: number, a: number) {
  boxShadow(g, gx, gy, a, 11, 8, 6);
  roundShadow(g, gx, gy, 8, 16);
}

// ── Pipe rack ───────────────────────────────────────────────────────────────────────────────────────────────────────
export interface PipeRack { a: number; pipes: number; valve: boolean }
/** Steel pipes stacked on timber chocks, their open ends towards the viewer, and on some a valve stand with its wheel. */
export function drawPipes(g: Ink, gx: number, gy: number, p: PipeRack) {
  const a = p.a,
    rows = p.pipes > 3 ? [[-4.6, 3.6], [0, 3.6], [4.6, 3.6], [-2.3, 7.6], [2.3, 7.6]] : [[-3.6, 3.6], [3.6, 3.6], [0, 7.6]];
  for (const q of [-12, 12]) box(g, gx, gy, frame(a, 0, 0, Math.cos(a) * q, Math.sin(a) * q), -2, 2, -9, 9, 0, 2, 0x6a5232);
  const order = [...rows.slice(0, p.pipes)].sort((u, v) => u[1] - v[1]);
  for (const [q, h] of order) {
    const du = -Math.sin(a) * q,
      dv = Math.cos(a) * q;
    tube(g, gx + du, gy + dv * SQUASH, a, h, -17, 17, 2.3, 0x6e7c88);
    const end = Math.sin(a) >= 0 ? 17 : -17;
    endFace(g, gx + du, gy + dv * SQUASH, a, h, end, 2.3, 0x8a96a0);
    endFace(g, gx + du, gy + dv * SQUASH, a, h, end, 1.4, 0x1a2026);
  }
  if (p.valve) {
    const vx = gx - Math.sin(a) * 15,
      vy = gy + Math.cos(a) * 15 * SQUASH;
    drum(g, vx, vy, 2, 0, 12, 0x3e4a54, 0x56636e, 8);
    oval(g, vx, Y(vy, 0, 13), 5.2, 5.2 * SQUASH, OUTLINE, 0.8);
    g.lineStyle(1.6, 0xc83a2e);
    strokeOval(g, vx, Y(vy, 0, 13), 9, 9 * SQUASH);
    g.lineBetween(vx - 4.5, Y(vy, 0, 13), vx + 4.5, Y(vy, 0, 13));
    g.lineBetween(vx, Y(vy, 0, 13) - 2.9, vx, Y(vy, 0, 13) + 2.9);
  }
}
export function pipesShadow(g: Ink, gx: number, gy: number, p: PipeRack) {
  boxShadow(g, gx, gy, p.a, 17, 7, 9);
}
export const pipesOf = (rand: Random): PipeRack => ({ a: (rand() - 0.5) * 0.7, pipes: rand() < 0.5 ? 3 : 5, valve: rand() < 0.5 });

// ── Cargo pallets ───────────────────────────────────────────────────────────────────────────────────────────────────
export interface Pallet { du: number; dv: number; a: number; h: number; color: number; wrapped: boolean; z: number }
const CARGO = [0x3e6a8a, 0x8a5a3a, 0x5a7a4a, 0x9a8a5a, 0x6a4a6a] as const;
/** A pallet of cargo: a timber pallet and a load on it, shrink-wrapped with a sheen or tied down with orange straps. */
function pallet(g: Ink, gx: number, gy: number, p: Pallet) {
  const f = frame(p.a, 0, p.z, p.du, p.dv);
  box(g, gx, gy, f, -8, 8, -7, 7, 0, 2, 0x8a6a42);
  box(g, gx, gy, f, -7.4, 7.4, -6.4, 6.4, 2, 2 + p.h, p.color);
  if (p.wrapped) {
    project(gx, gy, f, -6, -5, 2 + p.h + 0.2, 0);
    project(gx, gy, f, 2, -5, 2 + p.h + 0.2, 1);
    project(gx, gy, f, -2, 5, 2 + p.h + 0.2, 2);
    g.fillStyle(0xffffff, 0.18);
    g.fillTriangle(SX[0], SY[0], SX[1], SY[1], SX[2], SY[2]);
  } else for (const q of [-2.5, 2.5]) box(g, gx, gy, f, -7.7, 7.7, q - 0.6, q + 0.6, 1.8, 2.4 + p.h, 0xd8742e);
}
export function palletsOf(rand: Random): Pallet[] {
  const one = (du: number, dv: number, z = 0): Pallet => ({ du, dv, a: (rand() - 0.5) * 0.6, h: 7 + rand() * 5, color: CARGO[Math.floor(rand() * CARGO.length)], wrapped: rand() < 0.5, z });
  const roll = rand();
  if (roll < 0.35) {
    const base = one(0, 0);
    return [base, { ...one(rand() - 0.5, rand() - 0.5, 2 + base.h), a: base.a }];
  }
  if (roll < 0.7) return [one(-7, -5), one(8, 4)];
  return [one(-8, -6), one(8, -5), one(0, 7)];
}
export function drawPallets(g: Ink, gx: number, gy: number, list: readonly Pallet[]) {
  for (const p of [...list].sort((u, v) => u.dv + u.z * 0.01 - (v.dv + v.z * 0.01))) pallet(g, gx, gy, p);
}
export function palletsShadow(g: Ink, gx: number, gy: number, list: readonly Pallet[]) {
  for (const p of list) boxShadow(g, gx + p.du, gy + p.dv * SQUASH, p.a, 8, 7, 2 + p.h + p.z);
}

// ── Gas cylinders ───────────────────────────────────────────────────────────────────────────────────────────────────
/** A cage of gas cylinders standing upright, coloured caps, chained to a steel frame. */
export function drawCylinders(g: Ink, gx: number, gy: number, a: number) {
  box(g, gx, gy, frame(a, 0, 0), -12, 12, -6, 6, 0, 1.5, 0x3a4046);
  const caps = [0xc83a2e, 0x2e6a9a, 0xe8e0c8, 0x3a8a4a, 0xc89a2a];
  const slots = Array.from({ length: 5 }, (_, i) => ({ p: -9 + i * 4.5, q: (i % 2) * 2.5 - 1.2, cap: caps[i] }))
    .map((s) => ({ ...s, u: Math.cos(a) * s.p - Math.sin(a) * s.q, v: Math.sin(a) * s.p + Math.cos(a) * s.q }))
    .sort((u, v) => u.v - v.v);
  for (const s of slots) {
    drum(g, gx + s.u, gy + s.v * SQUASH, 2.2, 1.5, 17, 0x8a96a0, 0xa0aab2, 8);
    drum(g, gx + s.u, gy + s.v * SQUASH, 1.6, 17, 19.5, s.cap, shade(s.cap, 0.2), 8);
  }
  for (const p of [-13, 13]) rod(g, gx, gy, Math.cos(a) * p, Math.sin(a) * p, 1.5, Math.cos(a) * p, Math.sin(a) * p, 14, 1.2, STEEL);
  rod(g, gx, gy, -Math.cos(a) * 13, -Math.sin(a) * 13, 11, Math.cos(a) * 13, Math.sin(a) * 13, 11, 0.8, 0x8a8a84);
}
export function cylindersShadow(g: Ink, gx: number, gy: number, a: number) {
  boxShadow(g, gx, gy, a, 12, 6, 18);
}

// ── Harbour lantern ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Height of a lantern's lamp in px. */
export const LANTERN = 34;
/** A cast-iron harbour lantern: a fluted post on a plinth, a crossarm and a glass lantern head. */
export function drawLantern(g: Ink, gx: number, gy: number) {
  box(g, gx, gy, frame(0, 0, 0), -4, 4, -4, 4, 0, 3, CONCRETE);
  drum(g, gx, gy, 2.6, 3, 7, 0x1e252c, 0x2a3238, 8);
  drum(g, gx, gy, 1.4, 7, LANTERN - 4, 0x1e252c, 0x2a3238, 8);
  drum(g, gx, gy, 2.8, LANTERN - 4, LANTERN - 3, 0x1e252c, 0x2a3238, 8);
  drum(g, gx, gy, 2.4, LANTERN - 3, LANTERN + 2, 0xf0e8c0, 0xfff6d8, 8);
  drum(g, gx, gy, 3.4, LANTERN + 2, LANTERN + 3.5, 0x1e252c, 0x2a3238, 8);
  disc(g, gx, Y(gy, 0, LANTERN + 4.6), 1, 0x1e252c);
}
export function lanternShadow(g: Ink, gx: number, gy: number) {
  g.lineStyle(2, SHADE, 0.22);
  g.lineBetween(gx, gy, gx + LANTERN * SUN.x, gy + LANTERN * SUN.y);
}

// ── Control kiosk ───────────────────────────────────────────────────────────────────────────────────────────────────
/** Where the kiosk's lit window sits (screen offset from its ground point), for its facing `a`. */
export const kioskWindow = (a: number) => ({ x: X(0, -Math.sin(a) * 6.1), y: Y(0, Math.cos(a) * 6.1, 12) });
/** A small control kiosk: steel cabin, a lit window facing the viewer, a flat roof with an antenna, a warning lamp. */
export function drawKiosk(g: Ink, gx: number, gy: number, a: number) {
  const f = frame(a, 0, 0);
  box(g, gx, gy, f, -8, 8, -6, 6, 0, 17, 0x3e5a72);
  for (const [p0, p1] of [[-5.5, -0.5], [0.5, 5.5]]) {
    project(gx, gy, f, p0, 6.05, 9, 0);
    project(gx, gy, f, p1, 6.05, 9, 1);
    project(gx, gy, f, p1, 6.05, 14, 2);
    project(gx, gy, f, p0, 6.05, 14, 3);
    quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], 0xf0d890);
  }
  box(g, gx, gy, f, -9, 9, -7, 7, 17, 18.5, 0x2a3644);
  rod(g, gx, gy, Math.cos(a) * 5, Math.sin(a) * 5, 18.5, Math.cos(a) * 5, Math.sin(a) * 5, 30, 0.7, 0x8a96a0);
}
export function kioskShadow(g: Ink, gx: number, gy: number, a: number) {
  boxShadow(g, gx, gy, a, 9, 7, 18.5);
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The crane's warning beacon (screen offset from the landmark's ground point at full size). */
export const CRANE_BEACON = { x: 0, h: 74 } as const;
const CRANE = 0xd89a2a;
/**
 * A rail-mounted gantry crane straddling the quay: two A-frame legs on bogies, a box girder across the top, a cab
 * hanging from the trolley and a container held on its spreader.
 */
export function drawCrane(g: Ink) {
  const top = 66;
  for (const u of [-30, 30]) {
    box(g, 0, 0, frame(0, 0, 0, u, 0), -5, 5, -16, 16, 0, 4, 0x3a3e40);
    for (const v of [-13, 13]) rod(g, 0, 0, u, v, 4, u * 0.92, v * 0.25, top, 3.2, CRANE);
    rod(g, 0, 0, u, -11, 22, u, 11, 22, 1.8, shade(CRANE, -0.1));
    rod(g, 0, 0, u, -8, 44, u, 8, 44, 1.6, shade(CRANE, -0.1));
  }
  // Container hanging on its spreader under the girder.
  rod(g, 0, 0, -4, 0, top - 2, -4, 0, 30, 0.6, 0x2a2a2a);
  rod(g, 0, 0, 4, 0, top - 2, 4, 0, 30, 0.6, 0x2a2a2a);
  box(g, 0, 0, frame(0.1, 0, 28), -12, 12, -5, 5, 0, 2, 0x3a3e40);
  box(g, 0, 0, frame(0.1, 0, 14), -13, 13, -5.5, 5.5, 0, 13, 0x2e6a7a);
  box(g, 0, 0, frame(0, 0, top), -36, 36, -4, 4, 0, 7, CRANE);
  g.lineStyle(0.7, shade(CRANE, -0.4), 0.8);
  for (let u = -32; u <= 32; u += 6) {
    project(0, 0, frame(0, 0, top), u, 4, 0.5, 0);
    project(0, 0, frame(0, 0, top), u + 3, 4, 6.5, 1);
    g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
  }
  box(g, 0, 0, frame(0, 0, top - 9), 10, 18, -4, 4, 0, 9, 0x4a5a6a);
  project(0, 0, frame(0, 0, top - 9), 11, 4.05, 3, 0);
  project(0, 0, frame(0, 0, top - 9), 17, 4.05, 3, 1);
  project(0, 0, frame(0, 0, top - 9), 17, 4.05, 7, 2);
  project(0, 0, frame(0, 0, top - 9), 11, 4.05, 7, 3);
  quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], 0xf0d890);
  drum(g, 0, 0, 2, top + 7, CRANE_BEACON.h - 1, 0x2a2e30, 0x3a3e40, 8);
}
export function craneShadow(g: Ink) {
  boxShadow(g, 0, 0, 0, 36, 4, 70, 0.25);
  for (const u of [-30, 30]) boxShadow(g, u, 0, 0, 5, 16, 40, 0.18);
}
/** Where the control tower's windows glow and its beacon sits (screen offsets at full size). */
export const TOWER = { band: 46, beacon: 70 } as const;
/** The lock control tower: a concrete shaft with a stair, a wide glazed cab ringed by a gallery, a roof and a mast. */
export function drawControlTower(g: Ink) {
  box(g, 0, 0, frame(0, 0, 0), -16, 16, -14, 14, 0, 4, CONCRETE);
  box(g, 0, 0, frame(0, 0, 0), -9, 9, -8, 8, 4, 40, 0x6a7680);
  g.lineStyle(0.8, 0x4a5660, 0.8);
  for (let h = 8; h < 40; h += 6) g.lineBetween(X(0, -9), Y(0, 8, h), X(0, 9), Y(0, 8, h));
  box(g, 0, 0, frame(0, 0, 0), -17, 17, -15, 15, 40, 42, 0x3a4652);
  box(g, 0, 0, frame(0, 0, 0), -14, 14, -12, 12, 42, 53, 0x2a3a4a);
  for (let u = -12; u < 12; u += 6) quad(g, X(0, u + 0.6), Y(0, 12.05, 44), X(0, u + 5.4), Y(0, 12.05, 44), X(0, u + 5.4), Y(0, 12.05, 51), X(0, u + 0.6), Y(0, 12.05, 51), 0xf0d890);
  box(g, 0, 0, frame(0, 0, 0), -16, 16, -14, 14, 53, 55, 0x26303a);
  for (let u = -16; u <= 16; u += 4) rod(g, 0, 0, u, 15, 42, u, 15, 46, 0.5, 0x8a96a0);
  rod(g, 0, 0, -17, 15, 46, 17, 15, 46, 0.7, 0x8a96a0);
  rod(g, 0, 0, 8, -6, 55, 8, -6, TOWER.beacon, 0.9, 0x8a96a0);
}
export function controlTowerShadow(g: Ink) {
  boxShadow(g, 0, 0, 0, 16, 14, 55, 0.3);
}

// ── Quay ────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A tyre fender hanging on the quay wall at (x, y), on the side facing the water. */
export function fender(g: Ink, x: number, y: number) {
  oval(g, x, y + 0.6, 4.4, 3.4, OUTLINE, 0.6);
  oval(g, x, y, 4, 3, 0x1a1c1e);
  oval(g, x, y, 1.8, 1.3, 0x0a2230);
  g.lineStyle(0.8, 0x6a6e70, 0.8);
  g.lineBetween(x - 2.5, y - 2.4, x - 1.5, y - 6);
  g.lineBetween(x + 2.5, y - 2.4, x + 1.5, y - 6);
}
/** A moored barge: a long flat hull with a raised bow, a hold of cargo under tarp, and a deckhouse aft with lit portholes. */
export function drawBarge(g: Ink, gx: number, gy: number) {
  const f = frame(0, 0, 0);
  box(g, gx, gy, f, -34, 34, -10, 10, -2, 5, 0x2a3a2e);
  box(g, gx, gy, f, 34, 40, -7, 7, -1, 6, 0x2a3a2e);
  box(g, gx, gy, f, -34, 40, -10.2, 10.2, 4, 5.4, 0xb8402e);
  box(g, gx, gy, f, -14, 22, -7.5, 7.5, 5, 10, 0x4a5a3a);
  g.lineStyle(0.7, 0x2a3a22, 0.8);
  for (let p = -10; p < 22; p += 6) {
    project(gx, gy, f, p, -7.5, 10.1, 0);
    project(gx, gy, f, p, 7.5, 10.1, 1);
    g.lineBetween(SX[0], SY[0], SX[1], SY[1]);
  }
  box(g, gx, gy, f, -32, -18, -7, 7, 5, 16, 0xe8e0c8);
  box(g, gx, gy, f, -33, -17, -8, 8, 16, 17.5, 0x3a4246);
  for (const p of [-29, -25, -21]) disc(g, X(gx, p), Y(gy, 7.05, 11), 1.3, 0xf0d890);
  rod(g, gx, gy, -24, 0, 17.5, -24, 0, 26, 1.4, 0x2a2a2a);
}
export function bargeShadow(g: Ink, gx: number, gy: number) {
  boxShadow(g, gx, gy, 0, 36, 10, 8, 0.25);
}
/** Ripple rings on dark water drifting with time (render-only motion, `clock` in seconds). */
export function ripple(g: Ink, x: number, y: number, clock: number, seed: number) {
  const life = (clock * 0.35 + hash01(seed)) % 1;
  g.lineStyle(0.8, 0x7fe3ff, 0.22 * (1 - life));
  strokeOval(g, x, y, 4 + life * 16, (4 + life * 16) * SQUASH);
}
