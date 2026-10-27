import type { GameEvent, ProtocolId } from "../core/types";
import { glowLine, halo } from "./material";
import { arcBand, CELL, hash01, polygon, px, ring, star, type Ink, type Pen } from "./shapes";
/**
 * Run protocols going off (`systems/protocols.ts`): each has its own short mark, so a relic's work can be told
 * apart on a busy field. Render only; the marked enemy's lasting reticle is `drawMarked`.
 */
export const PROTOCOL_COLORS: Record<ProtocolId, number> = {
  fracture: 0x9fe8ff,
  singularity: 0xff3df2,
  unstable: 0xff6a3d,
  killbox: 0xffb347,
  armorbreak: 0xffd166,
  swarm: 0x7cff9e,
  skyhunter: 0xe0c068,
  titan: 0xff8a3d,
  scanner: 0x6fa8ff,
};
export const PROTOCOL_LIFE: Record<ProtocolId, number> = {
  fracture: 0.5,
  singularity: 0.6,
  unstable: 0.45,
  killbox: 0.45,
  armorbreak: 0.5,
  swarm: 0.45,
  skyhunter: 0.5,
  titan: 0.7,
  scanner: 0.45,
};
type ProtocolEvent = Extract<GameEvent, { type: "protocol" }>;
export function drawProtocol({ g, glow }: Pen, e: ProtocolEvent, age: number) {
  const x = px(e.at.x),
    y = px(e.at.y),
    color = PROTOCOL_COLORS[e.protocol],
    k = Math.min(1, age / PROTOCOL_LIFE[e.protocol]),
    fade = 1 - k;
  switch (e.protocol) {
    case "fracture": {
      // Ice shards flying apart from a white flash.
      const seed = hash01(e.at.x, e.at.y);
      for (let i = 0; i < 7; i++) {
        const a = seed * 6.283 + (i * Math.PI * 2) / 7,
          d = 6 + 22 * k;
        polygon(g, x + Math.cos(a) * d, y + Math.sin(a) * d, 3.2 * fade + 1, 3, i % 2 ? 0xffffff : color, a, fade);
      }
      star(glow, x, y, 12 * fade + 4, 2, 6, color, seed, 0.4 * fade);
      return halo(glow, x, y, 16, color, 0.45 * fade);
    }
    case "singularity": {
      // Four brackets snapping onto the target.
      const r = 26 - 14 * Math.min(1, age / 0.25);
      for (let i = 0; i < 4; i++) arcBand(g, x, y, r, 2, i * (Math.PI / 2) - 0.35, i * (Math.PI / 2) + 0.35, color, fade);
      return halo(glow, x, y, 18, color, 0.35 * fade);
    }
    case "titan": {
      // A wide reload ring rolls out to the towers it recharges.
      const reach = (e.radius ?? 3) * CELL;
      ring(g, x, y, 10 + (reach - 10) * k, 2.4, color, 0.8 * fade);
      ring(glow, x, y, 10 + (reach - 10) * k, 6, color, 0.25 * fade);
      return halo(glow, x, y, 20, color, 0.4 * fade);
    }
    case "armorbreak": {
      // Plates cracking off: short broken arcs falling outward.
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 + 0.3,
          r = 10 + 8 * k;
        arcBand(g, x, y, r, 3, a, a + 0.6, color, fade);
      }
      return;
    }
    case "skyhunter": {
      // A net dropping onto the flyer.
      const r = 22 - 10 * Math.min(1, age / 0.2);
      ring(g, x, y, r, 1.4, color, fade);
      for (const o of [-0.5, 0.5]) glowLine(glow, x - r, y + o * r, x + r, y - o * r, color, 1, 0.5 * fade);
      return;
    }
    default:
      return ring(g, x, y, 6 + 30 * k, 2, color, fade);
  }
}
/** The lasting reticle of Singularity Protocol's priority target, turning slowly. */
export function drawMarked(g: Ink, x: number, y: number, r: number, clock: number) {
  const color = PROTOCOL_COLORS.singularity,
    spin = clock * 1.6;
  for (let i = 0; i < 4; i++) arcBand(g, x, y, r + 6, 1.8, spin + i * (Math.PI / 2) - 0.3, spin + i * (Math.PI / 2) + 0.3, color, 0.9);
}
