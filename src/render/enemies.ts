import type { Enemy, EnemyDefinition, EnemyVisual } from "../core/types";
import type { StatusFlags } from "../systems/status";
import type { TraitFlags } from "../systems/traits";
import { polygon, type Ink } from "./shapes";
interface BodyContext {
  g: Ink;
  x: number;
  y: number;
  r: number;
  color: number;
  /** Direction of travel. */
  heading: number;
}
/** Enemy bodies by `visual.shape`. A new look is one entry here. */
const BODIES: { [K in EnemyVisual["shape"]]: (ctx: BodyContext, visual: Extract<EnemyVisual, { shape: K }>) => void } = {
  polygon: ({ g, x, y, r, color }, visual) => {
    g.fillStyle(0x030a0c, 0.55);
    g.fillEllipse(x, y + 6, r * 2.3, r * 1.5);
    polygon(g, x, y, r, visual.sides, color, visual.rotation ?? 0);
    polygon(g, x, y, r * 0.4, 4, 0x442e36, 0);
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
const STATUS_COLORS = { slowed: 0xa5a2ff, stunned: 0x5cf2d6, burning: 0xff6a3d, vulnerable: 0xb6f04a };
const TRAIT_COLORS = { shield: 0x6fb8ff, leader: 0xf5c542, healer: 0x6dff9e, scan: 0x6fd3ff, regen: 0x93f5b8, armor: 0xc9d1d9, immune: 0x9fe6ff, split: 0x442e36 };
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
  const back = { x: -Math.cos(heading), y: -Math.sin(heading) };
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
  (BODIES[d.visual.shape] as (ctx: BodyContext, visual: EnemyVisual) => void)({ g, x, y, r, color: d.color, heading }, d.visual);
  traitsAbove(g, x, y, r, traits, clock);
  if (status.burning) {
    g.fillStyle(STATUS_COLORS.burning, 0.9);
    for (const [dx, dy] of [[-0.6, -0.2], [0.5, -0.5], [0.1, 0.4]]) g.fillCircle(x + dx * r, y + dy * r, 2.2);
  }
  g.fillStyle(0x050c12);
  g.fillRoundedRect(x - r - 1, y - r - 9, r * 2 + 2, 5, 2);
  g.fillStyle(e.hp / e.maxHp > 0.4 ? 0x93f5b8 : 0xff738a);
  g.fillRect(x - r, y - r - 8, Math.max(0, (r * 2 * e.hp) / e.maxHp), 3);
}
