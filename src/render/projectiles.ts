import type { ProjectileStyle } from "../core/types";
import { polygon, type Ink } from "./shapes";
/** Projectile drawings by `visual.projectile`; `a` is the flight direction. */
const PROJECTILES: Record<ProjectileStyle, (g: Ink, x: number, y: number, a: number, color: number) => void> = {
  shell: (g, x, y, _a, color) => {
    g.fillStyle(color, 0.3);
    g.fillCircle(x, y, 9);
    g.fillStyle(color);
    g.fillCircle(x, y, 5);
  },
  crystal: (g, x, y, a, color) => polygon(g, x, y, 5, 4, color, a),
  twin: (g, x, y, a, color) => {
    const nx = -Math.sin(a) * 3,
      ny = Math.cos(a) * 3;
    g.fillStyle(color);
    g.fillCircle(x + nx, y + ny, 2.5);
    g.fillCircle(x - nx, y - ny, 2.5);
  },
  ember: (g, x, y, a, color) => {
    g.lineStyle(3, color, 0.45);
    g.lineBetween(x, y, x - Math.cos(a) * 9, y - Math.sin(a) * 9);
    g.fillStyle(color);
    g.fillCircle(x, y, 3.5);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(x, y, 1.5);
  },
  glob: (g, x, y, a, color) => {
    g.fillStyle(color, 0.35);
    g.fillCircle(x, y, 7);
    g.fillStyle(color);
    g.fillEllipse(x, y, 9, 7);
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(x - Math.cos(a) * 1.5, y - Math.sin(a) * 1.5 - 1.5, 1.3);
  },
  orb: (g, x, y, _a, color) => {
    g.fillStyle(color, 0.25);
    g.fillCircle(x, y, 8);
    g.fillStyle(color);
    g.fillCircle(x, y, 4);
    g.fillStyle(0xffffff);
    g.fillCircle(x, y, 1.8);
  },
  tracer: (g, x, y, a, color) => {
    g.lineStyle(2, color, 0.5);
    g.lineBetween(x, y, x - Math.cos(a) * 10, y - Math.sin(a) * 10);
    g.fillStyle(0xffffff);
    g.fillCircle(x, y, 3);
  },
};
export function drawProjectile(g: Ink, style: ProjectileStyle | undefined, x: number, y: number, a: number, color: number) {
  PROJECTILES[style ?? "tracer"](g, x, y, a, color);
}
