import { halo } from "../render/material";
import { disc, oval, shade } from "../render/shapes";
import { lampInk, lampLight } from "../render/tower-art/tilt-parts";
import { OUTLINE, SQUASH } from "../render/tower-art/tilt";
import { STEEL, at, contact, drumAt, ngon, slab } from "./kit-support-a";
import type { Concept } from "./types";

/** Bounty Beacon: a coin press on a stepped plinth; a gold coin hologram turns over the pedestal. */
const DROP = 5,
  LOW = 3,
  DECK = 6,
  COLUMN = 15,
  COIN = 24;
const LOWER = ngon(8, 18, Math.PI / 8),
  UPPER = ngon(8, 13, Math.PI / 8),
  STACKS = [
    [-11, -5],
    [11, -5],
    [-9, 8],
    [9, 8],
  ];
const GOLD = 0xffd84d;

export const concept: Concept = {
  tower: "beacon",
  name: "Coin Press",
  idea: "Stepped octagonal plinth, a fluted pedestal with a cradle ring; a gold coin turns over it; coin stacks from L3.",
  tilt: { drop: DROP, squash: SQUASH, height: COIN, deck: DECK, emit: COIN },
  base: ({ g, x, y, level, color }) => {
    const y0 = y + DROP,
      P = at(x, y0);
    contact(g, x, y0, 19, 16);
    slab(g, x, y0, LOWER, 0, LOW, 0, STEEL.side, STEEL.top);
    slab(g, x, y0, UPPER, LOW, DECK, 1.2, shade(GOLD, -0.62), shade(GOLD, -0.42), shade(GOLD, 0.1));
    // Coin stacks on the plinth's corners from level 3: the back ones before the pedestal.
    const stacks = (front: boolean) => {
      if (level < 3) return;
      for (const [u, v] of STACKS) if (v > 0 === front) for (let k = 0; k < 3; k++) drumAt(g, x, y0, u, v, 2.4, LOW + k * 1.1, LOW + 1 + k * 1.1, shade(GOLD, -0.35), shade(GOLD, 0.1), 8);
    };
    stacks(false);
    drumAt(g, x, y0, 0, 0, 4.6, DECK, COLUMN, STEEL.side, STEEL.top, 12);
    // Flutes up the pedestal and a band in the trim colour once specialized.
    g.lineStyle(0.6, STEEL.deep, 0.9);
    for (const u of [-2.6, 0, 2.6]) g.lineBetween(...P(u, 4.2, DECK + 1), ...P(u, 4.2, COLUMN - 1.5));
    if (level >= 4) drumAt(g, x, y0, 0, 0, 4.8, COLUMN - 3, COLUMN - 1.8, color, shade(color, 0.2), 12);
    // The cradle ring the coin turns in.
    const [rx, ry] = P(0, 0, COLUMN);
    oval(g, rx, ry, 8, 8 * SQUASH, OUTLINE);
    oval(g, rx, ry, 7, 7 * SQUASH, shade(GOLD, -0.45));
    oval(g, rx, ry, 5.4, 5.4 * SQUASH, STEEL.deep);
    stacks(true);
    if (level >= 2) lampInk(g, ...P(0, 13, LOW + 1.5), color);
  },
  below: ({ glow, x, y, level, color }) => {
    if (level >= 2) lampLight(glow, ...at(x, y + DROP)(0, 13, LOW + 1.5), color);
  },
  turret: () => {},
  above: ({ g, glow, x, y, tower, clock, level, color }) => {
    const y0 = y + DROP,
      [cx, cy] = at(x, y0)(0, 0, COIN + Math.sin(clock * 2 + tower.id) * 1.2),
      spin = clock * 2.4 + tower.id,
      // Never fully edge-on, so it always reads as a coin.
      w = 0.55 + 0.45 * Math.abs(Math.cos(spin)),
      r = 7.5 + Math.min(level, 3) * 0.4;
    halo(glow, cx, cy, 12, GOLD, 0.18);
    // The coin: a thick disc whose rim shows beside its face as it turns, the face glinting towards the viewer.
    const side = Math.sin(spin) > 0 ? 1 : -1,
      rim = 2.2 * (1 - w) + 0.8;
    oval(g, cx + side * rim * 0.5, cy, r * w + rim * 0.5 + 0.9, r + 0.9, OUTLINE);
    oval(g, cx + side * rim, cy, r * w, r, shade(GOLD, -0.45));
    g.fillStyle(shade(GOLD, -0.45));
    g.fillRect(cx, cy - r, side * rim, 2 * r);
    oval(g, cx, cy, r * w, r, shade(GOLD, -0.15));
    {
      oval(g, cx, cy, r * w * 0.8, r * 0.8, GOLD);
      oval(g, cx - r * w * 0.2, cy - r * 0.25, r * w * 0.3, r * 0.22, shade(GOLD, 0.6));
      // The ◇ mark of credits on its face.
      g.fillStyle(shade(GOLD, -0.45));
      g.fillTriangle(cx - 2.6 * w, cy, cx, cy - 3, cx + 2.6 * w, cy);
      g.fillTriangle(cx - 2.6 * w, cy, cx, cy + 3, cx + 2.6 * w, cy);
    }
    if (level >= 4) disc(glow, cx, cy, 3, color, 0.3);
  },
};
