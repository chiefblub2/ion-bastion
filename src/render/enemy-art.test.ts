import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { EnemyId } from "../core/types";
import { artFor, artUrl, ENEMY_ART, type EnemyArt } from "./enemy-art";

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

  it("points at transparent (RGBA) PNG files and keeps the tuning sane", () => {
    for (const [id, art] of painted) {
      const file = readFileSync(new URL(art.path.replace("assets/enemies/", ""), ART_DIR));
      expect(file.subarray(0, 8), id).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      expect(file.subarray(12, 16).toString()).toBe("IHDR");
      // Colour type 6: truecolour with alpha.
      expect(file[25], id).toBe(6);
      expect(art.scale ?? 1.3, id).toBeGreaterThan(1);
      expect(art.scale ?? 1.3, id).toBeLessThan(3);
      expect(Math.abs(art.angleOffset ?? 0), id).toBeLessThanOrEqual(Math.PI);
    }
  });

  it("resolves URLs below the Vite base path", () => {
    const tank = artFor("tank")!;
    expect(artUrl(tank)).toBe(`${import.meta.env.BASE_URL}assets/enemies/tank.png`);
    expect(artUrl(tank, "/")).toBe("/assets/enemies/tank.png");
    expect(artUrl(tank, "/ion-bastion/")).toBe("/ion-bastion/assets/enemies/tank.png");
    expect(artUrl(tank, "/ion-bastion")).toBe("/ion-bastion/assets/enemies/tank.png");
  });
});
