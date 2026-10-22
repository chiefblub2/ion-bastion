import type { ContentPack, Point, Projectile, Tower, TowerId } from "../core/types";
import { towerLevel } from "../core/upgrades";
import { MUZZLES, muzzleTips } from "./muzzles";
import { PROJECTILES, type ProjectileLook } from "./projectiles";
import { CELL, px, type Pen } from "./shapes";
/** Where and how a projectile is drawn this frame, in pixels. */
export interface Pose {
  /** Drawn position: lifted for arcing shells, eased out of the barrel tip at the start. */
  x: number;
  y: number;
  /** Ground position below it, for shadows. */
  gx: number;
  gy: number;
  /** Direction of flight on screen. */
  angle: number;
  /** 0 at the barrel, 1 at the target. */
  progress: number;
  /** Arcing shells: height above the ground relative to the top of the arc (0–1). */
  lift: number;
  /** Seconds in flight (effect clock: frozen while paused). */
  age: number;
  /** Stable per projectile, for shapes and jitter. */
  seed: number;
}
/** Recent positions of a projectile, newest first; while it flies, sample 0 is its current position. */
export interface TrailView {
  readonly count: number;
  x(i: number): number;
  y(i: number): number;
  /** Seconds since sample `i` was taken. */
  age(i: number): number;
  /** Seconds since the projectile landed or vanished; 0 while it flies. */
  readonly ended: number;
  /** 1 while it flies, falling to 0 over the trail's life after it landed. */
  readonly fade: number;
  readonly pose: Pose;
}
/** Where a projectile landed in the last sync, for its impact effect. */
export interface Arrival {
  type: TowerId;
  x: number;
  y: number;
  /** Direction it flew in. */
  angle: number;
  /** Blast radius in cells from its attack snapshot; 0 for single-target shots. */
  radius: number;
}
/** Samples kept per projectile. */
const SAMPLES = 16;
/** Above this many projectiles, trails take half the samples. */
const BUSY = 40;
/** Faded trails kept after their projectile is gone. */
const MAX_ORPHANS = 64;
class Trail implements TrailView {
  private readonly xs = new Float32Array(SAMPLES);
  private readonly ys = new Float32Array(SAMPLES);
  private readonly ts = new Float64Array(SAMPLES);
  private head = 0;
  private stored = 0;
  private now = 0;
  endedAt: number | undefined;
  frame = 0;
  readonly pose: Pose;
  constructor(
    readonly type: TowerId,
    readonly tower: number,
    readonly look: ProjectileLook,
    readonly color: number,
    /** Tower centre the projectile started from, and the offset of the barrel tip from it. */
    private readonly cx: number,
    private readonly cy: number,
    private ox: number,
    private oy: number,
    /** Point-aimed shells: total distance to the fixed target. */
    private readonly total: number,
    private readonly born: number,
    seed: number,
    readonly radius: number,
  ) {
    this.pose = { x: cx + ox, y: cy + oy, gx: cx + ox, gy: cy + oy, angle: 0, progress: 0, lift: 0, age: 0, seed };
  }
  get count() {
    return this.endedAt === undefined ? this.stored + 1 : this.stored;
  }
  get ended() {
    return this.endedAt === undefined ? 0 : this.now - this.endedAt;
  }
  get fade() {
    return this.endedAt === undefined ? 1 : Math.max(0, 1 - this.ended / (this.look.trail?.life || 1));
  }
  private index(i: number) {
    return (this.head - (this.endedAt === undefined ? i - 1 : i) + SAMPLES) % SAMPLES;
  }
  x(i: number) {
    return this.endedAt === undefined && i === 0 ? this.pose.x : this.xs[this.index(i)];
  }
  y(i: number) {
    return this.endedAt === undefined && i === 0 ? this.pose.y : this.ys[this.index(i)];
  }
  age(i: number) {
    return this.endedAt === undefined && i === 0 ? 0 : this.now - this.ts[this.index(i)];
  }
  private push(x: number, y: number, t: number) {
    this.head = (this.head + 1) % SAMPLES;
    this.xs[this.head] = x;
    this.ys[this.head] = y;
    this.ts[this.head] = t;
    this.stored = Math.min(SAMPLES, this.stored + 1);
  }
  /** Still merging from the barrel tip into its true path (set by `update`). */
  easing = true;
  /** Moves the barrel tip the shot leaves from, while the turret it left is still turning. */
  aimFrom(ox: number, oy: number) {
    this.ox = ox;
    this.oy = oy;
  }
  /** Follows the simulation: eases out of the barrel, lifts arcing shells and records trail samples. */
  update(p: Projectile, now: number, busy: boolean) {
    const sx = px(p.x),
      sy = px(p.y),
      tx = px(p.tx),
      ty = px(p.ty),
      travelled = Math.hypot(sx - this.cx, sy - this.cy),
      tip = Math.hypot(this.ox, this.oy),
      // The shot leaves from the barrel tip and merges into its true path within one barrel length.
      ease = tip > 0 ? Math.max(0, 1 - travelled / tip) : 0,
      remaining = Math.hypot(tx - sx, ty - sy),
      progress = this.total > 0 ? Math.min(1, travelled / this.total) : travelled / (travelled + remaining || 1),
      pose = this.pose;
    this.easing = ease > 0;
    let angle = Math.atan2(ty - sy, tx - sx),
      lift = 0,
      height = 0;
    if (this.look.arc && this.total > 0) {
      const peak = Math.min(60, Math.max(18, 0.32 * this.total)),
        heading = Math.atan2(ty - this.cy, tx - this.cx);
      height = 4 * peak * progress * (1 - progress);
      lift = height / peak;
      // Tangent of the arc: forward along the ground, up then down on screen.
      angle = Math.atan2(Math.sin(heading) * this.total - 4 * peak * (1 - 2 * progress), Math.cos(heading) * this.total);
    }
    pose.gx = sx + this.ox * ease;
    pose.gy = sy + this.oy * ease;
    pose.x = pose.gx;
    pose.y = pose.gy - height;
    pose.angle = angle;
    pose.progress = progress;
    pose.lift = lift;
    pose.age = now - this.born;
    this.now = now;
    const trail = this.look.trail;
    if (!trail) return;
    const step = trail.step * (busy ? 2 : 1);
    if (!this.stored) return this.push(pose.x, pose.y, now);
    const lx = this.xs[this.head],
      ly = this.ys[this.head],
      lt = this.ts[this.head],
      gap = Math.hypot(pose.x - lx, pose.y - ly);
    if (gap < step) return;
    // Big jumps (2× speed, a burst of lockstep frames): up to two samples in between keep the trail smooth.
    const extra = Math.min(2, Math.floor(gap / step) - 1);
    for (let i = 1; i <= extra; i++) {
      const k = i / (extra + 1);
      this.push(lx + (pose.x - lx) * k, ly + (pose.y - ly) * k, lt + (now - lt) * k);
    }
    this.push(pose.x, pose.y, now);
  }
  /** Draws the trail; `now` also ages it after the projectile is gone. */
  drawTrail(pen: Pen, now: number, busy: boolean) {
    this.now = now;
    if (this.look.trail && this.count > 0) this.look.trail.draw(pen, this, this.color, busy);
  }
  expired(now: number) {
    return this.endedAt !== undefined && now - this.endedAt > (this.look.trail?.life ?? 0);
  }
}
/** Absolute angle between two directions, 0 to π. */
const turn = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
/** Offset of the barrel tip a projectile leaves from, with the turret drawn at `angle`. */
function barrelOffset(p: Projectile, tower: Tower, content: ContentPack, angle: number): Point {
  const d = content.towers[p.type],
    cx = px(tower.x),
    cy = px(tower.y),
    tips = muzzleTips(d.visual.turret, towerLevel(tower, content), cx, cy, angle),
    flight = Math.atan2(p.ty - tower.y, p.tx - tower.x);
  if (!tips.length) return { x: 0, y: 0 };
  // Fanned barrels: the one pointing closest to this shot; parallel barrels: between them.
  const off = (q: Point) => turn(Math.atan2(q.y - cy, q.x - cx), flight),
    tip = MUZZLES[d.visual.turret]?.fan
      ? tips.reduce((best, q) => (off(q) < off(best) ? q : best))
      : { x: tips.reduce((s, q) => s + q.x, 0) / tips.length, y: tips.reduce((s, q) => s + q.y, 0) / tips.length };
  return { x: tip.x - cx, y: tip.y - cy };
}
/**
 * Render-side memory of the projectiles in flight: where each one left its barrel, its recent positions for the
 * trail, and trails that fade out after it landed. Purely visual: it only reads the state.
 */
export class Trails {
  private live = new Map<number, Trail>();
  private orphans: Trail[] = [];
  /** Projectiles that disappeared in the last sync. */
  private arrivals: Arrival[] = [];
  private frame = 0;
  reset() {
    this.live.clear();
    this.orphans = [];
    this.arrivals = [];
  }
  /** `angleOf` is the turret angle on screen (`TurretAim`), so a shot leaves the barrel that is drawn. */
  sync(projectiles: readonly Projectile[], towers: readonly Tower[], content: ContentPack, now: number, angleOf = (t: Tower) => t.angle) {
    const frame = ++this.frame,
      busy = projectiles.length > BUSY;
    this.arrivals.length = 0;
    for (const p of projectiles) {
      let t = this.live.get(p.id);
      // A restart hands out ids again; a different shot under a known id starts a fresh trail.
      if (t && (t.type !== p.type || t.tower !== p.tower)) {
        this.orphan(t, now);
        t = undefined;
      }
      if (!t) {
        t = this.start(p, towers, content, now, angleOf);
        this.live.set(p.id, t);
      }
      t.frame = frame;
      // The turret may still be turning toward this shot: the shot keeps leaving the barrel as drawn.
      if (t.easing) {
        const tower = towers.find((q) => q.id === p.tower);
        if (tower) {
          const o = barrelOffset(p, tower, content, angleOf(tower));
          t.aimFrom(o.x, o.y);
        }
      }
      t.update(p, now, busy);
    }
    for (const [id, t] of this.live)
      if (t.frame !== frame) {
        this.live.delete(id);
        this.arrivals.push({ type: t.type, x: t.pose.gx, y: t.pose.gy, angle: t.pose.angle, radius: t.radius });
        this.orphan(t, now);
      }
    this.orphans = this.orphans.filter((t) => !t.expired(now));
  }
  private orphan(t: Trail, now: number) {
    if (!t.look.trail) return;
    t.endedAt = now;
    this.orphans.push(t);
    if (this.orphans.length > MAX_ORPHANS) this.orphans.shift();
  }
  private start(p: Projectile, towers: readonly Tower[], content: ContentPack, now: number, angleOf: (t: Tower) => number) {
    const d = content.towers[p.type],
      look = PROJECTILES[d.visual.projectile ?? "tracer"],
      tower = towers.find((t) => t.id === p.tower),
      cx = tower ? px(tower.x) : px(p.x),
      cy = tower ? px(tower.y) : px(p.y);
    const { x: ox, y: oy } = tower ? barrelOffset(p, tower, content, angleOf(tower)) : { x: 0, y: 0 };
    const total = p.target === null ? Math.hypot(px(p.tx) - cx, px(p.ty) - cy) : 0,
      radius = "radius" in p.attack ? p.attack.radius : 0;
    return new Trail(p.type, p.tower, look, d.color, cx, cy, ox, oy, total, now, p.id, radius);
  }
  /** Trails first (landed ones included), then the projectiles on top. */
  draw(pen: Pen, now: number) {
    const busy = this.live.size > BUSY;
    for (const t of this.orphans) t.drawTrail(pen, now, busy);
    for (const t of this.live.values()) t.drawTrail(pen, now, busy);
    for (const t of this.live.values()) t.look.body(pen, t.pose, t.color);
  }
  /** A projectile of `type` that landed near `at` (grid) in the last sync, for its impact effect. */
  landed(type: TowerId, at: Point): Arrival | undefined {
    const x = px(at.x),
      y = px(at.y);
    return this.arrivals.find((a) => a.type === type && Math.hypot(a.x - x, a.y - y) < 0.7 * CELL);
  }
}
