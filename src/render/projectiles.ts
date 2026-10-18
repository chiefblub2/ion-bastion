import type { ProjectileStyle, TowerDefinition } from "../core/types";
import { facing, halo, SHADOW } from "./material";
import { arcBand, disc, hash01, oval, polygon, ring, shade, strip, type Ink, type Pen } from "./shapes";
import type { Pose, TrailView } from "./trails";
const WHITE = 0xffffff,
  SMOKE = 0x8a9096;
export interface TrailSpec {
  /** Seconds a sample stays visible; landed trails fade out over the same time. */
  life: number;
  /** Pixels flown between two samples. */
  step: number;
  draw(pen: Pen, t: TrailView, color: number, busy: boolean): void;
}
export interface ImpactDrawing {
  /** Seconds the effect lasts. */
  life: number;
  /** `heading`: flight direction, if known; `radius`: blast radius in pixels, 0 for single-target shots. */
  draw(pen: Pen, x: number, y: number, age: number, color: number, seed: number, heading: number | undefined, radius: number): void;
}
export interface ProjectileLook {
  body(pen: Pen, p: Pose, color: number): void;
  trail?: TrailSpec;
  /** Lobbed on a visible arc: drawn raised above its shadow. */
  arc?: true;
  /** Drawing when it lands; absent: the tower's `visual.impact` look. */
  impact?: ImpactDrawing;
}
/** Point at distance `d` along and `l` across the angle with cosine `c` and sine `s` (positive `l` at the angle + π/2). */
const along = (x: number, y: number, c: number, s: number, d: number, l: number) => [x + c * d - s * l, y + s * d + c * l] as const;
/**
 * Tapered streak through the newest samples, at most `length` px long. `side` shifts it sideways relative to the
 * flight direction, for parallel shots.
 */
function streak(g: Ink, t: TrailView, length: number, w: number, color: number, alpha: number, side = 0) {
  const fade = alpha * t.fade;
  let acc = 0;
  for (let i = 0; i + 1 < t.count && acc < length; i++) {
    const ax = t.x(i),
      ay = t.y(i),
      bx = t.x(i + 1),
      by = t.y(i + 1),
      seg = Math.hypot(bx - ax, by - ay);
    if (seg < 0.01) continue;
    // Samples run backwards, so the flight's left is this segment's right.
    const c = (bx - ax) / seg,
      s = (by - ay) / seg,
      end = Math.min(seg, length - acc),
      k0 = acc / length,
      k1 = (acc + end) / length,
      w0 = w * (1 - k0),
      w1 = w * (1 - k1);
    strip(g, ax, ay, c, s, 0, end, -side - w0, -side + w0, -side - w1, -side + w1, color, fade * (1 - k0));
    acc += seg;
  }
}
/** Puffs left at the samples, growing, rising and fading with age. */
function puffs(g: Ink, t: TrailView, life: number, r0: number, r1: number, color: number, alpha: number, rise: number, busy: boolean) {
  for (let i = 1; i < t.count; i += busy ? 2 : 1) {
    const k = t.age(i) / life;
    if (k >= 1) break;
    const x = t.x(i),
      y = t.y(i),
      jitter = (hash01(x, y) - 0.5) * 3 * k;
    disc(g, x + jitter, y - rise * k, r0 + (r1 - r0) * k, color, alpha * (1 - k) * t.fade);
  }
}
/** Fading smoke wisps along an arc. */
const wisps = (pen: Pen, t: TrailView, _c: number, busy: boolean) => puffs(pen.g, t, 0.3, 1.2, 2.8, SMOKE, 0.3, 3, busy);
/** Short-lived white flash and a coloured glow at the impact point. */
function flash({ g, glow }: Pen, x: number, y: number, age: number, color: number, size = 1) {
  const f = Math.max(0, 1 - age / 0.08);
  if (f <= 0) return;
  disc(g, x, y, (1 + 3.5 * f) * size, WHITE, f);
  halo(glow, x, y, 11 * size, color, 0.5 * f);
}
/** Sparks thrown back against the flight direction (all around when it is unknown), falling as they fly. */
function sparks(pen: Pen, x: number, y: number, age: number, color: number, seed: number, heading: number | undefined, count: number, tint = shade(color, 0.45)) {
  const k = age / 0.35;
  if (k >= 1) return;
  flash(pen, x, y, age, color);
  halo(pen.glow, x, y, 7, color, 0.22 * (1 - k));
  pen.g.lineStyle(1.2, tint, 1 - k);
  for (let i = 0; i < count; i++) {
    const a = heading === undefined ? ((i + hash01(seed, i)) / count) * Math.PI * 2 : heading + Math.PI + (hash01(seed, i) - 0.5) * 2.4,
      d = (60 + 50 * hash01(seed, i, 1)) * age * (1 - 0.45 * k),
      len = 2 + 3 * (1 - k),
      c = Math.cos(a),
      s = Math.sin(a),
      sx = x + c * d,
      sy = y + s * d + 40 * age * age;
    pen.g.lineBetween(sx - c * len, sy - s * len, sx, sy);
  }
}
/** Explosion: flash, fireball, shock ring out to the blast radius, flying debris, rising smoke and a scorch mark. */
function blast({ g, glow }: Pen, x: number, y: number, age: number, color: number, seed: number, radius: number, debris: number) {
  const R = radius > 0 ? radius : 40;
  oval(g, x, y + 2, R * 0.42, R * 0.28, SHADOW, 0.3 * Math.max(0, 1 - age / 0.8));
  const f = Math.max(0, 1 - age / 0.12);
  if (f > 0) {
    disc(glow, x, y, 9 + 7 * (1 - f), WHITE, 0.3 * f);
    halo(glow, x, y, R * 0.5, color, 0.4 * f);
  }
  const fire = Math.max(0, 1 - age / 0.32);
  if (fire > 0) {
    const r = 6 + 7 * Math.min(1, age / 0.08);
    disc(g, x, y, r, shade(color, -0.25), 0.9 * fire);
    disc(g, x, y - 1, r * 0.7, shade(color, 0.25), fire);
    disc(g, x, y - 1.5, r * 0.38, 0xfff4d8, fire);
    halo(glow, x, y, r * 2, color, 0.4 * fire);
  }
  const k = Math.min(1, age / 0.35),
    shock = R * 0.9 * (1 - Math.pow(1 - k, 3));
  if (k < 1) {
    ring(g, x, y, shock, 1 + 3 * (1 - k), color, 0.8 * (1 - k));
    ring(glow, x, y, shock, 2 + 6 * (1 - k), color, 0.22 * (1 - k));
  }
  const dk = Math.min(1, age / 0.5);
  if (dk < 1)
    for (let i = 0; i < debris; i++) {
      const a = ((i + hash01(seed, i)) / debris) * Math.PI * 2,
        d = R * (0.35 + 0.4 * hash01(seed, i, 2)) * (1 - Math.pow(1 - dk, 2));
      polygon(g, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8 - 16 * dk + 24 * dk * dk, 1.7, 3, shade(color, -0.55), a + age * 9, 1 - dk);
    }
  for (let i = 0; i < 3; i++) {
    const k2 = Math.max(0, age - 0.08 - i * 0.05) / 0.7;
    if (k2 <= 0 || k2 >= 1) continue;
    disc(g, x + (i - 1) * R * 0.22, y - 4 - k2 * 22, 4 + k2 * 7, 0x6f767c, 0.28 * (1 - k2));
  }
}
/** Impact looks shared by projectile styles without their own and by traps (`visual.impact`). */
export const IMPACTS: Record<"spark" | "burst", ImpactDrawing> = {
  spark: { life: 0.35, draw: (pen, x, y, age, c, seed, heading) => sparks(pen, x, y, age, c, seed, heading, 5) },
  burst: { life: 0.8, draw: (pen, x, y, age, c, seed, _heading, radius) => blast(pen, x, y, age, c, seed, radius, 6) },
};
/** Projectile looks by `visual.projectile`. A new look is one entry here. */
export const PROJECTILES: Record<ProjectileStyle, ProjectileLook> = {
  // Pulse: a white-hot bolt in a coloured sheath with a short streak.
  tracer: {
    body: ({ g, glow }, p, c) => {
      halo(glow, p.x, p.y, 6, c, 0.4);
      oval(g, p.x, p.y, 4.6, 2, c, 1, p.angle);
      oval(g, p.x + Math.cos(p.angle) * 0.6, p.y + Math.sin(p.angle) * 0.6, 3.4, 1.1, WHITE, 1, p.angle);
    },
    trail: {
      life: 0.12,
      step: 5,
      draw: ({ g, glow }, t, c) => {
        streak(glow, t, 26, 2.6, c, 0.55);
        streak(g, t, 12, 0.8, WHITE, 0.7);
      },
    },
  },
  // Fallback for custom packs: a glowing ball.
  shell: {
    body: ({ g, glow }, p, c) => {
      halo(glow, p.x, p.y, 9, c, 0.35);
      disc(g, p.x, p.y, 4.5, shade(c, -0.3));
      disc(g, p.x - 0.5, p.y - 0.5, 3.4, c);
      disc(g, p.x - 1.3, p.y - 1.3, 1.1, WHITE, 0.6);
    },
    trail: { life: 0.3, step: 6, draw: wisps },
  },
  // Nova: a finned rocket with a flickering exhaust and a smoke trail.
  rocket: {
    body: ({ g, glow }, p, c) => {
      const a = p.angle + Math.sin(p.age * 40 + p.seed) * 0.05,
        co = Math.cos(a),
        si = Math.sin(a),
        flicker = hash01(p.seed, Math.floor(p.age * 30)),
        P = (d: number, l: number) => along(p.x, p.y, co, si, d, l);
      halo(glow, ...P(-7, 0), 7, shade(c, 0.2), 0.45);
      oval(glow, ...P(-7.5 - 2 * flicker, 0), 3 + 2.5 * flicker, 1.7, shade(c, 0.4), 0.55, a);
      disc(g, ...P(-5.4, 0), 1.5, 0xfff3d6);
      g.fillStyle(shade(c, -0.45));
      for (const side of [-1, 1]) g.fillTriangle(...P(-5, 1.2 * side), ...P(-1.5, 1.2 * side), ...P(-5.8, 4 * side));
      strip(g, p.x, p.y, co, si, -5, 3, -1.8, 1.8, -1.8, 1.8, c);
      const lit = facing(a + Math.PI / 2) > 0 ? 1 : -1;
      strip(g, p.x, p.y, co, si, -5, 3, lit * 1.8, lit * 0.6, lit * 1.8, lit * 0.6, shade(c, 0.35));
      strip(g, p.x, p.y, co, si, -1.3, -0.3, -1.9, 1.9, -1.9, 1.9, shade(c, -0.4));
      g.fillStyle(shade(c, 0.55));
      g.fillTriangle(...P(3, -1.8), ...P(3, 1.8), ...P(6.6, 0));
    },
    trail: {
      life: 0.45,
      step: 4,
      draw: ({ g, glow }, t, c, busy) => {
        puffs(g, t, 0.45, 2.4, 6.5, SMOKE, 0.24, 6, busy);
        streak(glow, t, 14, 2.4, shade(c, 0.2), 0.45);
      },
    },
  },
  // Mortar: a shell lobbed on a high arc; its shadow stays on the ground and shrinks at the top of the arc.
  lob: {
    arc: true,
    body: ({ g, glow }, p, c) => {
      const s = 1 + 0.15 * p.lift,
        back = along(p.x, p.y, Math.cos(p.angle), Math.sin(p.angle), -4 * s, 0);
      oval(g, p.gx + 1, p.gy + 2, 4.4 * (1 - 0.45 * p.lift), 2.2 * (1 - 0.45 * p.lift), SHADOW, 0.42 - 0.22 * p.lift);
      oval(g, p.x, p.y, 4.2 * s, 3 * s, shade(c, -0.4), 1, p.angle);
      oval(g, p.x - 0.4, p.y - 0.5, 3.3 * s, 2.1 * s, c, 1, p.angle);
      disc(g, p.x - 1.2, p.y - 1.3, 0.9 * s, WHITE, 0.6);
      halo(glow, ...back, 4.5, 0xffb057, 0.3 + 0.25 * hash01(p.seed, Math.floor(p.age * 20)));
    },
    trail: { life: 0.3, step: 6, draw: wisps },
    impact: { life: 0.8, draw: (pen, x, y, age, c, seed, _heading, radius) => blast(pen, x, y, age, c, seed, radius, 10) },
  },
  // Executioner: a spinning three-bladed glaive with motion blur.
  glaive: {
    body: ({ g, glow }, p, c) => {
      const spin = p.age * 30 + p.seed,
        polar = (r: number, a: number) => [p.x + Math.cos(a) * r, p.y + Math.sin(a) * r] as const;
      halo(glow, p.x, p.y, 9, shade(c, 0.35), 0.35);
      for (let i = 0; i < 3; i++) {
        const b = spin + (i * Math.PI * 2) / 3;
        arcBand(glow, p.x, p.y, 5.5, 1.6, b - 1.3, b, shade(c, 0.3), 0.22);
        g.fillStyle(shade(c, 0.12));
        g.fillPoints(
          [polar(2, b - 0.6), polar(4.6, b - 0.15), polar(7, b + 0.35), polar(4.2, b + 0.5), polar(2, b + 0.9)].map(([x, y]) => ({ x, y })),
          true,
        );
        g.lineStyle(1, shade(c, 0.65), 0.9);
        g.lineBetween(...polar(4.6, b - 0.15), ...polar(7, b + 0.35));
      }
      disc(g, p.x, p.y, 2.3, shade(c, -0.45));
      disc(g, p.x - 0.4, p.y - 0.4, 1, shade(c, 0.45));
    },
    trail: { life: 0.12, step: 7, draw: ({ glow }, t, c) => streak(glow, t, 18, 3, shade(c, 0.25), 0.3) },
    impact: {
      life: 0.35,
      // Two crimson slashes crossing over the target.
      draw: (pen, x, y, age, c, seed, heading) => {
        const k = age / 0.35,
          a = heading ?? hash01(seed) * Math.PI;
        if (k >= 1) return;
        flash(pen, x, y, age, c);
        for (const side of [-1, 1]) {
          const mid = a + side * 0.8;
          arcBand(pen.glow, x - Math.cos(mid) * 10, y - Math.sin(mid) * 10, 10, 5 * (1 - k), mid - 0.9, mid + 0.9, c, 0.35 * (1 - k));
          arcBand(pen.g, x - Math.cos(mid) * 10, y - Math.sin(mid) * 10, 10, 1.6 * (1 - k) + 0.4, mid - 0.9, mid + 0.9, shade(c, 0.5), 1 - k);
        }
      },
    },
  },
  // Shrapnel: a jagged steel fragment, tumbling, with a hot leading edge.
  shard: {
    body: ({ g, glow }, p, c) => {
      const spin = p.age * 14 + p.seed,
        corner = (i: number, scale: number) => {
          const a = spin + (i * Math.PI * 2) / 5,
            r = (2.6 + 2 * hash01(p.seed, i)) * scale;
          return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };
        };
      g.fillStyle(shade(c, -0.3));
      g.fillPoints([0, 1, 2, 3, 4].map((i) => corner(i, 1)), true);
      g.fillStyle(shade(c, 0.35));
      g.fillPoints([0, 1, 2].map((i) => corner(i, 0.6)), true);
      const tip = along(p.x, p.y, Math.cos(p.angle), Math.sin(p.angle), 2.5, 0);
      disc(g, ...tip, 1.1, 0xffd08a);
      halo(glow, ...tip, 4, 0xff9a40, 0.45);
    },
    trail: {
      life: 0.08,
      step: 5,
      draw: ({ g, glow }, t) => {
        streak(glow, t, 16, 1.6, 0xff9a40, 0.5);
        streak(g, t, 8, 0.5, 0xffe2b0, 0.7);
      },
    },
    impact: { life: 0.35, draw: (pen, x, y, age, c, seed, heading) => sparks(pen, x, y, age, c, seed, heading, 3, 0xffc27a) },
  },
  // Catalyst: a stoppered glass vial tumbling end over end, its reagent sloshing and fizzing behind it.
  vial: {
    body: ({ g, glow }, p, c) => {
      const spin = p.angle + Math.sin(p.age * 18 + p.seed) * 0.6,
        co = Math.cos(spin),
        si = Math.sin(spin),
        slosh = 0.5 + 0.5 * Math.sin(p.age * 24 + p.seed);
      halo(glow, p.x, p.y, 7, c, 0.3);
      strip(g, p.x, p.y, co, si, -4.4, 3.4, -2.6, 2.6, -2.2, 2.2, shade(c, -0.6));
      strip(g, p.x, p.y, co, si, -4, 3 - slosh, -2, 2, -1.7, 1.7, c);
      strip(g, p.x, p.y, co, si, 3.4, 5.2, -1.2, 1.2, -1.2, 1.2, 0xb08a5a);
      disc(g, ...along(p.x, p.y, co, si, -1.5, -1), 0.9, WHITE, 0.65);
    },
    trail: {
      life: 0.3,
      step: 6,
      draw: ({ g, glow }, t, c) => {
        for (let i = 1; i < t.count; i += 2) {
          const k = t.age(i) / 0.3;
          if (k >= 1) break;
          const r = 1.6 * (1 - k) + 0.3 * hash01(i, t.count);
          disc(g, t.x(i), t.y(i) - 6 * k, r, shade(c, 0.35), (1 - k) * t.fade);
          if (i < 5) disc(glow, t.x(i), t.y(i), 2.6, c, 0.18 * (1 - k) * t.fade);
        }
      },
    },
  },
  // Cryo: a two-faceted ice dart trailing frost sparkles.
  crystal: {
    body: ({ g, glow }, p, c) => {
      const co = Math.cos(p.angle),
        si = Math.sin(p.angle),
        P = (d: number, l: number) => along(p.x, p.y, co, si, d, l),
        lit = facing(p.angle + Math.PI / 2) > 0 ? 1 : -1;
      halo(glow, p.x, p.y, 7, c, 0.35);
      g.fillStyle(shade(c, 0.45));
      g.fillTriangle(...P(6, 0), ...P(0.5, 2.4 * lit), ...P(-4, 0));
      g.fillStyle(shade(c, -0.15));
      g.fillTriangle(...P(6, 0), ...P(0.5, -2.4 * lit), ...P(-4, 0));
      disc(g, ...P(3, 0), 0.9, WHITE, 0.9);
    },
    trail: {
      life: 0.28,
      step: 6,
      draw: ({ glow }, t, c, busy) => {
        for (let i = 1; i < t.count; i += busy ? 2 : 1) {
          const k = t.age(i) / 0.28;
          if (k >= 1) break;
          const x = t.x(i) + (hash01(t.x(i), t.y(i)) - 0.5) * 6,
            y = t.y(i) + (hash01(t.y(i), t.x(i)) - 0.5) * 6;
          polygon(glow, x, y, 2 * (1 - k), 4, shade(c, 0.5), k * 3, 0.7 * (1 - k) * t.fade);
        }
      },
    },
    impact: {
      life: 0.45,
      // Ice slivers burst out and a frost ring spreads.
      draw: (pen, x, y, age, c, seed) => {
        const k = age / 0.45;
        if (k >= 1) return;
        flash(pen, x, y, age, c);
        ring(pen.glow, x, y, 4 + 14 * k, 3, c, 0.35 * (1 - k));
        pen.g.fillStyle(shade(c, 0.55), 1 - k);
        for (let i = 0; i < 6; i++) {
          const a = ((i + hash01(seed, i) * 0.5) / 6) * Math.PI * 2,
            co = Math.cos(a),
            si = Math.sin(a),
            d = 3 + 11 * (1 - Math.pow(1 - k, 2));
          pen.g.fillTriangle(...along(x, y, co, si, d + 5, 0), ...along(x, y, co, si, d, 1.2), ...along(x, y, co, si, d, -1.2));
        }
      },
    },
  },
  // Flak: two tracer rounds side by side.
  twin: {
    body: ({ g, glow }, p, c) => {
      const co = Math.cos(p.angle),
        si = Math.sin(p.angle);
      for (const side of [-3, 3]) {
        const [x, y] = along(p.x, p.y, co, si, 0, side);
        halo(glow, x, y, 4, c, 0.35);
        oval(g, x, y, 2.8, 1.5, c, 1, p.angle);
        oval(g, x, y, 2, 0.8, WHITE, 1, p.angle);
      }
    },
    trail: {
      life: 0.1,
      step: 5,
      draw: ({ glow }, t, c) => {
        streak(glow, t, 18, 1.5, c, 0.55, -3);
        streak(glow, t, 18, 1.5, c, 0.55, 3);
      },
    },
    impact: {
      life: 0.4,
      // Sparks and a grey airburst puff.
      draw: (pen, x, y, age, c, seed, heading) => {
        const k = age / 0.4;
        if (k < 1) disc(pen.g, x, y, 4 + 9 * k, SMOKE, 0.3 * (1 - k));
        sparks(pen, x, y, age, c, seed, heading, 4);
      },
    },
  },
  // Ember: a fireball with licking flames, shedding embers that cool as they rise.
  ember: {
    body: ({ g, glow }, p, c) => {
      halo(glow, p.x, p.y, 8, c, 0.45);
      g.fillStyle(shade(c, -0.1));
      for (let i = -1; i <= 1; i++) {
        const a = p.angle + Math.PI + i * 0.5,
          co = Math.cos(a),
          si = Math.sin(a),
          len = 4 + 3.5 * hash01(p.seed, Math.floor(p.age * 30), i);
        g.fillTriangle(...along(p.x, p.y, co, si, 1.5, 1.7), ...along(p.x, p.y, co, si, 1.5, -1.7), ...along(p.x, p.y, co, si, 1.5 + len, 0));
      }
      disc(g, p.x, p.y, 3.4, c);
      disc(g, p.x, p.y, 2.2, shade(c, 0.45));
      disc(g, p.x, p.y, 1.2, WHITE);
    },
    trail: {
      life: 0.4,
      step: 5,
      draw: ({ g, glow }, t, c, busy) => {
        streak(glow, t, 22, 3.6, c, 0.4);
        for (let i = 2; i < t.count; i += busy ? 4 : 2) {
          const k = t.age(i) / 0.4;
          if (k >= 1) break;
          const n = hash01(t.x(i), t.y(i)),
            x = t.x(i) + (n - 0.5) * 9 * k,
            y = t.y(i) - (8 + 10 * n) * k,
            alpha = (1 - k) * t.fade;
          disc(g, x, y, (0.8 + 0.9 * n) * (1 - 0.5 * k), shade(c, 0.35 - 0.75 * k), alpha);
          if (k < 0.35) disc(glow, x, y, 2.6, c, 0.35 * alpha);
        }
      },
    },
    impact: {
      life: 0.45,
      // Sparks, then a little burst of rising embers.
      draw: (pen, x, y, age, c, seed, heading) => {
        sparks(pen, x, y, age, c, seed, heading, 4);
        const k = age / 0.45;
        if (k >= 1) return;
        for (let i = 0; i < 6; i++) {
          const ex = x + (hash01(seed, i) - 0.5) * 18 * k,
            ey = y - (20 + 16 * hash01(seed, i, 3)) * k;
          disc(pen.g, ex, ey, 1.4 * (1 - k), shade(c, 0.3 - 0.6 * k), 1 - k);
        }
      },
    },
  },
  // Korrosion: a wobbling acid blob dripping as it flies.
  glob: {
    body: ({ g, glow }, p, c) => {
      const w = Math.sin(p.age * 14 + p.seed);
      halo(glow, p.x, p.y, 7, c, 0.25);
      oval(g, p.x + 0.6, p.y + 1, 4.4 + 0.5 * w, 3.6 - 0.4 * w, shade(c, -0.4), 1, p.angle);
      oval(g, p.x, p.y, 4.2 + 0.5 * w, 3.4 - 0.4 * w, c, 1, p.angle);
      disc(g, p.x - 1.3, p.y - 1.3, 1.2, WHITE, 0.6);
    },
    trail: {
      life: 0.35,
      step: 7,
      draw: ({ g }, t, c) => {
        for (let i = 2; i < t.count; i += 2) {
          const k = t.age(i) / 0.35;
          if (k >= 1) break;
          disc(g, t.x(i), t.y(i) + 14 * k * k, 1.5 * (1 - 0.4 * k), shade(c, -0.1), (1 - k) * t.fade);
        }
      },
    },
    impact: {
      life: 0.8,
      // A splash out to the corrosion radius, droplets and a fading splat.
      draw: ({ g, glow }, x, y, age, c, seed, _heading, radius) => {
        const R = radius > 0 ? radius : 24;
        oval(g, x, y + 1, R * 0.3, R * 0.2, shade(c, -0.35), 0.35 * Math.max(0, 1 - age / 0.8));
        const k = Math.min(1, age / 0.3);
        if (k < 1) {
          ring(g, x, y, R * 0.9 * (1 - Math.pow(1 - k, 3)), 2.5 * (1 - k) + 0.5, c, 0.8 * (1 - k));
          halo(glow, x, y, R * 0.6, c, 0.3 * (1 - k));
        }
        const dk = Math.min(1, age / 0.45);
        if (dk < 1)
          for (let i = 0; i < 6; i++) {
            const a = ((i + hash01(seed, i)) / 6) * Math.PI * 2,
              d = R * 0.6 * dk;
            disc(g, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8 - 10 * dk + 22 * dk * dk, 1.6 * (1 - 0.5 * dk), c, 1 - dk);
          }
      },
    },
  },
  // Decay: a void orb in a ring of light with two orbiting motes and a fading ribbon.
  orb: {
    body: ({ g, glow }, p, c) => {
      halo(glow, p.x, p.y, 10, c, 0.4);
      ring(g, p.x, p.y, 4.6, 1.3, c, 0.95);
      disc(g, p.x, p.y, 3.4, shade(c, -0.75));
      for (let i = 0; i < 2; i++) {
        const a = p.age * 7 + p.seed + i * Math.PI,
          mx = p.x + Math.cos(a) * 6.5,
          my = p.y + Math.sin(a) * 6.5 * 0.7;
        disc(g, mx, my, 1.1, shade(c, 0.5));
        disc(glow, mx, my, 2.4, c, 0.3);
      }
    },
    trail: {
      life: 0.2,
      step: 5,
      draw: ({ g, glow }, t, c) => {
        streak(glow, t, 26, 4.5, c, 0.35);
        streak(g, t, 16, 1.4, shade(c, -0.5), 0.5);
      },
    },
    impact: {
      life: 0.45,
      // The orb implodes into a point, then a ripple runs outwards.
      draw: ({ g, glow }, x, y, age, c) => {
        if (age < 0.15) {
          const k = age / 0.15;
          ring(glow, x, y, 18 - 16 * k, 3, c, 0.5);
          disc(g, x, y, 4 * (1 - k) + 1, shade(c, -0.75));
        } else {
          const k = (age - 0.15) / 0.3;
          if (k >= 1) return;
          ring(g, x, y, 3 + 14 * k, 1.5, c, 0.8 * (1 - k));
          halo(glow, x, y, 8, c, 0.4 * (1 - k));
        }
      },
    },
  },
  // Snare Net: a weighted mesh unfolding in flight.
  net: {
    body: ({ g }, p, c) => {
      const s = 5 + 3 * Math.min(1, p.progress * 1.5),
        spin = p.age * 5 + p.seed,
        corners = [0, 1, 2, 3].map((i) => ({ x: p.x + Math.cos(spin + (i * Math.PI) / 2) * s, y: p.y + Math.sin(spin + (i * Math.PI) / 2) * s })),
        bx = -Math.cos(p.angle) * 5,
        by = -Math.sin(p.angle) * 5;
      g.lineStyle(1, c, 0.25);
      for (const q of corners) g.lineBetween(q.x, q.y, q.x + bx, q.y + by);
      polygon(g, p.x, p.y, s, 4, c, spin, 0.15);
      g.lineStyle(1.3, c, 0.95);
      g.strokePoints(corners, true);
      g.lineBetween(corners[0].x, corners[0].y, corners[2].x, corners[2].y);
      g.lineBetween(corners[1].x, corners[1].y, corners[3].x, corners[3].y);
      for (const q of corners) disc(g, q.x, q.y, 1.4, shade(c, -0.45));
    },
    impact: {
      life: 0.45,
      // The net snaps open over the target, then pulls tight.
      draw: ({ g, glow }, x, y, age, c, seed) => {
        const k = age / 0.45;
        if (k >= 1) return;
        const s = age < 0.08 ? 6 + 8 * (age / 0.08) : 14 - 5 * Math.min(1, (age - 0.08) / 0.3),
          spin = hash01(seed) * Math.PI;
        polygon(g, x, y, s, 4, c, spin, 0.18 * (1 - k));
        g.lineStyle(1.3, c, 1 - k);
        const corners = [0, 1, 2, 3].map((i) => ({ x: x + Math.cos(spin + (i * Math.PI) / 2) * s, y: y + Math.sin(spin + (i * Math.PI) / 2) * s }));
        g.strokePoints(corners, true);
        g.lineBetween(corners[0].x, corners[0].y, corners[2].x, corners[2].y);
        g.lineBetween(corners[1].x, corners[1].y, corners[3].x, corners[3].y);
        halo(glow, x, y, 10, c, 0.3 * (1 - k));
      },
    },
  },
  // ── new towers: g1 (Attack+Control A) ──
  // Orbital: a designator dart, a red-hot needle with a blinking beacon, trailing a thin laser line.
  "beacon-mark": {
    body: ({ g, glow }, p, c) => {
      const co = Math.cos(p.angle),
        si = Math.sin(p.angle);
      halo(glow, p.x, p.y, 7, c, 0.3);
      strip(g, p.x, p.y, co, si, -4, 3, -1.3, 1.3, -0.4, 0.4, shade(c, -0.45));
      strip(g, p.x, p.y, co, si, -3, 2, -0.6, 0.6, -0.2, 0.2, shade(c, 0.4));
      disc(g, p.x, p.y, 1, Math.sin(p.age * 30 + p.seed) > 0 ? WHITE : c);
    },
    trail: {
      life: 0.25,
      step: 4,
      draw: ({ g, glow }, t, c) => {
        streak(glow, t, 60, 1.6, c, 0.4);
        streak(g, t, 40, 0.5, shade(c, 0.5), 0.8);
      },
    },
    impact: {
      life: 0.45,
      // The beacon plants itself: four brackets snap onto the spot and a ping ring runs out.
      draw: ({ g, glow }, x, y, age, c) => {
        const k = age / 0.45;
        if (k >= 1) return;
        const s = 14 * (1 - Math.min(1, age / 0.15)) + 5;
        for (let i = 0; i < 4; i++) {
          const a = Math.PI / 4 + (i * Math.PI) / 2;
          strip(g, x, y, Math.cos(a), Math.sin(a), s, s + 4, -0.8, 0.8, -0.8, 0.8, c, 1 - k);
        }
        ring(g, x, y, 4 + 16 * k, 1.2, c, 0.8 * (1 - k));
        disc(g, x, y, 1.6, WHITE, 1 - k);
        halo(glow, x, y, 8, c, 0.3 * (1 - k));
      },
    },
  },
  // ── end g1 ──
  // ── new towers: g2 (Control B) ──
  // ── end g2 ──
  // ── new towers: g3 (Traps) ──
  // Harpoon: a barbed steel head on a short shaft, trailing its rope back to the trap.
  harpoon: {
    body: ({ g, glow }, p, c) => {
      const co = Math.cos(p.angle),
        si = Math.sin(p.angle);
      strip(g, p.x + 0.8, p.y + 1.2, co, si, -9, 2, -1, 1, -1, 1, SHADOW, 0.35);
      strip(g, p.x, p.y, co, si, -9, 1, -0.9, 0.9, -0.9, 0.9, shade(c, -0.3));
      g.fillStyle(0xd6dde2);
      g.fillTriangle(...along(p.x, p.y, co, si, 1, -2.8), ...along(p.x, p.y, co, si, 1, 2.8), ...along(p.x, p.y, co, si, 6.5, 0));
      g.fillStyle(0x8a96a3);
      g.fillTriangle(...along(p.x, p.y, co, si, 1, 0), ...along(p.x, p.y, co, si, 1, 2.8), ...along(p.x, p.y, co, si, 6.5, 0));
      // Barbs flaring back from the head.
      g.lineStyle(1, 0xd6dde2, 0.9);
      for (const side of [-1, 1]) g.lineBetween(...along(p.x, p.y, co, si, 1.5, side * 2.4), ...along(p.x, p.y, co, si, -1.5, side * 3.6));
      halo(glow, p.x + co * 4, p.y + si * 4, 5, c, 0.2);
    },
    trail: {
      life: 0.6,
      step: 3,
      // The rope: a sagging line through every sample back to the launch point.
      draw: ({ g }, t) => {
        if (t.count < 2) return;
        const pts = Array.from({ length: t.count }, (_, i) => {
          const k = i / (t.count - 1);
          return { x: t.x(i), y: t.y(i) + Math.sin(Math.PI * k) * 2.5 };
        });
        g.lineStyle(1.6, 0x5a4630, 0.8 * t.fade);
        g.strokePoints(pts, false);
        g.lineStyle(0.7, 0xc8a46b, 0.9 * t.fade);
        g.strokePoints(pts, false);
      },
    },
    impact: {
      life: 0.4,
      // The head bites: a white flash, a jolt ring and a few metal sparks.
      draw: (pen, x, y, age, c, seed, heading) => {
        sparks(pen, x, y, age, c, seed, heading, 3, 0xd6dde2);
        const k = age / 0.4;
        if (k < 1) ring(pen.g, x, y, 4 + 10 * k, 1.5 * (1 - k) + 0.5, shade(c, 0.4), 0.8 * (1 - k));
      },
    },
  },
  // ── end g3 ──
  // ── new towers: g4 (Support A) ──
  // ── end g4 ──
  // ── new towers: g5 (Support B) ──
  // ── end g5 ──
};
/** What a tower's shot looks like when it lands: its projectile's own impact, else its `visual.impact`. */
export function impactOf(d: Readonly<TowerDefinition>): ImpactDrawing {
  return (d.visual.projectile && PROJECTILES[d.visual.projectile].impact) || IMPACTS[d.visual.impact ?? "spark"];
}
