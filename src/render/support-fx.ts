import { resolveUpgrades } from "../core/upgrades";
import type { GameEvent, Sim, Tower } from "../core/types";
import { dist } from "../systems/path";
import { fireControlOf, nexusTypes, overclockActive, skylinkHold } from "../systems/support";
import { isHidden, isSuppressed, layerOf } from "../systems/traits";
import { glowLine, halo } from "./material";
import { arcBand, CELL, disc, px, ring, shade, star, type Ink, type Pen } from "./shapes";
/**
 * Tells of the combat support towers (Overclock, Fire Control, Armory, Skylink, Nexus), read from the state only:
 * `g` lies below the towers (hints), `glow` is the tower light, below the enemies. Each buff marks the towers it
 * reaches with its own ring segment just outside their plate, so several buffs on one tower stay apart.
 */
export function drawSupportFx({ g, glow }: Pen, sim: Sim, clock: number) {
  const s = sim.state,
    { towers } = sim.content,
    receivers = s.towers.filter((t) => towers[t.type].targets.length > 0);
  for (const src of s.towers) {
    const d = towers[src.type],
      kind = d.attack.kind;
    if (kind !== "overclock" && kind !== "crit" && kind !== "pierceaura" && kind !== "skylink" && kind !== "synergy") continue;
    if (isSuppressed(sim, src)) continue;
    const r = resolveUpgrades(src, sim.content),
      range = r.stats.range,
      x = px(src.x),
      y = px(src.y),
      c = d.color,
      reached = receivers.filter((t) => dist(t, src) <= range);
    switch (r.attack.kind) {
      case "overclock": {
        const a = r.attack,
          phase = s.time % a.period;
        if (overclockActive(a, s.time)) {
          // Burst: a shock ring runs out to the radius, buffed towers spin a double arc, the clock glows.
          const k = Math.min(1, phase / 0.5);
          if (k < 1) ring(g, x, y, 12 + k * (range * CELL - 12), 3 * (1 - k) + 1, c, 0.8 * (1 - k));
          halo(glow, x, y, 26, c, 0.18 + 0.08 * Math.sin(clock * 12));
          for (const t of reached) spinArcs(g, glow, px(t.x), px(t.y), clock * 6 + t.id, c);
        } else {
          // Charging: an arc round the clock fills up towards the next burst.
          const k = (phase - a.window) / (a.period - a.window);
          arcBand(g, x, y, 27, 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k, c, 0.55);
          if (k > 0.85) halo(glow, x, y, 18, c, 0.2 * ((k - 0.85) / 0.15));
        }
        break;
      }
      case "crit": {
        // Each covered tower shows its shot count towards the next crit as pips under its plate.
        const every = r.attack.every;
        for (const t of reached) {
          if (fireControlOf(sim, t)?.tower !== src) continue;
          critPips(g, glow, px(t.x), px(t.y), every, (t.critCount ?? 0) % every, c);
        }
        break;
      }
      case "pierceaura":
        // Piercing rounds: a notched arc on the lower left of every tower it arms.
        for (const t of reached) {
          const tx = px(t.x),
            ty = px(t.y);
          arcBand(g, tx, ty, 26.5, 2.2, 0.6 * Math.PI, 0.9 * Math.PI, c, 0.75);
          arcBand(glow, tx, ty, 26.5, 3, 0.6 * Math.PI, 0.9 * Math.PI, c, 0.18);
        }
        break;
      case "skylink":
        // Lock beams to every flyer it holds, with brackets closing round each.
        for (const e of s.enemies) {
          if (e.hp <= 0 || layerOf(sim, e) !== "air" || isHidden(sim, e) || skylinkHold(sim, e) <= 0 || dist(e, src) > range) continue;
          const ex = px(e.x),
            ey = px(e.y),
            size = sim.content.enemies[e.type].size * CELL + 7;
          glowLine(glow, x, y, ex, ey, c, 1, 0.22 + 0.08 * Math.sin(clock * 8 + e.id));
          for (let i = 0; i < 4; i++) {
            const q = Math.PI / 4 + (i * Math.PI) / 2 + clock * 0.8;
            arcBand(g, ex, ey, size, 1.6, q - 0.3, q + 0.3, shade(c, 0.3), 0.85);
          }
        }
        break;
      case "synergy": {
        // A thread to the nearest tower of each counted type, and one lit segment per type round the Nexus.
        const types = nexusTypes(sim, src, range),
          counted = Math.min(r.attack.cap, types.length);
        for (const type of types.slice(0, r.attack.cap)) {
          const t = nearestOf(reached, type, src);
          if (!t) continue;
          g.lineStyle(1.2, c, 0.35);
          g.lineBetween(x, y, px(t.x), px(t.y));
          disc(glow, px(t.x), px(t.y), 5, c, 0.18);
        }
        for (let i = 0; i < r.attack.cap; i++) {
          const a0 = -Math.PI / 2 + (i * Math.PI * 2) / r.attack.cap;
          arcBand(g, x, y, 27, 2, a0 + 0.06, a0 + (Math.PI * 2) / r.attack.cap - 0.06, i < counted ? c : shade(c, -0.6), i < counted ? 0.8 : 0.4);
        }
        break;
      }
    }
  }
}
/** Two arcs turning fast round an overclocked tower. */
function spinArcs(g: Ink, glow: Ink, x: number, y: number, a: number, c: number) {
  for (const o of [0, Math.PI]) {
    arcBand(g, x, y, 26.5, 2, a + o, a + o + 0.9, c, 0.85);
    arcBand(glow, x, y, 26.5, 4, a + o, a + o + 0.9, c, 0.2);
  }
}
/** Shot counter under a tower: `every` pips along the bottom, `count` of them lit. */
function critPips(g: Ink, glow: Ink, x: number, y: number, every: number, count: number, c: number) {
  for (let i = 0; i < every; i++) {
    const a = Math.PI / 2 + (i - (every - 1) / 2) * 0.28,
      px0 = x + Math.cos(a) * 27,
      py0 = y + Math.sin(a) * 27,
      on = i < count;
    disc(g, px0, py0, 2.6, 0x081016, 0.85);
    disc(g, px0, py0, 1.7, on ? c : shade(c, -0.6));
    if (on) disc(glow, px0, py0, 3.6, c, 0.25);
  }
}
function nearestOf(towers: readonly Tower[], type: string, from: Tower) {
  let best: Tower | undefined;
  for (const t of towers) if (t.type === type && (!best || dist(t, from) < dist(best, from))) best = t;
  return best;
}
/** Fire Control crit: a hot tracer from the tower, a four-point star flaring on the target and a ring snapping shut. */
export function drawCrit({ g, glow }: Pen, e: Extract<GameEvent, { type: "crit" }>, age: number) {
  const x = px(e.at.x),
    y = px(e.at.y),
    k = Math.min(1, age / 0.45),
    fade = 1 - k;
  if (age < 0.15) glowLine(glow, px(e.from.x), px(e.from.y), x, y, e.color, 1.4, 0.5 * (1 - age / 0.15));
  star(g, x, y, 8 + 10 * Math.min(1, age / 0.08), 2, 4, 0xffffff, Math.PI / 4, fade);
  star(glow, x, y, 14, 3, 4, e.color, Math.PI / 4, 0.35 * fade);
  ring(g, x, y, 22 - 14 * k, 1.8, e.color, 0.9 * fade);
  halo(glow, x, y, 14, e.color, 0.4 * fade);
}
