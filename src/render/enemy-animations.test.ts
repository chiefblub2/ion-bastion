import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { EnemyId } from "../core/types";
import { decodePng, measureArt, VISIBLE_ALPHA, type Png } from "../../scripts/png";
import { ANIMATION_BOUNDS } from "./enemy-animation-bounds";
import {
  allClips,
  ANIMATION_CELL,
  ANIMATION_STATES,
  animationArt,
  animationsFor,
  clipDuration,
  clipError,
  clipFrame,
  clipUrl,
  ENEMY_ANIMATIONS,
  type AnimationClip,
} from "./enemy-animations";
import { artFor } from "./enemy-art";

const STARTERS = ["drone", "runner", "tank", "boss", "glider", "aegis"];
const ROOT = new URL("../../", import.meta.url);
const sheet = (clip: AnimationClip) => decodePng(readFileSync(new URL(`public/${clip.path}`, ROOT)));
function cell(png: Png, i: number, w: number): Png {
  const rgba = new Uint8Array(w * png.height * 4);
  for (let y = 0; y < png.height; y++) rgba.set(png.rgba.subarray((y * png.width + i * w) * 4, (y * png.width + i * w + w) * 4), y * w * 4);
  return { ...png, width: w, rgba };
}

describe("animation registry", () => {
  it("registers exactly the six starter types with all four states", () => {
    expect(Object.keys(ENEMY_ANIMATIONS).sort()).toEqual([...STARTERS].sort());
    for (const id of STARTERS as EnemyId[]) {
      expect(DEFAULT_CONTENT.enemies[id], id).toBeDefined();
      expect(artFor(id), `${id} needs static art as its fallback`).toBeDefined();
      for (const state of ANIMATION_STATES)
        expect(animationsFor(id)![state], `${id}/${state}`).toMatchObject({ texture: `enemy:${id}:${state}`, path: `assets/enemy-animations/${id}/${state}.png`, loop: state === "idle" || state === "move" });
    }
    expect(animationsFor("warpdrone")).toBeUndefined();
  });

  it("keeps texture keys unique, apart from the static art keys, and timings valid", () => {
    const keys = allClips().map((c) => c.texture);
    expect(new Set(keys).size).toBe(keys.length);
    for (const id of STARTERS as EnemyId[]) expect(keys).not.toContain(artFor(id)!.texture);
    for (const clip of allClips()) {
      expect(clipError(clip), clip.texture).toBeUndefined();
      expect(clip).toMatchObject({ frameWidth: ANIMATION_CELL, frameHeight: ANIMATION_CELL });
    }
    expect(clipError({ ...allClips()[0], fps: 0 })).toMatch(/fps/);
    expect(clipError({ ...allClips()[0], frames: 2.5 })).toMatch(/frames/);
    expect(clipError({ ...allClips()[0], frameHeight: 200 })).toMatch(/square/);
  });

  it("wraps loops, holds one-shots on their last frame and resolves URLs below the base path", () => {
    const loop = { frames: 8, fps: 10, loop: true },
      once = { frames: 4, fps: 14, loop: false };
    expect([0, 0.1, 0.79, 0.8, 1.25].map((t) => clipFrame(loop, t))).toEqual([0, 1, 7, 0, 4]);
    expect([0, 0.1, clipDuration(once), 9].map((t) => clipFrame(once, t))).toEqual([0, 1, 3, 3]);
    expect(clipFrame(loop, -1)).toBe(0);
    expect(clipFrame(loop, NaN)).toBe(0);
    expect(clipUrl(animationsFor("tank")!.idle!, "/game")).toBe("/game/assets/enemy-animations/tank/idle.png");
  });

  it("places animated bodies with the static tuning and the cells' own bounds", () => {
    for (const id of STARTERS as EnemyId[]) {
      const art = animationArt(id)!,
        stat = artFor(id)!;
      expect({ ...art, bounds: stat.bounds }).toEqual(stat);
      expect(art.bounds).toBe(ANIMATION_BOUNDS[id]);
    }
    expect(animationArt("warpdrone")).toBeUndefined();
  });
});

describe("animation sheets", () => {
  it("are PNG strips of their declared cells, padded to a power of two with empty cells, never blank or cut", () => {
    for (const clip of allClips()) {
      const png = sheet(clip),
        n = png.width / clip.frameWidth;
      expect(png.colorType, clip.texture).toBe(6);
      expect(png.height, clip.texture).toBe(clip.frameHeight);
      expect(Number.isInteger(n) && n >= clip.frames, clip.texture).toBe(true);
      expect(png.width & (png.width - 1), `${clip.texture} power of two`).toBe(0);
      for (let i = 0; i < n; i++) {
        const m = measureArt(cell(png, i, clip.frameWidth));
        if (i >= clip.frames) expect(m.coverage, `${clip.texture} padding ${i + 1}`).toBe(0);
        // A death clip may end almost empty; every other frame draws its body.
        else if (!(clip.texture.endsWith(":death") && i === clip.frames - 1)) expect(m.coverage, `${clip.texture} frame ${i + 1}`).toBeGreaterThan(0.1);
        if (i >= clip.frames) continue;
        const c = cell(png, i, clip.frameWidth),
          w = c.width;
        let edge = 0;
        for (let k = 0; k < w; k++) for (const [x, y] of [[k, 0], [k, w - 1], [0, k], [w - 1, k]]) if (c.rgba[(y * w + x) * 4 + 3] > VISIBLE_ALPHA) edge++;
        expect(m.transparent, `${clip.texture} frame ${i + 1} background`).toBeGreaterThan(0.2);
        // Glow and thrust may graze the cell edge; a cut body would run along it.
        expect(edge / (4 * w), `${clip.texture} frame ${i + 1} edge`).toBeLessThan(0.08);
      }
    }
  });

  it("keep the measured idle bounds current (scripts/audit-enemy-animations.ts -- --write)", () => {
    for (const id of STARTERS as EnemyId[]) {
      const clip = animationsFor(id)!.idle!,
        png = sheet(clip),
        u = { x0: Infinity, y0: Infinity, x1: 0, y1: 0 };
      for (let i = 0; i < clip.frames; i++) {
        const b = measureArt(cell(png, i, clip.frameWidth)).bounds;
        u.x0 = Math.min(u.x0, b.x0);
        u.y0 = Math.min(u.y0, b.y0);
        u.x1 = Math.max(u.x1, b.x1);
        u.y1 = Math.max(u.y1, b.y1);
      }
      const s = clip.frameWidth;
      expect(ANIMATION_BOUNDS[id], id).toEqual({ w: Number(((u.x1 - u.x0) / s).toFixed(4)), h: Number(((u.y1 - u.y0) / s).toFixed(4)), x: Number(((u.x0 + u.x1) / 2 / s - 0.5).toFixed(4)), y: Number(((u.y0 + u.y1) / 2 / s - 0.5).toFixed(4)) });
    }
  });

  it("hold the body still across loop frames (no pivot drift)", () => {
    for (const id of STARTERS as EnemyId[])
      for (const state of ["idle", "move"] as const) {
        const clip = animationsFor(id)![state]!,
          png = sheet(clip),
          centres = Array.from({ length: clip.frames }, (_, i) => measureArt(cell(png, i, clip.frameWidth)).center);
        for (let i = 0; i < centres.length; i++) {
          const a = centres[i],
            b = centres[(i + 1) % centres.length];
          expect(Math.hypot(a.x - b.x, a.y - b.y), `${id}/${state} frame ${i + 1}`).toBeLessThan(0.03);
        }
      }
  });

  it("match the supplied pack: every source sheet exists and divides into its declared cells", () => {
    const manifest = JSON.parse(readFileSync(new URL("assets-src/enemy-animations/manifest.json", ROOT), "utf8")) as {
      enemies: Record<string, { states: Record<string, { sheet: string; frameCount: number; frameWidth: number; frameHeight: number; fps: number; loop: boolean }> }>;
    };
    expect(Object.keys(manifest.enemies).sort()).toEqual([...STARTERS].sort());
    for (const [id, set] of Object.entries(manifest.enemies))
      for (const [state, m] of Object.entries(set.states)) {
        const png = decodePng(readFileSync(new URL(m.sheet, ROOT)));
        expect([png.width, png.height], `${id}/${state}`).toEqual([m.frameWidth * m.frameCount, m.frameHeight]);
        expect(animationsFor(id as EnemyId)![state as "idle"], `${id}/${state}`).toMatchObject({ fps: m.fps, loop: m.loop });
      }
  });
});
