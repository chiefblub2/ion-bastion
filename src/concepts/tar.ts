import { arcBand, disc, hash01, oval, ring, shade } from "../render/shapes";
import { OUTLINE, SQUASH, X, Y, onGround, quad } from "../render/tower-art/tilt";
import type { TurretContext } from "../render/tower-art/kit";
import { DROP, at, chase, readyLight, readySocket, slab } from "./kit-traps-b";
import type { Concept } from "./types";

/** Lip: outer and inner radius of the stone ring, the stones' height range; the tar's surface height. */
const OUTER = 19.5,
  INNER = 13,
  STONES = 11,
  SURFACE = 0.6;
/** Rough field stone of the lip (neutral, so the tar alone carries the colour): wall, top, highlight. */
const STONE = { wall: 0x47443e, top: 0x67635a, glint: 0x8c877b } as const;

/** Near-black tar with only a dull trace of the tower's colour. */
const tar = (c: number, k = 0) => shade(c, -0.84 + k);

/** One lip stone: an irregular four-sided block between the two radii, its height hashed per stone. */
function stone(i: number) {
  const a0 = (i / STONES) * Math.PI * 2 + 0.05,
    a1 = ((i + 1) / STONES) * Math.PI * 2 - 0.05,
    j = (k: number) => (hash01(i, k, 17) - 0.5) * 1.6,
    shape = [
      Math.cos(a0) * (INNER + j(1)), Math.sin(a0) * (INNER + j(1)),
      Math.cos(a0) * (OUTER + j(2)), Math.sin(a0) * (OUTER + j(2)),
      Math.cos(a1) * (OUTER + j(3)), Math.sin(a1) * (OUTER + j(3)),
      Math.cos(a1) * (INNER + j(4)), Math.sin(a1) * (INNER + j(4)),
    ];
  // Inner a0, outer a0, outer a1, inner a1: clockwise on the screen (v points down).
  return { shape, h: 2.2 + hash01(i, 5, 3) * 1.4, mid: (a0 + a1) / 2 };
}
const LIP = Array.from({ length: STONES }, (_, i) => stone(i)).sort((p, q) => Math.sin(p.mid) - Math.sin(q.mid));

/** The lamp stone (back right) and the front stones the chasing lights sit on. */
const LAMP = [12.5, -11] as const;
const FRONT = [-0.95, -0.3, 0.3, 0.95].map((t) => [Math.sin(t) * (OUTER - 2), Math.cos(t) * (OUTER - 2)] as const);

function base(ctx: TurretContext) {
  const { g, x, y, definition: d, level, color } = ctx,
    c = d.color,
    y0 = y + DROP;
  // Tar soaked into the path bed round the pit.
  onGround(g, x, y0, 0, () => {
    oval(g, 1.5, 2.5, OUTER + 3, OUTER + 2.5, tar(c, 0.06), 0.55);
    oval(g, 0, 0, OUTER + 1, OUTER + 1, 0x050608, 0.4);
  });
  // The pit: a flat, matte surface below the lip, darker toward its far wall.
  onGround(g, x, y0, SURFACE, () => {
    oval(g, 0, 0, INNER + 1, INNER + 1, OUTLINE, 1);
    oval(g, 0, 0.8, INNER, INNER - 0.4, tar(c));
    arcBand(g, 0, 0, INNER - 1.2, 2.4, Math.PI * 1.05, Math.PI * 1.95, tar(c, -0.1));
    // Slow folds in the thick surface: no gloss, only a slightly lighter crease here and there.
    g.lineStyle(0.8, tar(c, 0.1), 0.8);
    for (const [cx, cy, r, a0] of [
      [-3, 2, 6, 3.6],
      [4, -2, 5, 0.4],
      [1, 5, 4, 5.2],
    ] as const) {
      g.beginPath();
      for (let k = 0; k <= 6; k++) {
        const t = a0 + (k / 6) * 1.6;
        if (k) g.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
        else g.moveTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
      }
      g.strokePath();
    }
  });
  // The stone lip, back to front; tar stains the stones' feet and drips in strings over the front ones.
  for (const s of LIP) {
    slab(g, x, y0, s.shape, 0, s.h, 0.8, STONE.wall, STONE.top, STONE.glint, 0.82);
    if (Math.sin(s.mid) <= 0.25) continue;
    const ou = Math.cos(s.mid) * (OUTER - 0.4),
      ov = Math.sin(s.mid) * (OUTER - 0.4),
      [tx, ty] = at(x, y0, ou, ov, s.h),
      [bx, by] = at(x, y0, ou, ov, 0);
    // A string of tar from the stone's top edge down its face, ending in a blob on the bed.
    const len = 0.45 + 0.5 * hash01(s.mid * 10, 2, 9);
    quad(g, tx - 0.8, ty, tx + 0.8, ty, tx + 0.4, ty + (by - ty) * len, tx - 0.4, ty + (by - ty) * len, tar(c, 0.04));
    disc(g, tx, ty + (by - ty) * len + 0.5, 1, tar(c, 0.04));
    oval(g, bx + 1.2, by + 0.6, 2.2, 0.9, tar(c, 0.04), 0.9);
  }
  // L3: iron cramps binding the front stones; L5: a band round the lip in the trap's colour (path colour from L6).
  if (level >= 3)
    for (const t of [-0.6, 0, 0.6]) {
      const [cx, cy] = at(x, y0, Math.sin(t) * (OUTER - 3), Math.cos(t) * (OUTER - 3), 3.3);
      quad(g, cx - 1.6, cy - 0.5, cx + 1.6, cy - 0.5, cx + 1.6, cy + 0.5, cx - 1.6, cy + 0.5, 0x2a2d30);
      quad(g, cx - 1.4, cy - 0.5, cx + 1.4, cy - 0.5, cx + 1.4, cy - 0.1, cx - 1.4, cy - 0.1, 0x7d8589);
    }
  if (level >= 5)
    onGround(g, x, y0, 0.4, () => {
      ring(g, 0, 0, OUTER + 1.2, 1, level >= 6 ? color : shade(c, 0.2), 0.9);
    });
  if (level >= 2) readySocket(g, x, y0, LAMP[0], LAMP[1], 3.6, c);
}

/** From level 4 lights chase along the front stones. */
function below(ctx: TurretContext) {
  chase(ctx, ctx.x, ctx.y + DROP, FRONT, 1.4);
}

/**
 * Slow, heavy bubbles: a dull dome swells for seconds, stretches a string as it bursts and leaves a crater that closes
 * again; a catch (`kick`) heaves the whole surface. Matte throughout, the only light is a faint rim on each dome.
 */
function above(ctx: TurretContext) {
  const { g, glow, x, y, tower: t, definition: d, level, clock, kick } = ctx,
    c = d.color,
    y0 = y + DROP;
  onGround(g, x, y0, SURFACE, () => {
    for (let i = 0; i < 3; i++) {
      const phase = (clock * 0.22 + i * 0.37 + t.id * 0.13) % 1,
        bx = [-5, 3.5, 0][i],
        by = [1, -3, 5][i];
      if (phase < 0.8) {
        const r = 1 + 3.2 * (phase / 0.8);
        oval(g, bx + 0.4, by + 0.6, r + 0.4, r + 0.2, tar(c, -0.08));
        disc(g, bx, by, r, tar(c, 0.05 + 0.04 * (phase / 0.8)));
        arcBand(g, bx, by, r - 0.4, 0.7, Math.PI * 1.1, Math.PI * 1.55, tar(c, 0.22), 0.8);
      } else {
        // Burst: a dark crater ring closing again.
        const k = (phase - 0.8) / 0.2;
        ring(g, bx, by, 4.2 - 2.4 * k, 1.1, tar(c, -0.1), 1 - k);
        ring(g, bx, by, 4.6 - 2.4 * k, 0.5, tar(c, 0.15), 0.7 * (1 - k));
      }
    }
    // A catch heaves the surface: a dull swell ring and a faint glow of the tar's colour.
    if (kick > 0) {
      ring(g, 0, 1, INNER * (0.4 + 0.5 * (1 - kick)), 1.6, tar(c, 0.12), kick);
      ring(glow, 0, 1, INNER * (0.4 + 0.5 * (1 - kick)), 2.4, c, 0.18 * kick);
    }
  });
  // A bursting bubble stretches a thin string of tar upward (on screen) before it snaps.
  for (let i = 0; i < 3; i++) {
    const phase = (clock * 0.22 + i * 0.37 + t.id * 0.13) % 1;
    if (phase < 0.8 || phase > 0.9) continue;
    const k = (phase - 0.8) / 0.1,
      bx = X(x, [-5, 3.5, 0][i]),
      by = Y(y0, [1, -3, 5][i], SURFACE);
    g.lineStyle(0.7, tar(c, 0.1), 1 - k);
    g.lineBetween(bx, by, bx + 0.4, by - 2 - 4 * k);
    disc(g, bx + 0.4, by - 2 - 4 * k, 0.8, tar(c, 0.08), 1 - k);
  }
  if (level >= 2) readyLight(ctx, x, y0, LAMP[0], LAMP[1], 3.6);
}

/** Tar Pit: a thick, near-black pit in a raised lip of field stones; slow heavy bubbles, tar dripping over the stones. */
export const concept: Concept = {
  tower: "tar",
  name: "Tar Well",
  idea: "A pit of thick, matte, near-black tar in a raised lip of rough field stones; slow heavy bubbles swell and burst into stringy craters, tar drips over the front stones.",
  tilt: { drop: DROP, squash: SQUASH, height: 0, deck: 0 },
  base,
  below,
  turret: () => {},
  above,
};
