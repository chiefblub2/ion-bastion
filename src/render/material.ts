import { chamferRect, disc, polygon, shade, type Ink } from "./shapes";
/** Dark inner decks, plate outlines and cast shadows. */
const DARK = 0x172730,
  OUTLINE = 0x081016;
export const SHADOW = 0x050b10;
/** Light falls from the upper left; every rim light, highlight and shadow follows it. */
export const LIGHT = -0.75 * Math.PI;
const LX = Math.cos(LIGHT),
  LY = Math.sin(LIGHT);
/** How much a surface whose normal points at `normal` catches the light: 1 facing it, −1 facing away. */
export const facing = (normal: number) => Math.cos(normal - LIGHT);
/** Outline of a plate: a regular polygon (`n` corners turned by `rot`), a disc, or a box whose corners are cut by `cut` × r. */
export type Shape = { n: number; rot?: number } | "disc" | { cut: number };
function shape(g: Ink, s: Shape, x: number, y: number, r: number, color: number, alpha = 1) {
  if (s === "disc") disc(g, x, y, r, color, alpha);
  else if ("cut" in s) chamferRect(g, x, y, r, r, s.cut * r, color, alpha);
  else polygon(g, x, y, r, s.n, color, s.rot ?? 0, alpha);
}
/**
 * Raised plate: dark outline, shaded lower-right rim, lit upper-left rim and the face. The rims are offset
 * copies, so they taper like real bevels. `deck` > 0 adds a sunken inner floor of that radius.
 */
export function plate(g: Ink, x: number, y: number, s: Shape, r: number, color: number, deck = 0, deckColor = DARK) {
  shape(g, s, x, y, r + 1.2, OUTLINE, 0.85);
  shape(g, s, x, y, r, shade(color, -0.38));
  shape(g, s, x + LX * 1.1, y + LY * 1.1, r - 0.8, shade(color, 0.3));
  shape(g, s, x - LX * 0.4, y - LY * 0.4, r - 2, color);
  if (deck > 0) sunken(g, x, y, s, deck, deckColor);
}
/** Recessed floor: a shadow under the upper-left rim and a lit lip on the lower right. */
export function sunken(g: Ink, x: number, y: number, s: Shape, r: number, color: number) {
  shape(g, s, x - LX * 0.7, y - LY * 0.7, r, shade(color, 0.25));
  shape(g, s, x + LX * 0.3, y + LY * 0.3, r - 0.2, shade(color, -0.45));
  shape(g, s, x - LX * 0.45, y - LY * 0.45, r - 1.5, color);
}
/** Soft light: three stacked discs on the glow layer; the centre reaches about 1.1 × `alpha`. */
export function halo(glow: Ink, x: number, y: number, r: number, color: number, alpha: number) {
  if (alpha <= 0.01 || r <= 0) return;
  disc(glow, x, y, r, color, alpha * 0.3);
  disc(glow, x, y, r * 0.62, color, alpha * 0.35);
  disc(glow, x, y, r * 0.32, color, alpha * 0.45);
}
/** Glowing line: a wide faint stroke under a narrow bright one. */
export function glowLine(glow: Ink, x1: number, y1: number, x2: number, y2: number, color: number, w: number, alpha: number) {
  if (alpha <= 0.01) return;
  glow.lineStyle(w * 3, color, alpha * 0.3);
  glow.lineBetween(x1, y1, x2, y2);
  glow.lineStyle(w, color, alpha);
  glow.lineBetween(x1, y1, x2, y2);
}
