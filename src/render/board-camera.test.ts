import { describe, expect, it } from "vitest";
import { anchorView, clampView, fittedView, MAX_ZOOM, panView, snapCell, toScreen, toWorld } from "./board-camera";
const size = { width: 450, height: 300, worldWidth: 900, worldHeight: 600 };
describe("board camera", () => {
  it("maps the fitted board one to one and clamps zoom and centre", () => {
    expect(toWorld(fittedView(size), { x: 225, y: 150 }, size)).toEqual({ x: 450, y: 300 });
    expect(clampView({ zoom: 9, x: 0, y: 9999 }, size)).toEqual({ zoom: MAX_ZOOM, x: 150, y: 500 });
    expect(clampView({ zoom: 0.5, x: 10, y: 10 }, size)).toEqual(fittedView(size));
  });
  it("keeps the pinched point under the fingers and pans within the board", () => {
    const anchor = toWorld(fittedView(size), { x: 300, y: 100 }, size),
      view = anchorView(anchor, { x: 300, y: 100 }, 2, size);
    expect(toScreen(view, anchor, size).x).toBeCloseTo(300);
    expect(toScreen(view, anchor, size).y).toBeCloseTo(100);
    expect(panView(view, 10000, 0, size).x).toBe(225);
  });
  it("snaps a tap on a blocked cell to a buildable neighbour within reach", () => {
    const free = (x: number, y: number) => x === 2 && y === 1;
    expect(snapCell({ x: 108, y: 70 }, 56, 10, 10, free, 30)).toEqual({ x: 2, y: 1 });
    expect(snapCell({ x: 60, y: 70 }, 56, 10, 10, free, 30)).toEqual({ x: 1, y: 1 });
  });
});
