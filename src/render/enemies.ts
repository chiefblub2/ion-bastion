import type { Enemy, EnemyDefinition, EnemyVisual } from "../core/types";
import type { StatusFlags } from "../systems/status";
import type { TraitFlags } from "../systems/traits";
import { arcPath, chamferRect, fillRound, oval, polygon, star, strokeRound, type Ink } from "./shapes";
import { drawOilCoat } from "./trap-effects";
import { drawTranceMarks } from "./trance";
import { shrinkScale } from "./control-marks";
/**
 * Everything the three enemy stages need, built once per enemy and frame by `enemyContext`.
 * Stages, bottom to top: `drawEnemyUnderlay` (fields, trails, rings, shadow), `drawEnemyBody` (the unit itself)
 * and `drawEnemyOverlay` (markers, HP bar). Each may draw into its own Graphics; `drawEnemy` runs all three into one.
 */
export interface EnemyDrawContext {
  x: number;
  y: number;
  /** Pixel size of one cell; area traits give their radius in cells. */
  cell: number;
  /** Body radius in pixels. */
  r: number;
  enemy: Enemy;
  definition: Readonly<EnemyDefinition>;
  /** Direction of travel. */
  heading: number;
  status: StatusFlags;
  traits: TraitFlags;
  /** Render time in seconds, for animated bodies and markers. */
  clock: number;
  /** Drawn as a flying unit (distant shadow, lifted body), whatever its shape: a flyer, a phase in the air, a leaping walker. */
  air: boolean;
  /** Stealthed and unrevealed: the overlay draws only a shimmering outline, the other stages nothing. */
  hidden: boolean;
  /** The README gallery draws bare units. */
  hpBar: boolean;
}
export function enemyContext(
  x: number,
  y: number,
  cell: number,
  enemy: Enemy,
  definition: Readonly<EnemyDefinition>,
  heading: number,
  status: StatusFlags,
  traits: TraitFlags,
  clock: number,
  hpBar = true,
): EnemyDrawContext {
  const air = traits.phase ? traits.phase === "air" : traits.leaping ? definition.layer !== "air" : definition.layer === "air";
  const r = definition.size * cell * shrinkScale(enemy, status.shrunk);
  return { x, y, cell, r, enemy, definition, heading, status, traits, clock, air, hidden: traits.stealth && !traits.revealed, hpBar };
}
interface Shape<V> {
  /** Ground or air shadow; part of the underlay, so a sprite body can replace `body` and keep it. */
  shadow: (g: Ink, c: EnemyDrawContext, visual: V) => void;
  body: (g: Ink, c: EnemyDrawContext, visual: V) => void;
}
/** Shadow of a compact body: faint and far below a flyer, darker and close under a walker. */
function dropShadow(g: Ink, { x, y, r }: EnemyDrawContext, air: boolean, alpha = 0.55, w = 2.3, h = 1.5) {
  g.fillStyle(0x030a0c, air ? 0.3 : alpha);
  if (air) g.fillEllipse(x, y + 14, r * 1.8, r * 0.9);
  else g.fillEllipse(x, y + 6, r * w, r * h);
}
/**
 * The visible art of a painted body on the ground (`placeArt` in `enemy-sprites.ts`): its centre, heading and
 * visible length (along the heading) and width (across), world pixels.
 */
export interface ArtFootprint {
  x: number;
  y: number;
  heading: number;
  length: number;
  width: number;
}
/** Painted shadows: share of the art's visible length and width; `minWidth` (body radii) keeps slender art from casting a sliver. */
export const PAINTED_SHADOW = { ground: { length: 1, width: 0.8, dy: 6, alpha: 0.5 }, air: { length: 0.78, width: 0.5, dy: 14, alpha: 0.3 }, minWidth: 0.7 } as const;
/**
 * Shadow of a painted body: an oval under its visible art, turned with the heading, so a long body moving up the
 * screen casts a long shadow instead of the procedural body's wide one; the light still falls from above, so the
 * offset stays straight down. Flyers (and everything drawn as flying) cast the faint, smaller, distant one.
 */
function paintedShadow(g: Ink, c: EnemyDrawContext, f: ArtFootprint) {
  const s = c.air || c.definition.visual.shape === "glider" ? PAINTED_SHADOW.air : PAINTED_SHADOW.ground,
    width = Math.max(f.width * s.width, c.r * PAINTED_SHADOW.minWidth * (s === PAINTED_SHADOW.air ? 0.6 : 1));
  oval(g, f.x, f.y + s.dy, (f.length * s.length) / 2, width / 2, 0x030a0c, s.alpha, f.heading);
}
/**
 * How far the body floats above its position: 4 px for anything drawn as flying, except the glider shape, whose
 * distant shadow alone shows the height. Painted bodies (`enemy-sprites.ts`) use the same lift.
 */
export const bodyLift = ({ air, definition }: EnemyDrawContext) => (air && definition.visual.shape !== "glider" ? 4 : 0);
const lift = (c: EnemyDrawContext) => c.y - bodyLift(c);
/** One worm segment: a chain trailing behind the head with a gentle sway. */
function wormSegment({ x, r, heading, clock }: EnemyDrawContext, cy: number, segments: number, i: number) {
  const back = { x: -Math.cos(heading), y: -Math.sin(heading) },
    sway = Math.sin(clock * 4 - i * 0.9) * r * 0.35 * Math.min(i, 1.5),
    d = i * r * 0.95;
  return { x: x + back.x * d - back.y * sway, y: cy + back.y * d + back.x * sway, rad: r * (1 - (i * 0.55) / segments) };
}
/** Enemy looks by `visual.shape`. A new look is one entry here. */
const SHAPES: { [K in EnemyVisual["shape"]]: Shape<Extract<EnemyVisual, { shape: K }>> } = {
  polygon: {
    shadow: (g, c) => dropShadow(g, c, c.air),
    body: (g, c, visual) => {
      const cy = lift(c);
      polygon(g, c.x, cy, c.r, visual.sides, c.definition.color, visual.rotation ?? 0);
      polygon(g, c.x, cy, c.r * 0.4, 4, 0x442e36, 0);
    },
  },
  // Spiky star; turns a little with the heading so legs feel alive.
  star: {
    shadow: (g, c) => dropShadow(g, c, c.air),
    body: (g, c, visual) => {
      const { x, r, heading } = c,
        cy = lift(c);
      star(g, x, cy, r * 1.15, r * 1.15 * visual.inner, visual.points, c.definition.color, heading * 0.35);
      polygon(g, x, cy, r * 0.35, 4, 0x442e36, heading * 0.35);
    },
  },
  // Round body: glow ring, core, highlight and orbiting moons.
  orb: {
    shadow: (g, c) => dropShadow(g, c, c.air, 0.5, 2.1, 1.4),
    body: (g, c, visual) => {
      const { x, r, clock } = c,
        color = c.definition.color,
        cy = lift(c);
      g.fillStyle(color, 0.22);
      fillRound(g, x, cy, r * 1.25);
      g.fillStyle(color);
      fillRound(g, x, cy, r * 0.8);
      g.fillStyle(0xffffff, 0.45);
      fillRound(g, x - r * 0.25, cy - r * 0.25, r * 0.25);
      for (let i = 0; i < visual.moons; i++) {
        const a = clock * 2 + (i * Math.PI * 2) / visual.moons;
        g.fillStyle(0xffffff, 0.85);
        fillRound(g, x + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.35, Math.max(2, r * 0.17));
      }
    },
  },
  // Segmented chain trailing behind the head; every segment casts its own shadow.
  worm: {
    shadow: (g, c, visual) => {
      const cy = lift(c);
      g.fillStyle(0x030a0c, c.air ? 0.3 : 0.5);
      for (let i = 0; i < visual.segments; i++) {
        const s = wormSegment(c, cy, visual.segments, i);
        g.fillEllipse(s.x, s.y + (c.air ? 14 : 6), s.rad * 2, s.rad * 1.2);
      }
    },
    body: (g, c, visual) => {
      const { x, r, heading } = c,
        cy = lift(c);
      for (let i = visual.segments - 1; i >= 0; i--) {
        const s = wormSegment(c, cy, visual.segments, i);
        g.fillStyle(0x0c1417, 0.9);
        fillRound(g, s.x, s.y, s.rad + 1.5);
        g.fillStyle(c.definition.color);
        fillRound(g, s.x, s.y, s.rad);
      }
      g.fillStyle(0x442e36);
      fillRound(g, x + Math.cos(heading) * r * 0.3, cy + Math.sin(heading) * r * 0.3, r * 0.25);
    },
  },
  // Flying: always the faint, distant shadow, and an arrow pointing along the path (never lifted).
  glider: {
    shadow: (g, c) => dropShadow(g, c, true),
    body: (g, { x, y, r, heading: a, definition }) => {
      const p = (ang: number, rad: number) => ({ x: x + Math.cos(a + ang) * rad, y: y + Math.sin(a + ang) * rad });
      g.fillStyle(definition.color);
      g.fillPoints([p(0, r * 1.3), p(2.5, r * 1.2), p(Math.PI, r * 0.35), p(-2.5, r * 1.2)], true);
    },
  },
};
/** The registry entry of a visual, with its union narrowed away (each entry only ever gets its own shape). */
const shapeOf = (visual: EnemyVisual) => SHAPES[visual.shape] as Shape<EnemyVisual>;
/** Status marker colours; they match the towers that cause the effect. */
export const STATUS_COLORS = { slowed: 0xa5a2ff, stunned: 0x5cf2d6, burning: 0xff6a3d, vulnerable: 0xb6f04a, pulled: 0x4d7cff, disrupted: 0xff3df2, netted: 0xe0c068, bleeding: 0xd7263d, charged: 0xff4d4d };
export const TRAIT_COLORS = { shield: 0x6fb8ff, leader: 0xf5c542, healer: 0x6dff9e, scan: 0x6fd3ff, regen: 0x93f5b8, armor: 0xc9d1d9, immune: 0x9fe6ff, split: 0x442e36, sand: 0xc9a46a, plate: 0xff9a7a, gust: 0x9fd8ff, swarm: 0xb6ff6a, rage: 0xff5a1a, facet: 0x7ff4ea, leap: 0xbfe9ff, dampen: 0x8a7dff, brood: 0xe8d27a, overload: 0xffe14d, molt: 0xe6a0b4, momentum: 0xffb347, lap: 0xd9a441, refract: 0xe6f7ff, blastproof: 0xb59a7a, insulated: 0xf2d95c, heatshield: 0xff7a3d, mirror: 0xdfe8f2, link: 0x7ae0c8, taunt: 0xff6b8a, martyr: 0xf2e6c9, pack: 0xb8c4d0, cloak: 0x8e7cc3, blink: 0x6fe39a, tunnel: 0x9c7a54, phase: 0xc792ea, blind: 0xfff27a, jam: 0x90a4b8, defuse: 0xd4a373, suppress: 0x7a8899, retaliate: 0x8bb174 };
/** Faint filled field of an area trait with a dashed rim (`dashes` and `speed` tell the kinds apart). */
function field(g: Ink, x: number, y: number, radius: number, cell: number, color: number, clock: number, dashes: number, speed: number) {
  const rad = radius * cell;
  g.fillStyle(color, 0.04);
  fillRound(g, x, y, rad);
  g.lineStyle(1, color, 0.35);
  for (let i = 0; i < dashes; i++) {
    const a = (i * Math.PI * 2) / dashes + clock * speed;
    g.beginPath();
    arcPath(g, x, y, rad, a, a + (Math.PI * 2) / dashes * 0.45);
    g.strokePath();
  }
}
/** Markers under the body: auras of leaders and healers, motion trails, outlines. */
function traitsBelow(g: Ink, c: EnemyDrawContext) {
  const { x, y, r, cell, heading, traits: t, clock } = c,
    color = c.definition.color;
  if (t.leader) {
    g.lineStyle(1, TRAIT_COLORS.leader, 0.22);
    strokeRound(g, x, y, t.leader * cell);
  }
  if (t.healer) {
    const pulse = (clock * 0.8) % 1;
    g.fillStyle(TRAIT_COLORS.healer, 0.05);
    fillRound(g, x, y, t.healer * cell);
    g.lineStyle(1, TRAIT_COLORS.healer, 0.35 * (1 - pulse));
    strokeRound(g, x, y, t.healer * cell * pulse);
  }
  // Area traits: faint fields, told apart by colour and dash count.
  if (t.link) field(g, x, y, t.link, cell, TRAIT_COLORS.link, clock, 24, 0);
  if (t.taunt) field(g, x, y, t.taunt, cell, TRAIT_COLORS.taunt, clock, 10, -0.3);
  if (t.cloak) field(g, x, y, t.cloak, cell, TRAIT_COLORS.cloak, clock, 5, 0.15);
  if (t.blind) field(g, x, y, t.blind, cell, TRAIT_COLORS.blind, clock, 18, 0.1);
  if (t.jam) field(g, x, y, t.jam, cell, TRAIT_COLORS.jam, clock, 7, 0.6);
  if (t.defuse) field(g, x, y, t.defuse, cell, TRAIT_COLORS.defuse, clock, 4, 0);
  if (t.suppress) field(g, x, y, t.suppress, cell, TRAIT_COLORS.suppress, clock, 32, 0);
  const back = { x: -Math.cos(heading), y: -Math.sin(heading) };
  // Pack: neighbour spokes whose length follows the speed bonus.
  if (t.pack > 0) {
    g.lineStyle(1.5, TRAIT_COLORS.pack, 0.4 + t.pack);
    for (const side of [-0.5, 0.5]) g.lineBetween(x + back.x * r - back.y * side * r, y + back.y * r + back.x * side * r, x + back.x * r * (1.8 + 4 * t.pack) - back.y * side * r * 1.4, y + back.y * r * (1.8 + 4 * t.pack) + back.x * side * r * 1.4);
  }
  // Blink: ghost marks ahead on the path that brighten towards the next jump.
  if (t.blink > 0) {
    g.lineStyle(1.5, TRAIT_COLORS.blink, 0.2 + 0.7 * t.blink);
    for (const k of [1, 2]) {
      const fx = x - back.x * r * (1 + k * 0.9),
        fy = y - back.y * r * (1 + k * 0.9);
      g.lineBetween(fx - back.y * r * 0.5, fy + back.x * r * 0.5, fx + back.y * r * 0.5, fy - back.x * r * 0.5);
    }
  }
  if (t.swift)
    for (let i = 1; i <= 2; i++) {
      g.fillStyle(color, 0.22 / i);
      fillRound(g, x + back.x * r * 0.9 * i, y + back.y * r * 0.9 * i, r * (1 - 0.25 * i));
    }
  if (t.sprinting) {
    g.lineStyle(1.5, 0xffffff, 0.6);
    for (const side of [-0.6, 0, 0.6]) {
      const sx = x + back.x * r * 1.2 - back.y * side * r,
        sy = y + back.y * r * 1.2 + back.x * side * r;
      g.lineBetween(sx, sy, sx + back.x * r * 1.1, sy + back.y * r * 1.1);
    }
  }
  // Surging: long electric-blue streaks behind the body.
  if (t.surging) {
    g.lineStyle(1.5, TRAIT_COLORS.gust, 0.7);
    for (const side of [-0.7, -0.25, 0.25, 0.7]) {
      const sx = x + back.x * r * 1.1 - back.y * side * r,
        sy = y + back.y * r * 1.1 + back.x * side * r;
      g.lineBetween(sx, sy, sx + back.x * r * 2.2, sy + back.y * r * 2.2);
    }
  }
  // Swarming: a glow whose strength follows the damage reduction, with link spokes.
  if (t.swarm > 0) {
    g.fillStyle(TRAIT_COLORS.swarm, 0.1 + 0.25 * t.swarm);
    fillRound(g, x, y, r + 5);
    g.lineStyle(1, TRAIT_COLORS.swarm, 0.2 + 0.6 * t.swarm);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + clock * 0.5;
      g.lineBetween(x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * (r + 7), y + Math.sin(a) * (r + 7));
    }
  }
  // Raging: a pulsing red-orange heat ring that grows and brightens with the speed bonus.
  if (t.rage > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(clock * 8);
    g.fillStyle(TRAIT_COLORS.rage, (0.08 + 0.2 * t.rage) * (0.6 + 0.4 * pulse));
    fillRound(g, x, y, r + 4 + 4 * t.rage);
    g.lineStyle(1.5 + t.rage, TRAIT_COLORS.rage, (0.25 + 0.6 * t.rage) * (0.6 + 0.4 * pulse));
    strokeRound(g, x, y, r + 3 + 5 * t.rage * pulse);
  }
  // Leaping (on the other layer): a small arc under the body, like a hop.
  if (t.leaping) {
    g.lineStyle(2, TRAIT_COLORS.leap, 0.7);
    g.beginPath();
    arcPath(g, x, y + r * 0.9, r * 1.1, Math.PI * 0.15, Math.PI * 0.85);
    g.strokePath();
  }
  // Dampening: a violet dashed field of its radius.
  if (t.dampen) {
    g.fillStyle(TRAIT_COLORS.dampen, 0.05);
    fillRound(g, x, y, t.dampen * cell);
    g.lineStyle(1, TRAIT_COLORS.dampen, 0.4);
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8 + clock * 0.2;
      g.beginPath();
      arcPath(g, x, y, t.dampen * cell, a, a + 0.22);
      g.strokePath();
    }
  }
  // Brood: a pulsing egg sac behind the body that swells towards the next egg.
  if (t.brood > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(clock * 5),
      size = r * (0.45 + 0.4 * t.brood) * (0.9 + 0.1 * pulse),
      ex = x + back.x * r * 1.1,
      ey = y + back.y * r * 1.1;
    g.fillStyle(TRAIT_COLORS.brood, 0.35 + 0.3 * t.brood);
    g.fillEllipse(ex, ey, size * 2, size * 1.6);
    g.lineStyle(1, TRAIT_COLORS.brood, 0.8);
    g.strokeEllipse(ex, ey, size * 2, size * 1.6);
  }
  // Molted (shell shed): shards trailing behind plus speed lines.
  if (t.molt === "shed") {
    g.fillStyle(TRAIT_COLORS.molt, 0.7);
    for (let i = 1; i <= 3; i++) {
      const sx = x + back.x * r * (0.9 + 0.8 * i) + Math.sin(i * 2.1 + clock * 3) * 2,
        sy = y + back.y * r * (0.9 + 0.8 * i) + Math.cos(i * 2.1 + clock * 3) * 2;
      g.fillTriangle(sx - 2.5, sy - 2, sx + 2.5, sy, sx, sy + 3);
    }
    g.lineStyle(1.5, 0xffffff, 0.55);
    for (const side of [-0.5, 0.5]) {
      const sx = x + back.x * r * 1.2 - back.y * side * r,
        sy = y + back.y * r * 1.2 + back.x * side * r;
      g.lineBetween(sx, sy, sx + back.x * r * 1.6, sy + back.y * r * 1.6);
    }
  }
  // Momentum: motion streaks behind the body, longer with the bonus.
  if (t.momentum > 0) {
    const len = r * (0.8 + 4 * t.momentum);
    g.lineStyle(1.5, TRAIT_COLORS.momentum, 0.35 + 0.4 * Math.min(1, t.momentum));
    for (const side of [-0.55, 0, 0.55]) {
      const sx = x + back.x * r * 0.9 - back.y * side * r,
        sy = y + back.y * r * 0.9 + back.x * side * r;
      g.lineBetween(sx, sy, sx + back.x * len * (side === 0 ? 1 : 0.7), sy + back.y * len * (side === 0 ? 1 : 0.7));
    }
  }
  // Evasive: a faint afterimage beside the body.
  if (t.evade) {
    const o = Math.sin(clock * 6) * r * 0.6;
    g.fillStyle(color, 0.18);
    fillRound(g, x - Math.sin(heading) * o, y + Math.cos(heading) * o, r * 0.85);
  }
  // Slow-immune: a dashed ice ring, unlike the solid slowed ring.
  if (t.slowImmune) {
    g.lineStyle(1.5, TRAIT_COLORS.immune, 0.6);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g.beginPath();
      arcPath(g, x, y, r + 4, a, a + 0.6);
      g.strokePath();
    }
  }
  if (t.unstoppable) {
    g.lineStyle(3.5, 0x0b0f14, 0.95);
    strokeRound(g, x, y, r + 2);
  }
  // Burrowed: a sand mound with a dust ring spreading around it.
  if (t.burrowed) {
    const dust = (clock * 1.2) % 1;
    g.fillStyle(TRAIT_COLORS.sand, 0.35);
    g.fillEllipse(x, y + r * 0.35, r * 2.4, r * 1.2);
    g.fillStyle(0xe0c48a, 0.35);
    g.fillEllipse(x - r * 0.2, y + r * 0.15, r * 1.2, r * 0.5);
    g.lineStyle(1.5, TRAIT_COLORS.sand, 0.5 * (1 - dust));
    g.strokeEllipse(x, y + r * 0.35, r * (1.6 + dust), r * (0.8 + dust * 0.5));
  }
}
/** Markers on top of the body: shield bubble, crown, cross, scan brackets. */
function traitsAbove(g: Ink, { x, y, r, heading, traits: t, clock }: EnemyDrawContext) {
  if (t.shield > 0) {
    g.fillStyle(TRAIT_COLORS.shield, 0.1 * t.shield);
    fillRound(g, x, y, r + 6);
    g.lineStyle(1.5, TRAIT_COLORS.shield, 0.25 + 0.6 * t.shield);
    strokeRound(g, x, y, r + 6);
  }
  if (t.leader) {
    g.fillStyle(TRAIT_COLORS.leader);
    for (const dx of [-0.45, 0, 0.45])
      g.fillTriangle(x + dx * r - 2.5, y - r - 11, x + dx * r + 2.5, y - r - 11, x + dx * r, y - r - (dx ? 15 : 17));
  }
  if (t.healer) {
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(x - 1.25, y - 4, 2.5, 8);
    g.fillRect(x - 4, y - 1.25, 8, 2.5);
    g.fillStyle(TRAIT_COLORS.healer);
    g.fillRect(x - 0.75, y - 3.5, 1.5, 7);
    g.fillRect(x - 3.5, y - 0.75, 7, 1.5);
  }
  // Armor: four short plates around the body.
  if (t.armor) {
    g.lineStyle(2.5, TRAIT_COLORS.armor, 0.9);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + 0.335;
      g.beginPath();
      arcPath(g, x, y, r + 2, a, a + 0.9);
      g.strokePath();
    }
  }
  // Hardening: a plate ring that grows more opaque as the shell thickens.
  if (t.harden > 0) {
    g.lineStyle(3, TRAIT_COLORS.plate, 0.2 + 0.8 * t.harden);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + 0.2;
      g.beginPath();
      arcPath(g, x, y, r + 3.5, a, a + 0.7);
      g.strokePath();
    }
  }
  // Faceted (hardened window): bright cyan crystal outline with facet spokes.
  if (t.faceted) {
    g.lineStyle(2, TRAIT_COLORS.facet, 0.9);
    const pts = Array.from({ length: 6 }, (_, i) => ({ x: x + Math.cos((i * Math.PI) / 3 + 0.5) * (r + 3), y: y + Math.sin((i * Math.PI) / 3 + 0.5) * (r + 3) }));
    g.strokePoints(pts, true);
    g.lineStyle(1, 0xffffff, 0.5 + 0.3 * Math.sin(clock * 6));
    for (let i = 0; i < 6; i += 2) g.lineBetween(x, y, pts[i].x, pts[i].y);
  }
  // Plated molt: a thick segmented plate ring.
  if (t.molt === "plated") {
    g.lineStyle(4, TRAIT_COLORS.molt, 0.9);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + 0.1;
      g.beginPath();
      arcPath(g, x, y, r + 3.5, a, a + 0.65);
      g.strokePath();
    }
  }
  // Laps: one small ring pip per completed lap (max 4) above the body.
  for (let i = 0; i < Math.min(4, t.laps); i++) {
    const px = x + (i - (Math.min(4, t.laps) - 1) / 2) * 6;
    g.lineStyle(1.5, TRAIT_COLORS.lap, 0.95);
    strokeRound(g, px, y - r - 7, 2);
  }
  // Overload: small yellow crackling sparks around the body.
  if (t.overload) {
    g.lineStyle(1.5, TRAIT_COLORS.overload, 0.9);
    const step = Math.floor(clock * 14);
    for (let i = 0; i < 3; i++) {
      const a = ((step * 2.399 + i * 2.1) % (Math.PI * 2)) + i,
        x0 = x + Math.cos(a) * (r + 1),
        y0 = y + Math.sin(a) * (r + 1),
        x1 = x0 + Math.cos(a + 0.6) * 4,
        y1 = y0 + Math.sin(a + 0.6) * 4;
      g.lineBetween(x0, y0, x1, y1);
      g.lineBetween(x1, y1, x0 + Math.cos(a - 0.2) * 8, y0 + Math.sin(a - 0.2) * 8);
    }
  }
  // Refract: a bright diamond inside the body.
  if (t.refract) {
    g.lineStyle(1.5, TRAIT_COLORS.refract, 0.9);
    g.strokePoints([{ x, y: y - r * 0.55 }, { x: x + r * 0.4, y }, { x, y: y + r * 0.55 }, { x: x - r * 0.4, y }], true);
  }
  // Blastproof: a heavy sand-coloured outer ring.
  if (t.blastproof) {
    g.lineStyle(3, TRAIT_COLORS.blastproof, 0.85);
    strokeRound(g, x, y, r + 5);
  }
  // Insulated: a yellow ring with a crossed-out bolt.
  if (t.insulated) {
    g.lineStyle(1.5, TRAIT_COLORS.insulated, 0.9);
    g.strokePoints([{ x: x + 1.5, y: y - r * 0.6 }, { x: x - 1.5, y }, { x: x + 1.5, y }, { x: x - 1.5, y: y + r * 0.6 }], false);
    g.lineBetween(x - r * 0.6, y + r * 0.6, x + r * 0.6, y - r * 0.6);
  }
  // Heatshield: a thin orange shell.
  if (t.heatshield) {
    g.lineStyle(1.5, TRAIT_COLORS.heatshield, 0.8);
    g.beginPath();
    arcPath(g, x, y, r + 4, Math.PI * 1.1, Math.PI * 1.9);
    g.strokePath();
  }
  // Mirror: a bright highlight streak across the body.
  if (t.mirror) {
    g.lineStyle(2, TRAIT_COLORS.mirror, 0.55 + 0.35 * Math.sin(clock * 3));
    g.lineBetween(x - r * 0.7, y + r * 0.2, x + r * 0.1, y - r * 0.7);
    g.lineBetween(x - r * 0.3, y + r * 0.6, x + r * 0.6, y - r * 0.3);
  }
  // Martyr: a pale halo above the body.
  if (t.martyr) {
    g.lineStyle(1.5, TRAIT_COLORS.martyr, 0.9);
    g.strokeEllipse(x, y - r - 5, r * 1.1, 3);
  }
  // Taunt: a bright bullseye in the body.
  if (t.taunt) {
    g.lineStyle(1.5, TRAIT_COLORS.taunt, 0.9);
    strokeRound(g, x, y, r * 0.55);
    g.fillStyle(TRAIT_COLORS.taunt, 0.9);
    fillRound(g, x, y, r * 0.2);
  }
  // Retaliate: small thorns pointing outwards.
  if (t.retaliate) {
    g.fillStyle(TRAIT_COLORS.retaliate, 0.9);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      g.fillTriangle(x + Math.cos(a - 0.25) * (r + 1), y + Math.sin(a - 0.25) * (r + 1), x + Math.cos(a + 0.25) * (r + 1), y + Math.sin(a + 0.25) * (r + 1), x + Math.cos(a) * (r + 5), y + Math.sin(a) * (r + 5));
    }
  }
  // Tunnel: drill chevrons in front of the body, along the heading.
  if (t.tunnel) {
    const ahead = (d: number, side: number) => ({ x: x + Math.cos(heading) * d - Math.sin(heading) * side, y: y + Math.sin(heading) * d + Math.cos(heading) * side });
    g.lineStyle(1.5, TRAIT_COLORS.tunnel, 0.9);
    g.strokePoints([ahead(r * 0.9, -r * 0.5), ahead(r * 1.4, 0), ahead(r * 0.9, r * 0.5)], false);
  }
  // Phase: a ring that is dashed in the air and solid on the ground.
  if (t.phase) {
    g.lineStyle(1.5, TRAIT_COLORS.phase, 0.9);
    if (t.phase === "ground") strokeRound(g, x, y, r + 3);
    else
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + clock;
        g.beginPath();
        arcPath(g, x, y, r + 3, a, a + 0.4);
        g.strokePath();
      }
  }
  // Splitting: three small dots inside the body.
  if (t.split) {
    g.fillStyle(TRAIT_COLORS.split);
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
      fillRound(g, x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, 1.6);
    }
  }
  if (t.regen) {
    const px = x + r * 0.9,
      py = y - r * 0.9 - (clock * 6) % 3;
    g.fillStyle(TRAIT_COLORS.regen, 0.9);
    g.fillRect(px - 0.75, py - 2.5, 1.5, 5);
    g.fillRect(px - 2.5, py - 0.75, 5, 1.5);
  }
  // Revealed by a detector: scan brackets.
  if (t.stealth && t.revealed) {
    g.lineStyle(1.5, TRAIT_COLORS.scan, 0.85);
    const s = r + 5;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      g.lineBetween(x + sx * s, y + sy * s, x + sx * (s - 4), y + sy * s);
      g.lineBetween(x + sx * s, y + sy * s, x + sx * s, y + sy * (s - 4));
    }
  }
}
/** Status rings and sparks under the body: they belong to the ground the unit stands on. */
function statusBelow(g: Ink, { x, y, r, heading, status, clock, enemy: e }: EnemyDrawContext) {
  if (status.vulnerable) {
    g.fillStyle(STATUS_COLORS.vulnerable, 0.18);
    fillRound(g, x, y, r + 8);
  }
  if (status.slowed) {
    g.lineStyle(2, STATUS_COLORS.slowed, 0.7);
    strokeRound(g, x, y, r + 5);
  }
  // Disrupted: sparks flickering around the body.
  if (status.disrupted) {
    for (let i = 0; i < 4; i++) {
      const a = clock * 7 + i * 1.9 + e.id;
      g.fillStyle(STATUS_COLORS.disrupted, 0.5 + 0.5 * Math.sin(clock * 23 + i));
      fillRound(g, x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4), 1.6);
    }
  }
  // Bleeding: drops falling off behind the enemy.
  if (status.bleeding) {
    for (let i = 0; i < 3; i++) {
      const k = (clock * 1.5 + i / 3 + e.id * 0.1) % 1;
      g.fillStyle(STATUS_COLORS.bleeding, 1 - k);
      fillRound(g, x - Math.cos(heading) * (r + 2 + k * 6) + (i - 1) * 2, y - Math.sin(heading) * (r + 2 + k * 6) + k * 3, 1.6);
    }
  }
  if (status.oiled) drawOilCoat(g, x, y, r, heading, clock, e.id);
  // Pulled: a ring trailing behind against the walking direction.
  if (status.pulled) {
    g.lineStyle(2, STATUS_COLORS.pulled, 0.85);
    g.beginPath();
    arcPath(g, x, y, r + 4, heading + Math.PI - 1.1, heading + Math.PI + 1.1);
    g.strokePath();
  }
  // Stunned: a broken ring.
  if (status.stunned) {
    g.lineStyle(2.5, STATUS_COLORS.stunned, 0.9);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g.beginPath();
      arcPath(g, x, y, r + 3, a, a + 0.6);
      g.strokePath();
    }
  }
}
/** Tentacles trail behind a polygon body, swaying with the clock. */
function tentacles(g: Ink, { x, y, r, heading, clock, enemy: e, definition: d }: EnemyDrawContext) {
  if (d.visual.shape !== "polygon" || !d.visual.tentacles) return;
  const count = d.visual.tentacles;
  g.lineStyle(1.5, d.color, 0.55);
  for (let k = 0; k < count; k++) {
    const i = k - (count - 1) / 2;
    const sx = x - Math.cos(heading) * r * 0.5 - Math.sin(heading) * i * r * 0.35,
      sy = y - Math.sin(heading) * r * 0.5 + Math.cos(heading) * i * r * 0.35,
      w = Math.sin(clock * 5 + i * 1.3 + e.id) * r * 0.35;
    g.strokePoints(
      [
        { x: sx, y: sy },
        { x: sx - Math.cos(heading) * r * 0.9 - Math.sin(heading) * w, y: sy - Math.sin(heading) * r * 0.9 + Math.cos(heading) * w },
        { x: sx - Math.cos(heading) * r * 1.7 + Math.sin(heading) * w, y: sy - Math.sin(heading) * r * 1.7 - Math.cos(heading) * w },
      ],
      false,
    );
  }
}
/** Status markers stuck on the body: net, bomb, flames. */
function statusAbove(g: Ink, { x, y, r, status, clock }: EnemyDrawContext) {
  // Netted: a mesh drawn over the body.
  if (status.netted) {
    g.lineStyle(1.2, STATUS_COLORS.netted, 0.9);
    strokeRound(g, x, y, r + 2);
    for (const o of [-0.5, 0, 0.5]) {
      g.lineBetween(x - r, y + o * r * 2 - r * 0.5, x + r, y + o * r * 2 + r * 0.5);
      g.lineBetween(x - r, y + o * r * 2 + r * 0.5, x + r, y + o * r * 2 - r * 0.5);
    }
  }
  // Haftladung: a bomb stuck on top, its light blinking.
  if (status.charged) {
    g.fillStyle(0x1a1a1a);
    fillRound(g, x + r * 0.5, y - r * 0.5, 3.5);
    g.fillStyle(STATUS_COLORS.charged, Math.sin(clock * 18) > 0 ? 1 : 0.25);
    fillRound(g, x + r * 0.5, y - r * 0.5 - 2.5, 1.4);
  }
  // Embers scale down on small bodies (r under 14 px), so three of them never cover a runner or an ant.
  if (status.burning) {
    g.fillStyle(STATUS_COLORS.burning, 0.9);
    for (const [dx, dy] of [[-0.6, -0.2], [0.5, -0.5], [0.1, 0.4]]) fillRound(g, x + dx * r, y + dy * r, Math.min(2.2, r * 0.16));
  }
}
/**
 * Everything behind the body: trait fields and trails, status rings, tentacles and, last, the shadow (it used to
 * open the body, so it still darkens the rings and tentacles drawn before it). `painted`: a sprite is the body, and
 * this is its visible footprint; it casts the shadow of the art instead of the shape's.
 */
export function drawEnemyUnderlay(g: Ink, c: EnemyDrawContext, painted?: ArtFootprint) {
  if (c.hidden) return;
  traitsBelow(g, c);
  statusBelow(g, c);
  // Painted bodies (`enemy-sprites.ts`) show their tentacles in the art.
  if (!painted) tentacles(g, c);
  // Burrowed units cast no shadow: the mound stands in for it.
  if (c.traits.burrowed) return;
  if (painted) paintedShadow(g, c, painted);
  else shapeOf(c.definition.visual).shadow(g, c, c.definition.visual);
}
/** The unit itself, without shadow or markers. Hidden stealth units have none; burrowed ones only a faint shape. */
export function drawEnemyBody(g: Ink, c: EnemyDrawContext) {
  if (c.hidden) return;
  const { x, y, r, definition: d } = c;
  if (c.traits.burrowed) polygon(g, x, y, r * 0.8, d.visual.shape === "polygon" ? d.visual.sides : 4, d.color, d.visual.shape === "polygon" ? (d.visual.rotation ?? 0) : 0, 0.3);
  else shapeOf(d.visual).body(g, c, d.visual);
}
/** Markers on the body and the HP bar; a hidden stealth unit shows only its shimmering outline. */
export function drawEnemyOverlay(g: Ink, c: EnemyDrawContext) {
  const { x, y, r, enemy: e, definition: d, clock } = c;
  if (c.hidden) {
    g.lineStyle(1.5, d.color, 0.3 + 0.15 * Math.sin(clock * 5 + e.id));
    for (let i = 0; i < 8; i++) {
      const a = clock + (i * Math.PI) / 4;
      g.beginPath();
      arcPath(g, x, y, r, a, a + 0.45);
      g.strokePath();
    }
    return;
  }
  traitsAbove(g, c);
  statusAbove(g, c);
  drawTranceMarks(g, c);
  drawHpBar(g, c);
}
/** Bosses keep their bar at full health; everyone else shows it once hurt or shielded, which thins out a fresh wave. */
const ALWAYS_BAR = new Set(["boss"]);
/** HP colour steps: healthy, hurt, critical. */
export const HP_COLORS = { high: 0x93f5b8, mid: 0xffc94a, low: 0xff738a } as const;
/**
 * A 4 px bar in a dark frame above the unit, coloured in three steps, with the remaining shield as a thin strip on
 * top. Hidden at full health without a shield, except on bosses.
 */
function drawHpBar(g: Ink, c: EnemyDrawContext) {
  const { x, y, r, enemy: e, traits } = c,
    share = Math.max(0, e.hp / e.maxHp),
    shield = traits.shield;
  if (!c.hpBar || (share >= 1 && shield <= 0 && !ALWAYS_BAR.has(c.definition.id))) return;
  const top = y - r - 10,
    strip = shield > 0 ? 2 : 0;
  chamferRect(g, x, top + 2 - strip / 2, r + 1.5, 3 + strip / 2, 1, 0x050c12, 0.9);
  g.fillStyle(share > 0.6 ? HP_COLORS.high : share > 0.3 ? HP_COLORS.mid : HP_COLORS.low);
  g.fillRect(x - r, top, r * 2 * share, 4);
  if (strip) {
    g.fillStyle(TRAIT_COLORS.shield);
    g.fillRect(x - r, top - strip - 0.5, r * 2 * Math.min(1, shield), strip);
  }
}
/** One enemy with all three stages into a single Graphics (gallery); the battlefield draws the stages on their own layers. */
export function drawEnemy(
  g: Ink,
  x: number,
  y: number,
  size: number,
  e: Enemy,
  d: Readonly<EnemyDefinition>,
  heading: number,
  status: StatusFlags,
  traits: TraitFlags,
  clock: number,
  /** The README gallery draws bare units. */
  hpBar = true,
) {
  const c = enemyContext(x, y, size, e, d, heading, status, traits, clock, hpBar);
  drawEnemyUnderlay(g, c);
  drawEnemyBody(g, c);
  drawEnemyOverlay(g, c);
}
