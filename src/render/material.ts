import { chamferRect, disc, polygon, shade, strip, type Ink, type Pen } from "./shapes";
/** Metal of the tower plates and their dark inner decks. */
export const PLATE = 0x2e424d,
  DARK = 0x172730,
  OUTLINE = 0x081016,
  SHADOW = 0x050b10;
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
export interface BarStyle {
  /** Dark cross bands at these fractions of the length. */
  bands?: readonly number[];
  /** Colour of the last 3 px, e.g. a hot or path-coloured muzzle. */
  tip?: number;
  /** Sideways shift, for parallel barrels. */
  side?: number;
  /** Drop shadow on the deck below; on by default. */
  shadow?: boolean;
}
/**
 * Metal bar along angle `a` from distance `from` to `to` with the half widths `w0` and `w1`: a drop shadow,
 * the body, a lit stripe on the side facing the light and a shaded stripe opposite.
 */
export function litBar(g: Ink, x: number, y: number, a: number, from: number, to: number, w0: number, w1: number, color: number, o: BarStyle = {}) {
  const c = Math.cos(a),
    s = Math.sin(a),
    m = o.side ?? 0,
    k = facing(a + Math.PI / 2);
  if (o.shadow !== false) strip(g, x + 0.8, y + 1.2, c, s, from, to, m - w0 - 0.4, m + w0 + 0.4, m - w1 - 0.4, m + w1 + 0.4, SHADOW, 0.45);
  strip(g, x, y, c, s, from, to, m - w0, m + w0, m - w1, m + w1, color);
  if (Math.abs(k) > 0.2) {
    const lit = Math.sign(k);
    strip(g, x, y, c, s, from, to, m + lit * w0, m + lit * 0.4 * w0, m + lit * w1, m + lit * 0.4 * w1, shade(color, 0.12 + 0.3 * Math.abs(k)));
    strip(g, x, y, c, s, from, to, m - lit * w0, m - lit * 0.5 * w0, m - lit * w1, m - lit * 0.5 * w1, shade(color, -0.35));
  } else {
    // Pointing at or away from the light: the end that faces it catches a cap of light instead.
    const end = facing(a) > 0 ? to : from,
      w = end === to ? w1 : w0;
    strip(g, x, y, c, s, end - 1.5, end, m - w, m + w, m - w, m + w, shade(color, 0.3));
  }
  const width = (d: number) => w0 + ((w1 - w0) * (d - from)) / (to - from || 1);
  for (const f of o.bands ?? []) {
    const d = from + (to - from) * f,
      w = width(d) + 0.2;
    strip(g, x, y, c, s, d - 0.45, d + 0.45, m - w, m + w, m - w, m + w, shade(color, -0.45));
  }
  if (o.tip !== undefined) {
    const w = width(to - 3);
    strip(g, x, y, c, s, to - 3, to, m - w - 0.2, m + w + 0.2, m - w1 - 0.2, m + w1 + 0.2, o.tip);
  }
}
/** Rounded cap lit from the upper left: contact shadow, rim, body, a crescent highlight and a glint. */
export function dome(g: Ink, x: number, y: number, r: number, color: number) {
  disc(g, x + 1.2, y + 2, r + 1, SHADOW, 0.35);
  disc(g, x, y, r, shade(color, -0.3));
  disc(g, x - LX * 0.4, y - LY * 0.4, r - 1.4, color);
  disc(g, x + LX * r * 0.3, y + LY * r * 0.3, r * 0.45, shade(color, 0.4), 0.8);
  disc(g, x + LX * r * 0.45, y + LY * r * 0.45, Math.max(0.8, r * 0.18), 0xffffff, 0.75);
}
/** Hex bolt heads on a circle of radius `r`, with a glint on their upper-left side. */
export function rivets(g: Ink, x: number, y: number, r: number, n: number, rot = 0, color = shade(PLATE, -0.3)) {
  for (let i = 0; i < n; i++) {
    const a = rot + (i * Math.PI * 2) / n,
      bx = x + Math.cos(a) * r,
      by = y + Math.sin(a) * r;
    polygon(g, bx, by, 1.7, 6, color, a);
    disc(g, bx + LX * 0.6, by + LY * 0.6, 0.7, shade(PLATE, 0.45), 0.8);
  }
}
/** Status lamp in a dark socket; `on` (0–1) dims it and its glow. */
export function led({ g, glow }: Pen, x: number, y: number, color: number, on: number) {
  disc(g, x, y, 2.4, OUTLINE, 0.9);
  disc(g, x, y, 1.5, shade(color, -0.7 * (1 - on)));
  if (on > 0.05) {
    disc(glow, x, y, 4.5, color, 0.22 * on);
    disc(glow, x, y, 2.2, color, 0.3 * on);
  }
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
