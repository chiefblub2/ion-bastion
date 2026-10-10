import type { Enemy, EnemyDefinition, EnemyVisual } from "../core/types";
import type { StatusFlags } from "../systems/status";
import type { TraitFlags } from "../systems/traits";
import { polygon, star, type Ink } from "./shapes";
interface BodyContext {
  g: Ink;
  x: number;
  y: number;
  r: number;
  color: number;
  /** Direction of travel. */
  heading: number;
  /** Flying unit: drawn with a distant shadow, whatever its shape. */
  air: boolean;
  /** Render time in seconds, for animated bodies. */
  clock?: number;
}
/** Enemy bodies by `visual.shape`. A new look is one entry here. */
const BODIES: { [K in EnemyVisual["shape"]]: (ctx: BodyContext, visual: Extract<EnemyVisual, { shape: K }>) => void } = {
  polygon: ({ g, x, y, r, color, air }, visual) => {
    g.fillStyle(0x030a0c, air ? 0.3 : 0.55);
    if (air) g.fillEllipse(x, y + 14, r * 1.8, r * 0.9);
    else g.fillEllipse(x, y + 6, r * 2.3, r * 1.5);
    polygon(g, x, y - (air ? 4 : 0), r, visual.sides, color, visual.rotation ?? 0);
    polygon(g, x, y - (air ? 4 : 0), r * 0.4, 4, 0x442e36, 0);
  },
  // Spiky star; turns a little with the heading so legs feel alive.
  star: ({ g, x, y, r, color, heading, air }, visual) => {
    g.fillStyle(0x030a0c, air ? 0.3 : 0.55);
    if (air) g.fillEllipse(x, y + 14, r * 1.8, r * 0.9);
    else g.fillEllipse(x, y + 6, r * 2.3, r * 1.5);
    const cy = y - (air ? 4 : 0);
    star(g, x, cy, r * 1.15, r * 1.15 * visual.inner, visual.points, color, heading * 0.35);
    polygon(g, x, cy, r * 0.35, 4, 0x442e36, heading * 0.35);
  },
  // Round body: glow ring, core, highlight and orbiting moons.
  orb: ({ g, x, y, r, color, air, clock = 0 }, visual) => {
    g.fillStyle(0x030a0c, air ? 0.3 : 0.5);
    if (air) g.fillEllipse(x, y + 14, r * 1.8, r * 0.9);
    else g.fillEllipse(x, y + 6, r * 2.1, r * 1.4);
    const cy = y - (air ? 4 : 0);
    g.fillStyle(color, 0.22);
    g.fillCircle(x, cy, r * 1.25);
    g.fillStyle(color);
    g.fillCircle(x, cy, r * 0.8);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(x - r * 0.25, cy - r * 0.25, r * 0.25);
    for (let i = 0; i < visual.moons; i++) {
      const a = clock * 2 + (i * Math.PI * 2) / visual.moons;
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(x + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.35, Math.max(2, r * 0.17));
    }
  },
  // Segmented chain trailing behind the head with a gentle sway.
  worm: ({ g, x, y, r, color, heading, air, clock = 0 }, visual) => {
    const back = { x: -Math.cos(heading), y: -Math.sin(heading) },
      cy = y - (air ? 4 : 0),
      seg = (i: number) => {
        const sway = Math.sin(clock * 4 - i * 0.9) * r * 0.35 * Math.min(i, 1.5),
          d = i * r * 0.95;
        return { x: x + back.x * d - back.y * sway, y: cy + back.y * d + back.x * sway, rad: r * (1 - (i * 0.55) / visual.segments) };
      };
    g.fillStyle(0x030a0c, air ? 0.3 : 0.5);
    for (let i = 0; i < visual.segments; i++) {
      const s = seg(i);
      g.fillEllipse(s.x, s.y + (air ? 14 : 6), s.rad * 2, s.rad * 1.2);
    }
    for (let i = visual.segments - 1; i >= 0; i--) {
      const s = seg(i);
      g.fillStyle(0x0c1417, 0.9);
      g.fillCircle(s.x, s.y, s.rad + 1.5);
      g.fillStyle(color);
      g.fillCircle(s.x, s.y, s.rad);
    }
    g.fillStyle(0x442e36);
    g.fillCircle(x + Math.cos(heading) * r * 0.3, cy + Math.sin(heading) * r * 0.3, r * 0.25);
  },
  // Flying: faint, distant shadow and an arrow pointing along the path.
  glider: ({ g, x, y, r, color, heading: a }) => {
    g.fillStyle(0x030a0c, 0.3);
    g.fillEllipse(x, y + 14, r * 1.8, r * 0.9);
    const p = (ang: number, rad: number) => ({ x: x + Math.cos(a + ang) * rad, y: y + Math.sin(a + ang) * rad });
    g.fillStyle(color);
    g.fillPoints([p(0, r * 1.3), p(2.5, r * 1.2), p(Math.PI, r * 0.35), p(-2.5, r * 1.2)], true);
  },
};
/** Status marker colours; they match the towers that cause the effect. */
const STATUS_COLORS = { slowed: 0xa5a2ff, stunned: 0x5cf2d6, burning: 0xff6a3d, vulnerable: 0xb6f04a, pulled: 0x4d7cff, disrupted: 0xff3df2, netted: 0xe0c068, bleeding: 0xd7263d, charged: 0xff4d4d };
const TRAIT_COLORS = { shield: 0x6fb8ff, leader: 0xf5c542, healer: 0x6dff9e, scan: 0x6fd3ff, regen: 0x93f5b8, armor: 0xc9d1d9, immune: 0x9fe6ff, split: 0x442e36, sand: 0xc9a46a, plate: 0xff9a7a, gust: 0x9fd8ff, swarm: 0xb6ff6a, rage: 0xff5a1a, facet: 0x7ff4ea, leap: 0xbfe9ff, dampen: 0x8a7dff, brood: 0xe8d27a, overload: 0xffe14d, molt: 0xe6a0b4, momentum: 0xffb347, lap: 0xd9a441, refract: 0xe6f7ff, blastproof: 0xb59a7a, insulated: 0xf2d95c, heatshield: 0xff7a3d, mirror: 0xdfe8f2, link: 0x7ae0c8, taunt: 0xff6b8a, martyr: 0xf2e6c9, pack: 0xb8c4d0, cloak: 0x8e7cc3, blink: 0x6fe39a, tunnel: 0x9c7a54, phase: 0xc792ea, blind: 0xfff27a, jam: 0x90a4b8, defuse: 0xd4a373, suppress: 0x7a8899, retaliate: 0x8bb174 };
/** Faint filled field of an area trait with a dashed rim (`dashes` and `speed` tell the kinds apart). */
function field(g: Ink, x: number, y: number, radius: number, cell: number, color: number, clock: number, dashes: number, speed: number) {
  const rad = radius * cell;
  g.fillStyle(color, 0.04);
  g.fillCircle(x, y, rad);
  g.lineStyle(1, color, 0.35);
  for (let i = 0; i < dashes; i++) {
    const a = (i * Math.PI * 2) / dashes + clock * speed;
    g.beginPath();
    g.arc(x, y, rad, a, a + (Math.PI * 2) / dashes * 0.45);
    g.strokePath();
  }
}
/** Markers under the body: auras of leaders and healers, motion trails, outlines. */
function traitsBelow(g: Ink, x: number, y: number, r: number, cell: number, color: number, heading: number, t: TraitFlags, clock: number) {
  if (t.leader) {
    g.lineStyle(1, TRAIT_COLORS.leader, 0.22);
    g.strokeCircle(x, y, t.leader * cell);
  }
  if (t.healer) {
    const pulse = (clock * 0.8) % 1;
    g.fillStyle(TRAIT_COLORS.healer, 0.05);
    g.fillCircle(x, y, t.healer * cell);
    g.lineStyle(1, TRAIT_COLORS.healer, 0.35 * (1 - pulse));
    g.strokeCircle(x, y, t.healer * cell * pulse);
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
      g.fillCircle(x + back.x * r * 0.9 * i, y + back.y * r * 0.9 * i, r * (1 - 0.25 * i));
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
    g.fillCircle(x, y, r + 5);
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
    g.fillCircle(x, y, r + 4 + 4 * t.rage);
    g.lineStyle(1.5 + t.rage, TRAIT_COLORS.rage, (0.25 + 0.6 * t.rage) * (0.6 + 0.4 * pulse));
    g.strokeCircle(x, y, r + 3 + 5 * t.rage * pulse);
  }
  // Leaping (on the other layer): a small arc under the body, like a hop.
  if (t.leaping) {
    g.lineStyle(2, TRAIT_COLORS.leap, 0.7);
    g.beginPath();
    g.arc(x, y + r * 0.9, r * 1.1, Math.PI * 0.15, Math.PI * 0.85);
    g.strokePath();
  }
  // Dampening: a violet dashed field of its radius.
  if (t.dampen) {
    g.fillStyle(TRAIT_COLORS.dampen, 0.05);
    g.fillCircle(x, y, t.dampen * cell);
    g.lineStyle(1, TRAIT_COLORS.dampen, 0.4);
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8 + clock * 0.2;
      g.beginPath();
      g.arc(x, y, t.dampen * cell, a, a + 0.22);
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
    g.fillCircle(x - Math.sin(heading) * o, y + Math.cos(heading) * o, r * 0.85);
  }
  // Slow-immune: a dashed ice ring, unlike the solid slowed ring.
  if (t.slowImmune) {
    g.lineStyle(1.5, TRAIT_COLORS.immune, 0.6);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g.beginPath();
      g.arc(x, y, r + 4, a, a + 0.6);
      g.strokePath();
    }
  }
  if (t.unstoppable) {
    g.lineStyle(3.5, 0x0b0f14, 0.95);
    g.strokeCircle(x, y, r + 2);
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
function traitsAbove(g: Ink, x: number, y: number, r: number, t: TraitFlags, clock: number) {
  if (t.shield > 0) {
    g.fillStyle(TRAIT_COLORS.shield, 0.1 * t.shield);
    g.fillCircle(x, y, r + 6);
    g.lineStyle(1.5, TRAIT_COLORS.shield, 0.25 + 0.6 * t.shield);
    g.strokeCircle(x, y, r + 6);
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
      g.arc(x, y, r + 2, a, a + 0.9);
      g.strokePath();
    }
  }
  // Hardening: a plate ring that grows more opaque as the shell thickens.
  if (t.harden > 0) {
    g.lineStyle(3, TRAIT_COLORS.plate, 0.2 + 0.8 * t.harden);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + 0.2;
      g.beginPath();
      g.arc(x, y, r + 3.5, a, a + 0.7);
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
      g.arc(x, y, r + 3.5, a, a + 0.65);
      g.strokePath();
    }
  }
  // Laps: one small ring pip per completed lap (max 4) above the body.
  for (let i = 0; i < Math.min(4, t.laps); i++) {
    const px = x + (i - (Math.min(4, t.laps) - 1) / 2) * 6;
    g.lineStyle(1.5, TRAIT_COLORS.lap, 0.95);
    g.strokeCircle(px, y - r - 7, 2);
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
    g.strokeCircle(x, y, r + 5);
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
    g.arc(x, y, r + 4, Math.PI * 1.1, Math.PI * 1.9);
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
    g.strokeCircle(x, y, r * 0.55);
    g.fillStyle(TRAIT_COLORS.taunt, 0.9);
    g.fillCircle(x, y, r * 0.2);
  }
  // Retaliate: small thorns pointing outwards.
  if (t.retaliate) {
    g.fillStyle(TRAIT_COLORS.retaliate, 0.9);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      g.fillTriangle(x + Math.cos(a - 0.25) * (r + 1), y + Math.sin(a - 0.25) * (r + 1), x + Math.cos(a + 0.25) * (r + 1), y + Math.sin(a + 0.25) * (r + 1), x + Math.cos(a) * (r + 5), y + Math.sin(a) * (r + 5));
    }
  }
  // Tunnel: drill chevrons in front of the body.
  if (t.tunnel) {
    g.lineStyle(1.5, TRAIT_COLORS.tunnel, 0.9);
    g.strokePoints([{ x: x + r * 0.9, y: y - r * 0.5 }, { x: x + r * 1.4, y }, { x: x + r * 0.9, y: y + r * 0.5 }], false);
  }
  // Phase: a ring that is dashed in the air and solid on the ground.
  if (t.phase) {
    g.lineStyle(1.5, TRAIT_COLORS.phase, 0.9);
    if (t.phase === "ground") g.strokeCircle(x, y, r + 3);
    else
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + clock;
        g.beginPath();
        g.arc(x, y, r + 3, a, a + 0.4);
        g.strokePath();
      }
  }
  // Splitting: three small dots inside the body.
  if (t.split) {
    g.fillStyle(TRAIT_COLORS.split);
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
      g.fillCircle(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, 1.6);
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
  const r = d.size * size;
  // Stealthed and unrevealed: only a shimmering outline, no body or HP bar.
  if (traits.stealth && !traits.revealed) {
    g.lineStyle(1.5, d.color, 0.3 + 0.15 * Math.sin(clock * 5 + e.id));
    for (let i = 0; i < 8; i++) {
      const a = clock + (i * Math.PI) / 4;
      g.beginPath();
      g.arc(x, y, r, a, a + 0.45);
      g.strokePath();
    }
    return;
  }
  traitsBelow(g, x, y, r, size, d.color, heading, traits, clock);
  if (status.vulnerable) {
    g.fillStyle(STATUS_COLORS.vulnerable, 0.18);
    g.fillCircle(x, y, r + 8);
  }
  if (status.slowed) {
    g.lineStyle(2, STATUS_COLORS.slowed, 0.7);
    g.strokeCircle(x, y, r + 5);
  }
  // Disrupted: sparks flickering around the body.
  if (status.disrupted) {
    for (let i = 0; i < 4; i++) {
      const a = clock * 7 + i * 1.9 + e.id;
      g.fillStyle(STATUS_COLORS.disrupted, 0.5 + 0.5 * Math.sin(clock * 23 + i));
      g.fillCircle(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4), 1.6);
    }
  }
  // Bleeding: drops falling off behind the enemy.
  if (status.bleeding) {
    for (let i = 0; i < 3; i++) {
      const k = (clock * 1.5 + i / 3 + e.id * 0.1) % 1;
      g.fillStyle(STATUS_COLORS.bleeding, 1 - k);
      g.fillCircle(x - Math.cos(heading) * (r + 2 + k * 6) + (i - 1) * 2, y - Math.sin(heading) * (r + 2 + k * 6) + k * 3, 1.6);
    }
  }
  // Pulled: a ring trailing behind against the walking direction.
  if (status.pulled) {
    g.lineStyle(2, STATUS_COLORS.pulled, 0.85);
    g.beginPath();
    g.arc(x, y, r + 4, heading + Math.PI - 1.1, heading + Math.PI + 1.1);
    g.strokePath();
  }
  // Stunned: a broken ring.
  if (status.stunned) {
    g.lineStyle(2.5, STATUS_COLORS.stunned, 0.9);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g.beginPath();
      g.arc(x, y, r + 3, a, a + 0.6);
      g.strokePath();
    }
  }
  // Tentacles trail behind the body, swaying with the clock.
  if (d.visual.shape === "polygon" && d.visual.tentacles) {
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
  // Burrowed: only a faint body above the mound.
  if (traits.burrowed) {
    polygon(g, x, y, r * 0.8, d.visual.shape === "polygon" ? d.visual.sides : 4, d.color, d.visual.shape === "polygon" ? (d.visual.rotation ?? 0) : 0, 0.3);
  } else
    (BODIES[d.visual.shape] as (ctx: BodyContext, visual: EnemyVisual) => void)({ g, x, y, r, color: d.color, heading, air: traits.phase ? traits.phase === "air" : traits.leaping ? d.layer !== "air" : d.layer === "air", clock }, d.visual);
  traitsAbove(g, x, y, r, traits, clock);
  // Netted: a mesh drawn over the body.
  if (status.netted) {
    g.lineStyle(1.2, STATUS_COLORS.netted, 0.9);
    g.strokeCircle(x, y, r + 2);
    for (const o of [-0.5, 0, 0.5]) {
      g.lineBetween(x - r, y + o * r * 2 - r * 0.5, x + r, y + o * r * 2 + r * 0.5);
      g.lineBetween(x - r, y + o * r * 2 + r * 0.5, x + r, y + o * r * 2 - r * 0.5);
    }
  }
  // Haftladung: a bomb stuck on top, its light blinking.
  if (status.charged) {
    g.fillStyle(0x1a1a1a);
    g.fillCircle(x + r * 0.5, y - r * 0.5, 3.5);
    g.fillStyle(STATUS_COLORS.charged, Math.sin(clock * 18) > 0 ? 1 : 0.25);
    g.fillCircle(x + r * 0.5, y - r * 0.5 - 2.5, 1.4);
  }
  if (status.burning) {
    g.fillStyle(STATUS_COLORS.burning, 0.9);
    for (const [dx, dy] of [[-0.6, -0.2], [0.5, -0.5], [0.1, 0.4]]) g.fillCircle(x + dx * r, y + dy * r, 2.2);
  }
  if (!hpBar) return;
  g.fillStyle(0x050c12);
  g.fillRoundedRect(x - r - 1, y - r - 9, r * 2 + 2, 5, 2);
  g.fillStyle(e.hp / e.maxHp > 0.4 ? 0x93f5b8 : 0xff738a);
  g.fillRect(x - r, y - r - 8, Math.max(0, (r * 2 * e.hp) / e.maxHp), 3);
}
