import { disc, type Ink, oval, shade, strokeOval } from "../shapes";
import { OUTLINE, SQUASH, X, Y, drum, quad, tube } from "../tower-art/tilt";
import { box, frame, project, rod, SX, SY } from "../tower-art/tilt-frame";
import { boxShadow } from "./lock-props";
import type { Random } from "./kit";

// The props of Core Fortress (`core.ts`), the armoured keep around a power core at night, drawn in the towers' 3/4
// tilt: transformers with ceramic bushings, capacitor banks, server cabinets with status LEDs, coolant tanks joined by
// pipes, floor vents with fans and insulator masts; a cooling tower and a shield spire as landmarks; and the coolant
// pool's coping. Every prop stands on a ground point (gx, gy) in pixels and is rolled up front into a plain record;
// its lights live in the theme's ambient.

export const SHADE = 0x03070c;
export const SUN = { x: 0.5, y: 0.3 } as const;
export const MINT = 0x93f5b8;
export const AMBER = 0xffc857;
const STEEL = 0x3a4650,
  DARK = 0x232b33,
  HAZARD = 0xd8b040,
  CERAMIC = 0xc8c0b0;
export { boxShadow };
const roundShadow = (g: Ink, gx: number, gy: number, r: number, h: number, alpha = 0.3) => {
  for (const k of [0.5, 1]) oval(g, gx + h * SUN.x * k * 0.7, gy + h * SUN.y * k * 0.7, r, r * SQUASH, SHADE, alpha / 2);
};
/** A lit quad on a box's +q face (frame `f`), from p0…p1 and z0…z1. */
function panel(g: Ink, gx: number, gy: number, f: ReturnType<typeof frame>, q: number, p0: number, p1: number, z0: number, z1: number, color: number, alpha = 1) {
  project(gx, gy, f, p0, q, z0, 0);
  project(gx, gy, f, p1, q, z0, 1);
  project(gx, gy, f, p1, q, z1, 2);
  project(gx, gy, f, p0, q, z1, 3);
  quad(g, SX[0], SY[0], SX[1], SY[1], SX[2], SY[2], SX[3], SY[3], color, alpha);
}
/** A screen point on a frame. */
export function onFrame(gx: number, gy: number, f: ReturnType<typeof frame>, p: number, q: number, z: number) {
  project(gx, gy, f, p, q, z, 0);
  return { x: SX[0], y: SY[0] };
}

// ── Insulator ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** A ceramic bushing: stacked sheds narrowing up to a copper terminal. */
export function insulator(g: Ink, x: number, y: number, h0: number, h: number) {
  drum(g, x, y, 1.6, h0, h0 + h, 0xa8a090, CERAMIC, 8);
  for (let k = 0; k < 4; k++) drum(g, x, y, 2.8 - k * 0.25, h0 + 1 + k * (h / 4.5), h0 + 2 + k * (h / 4.5), 0xb8b0a0, CERAMIC, 8);
  drum(g, x, y, 1.2, h0 + h, h0 + h + 2, 0xb87a3a, 0xd89a5a, 8);
}

// ── Transformer ─────────────────────────────────────────────────────────────────────────────────────────────────────
export interface Transformer { a: number; bushings: number }
export const transformerOf = (rand: Random): Transformer => ({ a: (rand() - 0.5) * 0.5, bushings: rand() < 0.5 ? 2 : 3 });
/** Its status lamp (screen offset from the ground point). */
export const transformerLamp = (t: Transformer) => onFrame(0, 0, frame(t.a, 0, 0), 8, 9.1, 13);
/** A power transformer: a steel tank ribbed with cooling fins, ceramic bushings on its lid and a status lamp. */
export function drawTransformer(g: Ink, gx: number, gy: number, t: Transformer) {
  const f = frame(t.a, 0, 0);
  box(g, gx, gy, f, -15, 15, -10, 10, 0, 2, 0x2a3036);
  box(g, gx, gy, f, -13, 13, -9, 9, 2, 17, STEEL);
  // Cooling fins down the front.
  for (let p = -11; p <= 3; p += 2.8) box(g, gx, gy, f, p, p + 1, 9, 11.5, 3, 15, shade(STEEL, 0.08));
  panel(g, gx, gy, f, 9.05, 6, 11, 4, 9, HAZARD, 0.85);
  box(g, gx, gy, f, -13.5, 13.5, -9.5, 9.5, 17, 18.5, 0x2e3840);
  for (let i = 0; i < t.bushings; i++) {
    const p = t.bushings === 2 ? (i ? 5 : -5) : (i - 1) * 7,
      pt = onFrame(gx, gy, f, p, -2, 0);
    insulator(g, pt.x, pt.y, 18.5, 11);
  }
}
export function transformerShadow(g: Ink, gx: number, gy: number, t: Transformer) {
  boxShadow(g, gx, gy, t.a, 15, 10, 26);
}

// ── Capacitor bank ──────────────────────────────────────────────────────────────────────────────────────────────────
export interface Capacitors { a: number; count: number }
export const capacitorsOf = (rand: Random): Capacitors => ({ a: (rand() - 0.5) * 0.6, count: 3 + Math.floor(rand() * 2) });
/** Where the capacitors' charge lamps sit (screen offsets from the ground point). */
export function capacitorLamps(c: Capacitors) {
  return slotsOf(c).map((s) => ({ x: X(0, s.u), y: Y(0, s.v, 20.5) }));
}
function slotsOf(c: Capacitors) {
  return Array.from({ length: c.count }, (_, i) => {
    const p = (i - (c.count - 1) / 2) * 7.5,
      q = (i % 2) * 2 - 1;
    return { u: Math.cos(c.a) * p - Math.sin(c.a) * q, v: Math.sin(c.a) * p + Math.cos(c.a) * q };
  }).sort((p, q) => p.v - q.v);
}
/** A capacitor bank: tall canisters with banded sleeves on a skid, a copper bus bar across their caps. */
export function drawCapacitors(g: Ink, gx: number, gy: number, c: Capacitors) {
  const span = (c.count * 7.5) / 2 + 3;
  box(g, gx, gy, frame(c.a, 0, 0), -span, span, -6.5, 6.5, 0, 2.5, 0x2a3036);
  for (const s of slotsOf(c)) {
    const x = gx + s.u,
      y = gy + s.v * SQUASH;
    drum(g, x, y, 3.4, 2.5, 19, 0x4a5a66, 0x5e6e7a, 10);
    drum(g, x, y, 3.6, 6, 8, 0x1e262e, 0x2a333c, 10);
    drum(g, x, y, 3.6, 14, 15.5, MINT, shade(MINT, 0.2), 10);
    drum(g, x, y, 2.4, 19, 20.5, 0x2a333c, 0x3a4450, 10);
  }
  const e = span - 3;
  rod(g, gx, gy, -Math.cos(c.a) * e, -Math.sin(c.a) * e, 21.5, Math.cos(c.a) * e, Math.sin(c.a) * e, 21.5, 1.4, 0xb87a3a);
}
export function capacitorsShadow(g: Ink, gx: number, gy: number, c: Capacitors) {
  boxShadow(g, gx, gy, c.a, (c.count * 7.5) / 2 + 3, 6.5, 21);
}

// ── Server cabinet ──────────────────────────────────────────────────────────────────────────────────────────────────
export interface Cabinets { a: number; count: number }
export const cabinetsOf = (rand: Random): Cabinets => ({ a: (rand() - 0.5) * 0.5, count: rand() < 0.5 ? 2 : 1 });
/** Status LEDs on the cabinets' fronts (screen offsets from the ground point), rows top to bottom. */
export function cabinetLeds(c: Cabinets) {
  const f = frame(c.a, 0, 0),
    out: { x: number; y: number; i: number }[] = [];
  for (let k = 0; k < c.count; k++) {
    const p0 = c.count === 1 ? 0 : k ? 6 : -6;
    for (let r = 0; r < 5; r++)
      for (const dp of [-2.4, 0, 2.4]) out.push({ ...onFrame(0, 0, f, p0 + dp, 6.1, 9 + r * 3.6), i: out.length });
  }
  return out;
}
/** Server cabinets: tall dark steel cases, a smoked glass front with rack units behind it, vents on top. */
export function drawCabinets(g: Ink, gx: number, gy: number, c: Cabinets) {
  const f = frame(c.a, 0, 0);
  box(g, gx, gy, f, -c.count * 6 - 1, c.count * 6 + 1, -7, 7, 0, 2, 0x2a3036);
  for (let k = 0; k < c.count; k++) {
    const p0 = c.count === 1 ? 0 : k ? 6 : -6;
    box(g, gx, gy, f, p0 - 5.6, p0 + 5.6, -6, 6, 2, 30, DARK);
    panel(g, gx, gy, f, 6.05, p0 - 4.4, p0 + 4.4, 5, 28, 0x0c1014);
    for (let r = 0; r < 6; r++) panel(g, gx, gy, f, 6.06, p0 - 4, p0 + 4, 6.5 + r * 3.6, 6.9 + r * 3.6, 0x2a333c);
    // Lit edge on the glass.
    panel(g, gx, gy, f, 6.07, p0 - 4.4, p0 - 3.8, 5, 28, 0xffffff, 0.12);
    for (let p = p0 - 3.5; p < p0 + 4; p += 2.2) panel(g, gx, gy, f, 0, p, p + 1, 30.05, 30.06, 0x0c1014);
  }
}
export function cabinetsShadow(g: Ink, gx: number, gy: number, c: Cabinets) {
  boxShadow(g, gx, gy, c.a, c.count * 6 + 1, 7, 30);
}

// ── Coolant tanks ───────────────────────────────────────────────────────────────────────────────────────────────────
export interface Tanks { flip: boolean; gauge: boolean }
export const tanksOf = (rand: Random): Tanks => ({ flip: rand() < 0.5, gauge: rand() < 0.6 });
const TANK = 0x8a9aa4;
/** Two upright coolant tanks with domed tops, mint bands, joined by a pipe with a red valve wheel; a gauge on one. */
export function drawTanks(g: Ink, gx: number, gy: number, t: Tanks) {
  const s = t.flip ? -1 : 1,
    tanks = [{ u: -9 * s, v: -5, r: 7, h: 24 }, { u: 9 * s, v: 3, r: 6, h: 18 }].sort((p, q) => p.v - q.v);
  box(g, gx, gy, frame(0, 0, 0), -18, 18, -11, 9, 0, 2, 0x2a3036);
  for (const k of tanks) {
    const x = gx + k.u,
      y = gy + k.v * SQUASH;
    drum(g, x, y, k.r, 2, k.h, TANK, shade(TANK, 0.15), 14);
    drum(g, x, y, k.r + 0.3, k.h * 0.55, k.h * 0.55 + 2.4, MINT, shade(MINT, 0.2), 14);
    for (let i = 1; i <= 3; i++) drum(g, x, y, k.r * (1 - i * 0.22), k.h + (i - 1) * 1.3, k.h + i * 1.3, shade(TANK, 0.05 * i), shade(TANK, 0.1 + 0.05 * i), 12);
  }
  // The pipe between them, in front, at mid height.
  const [a, b] = tanks,
    h = 9;
  tube(g, gx + a.u, gy + a.v * SQUASH, Math.atan2(b.v - a.v, b.u - a.u), h, a.r - 1, Math.sqrt((b.u - a.u) ** 2 + (b.v - a.v) ** 2) - b.r + 1, 1.6, 0x6e7c88);
  const mx = gx + (a.u + b.u) / 2,
    my = gy + ((a.v + b.v) / 2) * SQUASH;
  g.lineStyle(1.4, 0xc83a2e);
  strokeOval(g, mx, Y(my, 0, h + 4), 6, 6 * SQUASH);
  rod(g, mx, my, 0, 0, h, 0, 0, h + 4, 0.8, 0x8a96a0);
  if (t.gauge) {
    const big = tanks.find((k) => k.r === 7)!;
    disc(g, X(gx + big.u, 0), Y(gy + big.v * SQUASH, big.r, 14), 2.4, OUTLINE);
    disc(g, X(gx + big.u, 0), Y(gy + big.v * SQUASH, big.r, 14), 1.8, 0xe8e0c8);
    g.lineStyle(0.6, 0xc83a2e);
    g.lineBetween(X(gx + big.u, 0), Y(gy + big.v * SQUASH, big.r, 14), X(gx + big.u, 1.2), Y(gy + big.v * SQUASH, big.r, 15));
  }
}
export function tanksShadow(g: Ink, gx: number, gy: number, t: Tanks) {
  const s = t.flip ? -1 : 1;
  roundShadow(g, gx - 9 * s, gy - 5 * SQUASH, 8, 28);
  roundShadow(g, gx + 9 * s, gy + 3 * SQUASH, 7, 20);
}

// ── Floor vent ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** Height of a vent's grille, and the fan's radius. */
export const VENT = { h: 8, r: 9 } as const;
/** A floor vent: a squat steel housing with hazard corners round a dark round grille; its fan turns in the ambient. */
export function drawVent(g: Ink, gx: number, gy: number) {
  const f = frame(0, 0, 0);
  box(g, gx, gy, f, -13, 13, -12, 12, 0, VENT.h, STEEL);
  for (const [p, q] of [[-13, -12], [9, -12], [-13, 8], [9, 8]]) box(g, gx, gy, f, p, p + 4, q, q + 4, VENT.h, VENT.h + 0.4, HAZARD);
  oval(g, gx, Y(gy, 0, VENT.h), VENT.r + 1.2, (VENT.r + 1.2) * SQUASH, 0x1a2026);
  oval(g, gx, Y(gy, 0, VENT.h), VENT.r, VENT.r * SQUASH, 0x06080a);
}
/** The vent's turning fan blades and its grille ring (ambient: `clock` turns them). */
export function ventFan(g: Ink, gx: number, gy: number, clock: number, seed: number) {
  const y = Y(gy, 0, VENT.h) + 0.6;
  for (let i = 0; i < 5; i++) {
    const a = clock * 3 + seed + (i / 5) * Math.PI * 2,
      b = a + 0.5,
      r = VENT.r - 1.2;
    g.fillStyle(0x3a4650, 0.95);
    g.fillTriangle(gx, y, gx + Math.cos(a) * r, y + Math.sin(a) * r * SQUASH, gx + Math.cos(b) * r, y + Math.sin(b) * r * SQUASH);
  }
  oval(g, gx, y, 2, 2 * SQUASH, 0x5a6670);
  g.lineStyle(0.6, 0x5a6670, 0.8);
  strokeOval(g, gx, y - 0.6, VENT.r * 2, VENT.r * 2 * SQUASH);
  g.lineBetween(gx - VENT.r, y - 0.6, gx + VENT.r, y - 0.6);
}
export function ventShadow(g: Ink, gx: number, gy: number) {
  boxShadow(g, gx, gy, 0, 13, 12, VENT.h);
}

// ── Insulator mast ──────────────────────────────────────────────────────────────────────────────────────────────────
/** Height of the mast's warning lamp. */
export const MAST = 44;
/** A lattice mast on a concrete footing with a crossarm of hanging insulators and a red warning lamp on top. */
export function drawMast(g: Ink, gx: number, gy: number) {
  box(g, gx, gy, frame(0, 0, 0), -6, 6, -6, 6, 0, 3, 0x6a7680);
  const leg = (u: number, v: number) => rod(g, gx, gy, u, v, 3, u * 0.3, v * 0.3, MAST - 4, 1.3, 0x5a6670);
  leg(-4.5, -4.5);
  leg(4.5, -4.5);
  for (let h = 8; h < MAST - 6; h += 7) {
    const k = 1 - ((h - 3) / (MAST - 7)) * 0.7;
    rod(g, gx, gy, -4.5 * k, 4.5 * k, h, 4.5 * k, 4.5 * k, h + 6, 0.6, 0x5a6670);
    rod(g, gx, gy, 4.5 * k, 4.5 * k, h, -4.5 * k, 4.5 * k, h + 6, 0.6, 0x5a6670);
  }
  leg(-4.5, 4.5);
  leg(4.5, 4.5);
  rod(g, gx, gy, -13, 0, MAST - 10, 13, 0, MAST - 10, 1.6, 0x4a5660);
  for (const u of [-11, 0, 11]) {
    drum(g, X(gx, u), Y(gy, 0, 0), 1.2, MAST - 18, MAST - 10.5, 0xa8a090, CERAMIC, 8);
    for (let k = 0; k < 3; k++) drum(g, X(gx, u), Y(gy, 0, 0), 2.2, MAST - 17 + k * 2.4, MAST - 16.4 + k * 2.4, 0xb8b0a0, CERAMIC, 8);
  }
  drum(g, gx, gy, 1.6, MAST - 4, MAST - 1, 0x2a3036, 0x3a4046, 8);
}
export function mastShadow(g: Ink, gx: number, gy: number) {
  g.lineStyle(3, SHADE, 0.2);
  g.lineBetween(gx, gy, gx + MAST * SUN.x, gy + MAST * SUN.y);
  g.lineStyle(1.5, SHADE, 0.18);
  const cx = gx + (MAST - 10) * SUN.x,
    cy = gy + (MAST - 10) * SUN.y;
  g.lineBetween(cx - 13, cy, cx + 13, cy);
}

// ── Landmarks ───────────────────────────────────────────────────────────────────────────────────────────────────────
/** The cooling tower's rim height (at full size). */
export const COOLING_RIM = 70;
/** Radius of the cooling tower's shell at height share t: a hyperbolic waist above the middle. */
const shell = (t: number) => 14 + 9 * ((t - 0.68) / 0.68) ** 2 + (t > 0.68 ? 10 * (t - 0.68) ** 2 : 0);
/** A cooling tower: a hyperbolic concrete shell on a ring of raking legs, a mint band, warning lamps round its rim. */
export function drawCoolingTower(g: Ink) {
  const steps = 14;
  drum(g, 0, 0, 30, 0, 3, 0x4a5660, 0x5a6670, 20);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    if (Math.sin(a) < 0.05) continue;
    rod(g, 0, 0, Math.cos(a) * 24, Math.sin(a) * 24, 3, Math.cos(a + 0.25) * 22, Math.sin(a + 0.25) * 22, 10, 1.6, 0x6a7680);
  }
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps,
      t1 = (i + 1) / steps,
      r = shell((t0 + t1) / 2),
      h0 = 10 + (COOLING_RIM - 10) * t0,
      h1 = 10 + (COOLING_RIM - 10) * t1 + 0.6;
    drum(g, 0, 0, r, h0, h1, i === 10 ? shade(MINT, -0.3) : shade(0x8a949c, -0.03 * (i % 2)), 0x6a747c, 20);
  }
  const rim = shell(1);
  oval(g, 0, Y(0, 0, COOLING_RIM), rim + 1.5, (rim + 1.5) * SQUASH, 0x9aa4ac);
  oval(g, 0, Y(0, 0, COOLING_RIM), rim, rim * SQUASH, 0x0c1014);
  oval(g, 0, Y(0, 0, COOLING_RIM) + 3, rim * 0.75, rim * 0.5 * SQUASH, 0x16202a);
}
export function coolingTowerShadow(g: Ink) {
  for (const k of [0.4, 0.8]) oval(g, 24 * k, 14 * k, 34, 20, SHADE, 0.16);
}
/** Lamps round the cooling tower's rim (screen offsets at full size), front half only. */
export const COOLING_LAMPS = Array.from({ length: 5 }, (_, i) => {
  const a = (i / 4) * Math.PI;
  return { x: Math.cos(a) * (shell(1) + 1), y: Y(0, Math.sin(a) * (shell(1) + 1), COOLING_RIM + 1) };
});
/** The shield spire's emitter orb height (at full size). */
export const SPIRE_ORB = 70;
/** A shield spire: an octagonal plinth, four buttress fins, a tapering column ringed by emitter collars, and an orb. */
export function drawSpire(g: Ink) {
  drum(g, 0, 0, 30, 0, 4, 0x3a4650, 0x4a5660, 8);
  drum(g, 0, 0, 24, 4, 9, 0x2e3840, 0x3e4a54, 8);
  // Fins behind the column first, then the column, then the fins in front.
  const fin = (a: number) => {
    const u = Math.cos(a),
      v = Math.sin(a);
    box(g, 0, 0, frame(a, 0, 9, u * 19, v * 19), -3, 3, -2.5, 2.5, 0, 3, 0x3a4650);
    rod(g, 0, 0, u * 19, v * 19, 12, u * 7, v * 7, 38, 3, 0x4a5660);
    rod(g, 0, 0, u * 7, v * 7, 38, u * 6, v * 6, 44, 2, 0x4a5660);
  };
  const fins = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
  for (const a of fins) if (Math.sin(a) < 0) fin(a);
  for (let i = 0; i < 6; i++) {
    const h0 = 9 + i * 9,
      r = 8 - i * 0.9;
    drum(g, 0, 0, r, h0, h0 + 9.2, 0x4a5a66, 0x5e6e7a, 12);
    drum(g, 0, 0, r + 1.4, h0 + 7, h0 + 9, i % 2 ? 0x2a3036 : shade(MINT, -0.3), 0x3a4650, 12);
  }
  for (const a of fins) if (Math.sin(a) >= 0) fin(a);
  drum(g, 0, 0, 5, 63, 65, 0x2a3036, 0x3a4650, 12);
  for (const a of [0, Math.PI * 0.66, Math.PI * 1.33]) rod(g, 0, 0, Math.cos(a) * 4, Math.sin(a) * 4, 64, Math.cos(a) * 7, Math.sin(a) * 7, SPIRE_ORB + 2, 1, 0x8a96a0);
  disc(g, 0, Y(0, 0, SPIRE_ORB), 5.6, OUTLINE, 0.8);
  disc(g, 0, Y(0, 0, SPIRE_ORB), 5, shade(MINT, -0.1));
  disc(g, -1.5, Y(0, 0, SPIRE_ORB) - 1.5, 2, 0xe8fff0);
}
export function spireShadow(g: Ink) {
  oval(g, 10, 6, 32, 18, SHADE, 0.16);
  g.lineStyle(6, SHADE, 0.16);
  g.lineBetween(0, 0, SPIRE_ORB * SUN.x, SPIRE_ORB * SUN.y);
}

// ── Coolant pool ────────────────────────────────────────────────────────────────────────────────────────────────────
/** A glowing fuel-rod rack sunk in the coolant pool: a steel grid of square cells, its lights in the ambient. */
export function rodRack(g: Ink, x: number, y: number) {
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      const cx = x + (i - 1) * 7,
        cy = y + (j - 1) * 7 * SQUASH;
      g.fillStyle(0x0a2a3a, 0.9);
      g.fillRect(cx - 3, cy - 2, 6, 4);
      g.lineStyle(0.8, 0x4a6a7a, 0.8);
      g.strokeRect(cx - 3, cy - 2, 6, 4);
    }
}
/** The bridge crane's handrail stanchion on the pool coping. */
export function railPost(g: Ink, x: number, y: number) {
  rod(g, x, y, 0, 0, 0, 0, 0, 9, 0.8, HAZARD);
  disc(g, x, Y(y, 0, 9), 1, HAZARD);
}
