import { CELL, fillRound, px, strokeRound } from "../shapes";
import { flow, type Theme } from "./kit";

// Deep Sea: coral and hydrothermal vents, kelp and shells, bubbles and slow light rays. First draw of `obstacle` picks the variant.
export const abyss: Theme = {
    backdrop: 0x020a14,
    ground: [0x061424, 0x051220],
    grid: 0x0f3050,
    path: { edge: 0x1f8fa8, bed: 0x072236, line: 0x3df2e0, arrow: 0x7af8ea },
    accent: 0x3df2e0,
    obstacle: (g, x, y, rand) => {
      const kind = rand();
      g.fillStyle(0x010408, 0.55);
      g.fillEllipse(x + 28, y + 47, 38, 10);
      if (kind < 0.55) {
        // Branching coral with glowing tips.
        const base = x + 28,
          arms = 3 + Math.floor(rand() * 2);
        for (let i = 0; i < arms; i++) {
          const lean = (i - (arms - 1) / 2) * 9 + (rand() - 0.5) * 4,
            h = 20 + rand() * 12,
            tx = base + lean,
            ty = y + 46 - h;
          g.lineStyle(5, 0x1f5a6e);
          g.strokePoints([{ x: base + lean * 0.2, y: y + 47 }, { x: base + lean * 0.6, y: y + 46 - h * 0.5 }, { x: tx, y: ty }], false);
          g.lineStyle(2, 0x3a8aa0, 0.8);
          g.strokePoints([{ x: base + lean * 0.2 - 1, y: y + 47 }, { x: base + lean * 0.6 - 1, y: y + 46 - h * 0.5 }, { x: tx - 1, y: ty }], false);
          g.fillStyle(0xff7aa8);
          g.fillCircle(tx, ty, 3);
          g.fillStyle(0xffc0d4, 0.8);
          g.fillCircle(tx - 0.8, ty - 0.8, 1.2);
        }
      } else {
        // Hydrothermal vent: a dark chimney with a glowing mouth.
        const cx = x + 28 + (rand() - 0.5) * 6,
          h = 22 + rand() * 8;
        g.fillStyle(0x16222e);
        g.fillPoints([{ x: cx - 13, y: y + 47 }, { x: cx - 6, y: y + 46 - h }, { x: cx + 6, y: y + 46 - h }, { x: cx + 13, y: y + 47 }], true);
        g.fillStyle(0x24384a);
        g.fillPoints([{ x: cx - 13, y: y + 47 }, { x: cx - 6, y: y + 46 - h }, { x: cx - 1, y: y + 46 - h }, { x: cx - 3, y: y + 47 }], true);
        g.fillStyle(0x7a3a1a, 0.7);
        for (let i = 0; i < 3; i++) g.fillRect(cx - 8 + i * 6 + rand() * 2, y + 30 + rand() * 12, 3, 2);
        g.fillStyle(0xff9a4a, 0.85);
        g.fillEllipse(cx, y + 46 - h, 12, 4);
        g.fillStyle(0xffe0a0, 0.9);
        g.fillEllipse(cx, y + 46 - h, 6, 2);
      }
    },
    decor: (g, x, y, rand) => {
      const kind = rand(),
        cx = x + 12 + rand() * 32,
        cy = y + 14 + rand() * 28;
      if (kind < 0.55) {
        // Seaweed fronds.
        for (let i = 0; i < 3; i++) {
          const bx = cx + (i - 1) * 4,
            lean = (rand() - 0.5) * 8,
            h = 12 + rand() * 8;
          g.lineStyle(1.5, i === 1 ? 0x2a8a5a : 0x1f6a48, 0.85);
          g.strokePoints([{ x: bx, y: cy + 6 }, { x: bx + lean, y: cy + 6 - h * 0.5 }, { x: bx - lean * 0.4, y: cy + 6 - h }], false);
        }
      } else if (kind < 0.85) {
        // Shell: a fan with ribs.
        g.fillStyle(0x3a6a7a, 0.9);
        g.fillTriangle(cx - 5, cy + 3, cx + 5, cy + 3, cx, cy - 4);
        g.lineStyle(1, 0x9ad8e0, 0.6);
        for (const dx of [-2.5, 0, 2.5]) g.lineBetween(cx, cy + 3, cx + dx * 1.2, cy - 3);
      } else {
        // Pale pebbles on the seabed.
        for (let i = 0; i < 3; i++) {
          g.fillStyle(0x1a4658, 0.9);
          g.fillCircle(cx + (rand() - 0.5) * 14, cy + (rand() - 0.5) * 8, 1.5 + rand() * 1.5);
        }
      }
    },
    // Slow light rays from above, bubbles rising from vents and the channel, bioluminescent pulses at the obstacles.
    ambient: ({ g, map, path, clock, hash, blocked, glow, lit }) => {
      const h = map.rows * CELL;
      for (let k = 0; k < Math.ceil(map.columns / 2); k++) {
        const s = hash(k, 5),
          sway = Math.sin(clock * 0.25 + s * 20) * 14,
          x0 = s * map.columns * CELL + sway;
        glow.fillStyle(0x7af8ea, (0.025 + 0.015 * Math.sin(clock * 0.5 + s * 9)) * lit);
        glow.fillPoints([{ x: x0, y: 0 }, { x: x0 + 22, y: 0 }, { x: x0 + 70, y: h }, { x: x0 + 30, y: h }], true);
      }
      for (const b of blocked) {
        const o = hash(b.x, b.y),
          bx = b.x * CELL,
          by = b.y * CELL,
          vent = o >= 0.55;
        glow.fillStyle(vent ? 0xff9a4a : 0x3df2e0, (0.07 + 0.06 * Math.sin(clock * 2 + o * 25)) * lit);
        fillRound(glow, px(b.x), by + 30, vent ? 20 : 26);
        for (let i = 0; i < (vent ? 3 : 1); i++) {
          const life = (clock * (vent ? 0.7 : 0.4) + o * 5 + i / 3) % 1;
          g.lineStyle(1.2, 0xbff8ff, 0.6 * (1 - life));
          strokeRound(g, bx + 24 + o * 12 + Math.sin(life * 7 + i) * 3, by + (vent ? 28 : 34) - life * 36, 1.5 + life * 2.5);
        }
      }
      flow(path, clock, 1.7, 0.45, (p, k) => {
        const life = (clock * 0.5 + k * 0.31) % 1;
        g.lineStyle(1, 0xbff8ff, 0.4 * (1 - life));
        strokeRound(g, p.x + ((k % 3) - 1) * 9, p.y + 6 - life * 18, 1.5 + (k % 2));
      });
    },
};
