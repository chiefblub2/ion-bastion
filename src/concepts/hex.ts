import { halo } from "../render/material";
import { disc, shade } from "../render/shapes";
import type { TurretContext } from "../render/tower-art/kit";
import { OUTLINE, X, Y, drum, onGround, tube } from "../render/tower-art/tilt";
import { GUN, castShadow, depth, framer, lampInk, lampLight, paint, part, rect } from "../render/tower-art/tilt-parts";
import { contact, ngon, slab } from "./kit-control-b";
import type { Concept } from "./types";

// Hex: the Sigil Altar. A pentagonal altar with rune slots in its walls; on its bearing turns a crooked iron claw
// that reaches out toward the target and holds the cursed shard. Over the altar a pentagram floats and turns, its
// points kindling as the curse charges; the shard grows at the claw's tip.
const TILT = { drop: 5, squash: 0.65, height: 12, deck: 5.6 },
  DROP = TILT.drop,
  HB = TILT.height,
  RECOIL = 0,
  reach = (l: number) => 14 + l * 0.5;
const R = 19,
  ALTAR = 4.6,
  DECK = 5.6,
  POST_TOP = 15,
  STAR_H = 24,
  STAR_R = 8;
const PENTA = ngon(5, R, -Math.PI / 2);
const POST = ngon(4, 3.6, Math.PI / 4);
const BRACE = rect(-5, 2, -2.2, 2.2);
const PLATES = [rect(-5, 1, 2.2, 3.4), rect(-5, 1, -3.4, -2.2)];
/** The altar's five corners (screen-clockwise from the top), for its rune slots on the front faces. */
const CORNERS = Array.from({ length: 5 }, (_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5);

function base({ g, x, y, level, color, definition }: TurretContext) {
  const y0 = y + DROP,
    c = definition.color;
  contact(g, x, y0, R);
  slab(g, x, y0, PENTA, 0, ALTAR, 1, GUN.side, GUN.top, GUN.metal);
  // Rune slots in the walls turned to the viewer.
  for (let i = 0; i < 5; i++) {
    const t0 = CORNERS[i],
      t1 = CORNERS[(i + 1) % 5],
      mid = (t0 + t1) / 2 + (i === 4 ? Math.PI : 0);
    if (Math.sin(mid) < 0.1) continue;
    const u = Math.cos(mid) * R * 0.8,
      v = Math.sin(mid) * R * 0.8,
      sx = X(x, u),
      sy = Y(y0, v, ALTAR / 2);
    g.fillStyle(GUN.deep);
    g.fillRect(sx - 2.2, sy - 1.1, 4.4, 2.2);
    g.fillStyle(shade(c, -0.55));
    g.fillRect(sx - 1.6, sy - 0.5, 3.2, 1);
  }
  onGround(g, x, y0, DECK, () => {
    // An engraved circle with the pentagram's shadow cut into the deck.
    g.lineStyle(0.8, GUN.deep, 0.9);
    for (let i = 0; i < 5; i++) {
      const t0 = -Math.PI / 2 + (i * 4 * Math.PI) / 5,
        t1 = t0 + (4 * Math.PI) / 5;
      g.lineBetween(Math.cos(t0) * 12.5, Math.sin(t0) * 12.5, Math.cos(t1) * 12.5, Math.sin(t1) * 12.5);
    }
    if (level >= 3)
      for (const t of CORNERS) {
        disc(g, Math.cos(t) * 15.5, Math.sin(t) * 15.5, 1, OUTLINE);
        disc(g, Math.cos(t) * 15.5 - 0.3, Math.sin(t) * 15.5 - 0.3, 0.45, GUN.metal);
      }
    if (level >= 4) {
      g.lineStyle(0.8, shade(color, -0.3), 0.9);
      g.beginPath();
      for (let i = 0; i <= 5; i++) {
        const t = CORNERS[i % 5];
        if (i === 0) g.moveTo(Math.cos(t) * 14, Math.sin(t) * 14);
        else g.lineTo(Math.cos(t) * 14, Math.sin(t) * 14);
      }
      g.strokePath();
    }
  });
  drum(g, x, y0, 5.2, DECK, DECK + 1.6, GUN.deep, shade(GUN.side, 0.15), 10);
}

/** The rune slots kindle in turn from level 4 (the claw may swing in front of them). */
function below({ g, glow, x, y, level, clock, definition }: TurretContext) {
  if (level < 4) return;
  const y0 = y + DROP,
    c = definition.color;
  for (let i = 0; i < 5; i++) {
    const t0 = CORNERS[i],
      t1 = CORNERS[(i + 1) % 5],
      mid = (t0 + t1) / 2 + (i === 4 ? Math.PI : 0);
    if (Math.sin(mid) < 0.1) continue;
    const on = Math.max(0, Math.sin(3 * clock - i * 1.3)),
      sx = X(x, Math.cos(mid) * R * 0.8),
      sy = Y(y0, Math.sin(mid) * R * 0.8, ALTAR / 2);
    g.fillStyle(shade(c, -0.55 + 0.8 * on));
    g.fillRect(sx - 1.6, sy - 0.5, 3.2, 1);
    if (on > 0.4) disc(glow, sx, sy, 3, c, 0.3 * on);
  }
}

/** The square post and the crooked claw reaching toward the target, back to front. Ink only. */
function turret({ g, x, y, tower, level, kick, tip, color, definition }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    P = framer(x, y0, a),
    end = reach(level) - kick * RECOIL;
  castShadow(g, x, y0, a, rect(-4, end, -2.5, 2.5), DECK, 0.24);
  const post = () => {
      if (level >= 5) for (const plate of PLATES) part(g, x, y0, a, plate, DECK + 1.6, POST_TOP - 2, 0, shade(c, -0.55), shade(c, -0.25), shade(c, 0.3));
      part(g, x, y0, a, POST, DECK + 1.6, POST_TOP, 1, GUN.side, GUN.top, GUN.metal);
      if (level >= 2) lampInk(g, ...P(0, 0, POST_TOP + 1.2), color);
    },
    claw = () => {
      // A brace from the post, an iron arm bending down to the barrel's height, two talons round the shard.
      part(g, x, y0, a, BRACE, POST_TOP - 3.5, POST_TOP - 1.5, 0, GUN.side, GUN.top, GUN.metal);
      const [bx, by] = P(2, 0, POST_TOP - 2.5),
        [kx, ky] = P(end - 6, 0, HB + 2.5),
        [ex, ey] = P(end - 2.5, 0, HB);
      g.lineStyle(3.4, OUTLINE, 0.95);
      g.lineBetween(bx, by, kx, ky);
      g.lineBetween(kx, ky, ex, ey);
      g.lineStyle(2.1, GUN.side, 1);
      g.lineBetween(bx, by, kx, ky);
      g.lineBetween(kx, ky, ex, ey);
      g.lineStyle(0.7, GUN.metal, 0.8);
      g.lineBetween(bx, by - 0.6, kx, ky - 0.6);
      for (const q of [-2.4, 2.4]) {
        const [mx, my] = P(end - 1.5, q, HB + 0.8),
          [tx, ty] = P(end + 1.2, q * 0.45, HB + 0.4);
        g.lineStyle(2, OUTLINE, 0.95);
        g.lineBetween(ex, ey, mx, my);
        g.lineBetween(mx, my, tx, ty);
        g.lineStyle(1, level >= 6 ? color : tip ?? shade(c, -0.2), 1);
        g.lineBetween(ex, ey, mx, my);
        g.lineBetween(mx, my, tx, ty);
      }
      tube(g, x, y0, a, HB, end - 3.4, end - 2, 1.6, GUN.deep, 1, false);
    };
  paint([
    [depth(a, 0, 0), post],
    [depth(a, 8, 0), claw],
  ]);
}

/** The floating pentagram turning over the altar, its points kindling with the charge; the cursed shard at the claw. */
function above({ g, glow, x, y, tower, level, charge, kick, clock, energy, color, definition }: TurretContext) {
  const a = tower.angle,
    y0 = y + DROP,
    c = definition.color,
    P = framer(x, y0, a),
    end = reach(level) - kick * RECOIL,
    spin = clock * 0.6 + tower.id;
  if (level >= 2) lampLight(glow, ...P(0, 0, POST_TOP + 1.2), color);
  const star = (ink: typeof g, width: number, col: number, alpha: number) => {
    ink.lineStyle(width, col, alpha);
    ink.beginPath();
    for (let i = 0; i <= 5; i++) {
      const t = spin + (i * 4 * Math.PI) / 5;
      if (i === 0) ink.moveTo(Math.cos(t) * STAR_R, Math.sin(t) * STAR_R);
      else ink.lineTo(Math.cos(t) * STAR_R, Math.sin(t) * STAR_R);
    }
    ink.strokePath();
  };
  onGround(glow, x, y0, STAR_H, () => star(glow, 3, c, 0.12 + 0.25 * charge + energy));
  onGround(g, x, y0, STAR_H, () => {
    star(g, 1, shade(c, 0.35), 0.8);
    for (let i = 0; i < 5; i++) {
      const t = spin + (i * 2 * Math.PI) / 5,
        on = Math.max(0, Math.min(1, charge * 5 - i));
      disc(g, Math.cos(t) * STAR_R, Math.sin(t) * STAR_R, 0.9 + 0.5 * on, shade(c, -0.3 + 0.7 * on));
    }
  });
  // The shard between the talons grows with the charge.
  if (kick === 0 && charge > 0.15) {
    const [sx, sy] = P(end, 0, HB + 0.3),
      r = 1 + 2 * charge;
    g.fillStyle(OUTLINE);
    g.fillTriangle(sx, sy - r * 1.7, sx - r - 0.5, sy + 0.3, sx + r + 0.5, sy + 0.3);
    g.fillTriangle(sx, sy + r * 1.1, sx - r - 0.5, sy + 0.3, sx + r + 0.5, sy + 0.3);
    g.fillStyle(shade(c, 0.25));
    g.fillTriangle(sx, sy - r * 1.4, sx - r, sy + 0.3, sx + r, sy + 0.3);
    g.fillStyle(shade(c, -0.25));
    g.fillTriangle(sx, sy + r * 0.8, sx - r, sy + 0.3, sx + r, sy + 0.3);
    disc(glow, sx, sy, 3 + 2 * charge, c, 0.2 + 0.2 * charge);
  }
  if (kick > 0) halo(glow, ...P(end, 0, HB), 5 * (1 + kick), c, 0.3 * kick);
}

export const concept: Concept = {
  tower: "hex",
  name: "Sigil Altar",
  idea: "A pentagonal altar with rune slots; a crooked iron claw reaches toward the target holding a cursed shard that grows, while a pentagram floats and turns overhead.",
  tilt: TILT,
  reach,
  recoil: RECOIL,
  base,
  below,
  turret,
  above,
};
