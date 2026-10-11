import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { EnemyId } from "../core/types";
import { decodePng, islands, measureArt } from "../../scripts/png";
import { ART_BOUNDS } from "./enemy-art-bounds";
import { ART_SCALE, artEdge, artFor, artScale, artUrl, ENEMY_ART, SLENDER_BOOST, type EnemyArt } from "./enemy-art";

const ART_DIR = new URL("../../public/assets/enemies/", import.meta.url);
const files = readdirSync(ART_DIR).filter((f) => f.endsWith(".png")),
  painted = Object.entries(ENEMY_ART) as [EnemyId, EnemyArt][];

describe("enemy art registry", () => {
  it("registers every PNG under its exact enemy id, with a unique texture key", () => {
    expect(painted.map(([id]) => `${id}.png`).sort()).toEqual([...files].sort());
    for (const [id, art] of painted) {
      expect(DEFAULT_CONTENT.enemies[id], id).toBeDefined();
      expect(art).toMatchObject({ texture: `enemy:${id}`, path: `assets/enemies/${id}.png` });
      expect(artFor(id)).toBe(art);
    }
    const keys = painted.map(([, a]) => a.texture);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps the procedural body for enemies without art", () => {
    const unpainted = (Object.keys(DEFAULT_CONTENT.enemies) as EnemyId[]).filter((id) => !ENEMY_ART[id]);
    // Every enemy has art today; any later enemy without a PNG simply stays unregistered.
    for (const id of unpainted) expect(artFor(id)).toBeUndefined();
    expect(artFor("no-such-enemy" as EnemyId)).toBeUndefined();
  });

  it("keeps the tuning sane: scale, shift, angle and pose", () => {
    for (const [id, art] of painted) {
      const worm = DEFAULT_CONTENT.enemies[id].visual.shape === "worm";
      expect(Number.isFinite(artScale(art)), id).toBe(true);
      // The visible longest side, in body diameters: about the body for most art, the whole chain for worms.
      expect(artScale(art), id).toBeGreaterThanOrEqual(worm ? 1.5 : 1);
      expect(artScale(art), id).toBeLessThanOrEqual(worm ? 2.6 : 1.4);
      expect(Math.abs(art.angleOffset ?? 0), id).toBeLessThanOrEqual(Math.PI);
      expect(art.shift ?? 0, id).toBeGreaterThanOrEqual(0);
      expect(art.shift ?? 0, id).toBeLessThanOrEqual(2);
      // Only worm art trails behind its position, and a worm must follow the path (never stand upright).
      if (art.shift) expect([worm, art.pose], id).toEqual([true, "profile"]);
      expect([undefined, "profile", "upright"], id).toContain(art.pose);
    }
  });

  it("derives the displayed size from the visible bounds, not the transparent canvas", () => {
    for (const [id, art] of painted) {
      const b = art.bounds!;
      // Canvas edge × visible share = the visible longest side.
      expect(artEdge(art) * Math.max(b.w, b.h), id).toBeCloseTo(artScale(art), 10);
    }
    const plain = { texture: "t", path: "p" };
    expect(artScale({ ...plain, bounds: { w: 0.8, h: 0.7, x: 0, y: 0 } })).toBe(ART_SCALE);
    // Slender art is shown a little longer; an explicit scale always wins.
    expect(artScale({ ...plain, bounds: { w: 0.8, h: 0.3, x: 0, y: 0 } })).toBeCloseTo(ART_SCALE * SLENDER_BOOST);
    expect(artScale({ ...plain, scale: 1.25, bounds: { w: 0.8, h: 0.3, x: 0, y: 0 } })).toBe(1.25);
  });

  it("resolves URLs below the Vite base path", () => {
    const tank = artFor("tank")!;
    expect(artUrl(tank)).toBe(`${import.meta.env.BASE_URL}assets/enemies/tank.png`);
    expect(artUrl(tank, "/")).toBe("/assets/enemies/tank.png");
    expect(artUrl(tank, "/ion-bastion/")).toBe("/ion-bastion/assets/enemies/tank.png");
    expect(artUrl(tank, "/ion-bastion")).toBe("/ion-bastion/assets/enemies/tank.png");
  });
});

describe("enemy art files", () => {
  const images = painted.map(([id, art]) => [id, art, decodePng(readFileSync(new URL(art.path.replace("assets/enemies/", ""), ART_DIR)))] as const);

  it("are readable RGBA PNGs with real transparency: never empty, never on a background", () => {
    for (const [id, , png] of images) {
      expect(png.colorType, id).toBe(6);
      expect(png.width, id).toBeGreaterThan(0);
      expect(png.height, id).toBe(png.width);
      const m = measureArt(png);
      expect(m.coverage, id).toBeGreaterThan(0.08);
      // A background would leave no fully transparent pixels; the art itself covers at most half its canvas.
      expect(m.transparent, id).toBeGreaterThan(0.4);
      // Nothing touches the border, so nothing is clipped.
      expect(m.borderOpaque, id).toBe(0);
      expect(m.visibleWidth, id).toBeGreaterThan(0.3);
      expect(m.visibleHeight, id).toBeGreaterThan(0.3);
    }
  });

  it("carry no residue: every detached island beyond anti-aliasing specks is a reviewed part of the art", () => {
    // Detached parts of 60 px or more that belong to the art (its other islands are residue of the sheet).
    const parts: Partial<Record<EnemyId, number>> = { mender: 1 };
    for (const [id, , png] of images) {
      const large = islands(png).slice(1).filter((island) => island.area >= 60);
      expect(large.length, `${id}: ${large.map((i) => `${i.area} px at ${i.bounds.x0},${i.bounds.y0}`).join(", ")}`).toBe(parts[id] ?? 0);
    }
  });

  it("match the generated bounds table (scripts/audit-enemy-art.ts -- --write)", () => {
    for (const [id, art, png] of images) {
      const m = measureArt(png),
        b = ART_BOUNDS[id]!;
      expect(art.bounds, id).toBe(b);
      expect(b.w, id).toBeCloseTo(m.visibleWidth, 3);
      expect(b.h, id).toBeCloseTo(m.visibleHeight, 3);
      expect(b.x, id).toBeCloseTo(m.boundsCenter.x, 3);
      expect(b.y, id).toBeCloseTo(m.boundsCenter.y, 3);
    }
    expect(Object.keys(ART_BOUNDS).sort()).toEqual(painted.map(([id]) => id).sort());
  });
});
