import type { PathMotif, Tower, TowerDefinition, TurretStyle } from "../core/types";
import { polygon, shade, type Ink } from "./shapes";
const PLATE = 0x2e424d,
  DARK = 0x172730;
interface TurretContext {
  g: Ink;
  x: number;
  y: number;
  tower: Tower;
  definition: Readonly<TowerDefinition>;
  clock: number;
  /** Level for attack towers, number of purchases for support towers. */
  level: number;
  maxed: boolean;
  /** Display colour; the path colour once a support tower has chosen one. */
  color: number;
  /** Chosen upgrade path, if any. */
  path?: string;
  /** 1 right after a shot, fading to 0 within the first 30 % of the attack cycle. */
  kick: number;
  /** Progress of the attack cycle, 1 when ready to fire. */
  charge: number;
}
type Drawing = (ctx: TurretContext) => void;
/** Tapered bar along `a`, from distance `from` to `to` with half widths `w0` and `w1`; `side` shifts it sideways. */
function bar(g: Ink, x: number, y: number, a: number, from: number, to: number, w0: number, w1: number, color: number, alpha = 1, side = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    p = (d: number, w: number) => ({ x: x + c * d - s * (w + side), y: y + s * d + c * (w + side) });
  g.fillStyle(color, alpha);
  g.fillPoints([p(from, -w0), p(to, -w1), p(to, w1), p(from, w0)], true);
}
const at = (x: number, y: number, a: number, r: number) => ({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
/** Centre pin; white-hot on a fully upgraded tower. */
function hub({ g, x, y, color, maxed }: TurretContext, r = 3) {
  g.fillStyle(maxed ? shade(color, 0.75) : DARK);
  g.fillCircle(x, y, r);
}
/** Coloured glow at the barrel tip right after a shot; the white flash itself is an effect. */
function muzzleGlow({ g, x, y, tower: t, definition: d, kick }: TurretContext, distance: number, size: number) {
  if (kick <= 0) return;
  const p = at(x, y, t.angle, distance);
  g.fillStyle(shade(d.color, 0.5), kick * 0.7);
  g.fillCircle(p.x, p.y, size * (0.6 + kick * 0.6));
}
/** Base plates by `visual.turret`: shadow, outer plate, trim and the dark inner deck. */
const BASES: Record<TurretStyle, Drawing> = {
  barrel: ({ g, x, y, definition: d }) => {
    polygon(g, x, y, 23, 6, PLATE, Math.PI / 6);
    polygon(g, x, y, 19, 6, DARK, Math.PI / 6);
    for (let i = 0; i < 3; i++) {
      const p = at(x, y, Math.PI / 6 + (i * Math.PI * 2) / 3, 21);
      g.fillStyle(shade(d.color, -0.35));
      g.fillCircle(p.x, p.y, 1.8);
    }
  },
  heavy: ({ g, x, y }) => {
    polygon(g, x, y, 24, 8, PLATE, Math.PI / 8);
    polygon(g, x, y, 21, 8, shade(PLATE, -0.25), Math.PI / 8);
    polygon(g, x, y, 18, 8, DARK, Math.PI / 8);
    g.lineStyle(2, DARK);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        p = at(x, y, a, 20),
        q = at(x, y, a, 24);
      g.lineBetween(p.x, p.y, q.x, q.y);
    }
  },
  twin: ({ g, x, y, definition: d }) => {
    g.lineStyle(3, shade(d.color, -0.55));
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2,
        p = at(x, y, a, 10),
        q = at(x, y, a, 19);
      g.lineBetween(p.x, p.y, q.x, q.y);
    }
    polygon(g, x, y, 23, 4, PLATE, 0);
    polygon(g, x, y, 18, 4, DARK, 0);
  },
  coil: ({ g, x, y, definition: d }) => {
    g.fillStyle(PLATE);
    g.fillCircle(x, y, 21);
    g.fillStyle(DARK);
    g.fillCircle(x, y, 17);
    for (let i = 0; i < 6; i++) {
      const p = at(x, y, (i * Math.PI) / 3, 20);
      g.fillStyle(shade(d.color, -0.5));
      g.fillCircle(p.x, p.y, 3);
      g.fillStyle(d.color, 0.8);
      g.fillCircle(p.x, p.y, 1.2);
    }
  },
  crystal: ({ g, x, y }) => {
    polygon(g, x, y, 23, 6, PLATE, 0);
    // Lit upper-left facet.
    const corner = (i: number) => at(x, y, (i * Math.PI) / 3, 23);
    g.fillStyle(shade(PLATE, 0.18));
    g.fillPoints([{ x, y }, corner(3), corner(4)], true);
    polygon(g, x, y, 18, 6, DARK, 0);
  },
  rail: ({ g, x, y, definition: d }) => {
    polygon(g, x, y, 23, 6, PLATE, 0);
    polygon(g, x, y, 19, 6, DARK, 0);
    for (const a of [0, Math.PI]) {
      const p = at(x, y, a, 21);
      g.fillStyle(shade(d.color, -0.45));
      g.fillCircle(p.x, p.y, 2.2);
    }
  },
  flame: ({ g, x, y, definition: d }) => {
    polygon(g, x, y, 23, 8, PLATE, Math.PI / 8);
    polygon(g, x, y, 19, 8, DARK, Math.PI / 8);
    // Heat vents glowing faintly.
    g.lineStyle(2, shade(d.color, -0.45), 0.9);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2,
        p = at(x, y, a, 16),
        q = at(x, y, a, 21);
      g.lineBetween(p.x, p.y, q.x, q.y);
    }
  },
  emitter: ({ g, x, y, definition: d }) => {
    g.fillStyle(PLATE);
    g.fillCircle(x, y, 22);
    g.fillStyle(DARK);
    g.fillCircle(x, y, 18);
    for (let i = 0; i < 3; i++) {
      const p = at(x, y, -Math.PI / 2 + (i * Math.PI * 2) / 3, 20);
      g.fillStyle(shade(d.color, -0.5));
      g.fillCircle(p.x, p.y, 3.2);
      g.fillStyle(d.color, 0.8);
      g.fillCircle(p.x, p.y, 1.3);
    }
  },
  vat: ({ g, x, y, definition: d }) => {
    g.fillStyle(PLATE);
    g.fillRoundedRect(x - 21, y - 21, 42, 42, 9);
    g.fillStyle(DARK);
    g.fillRoundedRect(x - 17, y - 17, 34, 34, 7);
    g.fillStyle(shade(d.color, -0.55));
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.fillCircle(x + sx * 19, y + sy * 19, 1.8);
  },
  prism: ({ g, x, y, definition: d }) => {
    polygon(g, x, y, 23, 12, PLATE, 0);
    polygon(g, x, y, 19, 12, DARK, 0);
    for (let i = 0; i < 3; i++) {
      const p = at(x, y, Math.PI / 2 + (i * Math.PI * 2) / 3, 21);
      polygon(g, p.x, p.y, 2.6, 3, shade(d.color, -0.35), Math.PI / 2 + (i * Math.PI * 2) / 3);
    }
  },
  refinery: ({ g, x, y, definition: d }) => {
    g.fillStyle(PLATE);
    g.fillRoundedRect(x - 22, y - 22, 44, 44, 5);
    g.fillStyle(DARK);
    g.fillRoundedRect(x - 18, y - 18, 36, 36, 4);
    // Hazard corners.
    g.fillStyle(shade(d.color, -0.3));
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
      g.fillTriangle(x + sx * 22, y + sy * 22, x + sx * 14, y + sy * 22, x + sx * 22, y + sy * 14);
  },
  // Round plate with bearing ticks.
  radar: ({ g, x, y, definition: d }) => {
    g.fillStyle(PLATE);
    g.fillCircle(x, y, 22);
    g.fillStyle(DARK);
    g.fillCircle(x, y, 18);
    g.lineStyle(1.5, shade(d.color, -0.35));
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        p = at(x, y, a, 19),
        q = at(x, y, a, 22);
      g.lineBetween(p.x, p.y, q.x, q.y);
    }
  },
  aura: ({ g, x, y, color, path, level, clock }) => {
    g.fillStyle(PLATE);
    g.fillCircle(x, y, 22);
    g.fillStyle(DARK);
    g.fillCircle(x, y, 18);
    // Dim until a path is chosen; the speed path spins faster with every tier.
    g.lineStyle(2, color, path ? 0.45 : 0.2);
    const spin = path === "speed" ? 0.3 * (1 + level) : 0.3;
    for (let i = 0; i < 12; i++) {
      const a = clock * spin + (i * Math.PI) / 6;
      g.beginPath();
      g.arc(x, y, 24, a, a + 0.3);
      g.strokePath();
    }
  },
};
/** Turret drawings by `visual.turret`. A new look is one entry here. */
const TURRETS: Record<TurretStyle, Drawing> = {
  barrel: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, kick } = ctx,
      a = t.angle,
      c = d.color,
      back = -kick * 5,
      length = 21 + level,
      w = level >= 3 ? 0.5 : 0;
    bar(g, x, y, a, back + 3, back + length, 3.5 + w, 2.5 + w, c);
    bar(g, x, y, a, back + length - 4, back + length, 4 + w, 4 + w, shade(c, -0.3));
    g.fillStyle(shade(c, -0.3));
    g.fillCircle(x, y, 9);
    g.fillStyle(c);
    g.fillCircle(x, y, 7);
    g.fillStyle(shade(c, 0.5), 0.6);
    g.fillCircle(x - 2, y - 2, 3);
    hub(ctx);
    muzzleGlow(ctx, back + length + 2, 4);
  },
  heavy: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, kick } = ctx,
      a = t.angle,
      c = d.color,
      back = -kick * 7,
      length = 19 + level,
      w = level >= 3 ? 0.8 : 0;
    bar(g, x, y, a, back + 4, back + length, 5.5 + w, 5 + w, c);
    bar(g, x, y, a, back + 9, back + 12, 5.6 + w, 5.6 + w, shade(c, -0.35));
    bar(g, x, y, a, back + length - 3, back + length, 6.5 + w, 6.5 + w, shade(c, -0.25));
    g.fillStyle(c);
    g.fillCircle(x, y, 10);
    g.fillStyle(shade(c, -0.25));
    g.fillCircle(x, y, 7);
    g.fillStyle(DARK);
    for (const sign of [-1, 1]) {
      const p = at(x, y, a + (sign * Math.PI) / 2, 8);
      g.fillCircle(p.x, p.y, 1.5);
    }
    hub(ctx, 3.5);
    muzzleGlow(ctx, back + length + 2, 6);
  },
  twin: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, kick } = ctx,
      a = t.angle,
      c = d.color,
      back = -kick * 4,
      length = 20 + level;
    bar(g, x, y, a, -7, 7, 8, 8, shade(c, -0.45));
    bar(g, x, y, a, -5, 5, 6, 6, shade(c, -0.2));
    for (const side of [-4, 4]) {
      bar(g, x, y, a, back + 2, back + length, 1.8, 1.5, c, 1, side);
      bar(g, x, y, a, back + length - 3, back + length, 2.3, 2.3, shade(c, 0.35), 1, side);
    }
    g.fillStyle(c);
    g.fillCircle(x, y, 5);
    hub(ctx, 2.5);
    muzzleGlow(ctx, back + length + 2, 4);
  },
  coil: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, clock, kick, charge } = ctx,
      c = d.color;
    // Insulator prongs turning slowly around the coil.
    for (let i = 0; i < 4; i++)
      bar(g, x, y, clock * 0.5 + t.id + (i * Math.PI) / 2, 8, 13, 1.6, 1.2, shade(c, -0.4));
    const rings = level >= 3 ? [12, 9, 6] : [10, 7];
    rings.forEach((r, i) => {
      g.lineStyle(2, c, 0.35 + 0.6 * charge * (1 - i * 0.15));
      g.strokeCircle(x, y, r);
    });
    g.fillStyle(c, 0.3 + 0.7 * charge);
    g.fillCircle(x, y, 3 + charge * 1.5);
    hub(ctx, 1.5);
    // Fully charged: small arcs crackle around the coil.
    if (charge > 0.9) {
      g.lineStyle(1.2, shade(c, 0.6), 0.8);
      for (let i = 0; i < 2; i++) {
        const a = Math.floor(clock * 12 + t.id * 3) * 2.4 + i * Math.PI,
          p = at(x, y, a, 9),
          m = at(x, y, a + 0.25, 13),
          q = at(x, y, a + 0.1, 16);
        g.lineBetween(p.x, p.y, m.x, m.y);
        g.lineBetween(m.x, m.y, q.x, q.y);
      }
    }
    if (kick > 0) {
      g.lineStyle(2, shade(c, 0.5), kick);
      g.strokeCircle(x, y, 10 + (1 - kick) * 8);
    }
  },
  crystal: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, clock, kick, charge } = ctx,
      c = d.color,
      spin = clock * 0.8 + t.id;
    g.fillStyle(c, 0.1 + 0.15 * charge);
    g.fillCircle(x, y, 13 + charge * 2);
    polygon(g, x, y, 11, 4, shade(c, -0.3), spin);
    polygon(g, x, y, 9, 4, c, spin);
    const p = at(x, y, spin, 9),
      q = at(x, y, spin + Math.PI, 9);
    g.lineStyle(1, shade(c, 0.6), 0.8);
    g.lineBetween(p.x, p.y, q.x, q.y);
    polygon(g, x, y, 4, 4, ctx.maxed ? shade(c, 0.75) : 0x222e47, spin);
    // Orbiting shards from level 3.
    if (level >= 3)
      for (let i = 0; i < 2; i++) {
        const s = at(x, y, -spin * 1.5 + i * Math.PI, 15);
        polygon(g, s.x, s.y, 2.5, 4, shade(c, 0.2), spin);
      }
    if (kick > 0) {
      g.lineStyle(1.5, 0xffffff, kick);
      g.strokeCircle(x, y, 12 + (1 - kick) * 6);
    }
  },
  rail: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, kick, charge } = ctx,
      a = t.angle,
      c = d.color,
      back = -kick * 6,
      length = 25 + level;
    bar(g, x, y, a, -9, 8, 7, 6, shade(c, -0.65));
    for (const side of [-3.5, 3.5]) bar(g, x, y, a, back, back + length, 1.7, 1.3, shade(c, -0.2), 1, side);
    // The charge runs along the rails until the next shot.
    bar(g, x, y, a, back + 2, back + 2 + (length - 4) * charge, 0.9, 0.9, c, 0.3 + 0.7 * charge);
    g.fillStyle(shade(c, -0.45));
    g.fillCircle(x, y, 6);
    hub(ctx, 2.5);
    muzzleGlow(ctx, back + length + 2, 4);
  },
  flame: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, kick, clock } = ctx,
      a = t.angle,
      c = d.color,
      back = -kick * 3,
      length = 15 + level,
      flicker = 0.75 + 0.25 * Math.sin(clock * 13 + t.id * 1.7);
    bar(g, x, y, a, back + 2, back + length, 4, 6, shade(c, -0.4));
    bar(g, x, y, a, back + length - 3, back + length, 6.5, 6.5, shade(c, -0.15));
    g.fillStyle(shade(c, -0.5));
    g.fillCircle(x, y, 10);
    g.fillStyle(c, 0.9);
    g.fillCircle(x, y, 6.5 * flicker);
    g.fillStyle(shade(c, 0.6), 0.9);
    g.fillCircle(x, y, 3 * flicker);
    // Embers circling the core from level 3.
    if (level >= 3)
      for (let i = 0; i < 3; i++) {
        const p = at(x, y, clock * 2 + t.id + (i * Math.PI * 2) / 3, 12);
        g.fillStyle(c, 0.5 + 0.5 * flicker);
        g.fillCircle(p.x, p.y, 1.4);
      }
    muzzleGlow(ctx, back + length + 2, 5);
  },
  emitter: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, clock, kick, charge } = ctx,
      c = d.color;
    for (let i = 0; i < 3; i++)
      bar(g, x, y, clock * 0.4 + t.id + (i * Math.PI * 2) / 3, 6, 13, 2.4, 1, shade(c, -0.3));
    g.lineStyle(2, c, 0.3 + 0.6 * charge);
    g.strokeCircle(x, y, 5 + charge * 5);
    if (level >= 3) {
      g.lineStyle(1, c, 0.25 + 0.5 * charge);
      g.strokeCircle(x, y, 12);
    }
    g.fillStyle(c, 0.4 + 0.6 * charge);
    g.fillCircle(x, y, 4);
    hub(ctx, 1.5);
    if (kick > 0) {
      g.lineStyle(2, shade(c, 0.5), kick);
      g.strokeCircle(x, y, 8 + (1 - kick) * 12);
    }
  },
  vat: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, kick, clock } = ctx,
      a = t.angle,
      c = d.color,
      back = -kick * 4,
      length = 17 + level;
    bar(g, x, y, a, back + 4, back + length, 2.6, 2.2, shade(c, -0.35));
    bar(g, x, y, a, back + length - 3, back + length, 3.4, 3.4, shade(c, -0.1));
    g.fillStyle(shade(c, -0.6));
    g.fillCircle(x, y, 10);
    g.fillStyle(c, 0.85);
    g.fillCircle(x, y, 7.5);
    // Bubbles rising in the tank.
    for (let i = 0; i < 2; i++) {
      const phase = (clock * 0.9 + i * 0.5 + t.id * 0.3) % 1;
      g.fillStyle(shade(c, 0.6), 1 - phase);
      g.fillCircle(x - 2 + i * 4, y + 3 - phase * 7, 1.3);
    }
    if (ctx.maxed) hub(ctx, 1.5);
    muzzleGlow(ctx, back + length + 2, 4);
  },
  prism: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, clock, kick, charge } = ctx,
      c = d.color,
      spin = clock * 0.6 + t.id,
      cy = y + Math.sin(clock * 2 + t.id) * 1.5;
    g.fillStyle(c, 0.12 + 0.18 * charge);
    g.fillCircle(x, y, 13);
    polygon(g, x, cy, 11, 3, shade(c, -0.35), spin);
    polygon(g, x, cy, 8, 3, c, spin);
    polygon(g, x, cy, 3.5, 3, ctx.maxed ? shade(c, 0.75) : shade(c, -0.6), -spin);
    // Orbiting shards from level 3.
    if (level >= 3)
      for (let i = 0; i < 3; i++) {
        const s = at(x, cy, -spin * 1.4 + (i * Math.PI * 2) / 3, 15);
        polygon(g, s.x, s.y, 2.2, 3, shade(c, 0.2), spin);
      }
    if (kick > 0) {
      g.lineStyle(1.5, 0xffffff, kick);
      g.strokeCircle(x, cy, 11 + (1 - kick) * 7);
    }
  },
  // A gear that turns faster with every level.
  refinery: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, clock } = ctx,
      c = d.color,
      spin = clock * (0.4 + 0.4 * level) + t.id;
    for (let i = 0; i < 8; i++) bar(g, x, y, spin + (i * Math.PI) / 4, 7, 12.5, 2.3, 1.8, shade(c, -0.25));
    g.fillStyle(shade(c, -0.25));
    g.fillCircle(x, y, 9);
    g.fillStyle(c);
    g.fillCircle(x, y, 6.5);
    hub(ctx, 2.5);
  },
  // A sweeping scan wedge and a dish that turns with it; faster with every level.
  radar: (ctx) => {
    const { g, x, y, tower: t, definition: d, level, clock } = ctx,
      c = d.color,
      a = clock * (1.2 + 0.4 * level) + t.id;
    for (let i = 0; i < 6; i++) {
      const from = a - (i + 1) * 0.12;
      g.fillStyle(c, 0.22 - i * 0.035);
      g.slice(x, y, 16, from, from + 0.12, false);
      g.fillPath();
    }
    g.lineStyle(1, c, 0.35);
    g.strokeCircle(x, y, 9);
    bar(g, x, y, a, 0, 13, 1.5, 1, c);
    bar(g, x, y, a, 8, 11, 6, 6, shade(c, -0.2));
    g.fillStyle(c);
    g.fillCircle(x, y, 4.5);
    hub(ctx, 2);
  },
  aura: (ctx) => {
    const { g, x, y, tower: t, definition: d, clock, color: c, path, level } = ctx,
      motif = path ? d.visual.paths?.[path]?.motif : undefined;
    g.lineStyle(2, c, motif ? 0.55 : 0.3);
    g.strokeCircle(x, y, 19);
    if (!motif) {
      // Undecided: one dimmed dot per path colour hints at the choice.
      Object.values(d.visual.paths ?? {}).forEach((option, i, all) => {
        const p = at(x, y, clock * 0.4 + (i * Math.PI * 2) / all.length - Math.PI / 2, 13);
        g.fillStyle(option.color, 0.55);
        g.fillCircle(p.x, p.y, 2.5);
      });
      g.fillStyle(c, 0.5);
      g.fillCircle(x, y, 4);
      hub(ctx, 2);
      return;
    }
    MOTIFS[motif](ctx, Math.max(1, level), clock + t.id);
    g.fillStyle(c);
    g.fillCircle(x, y, 5);
    hub(ctx, 2);
    g.lineStyle(1.5, c, 0.75);
    g.strokeCircle(x, y, 8 + Math.sin(clock * 2) * 2);
  },
};
/** Path motifs of support towers; `tier` (1–3) adds detail. */
const MOTIFS: Record<PathMotif, (ctx: TurretContext, tier: number, time: number) => void> = {
  // Damage: pairs of blades turning slowly.
  blades: ({ g, x, y, color: c }, tier, time) => {
    const n = tier * 2;
    for (let i = 0; i < n; i++) {
      const a = time * 0.5 + (i * Math.PI * 2) / n;
      bar(g, x, y, a, 9, 18, 3.5, 0, shade(c, -0.25));
      bar(g, x, y, a, 9, 16.5, 2, 0, c);
    }
  },
  // Speed: spiral arms whirling faster per tier.
  vortex: ({ g, x, y, color: c }, tier, time) => {
    const arms = tier + 1;
    g.lineStyle(2, c, 0.85);
    for (let i = 0; i < arms; i++) {
      const start = time * (2 + tier) + (i * Math.PI * 2) / arms;
      g.strokePoints(
        Array.from({ length: 8 }, (_, k) => at(x, y, start + k * 0.17, 7 + k * 1.45)),
        false,
      );
    }
  },
  // Range: rings pulsing outwards, fading at the plate edge.
  rings: ({ g, x, y, color: c }, tier, time) => {
    for (let i = 0; i < tier; i++) {
      const phase = (time * 0.6 + i / tier) % 1;
      g.lineStyle(1.5, c, (1 - phase) * 0.85);
      g.strokeCircle(x, y, 9 + phase * 13);
    }
  },
};
export interface TowerBadges {
  /** Level for attack towers, number of purchases for support towers. */
  markers: number;
  /** No upgrade left to buy. */
  maxed: boolean;
  boosted: boolean;
  /** Display colour, see `towerColor`. */
  color: number;
  path?: string;
}
export function drawTower(g: Ink, x: number, y: number, tower: Tower, definition: Readonly<TowerDefinition>, clock: number, badges: TowerBadges) {
  const c = badges.color,
    level = badges.markers,
    ctx: TurretContext = {
      g,
      x,
      y,
      tower,
      definition,
      clock,
      level,
      maxed: badges.maxed,
      color: c,
      path: badges.path,
      kick: Math.max(0, (tower.cooldown - 0.7) / 0.3),
      charge: 1 - tower.cooldown,
    };
  if (badges.maxed) {
    g.fillStyle(c, 0.08 + 0.05 * Math.sin(clock * 2 + tower.id));
    g.fillCircle(x, y, 27);
  }
  g.fillStyle(0x050b10, 0.55);
  g.fillEllipse(x, y + 8, 39, 27);
  BASES[definition.visual.turret](ctx);
  if (level >= 2) {
    g.lineStyle(1, shade(c, -0.2), 0.6);
    g.strokeCircle(x, y, 17);
  }
  if (level >= 4)
    for (let i = 0; i < 4; i++) {
      const p = at(x, y, Math.PI / 4 + (i * Math.PI) / 2, 15.5);
      g.fillStyle(c, 0.6 + 0.4 * Math.sin(clock * 3 + i));
      g.fillCircle(p.x, p.y, 1.6);
    }
  g.lineStyle(1.5, c, 0.6);
  g.strokeCircle(x, y, 14);
  TURRETS[definition.visual.turret](ctx);
  for (let i = 0; i < badges.markers; i++) {
    g.fillStyle(c);
    g.fillRect(x - (badges.markers * 6 - 2) / 2 + i * 6, y + 20, 4, 3);
  }
  if (badges.boosted) {
    g.fillStyle(0x0c202a);
    g.fillCircle(x + 19, y - 18, 6);
    g.lineStyle(1.5, 0x78dfff);
    g.strokeCircle(x + 19, y - 18, 5);
    g.lineBetween(x + 16, y - 18, x + 22, y - 18);
    g.lineBetween(x + 19, y - 21, x + 19, y - 15);
  }
}
