import { halo } from "../../material";
import { disc, oval, polygon, shade } from "../../shapes";
import type { TurretContext } from "../kit";
import { OUTLINE, SQUASH, X, Y, drum, onGround } from "../tilt";
import { lampInk, lampLight } from "../tilt-parts";
import { DEEP, METAL, STEEL, STEEL_TOP, contact, flatRing, ngon, post, slab } from "./kit-support-b";
import type { TiltedConcept as Concept } from "../tilted";

// Shield Generator: the Bastion Emitter. A hexagonal pad with three capacitor pylons, one at the back and two at the
// front corners (base); the emitter column and its dome (turret, still); the pips of the shield left this wave on the
// pad (below, the column covers the ones behind it), the capacitor crystals humming and the hexagonal shield bubble
// over it all, fading as the charge runs out (above, live).
const DROP = 5,
  H = 4,
  COLUMN = H + 6,
  DOME = COLUMN + 2.5,
  PYLON = H + 8;
const PAD = ngon(6, 21),
  PAD_IN = ngon(6, 19.6);
const PYLONS = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
const crystalAt = (x: number, y0: number, a: number) => [X(x, Math.cos(a) * 16), Y(y0, Math.sin(a) * 16, PYLON + 2.2)] as const;

/** Shield charges this tower holds per wave, and how many are left (as the flat look reads them). */
function charge({ tower: t, definition: d }: TurretContext) {
  const amount = t.upgrades.reduce((a, id) => d.upgrades.find((u) => u.id === id)?.effects.attack?.amount ?? a, "amount" in d.attack ? d.attack.amount : 0),
    left = Math.max(0, amount - (t.barrier ?? 0));
  return { amount, left, share: amount > 0 ? left / amount : 0 };
}

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, 21);
  slab(g, x, y0, PAD, PAD_IN, 0, H, STEEL, STEEL_TOP, METAL, 1);
  onGround(g, x, y0, H + 1, () => oval(g, 0, 0, 12.5, 12.5, DEEP, 0.7));
  if (level >= 4) flatRing(g, x, y0, H + 1, 17.6, 0.9, color, 0.95);
  // Capacitor pylons, the back one first: dark casings with a crystal seat; the crystals themselves hum live.
  for (const a of [...PYLONS].sort((p, q) => Math.sin(p) - Math.sin(q))) {
    const u = Math.cos(a) * 16,
      v = Math.sin(a) * 16;
    post(g, x, y0, u, v, 2.8, H, PYLON, shade(c, -0.6), shade(c, -0.4));
    // Level 3: a copper band round each casing.
    if (level >= 3) post(g, x, y0, u, v, 3, H + 3, H + 4.2, shade(c, -0.25), shade(c, 0.05));
  }
  if (level >= 2) lampInk(g, X(x, 0), Y(y0, 19.2, H * 0.5), color);
}

/** The emitter column and its dome. */
function turret({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  drum(g, x, y0, 4.8, H + 1, COLUMN, STEEL, STEEL_TOP, 12);
  drum(g, x, y0, 6.2, COLUMN, COLUMN + 1.2, shade(c, -0.55), shade(c, -0.35), 14);
  if (level >= 4) flatRing(g, x, y0, COLUMN + 1.2, 5.6, 0.8, color, 0.95);
  const [dx, dy] = [X(x, 0), Y(y0, 0, DOME)];
  oval(g, dx, dy, 5.4, 4.2, OUTLINE);
  oval(g, dx, dy, 4.8, 3.7, shade(c, -0.2));
  oval(g, dx - 1.3, dy - 1.1, 2.4, 1.6, shade(c, 0.35));
}

/** One pip per charge round the pad, lit while it is left (the column covers the ones behind it). */
function below(ctx: TurretContext) {
  const { g, glow, x, y, definition } = ctx,
    y0 = y + DROP,
    c = definition.color,
    { amount, left } = charge(ctx);
  for (let i = 0; i < amount; i++) {
    const a = -Math.PI / 2 + ((i + 0.5) * Math.PI * 2) / amount,
      px = X(x, Math.cos(a) * 9.5),
      py = Y(y0, Math.sin(a) * 9.5, H + 1);
    disc(g, px, py, 1.5, OUTLINE, 0.9);
    if (i < left) {
      disc(g, px, py, 1, shade(c, 0.4));
      disc(glow, px, py, 2.4, c, 0.25);
    }
  }
}

/** The capacitor crystals humming, the dome's light and the shield bubble, fading with the charge left. */
function above(ctx: TurretContext) {
  const { g, glow, x, y, tower, level, clock, energy, color, definition } = ctx,
    y0 = y + DROP,
    c = definition.color,
    { share } = charge(ctx),
    hum = 0.5 + 0.5 * Math.sin(clock * 2.4 + tower.id),
    shimmer = 0.5 + 0.5 * Math.sin(clock * 3 + tower.id);
  for (const a of PYLONS) {
    const [cx, cy] = crystalAt(x, y0, a);
    polygon(g, cx, cy, 2, 4, OUTLINE, 0, 0.9);
    polygon(g, cx, cy - 0.2, 1.5, 4, shade(c, -0.2 + 0.5 * hum * Math.max(0.3, share)));
    disc(glow, cx, cy, 3.4, c, (0.12 + 0.18 * hum) * Math.max(0.3, share));
  }
  halo(glow, X(x, 0), Y(y0, 0, DOME), 7, c, (share > 0 ? 0.16 + 0.1 * shimmer : 0.04) + energy);
  // The bubble: a hexagonal dome over the pad, its rim on the ground and its crown above the emitter.
  if (share > 0) {
    const crown = Y(y0, 0, DOME + 10),
      spin = clock * 0.2;
    onGround(glow, x, y0, H + 1, () => {
      polygon(glow, 0, 0, 19, 6, c, spin, (0.08 + 0.05 * shimmer) * share);
      glow.lineStyle(1.4, c, (0.28 + 0.14 * shimmer) * share);
      for (let i = 0; i < 6; i++) {
        const a0 = spin + (i * Math.PI) / 3,
          a1 = a0 + Math.PI / 3;
        glow.lineBetween(Math.cos(a0) * 19, Math.sin(a0) * 19, Math.cos(a1) * 19, Math.sin(a1) * 19);
      }
    });
    // Ribs from the rim's corners up to the crown.
    glow.lineStyle(1.2, c, (0.2 + 0.12 * shimmer) * share);
    for (let i = 0; i < 6; i++) {
      const a = spin + (i * Math.PI) / 3,
        rx = X(x, Math.cos(a) * 19),
        ry = Y(y0, Math.sin(a) * 19, H + 1),
        mx = X(x, Math.cos(a) * 14),
        my = Y(y0, Math.sin(a) * 14, DOME + 6);
      glow.lineBetween(rx, ry, mx, my);
      glow.lineBetween(mx, my, X(x, 0), crown);
    }
    disc(glow, X(x, 0), crown, 2, c, 0.25 * share);
  }
  if (level >= 2) lampLight(glow, X(x, 0), Y(y0, 19.2, H * 0.5), color);
}

export const concept: Concept = {
  tower: "shieldgen",
  name: "Bastion Emitter",
  idea: "Hex pad with three capacitor pylons and an emitter dome; a hexagonal shield bubble arches over it, pips on the pad count the charges left.",
  tilt: { drop: DROP, squash: SQUASH, height: DOME, deck: H + 1 },
  base,
  below,
  turret,
  above,
};
