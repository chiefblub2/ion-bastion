import { LIGHT, halo } from "../../material";
import { arcBand, disc, oval, polygon, shade } from "../../shapes";
import type { TurretContext } from "../kit";
import { OUTLINE, SQUASH, X, Y, drum, onGround, quad } from "../tilt";
import { lampInk, lampLight } from "../tilt-parts";
import { DEEP, METAL, STEEL, STEEL_TOP, contact, flatRing, ngon, slab } from "./kit-support-b";
import type { TiltedConcept as Concept } from "../tilted";

// Recycler: the Shredder Hopper. A round plinth and a drum-shaped hopper with the recycling chevrons on its wall and a
// dark mouth (base); inside the mouth a three-bladed shredder rotor turns, faster per level (below: it sits inside the
// rim, so nothing covers it); scrap chevrons orbit the rim the other way and the mouth glows (above, live). Nothing
// turns with an aim, so the turret is empty.
const DROP = 5,
  H = 3,
  TOP = H + 10,
  R = 14.5,
  MOUTH = 10.5;
const PLINTH = ngon(16, 20.5),
  PLINTH_IN = ngon(16, 19.5);
/** The recycling chevrons on the hopper's front wall. */
const SIGNS = [Math.PI * 0.3, Math.PI * 0.5, Math.PI * 0.7];

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, 20);
  slab(g, x, y0, PLINTH, PLINTH_IN, 0, H, STEEL, STEEL_TOP, METAL, 0.8);
  if (level >= 4) flatRing(g, x, y0, H + 0.8, 17.4, 0.9, color, 0.95);
  drum(g, x, y0, R, H + 0.8, TOP, shade(c, -0.6), shade(c, -0.4), 18);
  // Chevrons on the wall, each turned along the wall's curve.
  for (const t of SIGNS) {
    const u = Math.cos(t) * (R + 0.2),
      v = Math.sin(t) * (R + 0.2),
      sx = X(x, u),
      sy = Y(y0, v, H + 5.5);
    polygon(g, sx, sy, 2.4, 3, shade(c, -0.1 + 0.2 * Math.cos(t - Math.PI / 2)), -Math.PI / 2);
  }
  // Level 3: a hazard band round the rim.
  if (level >= 3)
    for (let i = 0; i < 10; i++) {
      const t0 = (i / 10) * Math.PI,
        t1 = t0 + Math.PI / 20;
      quad(g, X(x, Math.cos(t0) * R), Y(y0, Math.sin(t0) * R, TOP - 1.4), X(x, Math.cos(t1) * R), Y(y0, Math.sin(t1) * R, TOP - 1.4), X(x, Math.cos(t1) * R), Y(y0, Math.sin(t1) * R, TOP - 0.2), X(x, Math.cos(t0) * R), Y(y0, Math.sin(t0) * R, TOP - 0.2), 0xd8b23a);
    }
  // The rim's lip and the dark mouth, its back wall catching some light.
  onGround(g, x, y0, TOP, () => {
    oval(g, 0, 0, R - 0.6, R - 0.6, shade(STEEL_TOP, 0.05));
    arcBand(g, 0, 0, R - 1.6, 1.2, LIGHT - 1, LIGHT + 1, METAL, 0.8);
    oval(g, 0, 0, MOUTH + 1, MOUTH + 1, OUTLINE);
    oval(g, 0, 0, MOUTH, MOUTH, DEEP);
    arcBand(g, 0, 0, MOUTH - 1.4, 2.4, Math.PI * 1.1, Math.PI * 1.9, shade(STEEL, -0.2), 0.9);
  });
  if (level >= 2) lampInk(g, X(x, -12), Y(y0, 16.5, H + 1), color);
}

function turret() {}

/** The rotor inside the mouth: three blades and a hub, turning faster per level. */
function below({ g, x, y, tower, level, clock, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    spin = clock * (1.6 + 0.5 * level) + tower.id;
  onGround(g, x, y0, TOP - 2.5, () => {
    for (let i = 0; i < 3; i++) {
      const a = spin + (i * Math.PI * 2) / 3,
        ca = Math.cos(a),
        sa = Math.sin(a),
        p = (along: number, across: number) => [ca * along - sa * across, sa * along + ca * across] as const;
      quad(g, ...p(1.5, -1.8), ...p(8.8, -2.6), ...p(9.2, 0.4), ...p(1.5, 1.8), OUTLINE);
      quad(g, ...p(2, -1.3), ...p(8.4, -2), ...p(8.6, 0), ...p(2, 1.3), shade(METAL, -0.15 + 0.3 * Math.max(0, -sa)));
    }
    disc(g, 0, 0, 3, OUTLINE);
    disc(g, 0, 0, 2.2, shade(c, -0.4));
  });
}

/** Scrap chevrons orbiting the rim against the rotor, the glow rising from the mouth and the lamp's light. */
function above({ g, glow, x, y, tower, level, clock, energy, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    spin = clock * (1.6 + 0.5 * level) + tower.id;
  for (let i = 0; i < 3; i++) {
    const a = -spin * 0.5 + (i * Math.PI * 2) / 3,
      sx = X(x, Math.cos(a) * (R - 1.6)),
      sy = Y(y0, Math.sin(a) * (R - 1.6), TOP + 0.6);
    polygon(g, sx, sy, 2.4, 3, OUTLINE, a + Math.PI / 2, 0.9);
    polygon(g, sx, sy, 1.8, 3, c, a + Math.PI / 2);
    disc(glow, sx, sy, 2.6, c, 0.18);
  }
  onGround(glow, x, y0, TOP - 2, () => disc(glow, 0, 0, MOUTH - 1, c, 0.1 + 0.03 * level + energy));
  halo(glow, X(x, 0), Y(y0, 0, TOP + 3), 8, c, 0.08);
  if (level >= 2) lampLight(glow, X(x, -12), Y(y0, 16.5, H + 1), color);
}

export const concept: Concept = {
  tower: "recycler",
  name: "Shredder Hopper",
  idea: "Round hopper with recycling chevrons and a dark mouth; a three-bladed shredder rotor turns inside, scrap chevrons orbit the rim the other way.",
  tilt: { drop: DROP, squash: SQUASH, height: TOP, deck: TOP },
  base,
  below,
  turret,
  above,
};
