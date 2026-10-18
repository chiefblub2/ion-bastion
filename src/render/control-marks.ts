import type { Enemy, GameEvent, Sim, StatusEffect, TurretStyle } from "../core/types";
import { isSiphon, siphonBoost, siphonDrained } from "../systems/siphon";
import { tetherOf } from "../systems/tether";
import type { EnemyDrawContext } from "./enemies";
import { glowLine, halo } from "./material";
import { arcBand, chamferRect, disc, px, ring, shade, star, type Ink, type Pen } from "./shapes";
/**
 * Visual tells of the Control B towers (Tether, Shrink Ray, Hex, Siphon), drawn from the state every frame:
 * chains between linked enemies, a shrunk body with its marker, the hex sigil whose light grows with the stored
 * damage, and the Siphon's drain streams. Plus their event looks (link, beam, echo). Render only.
 */
type Shrink = Extract<StatusEffect, { kind: "shrink" }>;
type Echo = Extract<StatusEffect, { kind: "echo" }>;
const TAU = Math.PI * 2,
  WHITE = 0xffffff,
  SHRINK_COLOR = 0x26ff38;
/** Body scale of a unit: a running Shrink Ray makes the body (procedural or painted) and its rings smaller. */
export function shrinkScale(e: Enemy, shrunk: boolean) {
  if (!shrunk) return 1;
  const s = e.status.find((x): x is Shrink => x.kind === "shrink");
  return s ? s.factor : 1;
}
/** Point `k` of the way from (fx, fy) to (tx, ty), pushed `off` px across the line. */
function across(fx: number, fy: number, tx: number, ty: number, k: number, off: number) {
  const len = Math.hypot(tx - fx, ty - fy) || 1;
  return { x: fx + (tx - fx) * k - ((ty - fy) / len) * off, y: fy + (ty - fy) * k + ((tx - fx) / len) * off };
}
/** A sagging chain of alternating round and flat links between two points. */
function chainLinks(g: Ink, fx: number, fy: number, tx: number, ty: number, sag: number, color: number, alpha: number) {
  const n = Math.max(3, Math.ceil(Math.hypot(tx - fx, ty - fy) / 6));
  for (let i = 0; i <= n; i++) {
    const k = i / n,
      p = across(fx, fy, tx, ty, k, sag * Math.sin(Math.PI * k));
    if (i % 2) chamferRect(g, p.x, p.y, 1.2, 1.2, 0.5, shade(color, -0.25), alpha);
    else ring(g, p.x, p.y, 1.7, 0.9, color, alpha);
  }
}
/** Persistent tells, after the enemy layers: chains on the underlay, markers on the overlay, light on the glow layer. */
export function drawControlMarks(layers: { under: Ink; over: Ink; glow: Ink }, sim: Sim, units: readonly EnemyDrawContext[], clock: number) {
  const { under, over, glow } = layers,
    time = sim.state.time,
    towers = sim.content.towers;
  // Tether: one sagging chain through every group, in path order, fading out over its last half second.
  let groups: Map<number, EnemyDrawContext[]> | undefined;
  for (const c of units) {
    if (c.hidden || c.traits.burrowed || !c.status.tethered) continue;
    const s = tetherOf(c.enemy, time);
    if (!s) continue;
    groups ??= new Map();
    const list = groups.get(s.group);
    if (list) list.push(c);
    else groups.set(s.group, [c]);
  }
  for (const list of groups?.values() ?? []) {
    if (list.length < 2) continue;
    const s = tetherOf(list[0].enemy, time)!,
      color = towers[s.source.type].color,
      fade = Math.min(1, (s.until - time) / 0.5);
    list.sort((a, b) => b.enemy.distance - a.enemy.distance || a.enemy.id - b.enemy.id);
    for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i],
        b = list[i + 1],
        sag = 4 + 1.5 * Math.sin(clock * 3 + a.enemy.id);
      chainLinks(under, a.x, a.y + 2, b.x, b.y + 2, sag, color, 0.9 * fade);
      glowLine(glow, a.x, a.y, b.x, b.y, color, 1.2, 0.1 * fade);
      // A spark running along the link.
      const k = (clock * 0.8 + i * 0.37) % 1,
        p = across(a.x, a.y + 2, b.x, b.y + 2, k, sag * Math.sin(Math.PI * k));
      disc(glow, p.x, p.y, 2.4, color, 0.28 * fade);
    }
  }
  for (const c of units) {
    if (c.hidden || c.traits.burrowed) continue;
    const { x, y, r, enemy: e } = c;
    // Shrink Ray: rings contracting onto the body and a small ⊖ badge under it.
    if (c.status.shrunk) {
      const k = (clock * 1.6 + e.id * 0.21) % 1;
      ring(over, x, y, r + 2 + 6 * (1 - k), 1, SHRINK_COLOR, 0.45 * k);
      const bx = x - r - 3,
        by = y + r * 0.7;
      disc(over, bx, by, 3.4, 0x07140a, 0.85);
      ring(over, bx, by, 3, 0.9, SHRINK_COLOR);
      over.fillStyle(SHRINK_COLOR);
      over.fillRect(bx - 1.7, by - 0.45, 3.4, 0.9);
    }
    // Hex: a pentagram beside the HP bar; its light grows with the damage stored, and a ring counts down to the echo.
    if (c.status.cursed) {
      const s = e.status.find((x): x is Echo => x.kind === "echo" && time < x.until);
      if (!s) continue;
      const color = towers[s.source.type].color,
        stored = Math.min(1, (s.stored * s.share) / Math.max(1, e.maxHp * 0.3)),
        left = Math.max(0, Math.min(1, (s.until - time) / s.delay)),
        sx = x + r + 6,
        sy = y - r - 6,
        spin = clock * 0.8 + e.id;
      disc(over, sx, sy, 4.8, 0x14060f, 0.8);
      arcBand(over, sx, sy, 5.6, 1.1, -Math.PI / 2, -Math.PI / 2 + TAU * left, color, 0.9);
      star(over, sx, sy, 4, 1.7, 5, shade(color, -0.3 + 0.8 * stored), spin);
      halo(glow, sx, sy, 5 + 7 * stored, color, 0.06 + 0.24 * stored);
      if (stored > 0.6) disc(glow, sx, sy, 1.6, WHITE, 0.3 * (stored - 0.6) / 0.4);
    }
  }
  // Siphon: motes stream from every drained enemy into the Siphon, and on from it into the towers it feeds.
  let byId: Map<number, EnemyDrawContext> | undefined;
  for (const t of sim.state.towers) {
    if (!isSiphon(t.type, sim.content)) continue;
    const drained = siphonDrained(sim, t);
    if (!drained.length) continue;
    byId ??= new Map(units.map((c) => [c.enemy.id, c]));
    const color = towers[t.type].color,
      sx = px(t.x),
      sy = px(t.y);
    for (const e of drained) {
      const c = byId.get(e.id);
      if (!c || c.hidden || c.traits.burrowed) continue;
      glowLine(glow, c.x, c.y, sx, sy, color, 1, 0.07);
      for (let i = 0; i < 3; i++) {
        const k = (clock * 0.9 + i / 3 + e.id * 0.13) % 1,
          p = across(c.x, c.y, sx, sy, k, 3 * Math.sin(k * TAU + clock * 4));
        disc(glow, p.x, p.y, 1.8, color, 0.28 * (0.4 + 0.6 * k));
      }
    }
    for (const o of sim.state.towers) {
      if (o === t || siphonBoost(sim, o).from !== t) continue;
      const ox = px(o.x),
        oy = px(o.y);
      for (let i = 0; i < 2; i++) {
        const k = (clock * 0.7 + i / 2 + o.id * 0.19) % 1,
          p = across(sx, sy, ox, oy, k, 0);
        disc(glow, p.x, p.y, 2.2, color, 0.26 * Math.sin(Math.PI * k));
        disc(over, p.x, p.y, 0.9, shade(color, 0.5), 0.8 * Math.sin(Math.PI * k));
      }
    }
  }
}
/** Links drawn by the chain event of a Control B tower (a Tether grapple, a jumping curse, a forked drain); false for others. */
export function controlChain(pen: Pen, turret: TurretStyle | undefined, fx: number, fy: number, tx: number, ty: number, color: number, age: number) {
  const { g, glow } = pen,
    alpha = Math.max(0, 1 - age / 0.4);
  if (alpha <= 0) return turret === "tether" || turret === "sigil" || turret === "siphon";
  switch (turret) {
    // Tether: the chain whips out from the grappled enemy and snaps taut.
    case "tether": {
      const k = Math.min(1, age / 0.12),
        end = across(fx, fy, tx, ty, k, 0);
      chainLinks(g, fx, fy, end.x, end.y, 6 * (1 - k), shade(color, 0.3), alpha);
      glowLine(glow, fx, fy, end.x, end.y, color, 2, 0.3 * alpha);
      if (k === 1) halo(glow, tx, ty, 7, color, 0.3 * alpha);
      return true;
    }
    // Plague Hex: a thin wavering thread with a star where the curse lands.
    case "sigil": {
      const points = Array.from({ length: 13 }, (_, i) => across(fx, fy, tx, ty, i / 12, 3 * Math.sin((i / 12) * Math.PI * 3 - age * 14) * Math.sin((Math.PI * i) / 12)));
      glow.lineStyle(2.5, color, 0.3 * alpha);
      glow.strokePoints(points, false);
      g.lineStyle(0.9, shade(color, 0.4), alpha);
      g.strokePoints(points, false);
      star(g, tx, ty - 10, 4 * alpha + 1, 1.8, 5, color, age * 3, alpha);
      return true;
    }
    // Leech Field: a forked drain beam.
    case "siphon":
      drainBeam(pen, fx, fy, tx, ty, color, age, 0.7);
      return true;
  }
  return false;
}
/** A wavy beam whose motes run back from the target to the source: the Siphon drinking. */
function drainBeam({ g, glow }: Pen, fx: number, fy: number, tx: number, ty: number, color: number, age: number, strength = 1) {
  const alpha = Math.max(0, 1 - age / 0.45) * strength;
  if (alpha <= 0) return;
  const points = Array.from({ length: 17 }, (_, i) => across(fx, fy, tx, ty, i / 16, 2.4 * Math.sin((i / 16) * Math.PI * 4 + age * 18) * Math.sin((Math.PI * i) / 16)));
  glow.lineStyle(6, color, 0.16 * alpha);
  glow.strokePoints(points, false);
  g.lineStyle(1.4, shade(color, 0.35), alpha);
  g.strokePoints(points, false);
  for (let i = 0; i < 4; i++) {
    const k = 1 - ((age * 2.6 + i / 4) % 1),
      p = across(fx, fy, tx, ty, k, 0);
    disc(glow, p.x, p.y, 2.6, color, 0.3 * alpha);
    disc(g, p.x, p.y, 1, WHITE, 0.8 * alpha);
  }
  halo(glow, tx, ty, 7, color, 0.25 * alpha);
}
/** Beams of the Shrink Ray and the Siphon; false for any other turret. */
export function controlBeam(pen: Pen, turret: TurretStyle | undefined, fx: number, fy: number, tx: number, ty: number, color: number, age: number) {
  const { g, glow } = pen;
  if (turret === "siphon") {
    drainBeam(pen, fx, fy, tx, ty, color, age);
    return true;
  }
  if (turret !== "shrinker") return false;
  // Shrink Ray: a steady ray carrying rings that shrink on their way, and a ring closing on the target.
  const alpha = Math.max(0, 1 - age / 0.4);
  if (alpha <= 0) return true;
  glowLine(glow, fx, fy, tx, ty, color, 3, 0.3 * alpha);
  g.lineStyle(1.2, shade(color, 0.6), alpha);
  g.lineBetween(fx, fy, tx, ty);
  for (let i = 0; i < 3; i++) {
    const k = (age * 3 + i / 3) % 1,
      p = across(fx, fy, tx, ty, k, 0);
    ring(g, p.x, p.y, 5 * (1 - 0.75 * k), 1, color, alpha * 0.9);
  }
  const close = Math.min(1, age / 0.3);
  ring(g, tx, ty, 16 - 10 * close, 1.6, color, alpha);
  halo(glow, tx, ty, 9, color, 0.3 * alpha);
  return true;
}
/** Hex echo: the curse goes off as a pentagram that flares and spins out, with a ring collapsing into the enemy. */
export function drawEcho({ g, glow }: Pen, e: Extract<GameEvent, { type: "echo" }>, age: number) {
  const x = px(e.at.x),
    y = px(e.at.y),
    k = Math.min(1, age / 0.45),
    alpha = 1 - k,
    big = Math.min(1, e.amount / 60);
  if (alpha <= 0) return;
  star(g, x, y, 10 + 10 * k + 6 * big, 4 + 3 * k, 5, e.color, age * 4, 0.75 * alpha);
  star(g, x, y, 5 + 4 * k, 2, 5, WHITE, age * 4, alpha);
  ring(g, x, y, 22 * (1 - k) + 4, 1.6, shade(e.color, 0.3), alpha);
  halo(glow, x, y, 14 + 8 * big, e.color, 0.3 * alpha);
}
