import type { Ink } from "./render/shapes";
import { mulberry32 } from "./render/terrain-themes/kit";
import * as O from "./render/terrain-themes/outpost-props";
import * as L from "./render/terrain-themes/lock-props";
// Dev-only prop sheets for `/gallery.html?terrain&props` (`terrain-review.ts`): every prop of a theme on its own tile,
// shadow first, so a prop can be judged at a glance. One list per theme that has one.

export interface SheetItem {
  label: string;
  /** Tile width in cells (landmarks take two). */
  span?: number;
  shadow: (g: Ink, gx: number, gy: number) => void;
  draw: (g: Ink, gx: number, gy: number) => void;
}
/** Draws a landmark (built around 0, 0 at full 2×2 size) at (gx, gy) shrunk by k. */
const at = (g: Ink, gx: number, gy: number, k: number, draw: () => void) => {
  g.save();
  g.translateCanvas(gx, gy);
  g.scaleCanvas(k, k);
  draw();
  g.restore();
};
const r = (n: number) => mulberry32(n);
export const SHEETS: Partial<Record<string, SheetItem[]>> = {
  outpost: [
    ...[1, 2, 3].map((n) => {
      const c = O.cratesOf(r(100 + n));
      return { label: "crates", shadow: (g: Ink, x: number, y: number) => c.forEach((q) => O.crateShadow(g, x, y, q)), draw: (g: Ink, x: number, y: number) => O.drawCrates(g, x, y, c) };
    }),
    ...[1, 2].map((n) => {
      const d = O.drumsOf(r(200 + n));
      return { label: "drums", shadow: (g: Ink, x: number, y: number) => O.drumsShadow(g, x, y, d), draw: (g: Ink, x: number, y: number) => O.drawDrums(g, x, y, d) };
    }),
    ...[1, 2].map((n) => {
      const w = O.sandbagsOf(r(300 + n));
      return { label: "sandbags", shadow: (g: Ink, x: number, y: number) => O.sandbagsShadow(g, x, y, w), draw: (g: Ink, x: number, y: number) => O.drawSandbags(g, x, y, w) };
    }),
    (() => {
      const b = O.barriersOf(r(401));
      return { label: "barriers", shadow: (g: Ink, x: number, y: number) => O.barriersShadow(g, x, y, b), draw: (g: Ink, x: number, y: number) => O.drawBarriers(g, x, y, b) };
    })(),
    { label: "mast", shadow: (g, x, y) => O.mastShadow(g, x, y), draw: (g, x, y) => O.drawMast(g, x, y, 0.8) },
    ...[0.2, Math.PI - 0.35].map((a) => {
      const c = { ...O.containerOf(r(500)), a };
      return { label: "container", shadow: (g: Ink, x: number, y: number) => O.containerShadow(g, x, y, c), draw: (g: Ink, x: number, y: number) => O.drawContainer(g, x, y, c) };
    }),
    { label: "generator", shadow: (g, x, y) => O.generatorShadow(g, x, y, 0.5), draw: (g, x, y) => O.drawGenerator(g, x, y, 0.5) },
    { label: "hedgehog", shadow: (g, x, y) => O.hedgehogShadow(g, x, y), draw: (g, x, y) => O.drawHedgehog(g, x, y, 0.4) },
    { label: "fence", shadow: (g, x, y) => O.fenceShadow(g, x - 26, y, x + 26, y), draw: (g, x, y) => O.drawFence(g, x - 26, y, x + 26, y) },
    { label: "watchtower", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => O.watchtowerShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => O.drawWatchtower(g)) },
    { label: "helipad", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => O.helipadShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => O.drawHelipad(g)) },
  ],
  lock: [
    ...[1, 2, 3].map((n) => {
      const m = L.mooringOf(r(600 + n));
      return { label: "mooring", shadow: (g: Ink, x: number, y: number) => L.mooringShadow(g, x, y, m), draw: (g: Ink, x: number, y: number) => L.drawMooring(g, x, y, m) };
    }),
    { label: "capstan", shadow: (g, x, y) => L.capstanShadow(g, x, y, 0.6), draw: (g, x, y) => L.drawCapstan(g, x, y, 0.6) },
    ...[1, 2].map((n) => {
      const p = L.pipesOf(r(700 + n));
      return { label: "pipes", shadow: (g: Ink, x: number, y: number) => L.pipesShadow(g, x, y, p), draw: (g: Ink, x: number, y: number) => L.drawPipes(g, x, y, p) };
    }),
    ...[1, 2].map((n) => {
      const p = L.palletsOf(r(800 + n));
      return { label: "pallets", shadow: (g: Ink, x: number, y: number) => L.palletsShadow(g, x, y, p), draw: (g: Ink, x: number, y: number) => L.drawPallets(g, x, y, p) };
    }),
    { label: "cylinders", shadow: (g, x, y) => L.cylindersShadow(g, x, y, 0.2), draw: (g, x, y) => L.drawCylinders(g, x, y, 0.2) },
    { label: "lantern", shadow: (g, x, y) => L.lanternShadow(g, x, y), draw: (g, x, y) => L.drawLantern(g, x, y) },
    { label: "kiosk", shadow: (g, x, y) => L.kioskShadow(g, x, y, 0.3), draw: (g, x, y) => L.drawKiosk(g, x, y, 0.3) },
    { label: "fender", shadow: () => undefined, draw: (g, x, y) => L.fender(g, x, y - 10) },
    { label: "barge", span: 2, shadow: (g, x, y) => L.bargeShadow(g, x, y), draw: (g, x, y) => L.drawBarge(g, x, y) },
    { label: "crane", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => L.craneShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => L.drawCrane(g)) },
    { label: "control tower", span: 2, shadow: (g, x, y) => at(g, x, y, 0.75, () => L.controlTowerShadow(g)), draw: (g, x, y) => at(g, x, y, 0.75, () => L.drawControlTower(g)) },
  ],
};
