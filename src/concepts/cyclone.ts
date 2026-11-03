import { halo } from "../render/material";
import { arcBand, disc, oval, ring, shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { OUTLINE, X, Y, drum, onGround } from "../render/tower-art/tilt";
import { GUN, lampInk, lampLight } from "../render/tower-art/tilt-parts";
import { contact, ngon, slab } from "./kit-control-b";
import type { Concept } from "./types";

// Cyclone: the Turbine Well. An octagonal plinth with intake vents carries a wide ducted shroud lying flat; inside it a
// fan spins up as the gust charges and blurs after a blast, round a domed hub. Wind streaks curl round the rim in light.
// It never aims; the gust leaves from the top of the well.
const TILT = { drop: 6, squash: 0.65, height: 0, deck: 4.6, emit: 12 },
  DROP = TILT.drop;
const R = 19,
  PLINTH = 4,
  SHROUD = 13,
  LIP = 12,
  INNER = 10.3,
  FAN = 9.6,
  HUB = 2.6;
const PLINTH_SHAPE = ngon(8, R, Math.PI / 8);
/** Intake vents on the plinth's three front faces (centre angle of each face). */
const VENTS = [Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4];
/** Lamps round the shroud's rim (they chase from level 4). */
const RIM = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4 + Math.PI / 8);

function base({ g, x, y, level, color }: TurretContext) {
  const y0 = y + DROP;
  contact(g, x, y0, R);
  slab(g, x, y0, PLINTH_SHAPE, 0, PLINTH, 1, GUN.side, GUN.top, GUN.metal);
  // Intake vents: three dark slats on each front face.
  for (const t of VENTS) {
    const cx = Math.cos(t) * R * 0.93,
      cy = Math.sin(t) * R * 0.93,
      tx = -Math.sin(t),
      ty = Math.cos(t);
    g.lineStyle(0.9, GUN.deep, 1);
    for (const s of [-3, 0, 3]) g.lineBetween(X(x, cx + tx * s), Y(y0, cy + ty * s, 0.8), X(x, cx + tx * s), Y(y0, cy + ty * s, PLINTH - 0.6));
  }
  if (level >= 3)
    onGround(g, x, y0, PLINTH + 1, () => {
      for (let i = 0; i < 8; i++) {
        const t = (i * Math.PI) / 4 + Math.PI / 8;
        disc(g, Math.cos(t) * 16, Math.sin(t) * 16, 0.9, OUTLINE);
        disc(g, Math.cos(t) * 16 - 0.3, Math.sin(t) * 16 - 0.3, 0.4, GUN.metal);
      }
    });
  // Trim inlay from level 4 (the path colour once specialized).
  if (level >= 4) onGround(g, x, y0, PLINTH + 1, () => ring(g, 0, 0, 14.6, 0.8, shade(color, -0.3), 0.9));
}

/** From level 4 the rim lamps of the shroud chase round (on its outer wall, the fan never covers them). */
function below({ g, glow, x, y, level, clock, color }: TurretContext) {
  if (level < 4) return;
  const y0 = y + DROP;
  RIM.forEach((t, i) => {
    if (Math.sin(t) < 0.2) return;
    const on = Math.max(0, Math.sin(5 * clock - i * 0.8)),
      lx = X(x, Math.cos(t) * (SHROUD + 0.2)),
      ly = Y(y0, Math.sin(t) * (SHROUD + 0.2), (PLINTH + LIP) / 2);
    disc(g, lx, ly, 0.8, shade(color, -0.55 + 0.75 * on));
    if (on > 0.4) disc(glow, lx, ly, 2.4, color, 0.3 * on);
  });
}

/** The shroud: a wide drum with a dark well, two struts across it and the hub post. It never aims. Ink only. */
function turret({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  drum(g, x, y0, SHROUD, PLINTH, LIP, shade(c, -0.45), shade(c, -0.15), 20);
  // Level 5: armour bands on the shroud.
  if (level >= 5) drum(g, x, y0, SHROUD + 0.6, PLINTH + 2.2, PLINTH + 4, GUN.side, GUN.top, 20);
  onGround(g, x, y0, LIP, () => {
    oval(g, 0, 0, INNER + 1.2, INNER + 1.2, shade(c, 0.2));
    oval(g, 0, 0, INNER, INNER, GUN.deep);
    arcBand(g, 0, 0, INNER + 0.6, 0.8, Math.PI + 0.3, 2 * Math.PI - 0.3, shade(c, 0.55), 0.8);
  });
  // Rim lamp sockets (the lamps light below; the struts and hub sit in the well).
  for (const t of RIM) {
    if (Math.sin(t) < 0.2) continue;
    disc(g, X(x, Math.cos(t) * (SHROUD + 0.2)), Y(y0, Math.sin(t) * (SHROUD + 0.2), (PLINTH + LIP) / 2), 1.2, OUTLINE);
  }
  onGround(g, x, y0, LIP - 4, () => {
    g.fillStyle(GUN.side);
    g.fillRect(-INNER, -0.9, INNER * 2, 1.8);
    g.fillRect(-0.9, -INNER, 1.8, INNER * 2);
  });
  drum(g, x, y0, 1.6, LIP - 4, LIP - 1.5, GUN.side, GUN.top, 8);
  if (level >= 2) lampInk(g, X(x, -SHROUD + 2.5), Y(y0, -6, LIP), color);
}

/**
 * The fan in the well, spinning faster as the gust charges and blurring right after it, the domed hub, wind streaks
 * curling round the rim, the lamp's light.
 */
function above({ g, glow, x, y, level, charge, kick, clock, energy, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color,
    blades = level >= 3 ? 6 : 4,
    spin = clock * (4 + 10 * charge) + kick * 3;
  if (level >= 2) lampLight(glow, X(x, -SHROUD + 2.5), Y(y0, -6, LIP), color);
  onGround(g, x, y0, LIP - 1, () => {
    if (kick > 0.2) {
      // Blurred: a translucent disc instead of blades.
      disc(g, 0, 0, FAN, shade(c, 0.1), 0.45 + 0.3 * kick);
      ring(g, 0, 0, FAN * 0.65, 1.2, shade(c, 0.5), 0.5);
    } else
      for (let i = 0; i < blades; i++) {
        const b = spin + (i * 2 * Math.PI) / blades,
          p = (t: number, r: number) => [Math.cos(b + t) * r, Math.sin(b + t) * r] as const,
          [x0, y0_] = p(-0.18, HUB),
          [x1, y1] = p(-0.05, FAN),
          [x2, y2] = p(0.42, FAN - 0.6),
          [x3, y3] = p(0.32, HUB);
        g.fillStyle(OUTLINE, 0.9);
        g.fillTriangle(x0, y0_, x1, y1, x2, y2);
        g.fillTriangle(x0, y0_, x2, y2, x3, y3);
        g.fillStyle(shade(c, 0.05 + 0.3 * Math.max(0, Math.cos(b + Math.PI * 0.75))));
        g.fillTriangle(x0 * 0.9, y0_ * 0.9, x1 * 0.93, y1 * 0.93, x2 * 0.93, y2 * 0.93);
        g.fillTriangle(x0 * 0.9, y0_ * 0.9, x2 * 0.93, y2 * 0.93, x3 * 0.9, y3 * 0.9);
      }
    disc(g, 0, 0, HUB + 0.6, OUTLINE);
    disc(g, 0, 0, HUB, shade(GUN.top, 0.1));
    disc(g, -0.7, -0.7, HUB * 0.45, GUN.metal);
  });
  // Wind streaks curling round the rim, faster with the charge.
  const streaks = 2 + Math.round(2 * charge);
  onGround(glow, x, y0, LIP + 1, () => {
    for (let k = 0; k < streaks; k++) {
      const a0 = -clock * (2 + 4 * charge) + (k * 2 * Math.PI) / streaks;
      arcBand(glow, 0, 0, SHROUD + 1.5 + k * 0.8, 1.6, a0, a0 + 0.9, c, 0.12 + 0.2 * charge + energy);
    }
  });
  if (kick > 0) halo(glow, x, Y(y0, 0, LIP + 3), 12 * (1 + kick), c, 0.28 * kick);
}

export const concept: Concept = {
  tower: "cyclone",
  name: "Turbine Well",
  idea: "A wide ducted shroud lying flat on a vented plinth; the fan inside spins up as the gust charges and blurs after a blast, wind streaks curl round the rim.",
  tilt: TILT,
  base,
  below,
  turret,
  above,
};
