import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { EnemyId } from "../core/types";
import { artFor, artUrl, ENEMY_ART } from "./enemy-art";

const PAINTED = ["drone", "runner", "tank", "boss", "glider", "aegis"] as const;

describe("enemy art registry", () => {
  it("maps the six painted enemies to their texture and file", () => {
    expect(Object.keys(ENEMY_ART).sort()).toEqual([...PAINTED].sort());
    for (const id of PAINTED) {
      expect(DEFAULT_CONTENT.enemies[id]).toBeDefined();
      expect(artFor(id)).toMatchObject({ texture: `enemy:${id}`, path: `assets/enemies/${id}.png` });
    }
    const keys = Object.values(ENEMY_ART).map((a) => a.texture);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("has no art for the other enemies", () => {
    const others = (Object.keys(DEFAULT_CONTENT.enemies) as EnemyId[]).filter((id) => !(PAINTED as readonly string[]).includes(id));
    expect(others.length).toBeGreaterThan(0);
    for (const id of others) expect(artFor(id)).toBeUndefined();
  });

  it("points at transparent (RGBA) PNG files in public/", () => {
    for (const art of Object.values(ENEMY_ART)) {
      const file = readFileSync(new URL(`../../public/${art.path}`, import.meta.url));
      expect(file.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      expect(file.subarray(12, 16).toString()).toBe("IHDR");
      // Colour type 6: truecolour with alpha.
      expect(file[25]).toBe(6);
    }
  });

  it("resolves URLs below the Vite base path", () => {
    expect(artUrl(ENEMY_ART.tank)).toBe(`${import.meta.env.BASE_URL}assets/enemies/tank.png`);
    expect(artUrl(ENEMY_ART.tank, "/")).toBe("/assets/enemies/tank.png");
    expect(artUrl(ENEMY_ART.tank, "/ion-bastion/")).toBe("/ion-bastion/assets/enemies/tank.png");
    expect(artUrl(ENEMY_ART.tank, "/ion-bastion")).toBe("/ion-bastion/assets/enemies/tank.png");
  });
});
