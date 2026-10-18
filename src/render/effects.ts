import type { ContentPack, GameEvent, TurretStyle } from "../core/types";
import { glowLine, halo, SHADOW } from "./material";
import { MUZZLES, muzzleTips, type FlashStyle } from "./muzzles";
import { drawFieldEffect } from "./field-effects";
import { IMPACTS, impactOf } from "./projectiles";
import { drawTrapEffect, TRAP_EFFECT_LIFE } from "./trap-effects";
import { drawCrit } from "./support-fx";
import { drawEconomyEffect } from "./economy-effects";
import { controlBeam, controlChain, drawEcho } from "./control-marks";
import { arcBand, CELL, disc, hash01, lightning, polygon, px, ring, shade, strip, type Pen } from "./shapes";
/** Seconds an effect stays visible. */
export const EFFECT_LIFETIME = 0.45;
/** Refinery payouts and dock repairs linger so their label can be read. */
export const INCOME_LIFETIME = 1.6;
/** Ground cracks of a quake stay a little longer. */
const QUAKE_LIFETIME = 0.7;
export type VisualEvent = Extract<
  GameEvent,
  {
    type:
      | "shot" | "chain" | "beam" | "pulse" | "income" | "repair" | "impact" | "kill" | "leak" | "build" | "sell" | "upgrade" | "evade" | "overload"
      // ── new towers: g1 (Attack+Control A) ──
      | "strike" | "shatter" | "gather"
      // ── end g1 ──
      // ── new towers: g2 (Control B) ──
      | "echo"
      // ── end g2 ──
      // ── new towers: g3 (Traps) ──
      | "warp" | "breach"
      // ── end g3 ──
      // ── new towers: g4 (Support A) ──
      | "crit"
      // ── end g4 ──
      // ── new towers: g5 (Support B) ──
      | "recycle" | "barrier" | "discount"
      // ── end g5 ──
  }
>;
const VISUAL = new Set<GameEvent["type"]>([
  "shot", "chain", "beam", "pulse", "income", "repair", "impact", "kill", "leak", "build", "sell", "upgrade", "evade", "overload",
  // ── new towers: g1 (Attack+Control A) ──
  "strike", "shatter", "gather",
  // ── end g1 ──
  // ── new towers: g2 (Control B) ──
  "echo",
  // ── end g2 ──
  // ── new towers: g3 (Traps) ──
  "warp", "breach",
  // ── end g3 ──
  // ── new towers: g4 (Support A) ──
  "crit",
  // ── end g4 ──
  // ── new towers: g5 (Support B) ──
  "recycle", "barrier", "discount",
  // ── end g5 ──
]);
export const isVisual = (e: GameEvent): e is VisualEvent => VISUAL.has(e.type);
/** Read by the scene when an event arrives, so the effect still knows its source after a sale or a turn of the turret. */
export interface EffectOrigin {
  /** Level and turret angle of the tower that fired. */
  level?: number;
  angle?: number;
  /** Direction the landed projectile flew in. */
  heading?: number;
  /** Blast radius of the landed projectile in cells. */
  radius?: number;
}
const DANGER = 0xff647c,
  WHITE = 0xffffff;
const SOURCES = new WeakMap<ContentPack, Map<number, TurretStyle | null>>();
/**
 * Turret of the tower with this base colour: pulse, chain and beam events carry only the colour, and every tower
 * has its own. A colour two towers share maps to none, which falls back to the default look.
 */
function sourceOf(content: ContentPack, color: number): TurretStyle | undefined {
  let map = SOURCES.get(content);
  if (!map) {
    map = new Map();
    for (const d of Object.values(content.towers)) map.set(d.color, map.has(d.color) ? null : d.visual.turret);
    SOURCES.set(content, map);
  }
  return map.get(color) ?? undefined;
}
export function effectLifetime(e: VisualEvent, content: ContentPack) {
  switch (e.type) {
    case "income":
    case "repair":
      return INCOME_LIFETIME;
    case "impact":
      return impactOf(content.towers[e.tower]).life;
    case "warp":
    case "breach":
      return TRAP_EFFECT_LIFE;
    case "pulse": {
      const turret = sourceOf(content, e.color);
      return turret === "hammer" ? QUAKE_LIFETIME : turret === "heavy" || turret === "limpet" ? IMPACTS.burst.life : EFFECT_LIFETIME;
    }
    default:
      return EFFECT_LIFETIME;
  }
}
/** Ease-out growth to 1 within `time` seconds. */
const grow = (age: number, time: number) => 1 - Math.pow(1 - Math.min(1, age / time), 3);
/** Muzzle flashes by `MuzzleSpec.flash`, at one barrel tip pointing along `a`. */
const FLASHES: Record<FlashStyle, (pen: Pen, x: number, y: number, a: number, age: number, color: number, rise: boolean) => void> = {
  // A three-spiked star with a white core, then a wisp of smoke.
  gun: ({ g, glow }, x, y, a, age, c) => {
    const k = age / 0.08;
    if (k < 1) {
      const co = Math.cos(a),
        si = Math.sin(a),
        len = 4 + 9 * (1 - k);
      glow.fillStyle(shade(c, 0.3), 0.55 * (1 - k));
      glow.fillTriangle(x - si * 2.2, y + co * 2.2, x + si * 2.2, y - co * 2.2, x + co * len, y + si * len);
      for (const side of [-1.2, 1.2]) {
        const b = a + side;
        glow.fillTriangle(x - Math.sin(b) * 1.2, y + Math.cos(b) * 1.2, x + Math.sin(b) * 1.2, y - Math.cos(b) * 1.2, x + Math.cos(b) * 5, y + Math.sin(b) * 5);
      }
      disc(g, x + co, y + si, 3 * (1 - k) + 0.5, WHITE, 1 - k);
    }
    const s = (age - 0.04) / 0.3;
    if (s > 0 && s < 1) disc(g, x + Math.cos(a) * (3 + 8 * s), y + Math.sin(a) * (3 + 8 * s) - 4 * s, 2 + 3 * s, 0x9aa3a8, 0.18 * (1 - s));
  },
  // Heavy guns: a wide cone of fire and a cloud of smoke (rising from a mortar's steep barrel).
  heavy: ({ g, glow }, x, y, a, age, c, rise) => {
    const co = Math.cos(a),
      si = Math.sin(a),
      k = age / 0.1;
    if (k < 1) {
      glow.fillStyle(shade(c, 0.4), 0.5 * (1 - k));
      glow.fillTriangle(x - si * 3, y + co * 3, x + si * 3, y - co * 3, x + co * 16 - si * 6, y + si * 16 + co * 6);
      glow.fillTriangle(x - si * 3, y + co * 3, x + co * 16 + si * 6, y + si * 16 - co * 6, x + co * 16 - si * 6, y + si * 16 + co * 6);
      disc(g, x + co * 2, y + si * 2, 4 * (1 - k) + 1, WHITE, 1 - k);
    }
    for (let i = 0; i < 4; i++) {
      const s = (age - i * 0.03) / 0.42;
      if (s <= 0 || s >= 1) continue;
      const side = (i - 1.5) * 2.5,
        d = 4 + (rise ? 6 : 14) * s + i * 2;
      disc(g, x + co * d - si * side, y + si * d + co * side - (rise ? 18 : 5) * s, 3 + 5 * s, 0x8e979c, 0.26 * (1 - s));
    }
  },
  // Energy weapons: a flare across the aim.
  energy: ({ g, glow }, x, y, a, age, c) => {
    const k = age / 0.1;
    if (k >= 1) return;
    halo(glow, x, y, 9, c, 0.45 * (1 - k));
    strip(g, x, y, -Math.sin(a), Math.cos(a), -7 * (1 - k), 7 * (1 - k), -0.8, 0.8, -0.8, 0.8, WHITE, 1 - k);
    disc(g, x, y, 2.2 * (1 - k) + 0.6, WHITE, 1 - k);
  },
  // Flamethrowers: a fan of three flame tongues.
  flame: ({ glow }, x, y, a, age, c) => {
    const k = age / 0.12;
    if (k >= 1) return;
    for (let i = -1; i <= 1; i++) {
      const b = a + i * 0.35,
        len = 7 + 3 * (1 - k) - Math.abs(i) * 2;
      glow.fillStyle(i ? c : shade(c, 0.4), 0.5 * (1 - k));
      glow.fillTriangle(x - Math.sin(b) * 1.8, y + Math.cos(b) * 1.8, x + Math.sin(b) * 1.8, y - Math.cos(b) * 1.8, x + Math.cos(b) * len, y + Math.sin(b) * len);
    }
  },
  // Sprayers: droplets thrown forward.
  spray: ({ g }, x, y, a, age, c) => {
    const k = age / 0.2;
    if (k >= 1) return;
    for (let i = 0; i < 4; i++) {
      const b = a + (i - 1.5) * 0.25,
        d = 2 + 26 * age * (1 - 0.4 * k);
      disc(g, x + Math.cos(b) * d, y + Math.sin(b) * d + 10 * age, 1.3 * (1 - 0.5 * k), c, 1 - k);
    }
  },
};
/** Shot of a tower without a barrel (no `MUZZLES` entry). */
function radialShot(pen: Pen, turret: TurretStyle, fx: number, fy: number, tx: number, ty: number, age: number, color: number) {
  switch (turret) {
    // Crystals: a burst of light from the core.
    case "crystal":
    case "prism": {
      const k = age / 0.15;
      if (k < 1) halo(pen.glow, fx, fy, 12 * (0.6 + 0.4 * k), color, 0.5 * (1 - k));
      return;
    }
    // Field emitters: a faint line ties the tower to the field it raises.
    case "emitter":
    case "gravity":
    case "antenna": {
      const k = age / 0.25;
      if (k < 1) glowLine(pen.glow, fx, fy, tx, ty, color, 1.5, 0.25 * (1 - k));
      return;
    }
  }
}
/** Lance: a white-hot rail beam in a wide glow, wound by a fading spiral. */
function railBeam({ g, glow }: Pen, fx: number, fy: number, tx: number, ty: number, color: number, age: number) {
  const k = Math.min(1, age / 0.4),
    alpha = 1 - k,
    length = Math.hypot(tx - fx, ty - fy) || 1,
    co = (tx - fx) / length,
    si = (ty - fy) / length;
  if (alpha <= 0) return;
  glow.lineStyle(2 + 10 * alpha, color, 0.18 * alpha);
  glow.lineBetween(fx, fy, tx, ty);
  glow.lineStyle(4, color, 0.45 * alpha);
  glow.lineBetween(fx, fy, tx, ty);
  const n = Math.min(60, Math.ceil(length / 6)),
    points = Array.from({ length: n + 1 }, (_, i) => {
      const d = (i / n) * length,
        off = 4 * alpha * Math.sin((d / 18) * Math.PI * 2 - age * 20);
      return { x: fx + co * d - si * off, y: fy + si * d + co * off };
    });
  glow.lineStyle(1.2, shade(color, 0.3), 0.6 * alpha);
  glow.strokePoints(points, false);
  g.lineStyle(1.5 + alpha, WHITE, alpha);
  g.lineBetween(fx, fy, tx, ty);
  halo(glow, tx, ty, 8, color, 0.5 * alpha);
}
/** Focus: a steady beam whose width and glow follow the charge (`power`), flickering slightly. */
function focusBeam({ g, glow }: Pen, fx: number, fy: number, tx: number, ty: number, color: number, age: number, power: number) {
  const alpha = age < 0.25 ? 1 : Math.max(0, 1 - (age - 0.25) / 0.1),
    flicker = 0.85 + 0.15 * hash01(fx, fy, Math.floor(age * 30));
  if (alpha <= 0) return;
  glow.lineStyle(8 + 8 * power, color, 0.12 * alpha * flicker);
  glow.lineBetween(fx, fy, tx, ty);
  glow.lineStyle(3 + 6 * power, color, 0.35 * alpha * flicker);
  glow.lineBetween(fx, fy, tx, ty);
  g.lineStyle(1 + 1.5 * power, WHITE, alpha);
  g.lineBetween(fx, fy, tx, ty);
  halo(glow, tx, ty, 5 + 4 * power, color, 0.45 * alpha);
}
/** Links between enemies (and Tripwire's alarm to towers), by the source tower's turret. */
function chain(pen: Pen, turret: TurretStyle | undefined, fx: number, fy: number, tx: number, ty: number, color: number, age: number) {
  const { g, glow } = pen,
    alpha = Math.max(0, 1 - age / 0.4),
    length = Math.hypot(tx - fx, ty - fy) || 1,
    co = (tx - fx) / length,
    si = (ty - fy) / length,
    path = (n: number, offset: (k: number) => number) =>
      Array.from({ length: n + 1 }, (_, i) => {
        const k = i / n,
          off = offset(k);
        return { x: fx + (tx - fx) * k - si * off, y: fy + (ty - fy) * k + co * off };
      });
  if (alpha <= 0) return;
  if (controlChain(pen, turret, fx, fy, tx, ty, color, age)) return;
  switch (turret) {
    // Ricochet: a straight streak to the next target.
    case "barrel":
      glowLine(glow, fx, fy, tx, ty, color, 1.5, 0.5 * alpha);
      g.lineStyle(1, WHITE, alpha);
      g.lineBetween(fx + (tx - fx) * age * 2, fy + (ty - fy) * age * 2, tx, ty);
      return;
    // Net Cloud: a sagging rope.
    case "launcher": {
      const points = path(10, (k) => 6 * Math.sin(Math.PI * k));
      g.lineStyle(1.2, color, alpha);
      g.strokePoints(points, false);
      disc(g, tx, ty, 1.6, shade(color, -0.4), alpha);
      return;
    }
    // Contagion: a writhing tendril.
    case "prism": {
      const points = path(14, (k) => 3 * Math.sin(k * Math.PI * 4 - age * 18) * Math.sin(Math.PI * k));
      glow.lineStyle(3, color, 0.35 * alpha);
      glow.strokePoints(points, false);
      g.lineStyle(1, shade(color, -0.3), alpha);
      g.strokePoints(points, false);
      return;
    }
    // Wildfire: a low arc of fire carrying embers.
    case "flame": {
      const points = path(10, (k) => -10 * Math.sin(Math.PI * k));
      glow.lineStyle(3, color, 0.4 * alpha);
      glow.strokePoints(points, false);
      for (let i = 0; i < 3; i++) {
        const q = points[Math.min(10, Math.floor(((age * 2.5 + i / 3) % 1) * 10))];
        disc(g, q.x, q.y, 1.5, shade(color, 0.4), alpha);
      }
      return;
    }
    // Execution chain: a crimson cut.
    case "blade":
      glowLine(glow, fx, fy, tx, ty, color, 2, 0.6 * alpha);
      g.lineStyle(0.8, WHITE, alpha);
      g.lineBetween(fx, fy, tx, ty);
      return;
    // Tripwire alarm: a dashed line with a signal running along it.
    case "tripwire": {
      g.lineStyle(1, color, 0.7 * alpha);
      for (let d = 0; d < length; d += 7) g.lineBetween(fx + co * d, fy + si * d, fx + co * Math.min(length, d + 4), fy + si * Math.min(length, d + 4));
      const k = Math.min(1, age / 0.3);
      halo(glow, fx + (tx - fx) * k, fy + (ty - fy) * k, 6, color, 0.6 * alpha);
      return;
    }
    // Lightning by default (Tesla).
    default:
      lightning(pen, fx, fy, tx, ty, color, alpha, hash01(fx + tx, fy + ty, Math.floor(age * 20)));
      halo(glow, fx, fy, 5, color, 0.35 * alpha);
      halo(glow, tx, ty, 6, color, 0.45 * alpha);
  }
}
/** Area pulses (stun, pull, disruption, quake, frost bursts, detonations), by the source tower's turret. */
function pulse(pen: Pen, turret: TurretStyle | undefined, x: number, y: number, radius: number, color: number, age: number) {
  const { g, glow } = pen,
    R = radius * CELL,
    alpha = Math.max(0, 1 - age / 0.4),
    r = R * (0.3 + 0.7 * grow(age, 0.25));
  switch (turret) {
    // Stasis: a hexagonal field that snaps open and holds.
    case "emitter": {
      const hex = R * grow(age, 0.15),
        corners = Array.from({ length: 6 }, (_, i) => ({ x: x + Math.cos((i * Math.PI) / 3) * hex, y: y + Math.sin((i * Math.PI) / 3) * hex }));
      polygon(g, x, y, hex, 6, color, 0, 0.08 * alpha);
      glow.lineStyle(6, color, 0.2 * alpha);
      glow.strokePoints(corners, true);
      g.lineStyle(2, color, 0.85 * alpha);
      g.strokePoints(corners, true);
      for (const q of corners) disc(g, q.x, q.y, 1.8, shade(color, 0.5), alpha);
      return;
    }
    // Gravitron: the field contracts in four spiral arms around a dark core.
    case "gravity":
    case "spring": {
      const k = Math.min(1, age / EFFECT_LIFETIME),
        outer = R * (1 - 0.65 * Math.min(1, age / EFFECT_LIFETIME) ** 1.5);
      ring(glow, x, y, outer, 4, color, 0.3 * (1 - k));
      ring(g, x, y, outer, 1.6, color, 0.8 * (1 - k));
      // Arms curl inwards from the rim (outwards for the Spring's throw).
      glow.lineStyle(3, color, 0.25 * (1 - k));
      g.lineStyle(1.5, shade(color, 0.3), 0.75 * (1 - k));
      for (let i = 0; i < 4; i++) {
        const start = (i * Math.PI) / 2 + age * 5 * (turret === "spring" ? -1 : 1),
          arm = Array.from({ length: 6 }, (_, j) => ({ x: x + Math.cos(start + j * 0.28) * outer * (1 - j * 0.11), y: y + Math.sin(start + j * 0.28) * outer * (1 - j * 0.11) }));
        glow.strokePoints(arm, false);
        g.strokePoints(arm, false);
      }
      if (turret === "gravity") disc(g, x, y, 5 * (1 - k) + 1, 0x05070f, 0.7 * (1 - k));
      return;
    }
    // Quake: cracks run out through the ground under a ring of dust.
    case "hammer": {
      const k = Math.min(1, age / QUAKE_LIFETIME),
        reach = R * grow(age, 0.2);
      for (let i = 0; i < 7; i++) {
        const a = ((i + hash01(x, y, i)) / 7) * Math.PI * 2,
          points = Array.from({ length: 5 }, (_, j) => {
            const d = (reach * j) / 4,
              off = j ? (hash01(x + i, y, j) - 0.5) * 8 : 0;
            return { x: x + Math.cos(a) * d - Math.sin(a) * off, y: y + Math.sin(a) * d + Math.cos(a) * off };
          });
        g.lineStyle(2.2, SHADOW, 0.75 * (1 - k));
        g.strokePoints(points, false);
        g.lineStyle(0.8, shade(color, 0.35), 0.6 * (1 - k));
        g.strokePoints(points.map((q) => ({ x: q.x + 0.8, y: q.y + 1 })), false);
      }
      ring(g, x, y, reach, 7 * (1 - k) + 1, 0x8e8478, 0.22 * (1 - k));
      return;
    }
    // Jammer: a broken ring of static with glitch blocks.
    case "antenna": {
      const tick = Math.floor(age * 20);
      for (let i = 0; i < 14; i++) {
        if (hash01(x, i, tick) < 0.3) continue;
        const a = (i / 14) * Math.PI * 2;
        arcBand(g, x, y, r, 2, a, a + 0.32, color, 0.85 * alpha);
      }
      for (let i = 0; i < 6; i++) {
        const a = hash01(y, i, tick) * Math.PI * 2,
          d = r * (0.6 + 0.5 * hash01(x, i, tick + 1));
        g.fillStyle(i % 2 ? WHITE : color, 0.8 * alpha);
        g.fillRect(x + Math.cos(a) * d - 2, y + Math.sin(a) * d - 1, 4, 2);
      }
      ring(glow, x, y, r, 6, color, 0.18 * alpha);
      return;
    }
    // Frostburst: ice spikes ride the front.
    case "crystal": {
      ring(glow, x, y, r, 6, color, 0.22 * alpha);
      ring(g, x, y, r, 1.5, color, 0.8 * alpha);
      g.fillStyle(shade(color, 0.55), alpha);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2,
          co = Math.cos(a),
          si = Math.sin(a);
        g.fillTriangle(x + co * r - si * 1.5, y + si * r + co * 1.5, x + co * r + si * 1.5, y + si * r - co * 1.5, x + co * (r + 5), y + si * (r + 5));
      }
      return;
    }
    // Chain Reaction and Sticky Mine detonations: a full explosion.
    case "heavy":
    case "limpet":
      IMPACTS.burst.draw(pen, x, y, age, color, hash01(x, y), undefined, R);
      return;
    // Any other field: a bright front ring over a fading band.
    default:
      disc(g, x, y, r, color, 0.06 * alpha);
      ring(glow, x, y, r - 4, 8, color, 0.18 * alpha);
      ring(g, x, y, r, 2.5, color, 0.8 * alpha);
  }
}
/** Short-lived effects drawn from simulation events; they never affect the game. */
export function drawEffect(pen: Pen, e: VisualEvent, age: number, content: ContentPack, origin: EffectOrigin = {}) {
  if (drawFieldEffect(pen, e, age, content)) return;
  const { g, glow } = pen,
    alpha = Math.max(0, 1 - age / 0.4);
  switch (e.type) {
    case "warp":
    case "breach":
      return drawTrapEffect(pen, e, age);
    case "chain":
      chain(pen, sourceOf(content, e.color), px(e.from.x), px(e.from.y), px(e.to.x), px(e.to.y), e.color, age);
      return;
    case "beam": {
      const turret = sourceOf(content, e.color),
        tx = px(e.to.x),
        ty = px(e.to.y);
      let fx = px(e.from.x),
        fy = px(e.from.y);
      // From a tower: the beam leaves the barrel tip.
      if (turret && origin.angle !== undefined) {
        const tip = muzzleTips(turret, origin.level ?? 1, fx, fy, origin.angle)[0];
        if (tip) ({ x: fx, y: fy } = tip);
      }
      if (controlBeam(pen, turret, fx, fy, tx, ty, e.color, age)) return;
      if (turret === "lens") focusBeam(pen, fx, fy, tx, ty, e.color, age, e.power ?? 0.4);
      else railBeam(pen, fx, fy, tx, ty, e.color, age);
      return;
    }
    case "echo":
      return drawEcho(pen, e, age);
    case "pulse":
      pulse(pen, sourceOf(content, e.color), px(e.at.x), px(e.at.y), e.radius, e.color, age);
      return;
    // Dock repair: a cross flaring up and a ring contracting onto the dock.
    case "repair": {
      const x = px(e.at.x),
        y = px(e.at.y),
        k = Math.min(1, age / 0.6),
        fade = Math.max(0, 1 - age / INCOME_LIFETIME);
      ring(g, x, y, 40 - 26 * k, 2, e.color, (1 - k) * 0.9);
      g.fillStyle(e.color, fade * 0.8);
      const arm = 4 + 6 * Math.min(1, age / 0.2);
      g.fillRect(x - arm * 2, y - arm / 2, arm * 4, arm);
      g.fillRect(x - arm / 2, y - arm * 2, arm, arm * 4);
      halo(glow, x, y, 18, e.color, 0.35 * fade);
      return;
    }
    // Refinery payout: a flash, a shock ring and credit shards bursting out, then drifting up.
    case "income": {
      const x = px(e.at.x),
        y = px(e.at.y),
        k = age / INCOME_LIFETIME,
        fade = Math.max(0, 1 - k),
        flash = Math.max(0, 1 - age / 0.25);
      disc(glow, x, y, 14 + 10 * (1 - flash), WHITE, flash * 0.35);
      halo(glow, x, y, 30 * (1 - flash) + 10, e.color, flash * 0.5);
      const spread = Math.min(1, age / 0.5);
      ring(g, x, y, 10 + spread * 42, 3 * (1 - spread) + 1, e.color, (1 - spread) * 0.9);
      const out = 1 - Math.pow(1 - Math.min(1, age / 0.45), 3);
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + (i - 3.5) * 0.38,
          r = 10 + out * (22 + (i % 3) * 7),
          sx = x + Math.cos(a) * r,
          sy = y + Math.sin(a) * r * 0.8 - age * 26,
          size = (i % 2 ? 3.5 : 4.5) * (0.6 + 0.4 * fade);
        disc(glow, sx, sy, size * 1.9, e.color, fade * 0.25);
        polygon(g, sx, sy, size, 4, i % 3 ? e.color : WHITE, age * 4 + i, fade);
      }
      return;
    }
    // A dodged hit: a white arc swinging past the enemy.
    case "evade": {
      const x = px(e.at.x),
        y = px(e.at.y) - age * 20;
      arcBand(g, x, y, 12 + age * 20, 2, -2.4 + age * 3, -0.8 + age * 3, WHITE, alpha * 0.9);
      return;
    }
    // Overload death: an expanding yellow lightning ring out to the stalled radius.
    case "overload": {
      const x = px(e.at.x),
        y = px(e.at.y),
        k = Math.min(1, age / EFFECT_LIFETIME),
        radius = e.radius * CELL * (1 - Math.pow(1 - k, 2));
      ring(g, x, y, radius, 3, 0xffe14d, alpha * 0.9);
      ring(glow, x, y, radius, 8, 0xffe14d, alpha * 0.25);
      g.lineStyle(1.5, WHITE, alpha * 0.8);
      for (let i = 0; i < 14; i++) {
        const a = (i * Math.PI * 2) / 14 + age * 2,
          jag = i % 2 ? 5 : -5;
        g.lineBetween(x + Math.cos(a) * radius, y + Math.sin(a) * radius, x + Math.cos(a + 0.12) * (radius + jag), y + Math.sin(a + 0.12) * (radius + jag));
      }
      return;
    }
    case "shot": {
      const d = content.towers[e.tower];
      // A trap has no barrel to flash.
      if (d.placement === "path") return;
      const fx = px(e.from.x),
        fy = px(e.from.y),
        tx = px(e.to.x),
        ty = px(e.to.y),
        aim = Math.atan2(ty - fy, tx - fx);
      // Tesla: lightning leaps from the rim of the coil.
      if (d.visual.muzzle === "bolt") {
        lightning(pen, fx + Math.cos(aim) * 10, fy + Math.sin(aim) * 10, tx, ty, e.color, alpha, hash01(tx, ty, Math.floor(age * 20)));
        halo(glow, tx, ty, 7, e.color, 0.5 * alpha);
        return;
      }
      const spec = MUZZLES[d.visual.turret];
      if (!spec) return radialShot(pen, d.visual.turret, fx, fy, tx, ty, age, e.color);
      // The flash sits on every barrel tip, as the turret pointed when it fired.
      const angle = origin.angle ?? aim;
      for (const tip of muzzleTips(d.visual.turret, origin.level ?? 1, fx, fy, angle))
        FLASHES[spec.flash](pen, tip.x, tip.y, Math.atan2(tip.y - fy, tip.x - fx), age, e.color, d.visual.turret === "mortar");
      return;
    }
    case "impact": {
      const d = content.towers[e.tower],
        x = px(e.at.x),
        y = px(e.at.y),
        radius = (origin.radius ?? ("radius" in d.attack ? d.attack.radius : 0)) * CELL;
      impactOf(d).draw(pen, x, y, age, e.color, hash01(e.at.x, e.at.y), origin.heading, radius);
      return;
    }
    case "crit":
      return drawCrit(pen, e, age);
    case "recycle": case "barrier": case "discount": // g5
      return drawEconomyEffect(pen, e, age);
    default:
      ring(g, px(e.at.x), px(e.at.y), 6 + age * 65, 2, e.type === "leak" ? DANGER : e.color, alpha);
  }
}
