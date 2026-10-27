import { describe, expect, it } from "vitest";
import { ALTITUDE, type Camera, deckSpot, dragCamera, fitCamera, fromSphere, lerpCamera, occluded, outlineOnScreen, rotate, screenOf, slerp, spotOnScreen, surfaceSpot, toSphere } from "./globe";
const cam = (c: Partial<Camera> = {}): Camera => ({ lon: 0, lat: 0, r: 100, ox: 0, oy: 0, ...c });
describe("globe", () => {
  it("maps the plane onto the sphere and back", () => {
    for (const p of [
      { x: 100, y: 50 },
      { x: 37, y: 22 },
      { x: 180, y: 81 },
    ]) {
      const back = fromSphere(toSphere(p));
      expect(back.x).toBeCloseTo(p.x);
      expect(back.y).toBeCloseTo(p.y);
    }
    // The plane's middle faces the viewer; east is to the right, north up.
    expect(toSphere({ x: 100, y: 50 }).z).toBeCloseTo(1);
    expect(toSphere({ x: 150, y: 50 }).x).toBeCloseTo(1);
    expect(toSphere({ x: 100, y: 0 }).y).toBeCloseTo(1);
  });
  it("puts the faced point in the centre, its quarter turns on the rim and the far side behind", () => {
    const c = cam({ lon: 0.7, lat: 0.3 }),
      faced = toSphere({ x: 100 + 0.7 / ((2 * Math.PI) / 200), y: 50 - 0.3 / ((2 * Math.PI) / 200) }),
      at = screenOf(faced, c, 400, 300);
    expect(at.x).toBeCloseTo(200);
    expect(at.y).toBeCloseTo(150);
    expect(at.z).toBeCloseTo(1);
    const east = screenOf(toSphere({ x: 150, y: 50 }), cam(), 400, 300),
      north = screenOf(toSphere({ x: 100, y: 0 }), cam(), 400, 300);
    expect(east.x).toBeCloseTo(300);
    expect(north.y).toBeCloseTo(50);
    expect(screenOf(toSphere({ x: 0, y: 50 }), cam(), 400, 300).z).toBeCloseTo(-1);
  });
  it("floats a deck above its anchor, facing the viewer, hidden only while the globe stands in front of it", () => {
    const c = { x: 120, y: 30 },
      centre = deckSpot(c, c),
      east = spotOnScreen(deckSpot(c, { x: 130, y: 30 }), cam(), 400, 300),
      at = spotOnScreen(centre, cam(), 400, 300);
    expect(Math.hypot(centre.v.x, centre.v.y, centre.v.z)).toBeCloseTo(ALTITUDE);
    expect(east.x).toBeGreaterThan(at.x);
    expect(east.y).toBeCloseTo(at.y);
    expect(at.hidden).toBe(false);
    // Turned to the far side but out beside the disc, a point in orbit stays visible.
    expect(occluded({ x: 0.1, y: 0, z: -0.9 })).toBe(true);
    expect(occluded({ x: 1.2, y: 0, z: -0.3 })).toBe(false);
    expect(spotOnScreen(surfaceSpot({ x: 0, y: 50 }), cam(), 400, 300).hidden).toBe(true);
  });
  it("fits points or the whole globe centred into the padded view", () => {
    const pts = [toSphere({ x: 90, y: 45 }), toSphere({ x: 110, y: 55 })],
      pad = { top: 40, right: 10, bottom: 60, left: 10 },
      c = fitCamera(pts.map((v) => ({ v })), 0, 0, 600, 400, pad),
      s = pts.map((p) => screenOf(p, c, 600, 400));
    expect(Math.min(...s.map((p) => p.x))).toBeCloseTo(10);
    expect(Math.max(...s.map((p) => p.x))).toBeLessThanOrEqual(590.01);
    expect((Math.min(...s.map((p) => p.y)) + Math.max(...s.map((p) => p.y))) / 2).toBeCloseTo(40 + 150);
    const whole = fitCamera([], 0, 0, 600, 400, pad, { disc: 1.1 });
    expect(whole.r).toBeCloseTo(300 / 2.2);
    expect(whole.oy).toBeCloseTo(-10);
  });
  it("flies the short way round, zooms on a log scale and turns with a drag", () => {
    const a = cam({ lon: 3, r: 100 }),
      b = cam({ lon: -3, r: 400 }),
      mid = lerpCamera(a, b, 0.5);
    expect(Math.abs(mid.lon)).toBeGreaterThan(3);
    expect(mid.r).toBeCloseTo(200);
    expect(lerpCamera(a, b, 1).r).toBeCloseTo(400);
    const turned = dragCamera(cam(), 50, 0);
    expect(turned.lon).toBeCloseTo(-0.5);
    expect(dragCamera(cam(), 0, 1e4).lat).toBeCloseTo((70 * Math.PI) / 180);
  });
  it("slides hidden outline points onto the rim and drops an outline that turned away", () => {
    const ring = [toSphere({ x: 100, y: 50 }), toSphere({ x: 160, y: 50 }), toSphere({ x: 130, y: 30 })],
      out = outlineOnScreen(ring, cam(), 400, 300)!;
    expect(Math.hypot(out[1].x - 200, out[1].y - 150)).toBeCloseTo(100);
    const near = [toSphere({ x: 95, y: 50 }), toSphere({ x: 105, y: 50 }), toSphere({ x: 100, y: 45 })];
    expect(outlineOnScreen(near, cam({ lon: Math.PI }), 400, 300)).toBeNull();
    const mid = slerp(toSphere({ x: 100, y: 50 }), toSphere({ x: 150, y: 50 }), 0.5);
    expect(fromSphere(mid).x).toBeCloseTo(125);
  });
});
