import type { ContentPack, GameEvent } from "../core/types";
import { bolt, CELL, polygon, px, type Ink } from "./shapes";
/** Seconds an effect stays visible. */
export const EFFECT_LIFETIME = 0.45;
/** Refinery payouts and dock repairs linger so their label can be read. */
export const INCOME_LIFETIME = 1.6;
export const effectLifetime = (e: VisualEvent) => (e.type === "income" || e.type === "repair" ? INCOME_LIFETIME : EFFECT_LIFETIME);
export type VisualEvent = Extract<
  GameEvent,
  { type: "shot" | "chain" | "beam" | "pulse" | "income" | "repair" | "impact" | "kill" | "leak" | "build" | "sell" | "upgrade" | "evade" }
>;
const VISUAL = new Set<GameEvent["type"]>(["shot", "chain", "beam", "pulse", "income", "repair", "impact", "kill", "leak", "build", "sell", "upgrade", "evade"]);
export const isVisual = (e: GameEvent): e is VisualEvent => VISUAL.has(e.type);
const DANGER = 0xff647c;
/** Short-lived effects drawn from simulation events; they never affect the game. */
export function drawEffect(g: Ink, e: VisualEvent, age: number, content: ContentPack) {
  const alpha = Math.max(0, 1 - age / 0.4);
  switch (e.type) {
    case "chain":
      bolt(g, e.from, e.to, e.color, alpha);
      return;
    case "beam": {
      const fx = px(e.from.x),
        fy = px(e.from.y),
        x = px(e.to.x),
        y = px(e.to.y);
      const power = e.power ?? 1;
      g.lineStyle((7 * alpha + 1) * (0.4 + 0.6 * power), e.color, alpha * 0.35);
      g.lineBetween(fx, fy, x, y);
      g.lineStyle(1 + power, 0xffffff, alpha);
      g.lineBetween(fx, fy, x, y);
      return;
    }
    case "pulse": {
      const x = px(e.at.x),
        y = px(e.at.y),
        r = e.radius * CELL * (0.3 + 0.7 * Math.min(1, age / 0.2));
      g.fillStyle(e.color, alpha * 0.15);
      g.fillCircle(x, y, r);
      g.lineStyle(2, e.color, alpha * 0.9);
      g.strokeCircle(x, y, r);
      return;
    }
    // Dock repair: a cross flaring up and a ring contracting onto the dock.
    case "repair": {
      const x = px(e.at.x),
        y = px(e.at.y),
        k = Math.min(1, age / 0.6),
        fade = Math.max(0, 1 - age / INCOME_LIFETIME);
      g.lineStyle(2, e.color, (1 - k) * 0.9);
      g.strokeCircle(x, y, 40 - 26 * k);
      g.fillStyle(e.color, fade * 0.8);
      const arm = 4 + 6 * Math.min(1, age / 0.2);
      g.fillRect(x - arm * 2, y - arm / 2, arm * 4, arm);
      g.fillRect(x - arm / 2, y - arm * 2, arm, arm * 4);
      return;
    }
    // Refinery payout: a flash, a shock ring and credit shards bursting out, then drifting up.
    case "income": {
      const x = px(e.at.x),
        y = px(e.at.y),
        k = age / INCOME_LIFETIME,
        fade = Math.max(0, 1 - k),
        flash = Math.max(0, 1 - age / 0.25);
      g.fillStyle(0xffffff, flash * 0.55);
      g.fillCircle(x, y, 14 + 10 * (1 - flash));
      g.fillStyle(e.color, flash * 0.3);
      g.fillCircle(x, y, 30 * (1 - flash) + 10);
      const ring = Math.min(1, age / 0.5);
      g.lineStyle(3 * (1 - ring) + 1, e.color, (1 - ring) * 0.9);
      g.strokeCircle(x, y, 10 + ring * 42);
      const spread = 1 - Math.pow(1 - Math.min(1, age / 0.45), 3);
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + (i - 3.5) * 0.38,
          r = 10 + spread * (22 + (i % 3) * 7),
          sx = x + Math.cos(a) * r,
          sy = y + Math.sin(a) * r * 0.8 - age * 26,
          size = (i % 2 ? 3.5 : 4.5) * (0.6 + 0.4 * fade);
        g.fillStyle(e.color, fade * 0.35);
        g.fillCircle(sx, sy, size * 1.9);
        polygon(g, sx, sy, size, 4, i % 3 ? e.color : 0xffffff, age * 4 + i, fade);
      }
      return;
    }
    // A dodged hit: a white arc swinging past the enemy.
    case "evade": {
      const x = px(e.at.x),
        y = px(e.at.y) - age * 20;
      g.lineStyle(2, 0xffffff, alpha * 0.9);
      g.beginPath();
      g.arc(x, y, 12 + age * 20, -2.4 + age * 3, -0.8 + age * 3);
      g.strokePath();
      return;
    }
    case "shot": {
      if (content.towers[e.tower].visual.muzzle === "bolt") {
        bolt(g, e.from, e.to, e.color, alpha);
        return;
      }
      // Muzzle flash at the barrel tip; the projectile itself is drawn from state.
      const fx = px(e.from.x),
        fy = px(e.from.y),
        a = Math.atan2(px(e.to.y) - fy, px(e.to.x) - fx),
        flash = Math.max(0, 1 - age / 0.12);
      g.fillStyle(0xffffff, flash * 0.9);
      g.fillCircle(fx + Math.cos(a) * 25, fy + Math.sin(a) * 25, 5 * flash);
      return;
    }
    case "impact": {
      const x = px(e.at.x),
        y = px(e.at.y);
      if (content.towers[e.tower].visual.impact === "burst") {
        g.fillStyle(e.color, alpha * 0.25);
        g.fillCircle(x, y, 10 + age * 120);
        g.lineStyle(2, e.color, alpha * 0.7);
        g.strokeCircle(x, y, 8 + age * 130);
      } else {
        g.fillStyle(0xffffff, alpha);
        g.fillCircle(x, y, 4 * alpha);
        g.lineStyle(1.5, e.color, alpha);
        g.strokeCircle(x, y, 4 + age * 30);
      }
      return;
    }
    default:
      g.lineStyle(2, e.type === "leak" ? DANGER : e.color, alpha);
      g.strokeCircle(px(e.at.x), px(e.at.y), 6 + age * 65);
  }
}
