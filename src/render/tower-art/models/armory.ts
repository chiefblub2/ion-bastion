import { halo } from "../../material";
import { disc, oval, shade } from "../../shapes";
import type { TurretContext } from "../kit";
import { OUTLINE, SQUASH, X, Y, drum, onGround, quad } from "../tilt";
import { lampInk, lampLight } from "../tilt-parts";
import { BRASS, DEEP, METAL, STEEL, STEEL_TOP, contact, flatRing, post, shape, slab } from "./kit-support-b";
import type { TiltedConcept as Concept } from "../tilted";

// Armory: the Munitions Depot. A chamfered depot plinth with racks of standing cartridges along its front and back
// (base), a fixed magazine collar (turret) and a revolving magazine cylinder that indexes one chamber at a time, every
// chamber holding a cartridge tipped in the tower colour (above, live).
const DROP = 5,
  H = 5,
  COLLAR = H + 2,
  MAG = H + 10;
const PLINTH = [-21, -15, -15, -21, 15, -21, 21, -15, 21, 15, 15, 21, -15, 21, -21, 15];
const FOOT = shape(PLINTH),
  INSET = shape(PLINTH, 0.92);
/** Cartridge racks along the back and front edges of the deck. */
const RACK = [-12, -6, 0, 6, 12];

function cartridge(g: TurretContext["g"], x: number, y0: number, u: number, v: number, h: number, tip: number) {
  post(g, x, y0, u, v, 1.5, h, h + 3.6, BRASS, shade(BRASS, 0.2));
  oval(g, X(x, u), Y(y0, v, h + 3.9), 1.1, 0.8, tip);
}

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, 21);
  slab(g, x, y0, FOOT, INSET, 0, H, STEEL, STEEL_TOP, METAL, 1.2);
  // Level 3: armour plates on the two front walls, in the tower colour.
  if (level >= 3)
    for (const s of [-1, 1]) {
      const u0 = s * 15,
        u1 = s * 20;
      quad(g, X(x, u0), Y(y0, 21, 1), X(x, u1), Y(y0, 16, 1), X(x, u1), Y(y0, 16, H - 1), X(x, u0), Y(y0, 21, H - 1), shade(c, -0.35));
    }
  // Deck: a dark recess under the magazine, a trim inlay in the path colour from level 4.
  onGround(g, x, y0, H + 1.2, () => {
    oval(g, 0, 0, 12.5, 12.5, DEEP);
  });
  if (level >= 4) flatRing(g, x, y0, H + 1.2, 14.2, 0.9, color, 0.95);
  for (const u of RACK) cartridge(g, x, y0, u, -15, H + 1.2, shade(c, 0.25));
  for (const u of RACK) cartridge(g, x, y0, u, 15.5, H + 1.2, shade(c, 0.25));
  if (level >= 2) lampInk(g, X(x, -17.5), Y(y0, 17.5, H + 1.5), color);
}

/** The fixed magazine collar the cylinder turns on. */
function turret({ g, x, y }: TurretContext) {
  const y0 = y + DROP;
  drum(g, x, y0, 11, H + 1.2, COLLAR, DEEP, shade(STEEL, -0.1), 16);
  flatRing(g, x, y0, COLLAR, 10.4, 0.8, METAL, 0.8);
}

function below() {}

/** The revolving cylinder: fluted wall turning with the chambers, six cartridges on top, lit by level; the lamp's light. */
function above({ g, glow, x, y, tower, level, clock, energy, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    beat = clock * 0.8 + tower.id * 0.37,
    spin = (Math.floor(beat) + Math.min(1, (beat % 1) * 4)) * (Math.PI / 3);
  drum(g, x, y0, 9.5, COLLAR, MAG, shade(c, -0.25), shade(c, 0.05), 16);
  // Flutes on the cylinder's front half, turning with it.
  for (let i = 0; i < 12; i++) {
    const t = spin + (i * Math.PI) / 6,
      st = Math.sin(t);
    if (st <= 0.15) continue;
    const u = Math.cos(t) * 9.6,
      v = st * 9.6;
    g.lineStyle(1.1, shade(c, -0.6), 0.9);
    g.lineBetween(X(x, u), Y(y0, v, COLLAR + 1), X(x, u), Y(y0, v, MAG - 1));
  }
  // Chambers on the top face, back ones first.
  const chambers = Array.from({ length: 6 }, (_, i) => ({ i, t: spin + (i * Math.PI) / 3 + Math.PI / 6 })).sort((a, b) => Math.sin(a.t) - Math.sin(b.t));
  onGround(g, x, y0, MAG, () => oval(g, 0, 0, 3, 3, shade(c, -0.45)));
  chambers.forEach(({ i, t }) => {
    const u = Math.cos(t) * 6,
      v = Math.sin(t) * 6,
      loaded = i < level * 2;
    oval(g, X(x, u), Y(y0, v, MAG), 2.3, 2.3 * SQUASH, OUTLINE);
    if (!loaded) return;
    disc(g, X(x, u), Y(y0, v, MAG + 1.2), 1.7, BRASS);
    oval(g, X(x, u), Y(y0, v, MAG + 2.2), 1.2, 0.9, shade(c, 0.35));
    disc(glow, X(x, u), Y(y0, v, MAG + 2.2), 2.4, c, 0.18 + energy);
  });
  // The centre pin, and a glint where the cylinder indexes.
  const [px, py] = [X(x, 0), Y(y0, 0, MAG + 1.5)];
  disc(g, px, py, 1.6, OUTLINE);
  disc(g, px - 0.3, py - 0.3, 1, METAL);
  if ((beat % 1) * 4 < 1) halo(glow, px, py, 9, c, 0.15);
  if (level >= 2) lampLight(glow, X(x, -17.5), Y(y0, 17.5, H + 1.5), color);
}

export const concept: Concept = {
  tower: "armory",
  name: "Munitions Depot",
  idea: "Chamfered depot plinth with cartridge racks; a revolving magazine cylinder indexes one chamber at a time, cartridges tipped in purple.",
  tilt: { drop: DROP, squash: SQUASH, height: MAG, deck: H + 1.2 },
  base,
  below,
  turret,
  above,
};
