import { CELL, fillRound, px } from "../shapes";
import { along, flow, zigzag, type Theme } from "./kit";

/** Storm theme: one lightning strike per slot of this many seconds, each lasting `STRIKE_TIME`. */
const STRIKE_PERIOD = 14,
  STRIKE_TIME = 0.27;
// Storm plateau: basalt needles and lightning rods, rain and flashes.
export const storm: Theme = {
    backdrop: 0x0b0f18,
    ground: [0x141a26, 0x121722],
    grid: 0x24304a,
    path: { edge: 0x4a6a8a, bed: 0x0e1420, line: 0x9fd8ff, arrow: 0xcfeaff },
    accent: 0x9fd8ff,
    obstacle: (g, x, y, rand) => {
      const kind = rand();
      g.fillStyle(0x04060c, 0.55);
      g.fillEllipse(x + 28, y + 47, 36, 10);
      if (kind < 0.55) {
        // Jagged basalt needles.
        const needles = 2 + Math.floor(rand() * 2);
        for (let i = 0; i < needles; i++) {
          const cx = x + 28 + (i - (needles - 1) / 2) * 11 + (rand() - 0.5) * 4,
            h = 18 + rand() * 18,
            w = 6 + rand() * 3,
            lean = (rand() - 0.5) * 6;
          g.fillStyle(0x232c3e);
          g.fillPoints([{ x: cx - w, y: y + 47 }, { x: cx - w * 0.5 + lean * 0.5, y: y + 47 - h * 0.6 }, { x: cx + lean, y: y + 47 - h }, { x: cx + w * 0.6, y: y + 47 - h * 0.5 }, { x: cx + w, y: y + 47 }], true);
          g.fillStyle(0x3a4a64);
          g.fillPoints([{ x: cx - w, y: y + 47 }, { x: cx - w * 0.5 + lean * 0.5, y: y + 47 - h * 0.6 }, { x: cx + lean, y: y + 47 - h }, { x: cx - 1, y: y + 47 }], true);
          g.lineStyle(1, 0x6a86a8, 0.5);
          g.lineBetween(cx - w * 0.5 + lean * 0.5, y + 47 - h * 0.6, cx + lean, y + 47 - h);
        }
      } else {
        // Lightning rod: a pole on a stone footing with a glowing tip.
        const cx = x + 28,
          h = 30 + rand() * 8;
        g.fillStyle(0x2a3448);
        g.fillPoints([{ x: cx - 14, y: y + 47 }, { x: cx - 9, y: y + 39 }, { x: cx + 9, y: y + 39 }, { x: cx + 14, y: y + 47 }], true);
        g.fillStyle(0x4a5a78);
        g.fillRect(cx - 9, y + 39, 18, 2);
        g.lineStyle(3, 0x7a8aa4);
        g.lineBetween(cx, y + 39, cx, y + 47 - h);
        g.lineStyle(1.5, 0x9fb0c8, 0.9);
        for (const d of [-5, 5]) g.lineBetween(cx, y + 47 - h * 0.55, cx + d, y + 47 - h * 0.7);
        g.fillStyle(0x9fd8ff, 0.3);
        g.fillCircle(cx, y + 47 - h, 6);
        g.fillStyle(0xe6f6ff);
        g.fillCircle(cx, y + 47 - h, 2.5);
      }
    },
    decor: (g, x, y, rand) => {
      const kind = rand(),
        cx = x + 12 + rand() * 32,
        cy = y + 14 + rand() * 28;
      if (kind < 0.45) {
        // Puddle with a highlight.
        g.fillStyle(0x0a1020, 0.8);
        g.fillEllipse(cx, cy, 16 + rand() * 8, 7);
        g.lineStyle(1, 0x7ab8e0, 0.45);
        g.lineBetween(cx - 4, cy - 1, cx + 2, cy - 1);
      } else if (kind < 0.8) {
        // Cracked stone.
        g.lineStyle(1, 0x05080e, 0.85);
        zigzag(g, cx - 6, cy, rand, 14, 3);
        zigzag(g, cx, cy, rand, 9, 2);
      } else {
        // Scorch mark with a few embers.
        g.fillStyle(0x05070c, 0.7);
        g.fillEllipse(cx, cy, 14, 9);
        g.fillStyle(0x9fd8ff, 0.7);
        for (let i = 0; i < 3; i++) g.fillRect(cx + (rand() - 0.5) * 10, cy + (rand() - 0.5) * 6, 1.5, 1.5);
      }
    },
    // Slanted rain, a rare strike at one rod, crackle along the channel.
    ambient: ({ g, map, path, clock, hash, blocked, still, glow, lit }) => {
      const w = map.columns * CELL,
        h = map.rows * CELL;
      g.lineStyle(1, 0x9fc8e8, 0.22);
      for (let k = 0; k < Math.ceil(map.columns * 2.5); k++) {
        const s = hash(k, 91),
          life = (clock * 1.3 + s * 7) % 1,
          x0 = ((s * 13.7) % 1) * (w + 60) - 30 + life * 40,
          y0 = life * (h + 20) - 10;
        g.lineBetween(x0, y0, x0 - 5, y0 + 12);
      }
      // One strike per slot at a hashed moment and rod, so strikes stay rare and never overlap.
      const rods = blocked.filter((b) => hash(b.x, b.y) >= 0.55),
        slot = Math.floor(clock / STRIKE_PERIOD),
        t = (clock % STRIKE_PERIOD) - hash(slot, 97) * (STRIKE_PERIOD - 1),
        b = rods[Math.floor(hash(slot, 98) * rods.length)];
      if (b && t >= 0 && t < STRIKE_TIME) {
        const f = 1 - t / STRIKE_TIME,
          flick = f * (0.6 + 0.4 * Math.sin(clock * 90)),
          tipX = px(b.x),
          tipY = b.y * CELL + 12;
        glow.fillStyle(0xcfeaff, 0.3 * flick * lit);
        fillRound(glow, tipX, tipY, 26);
        if (!still) {
          g.fillStyle(0xffffff, 0.05 * flick);
          g.fillRect(0, 0, w, h);
        }
        g.lineStyle(2, 0xe6f6ff, 0.9 * flick);
        g.strokePoints([{ x: tipX, y: tipY - 40 }, { x: tipX + 6, y: tipY - 24 }, { x: tipX - 4, y: tipY - 12 }, { x: tipX, y: tipY }], false);
      }
      flow(path, clock, 1.9, 0.6, (p, k) => {
        const on = Math.sin(clock * 11 + k * 3.1);
        if (on < 0.3) return;
        const side = ((k % 3) - 1) * 6,
          nx = -Math.sin(p.angle) * side,
          ny = Math.cos(p.angle) * side,
          dx = Math.cos(p.angle) * 9,
          dy = Math.sin(p.angle) * 9;
        g.lineStyle(1.2, 0xcfeaff, 0.55 * on);
        g.strokePoints([{ x: p.x + nx - dx, y: p.y + ny - dy }, { x: p.x + nx + (k % 2 ? 3 : -3), y: p.y + ny + (k % 2 ? -3 : 3) }, { x: p.x + nx + dx, y: p.y + ny + dy }], false);
      });
    },
};
