import type { EnemyDrawContext } from "./enemies";
import { disc, polygon, shade, type Ink } from "./shapes";
/** Marker colours of the Mesmer trance and the Amber encasement. */
export const TRANCE_COLORS = { confused: 0xc77dff, encased: 0xffc23d } as const;
/**
 * Status marks of Mesmer and Amber on the enemy overlay. Encased: a translucent amber hexagon over the body with facet
 * lines, a rim and a glint wandering across it. Hypnotised: a turning spiral over the head (above the HP bar) and two
 * motes circling the body.
 */
export function drawTranceMarks(g: Ink, { x, y, r, status, clock, enemy: e }: EnemyDrawContext) {
  if (status.encased) {
    const c = TRANCE_COLORS.encased,
      R = r + 4,
      corners = Array.from({ length: 6 }, (_, i) => ({ x: x + Math.cos(Math.PI / 6 + (i * Math.PI) / 3) * R, y: y + Math.sin(Math.PI / 6 + (i * Math.PI) / 3) * R }));
    polygon(g, x, y, R, 6, c, Math.PI / 6, 0.4);
    polygon(g, x - R * 0.2, y - R * 0.2, R * 0.55, 6, shade(c, 0.45), Math.PI / 6, 0.25);
    g.lineStyle(0.8, shade(c, -0.35), 0.5);
    for (const q of corners) g.lineBetween(x, y, q.x, q.y);
    g.lineStyle(1.5, shade(c, 0.3), 0.95);
    g.strokePoints(corners, true);
    const glint = (clock * 0.6 + e.id * 0.37) % 1;
    disc(g, x - R * 0.55 + glint * R * 0.5, y - R * 0.5 + glint * R * 0.2, 1.6, 0xffffff, 0.85 * (1 - glint));
  }
  if (status.confused) {
    const c = TRANCE_COLORS.confused,
      cy = y - r - 15,
      spin = -clock * 6 - e.id;
    g.lineStyle(1.5, c, 0.95);
    g.beginPath();
    for (let k = 0; k < 12; k++) {
      const a = spin + k * 0.62,
        d = 0.6 + k * 0.42;
      if (k) g.lineTo(x + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7);
      else g.moveTo(x + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7);
    }
    g.strokePath();
    for (let i = 0; i < 2; i++) {
      const a = clock * 4 + i * Math.PI + e.id;
      disc(g, x + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3) * 0.55 - 2, 1.5, shade(c, 0.3), 0.9);
    }
  }
}
