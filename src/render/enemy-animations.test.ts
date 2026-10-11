import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { EnemyId } from "../core/types";
import { artSignature, decodePng, identify, measureArt, VISIBLE_ALPHA, type Png } from "../../scripts/png";
import { ANIMATION_BOUNDS } from "./enemy-animation-bounds";
import {
  allClips,
  allSheets,
  ANIMATION_CELL,
  ANIMATION_MANIFEST,
  ANIMATION_COLUMNS,
  ANIMATION_ROWS,
  ANIMATION_STATES,
  animationArt,
  animationsFor,
  clipDuration,
  clipError,
  clipFrame,
  clipUrl,
  ENEMY_ANIMATIONS,
  manifestClips,
  manifestTypes,
  missionAnimationTypes,
  sheetFrame,
  sheetKey,
  sheetPlan,
  type AnimationClip,
  type AnimationManifest,
} from "./enemy-animations";
import { artFor, artUrl } from "./enemy-art";

/** The Phase 5A types, which must keep working as more are added. */
const STARTERS = ["drone", "runner", "tank", "boss", "glider", "aegis"];
/** Every registered type: the manifest's enabled entries. */
const ANIMATED = Object.keys(ENEMY_ANIMATIONS) as EnemyId[];
const ROOT = new URL("../../", import.meta.url);
const sheet = (clip: Pick<AnimationClip, "path">) => decodePng(readFileSync(new URL(`public/${clip.path}`, ROOT)));
/** Sheet frame `f` (row by row) as an image of its own. */
function cell(png: Png, f: number, w: number): Png {
  const x0 = (f % ANIMATION_COLUMNS) * w,
    y0 = Math.floor(f / ANIMATION_COLUMNS) * w,
    rgba = new Uint8Array(w * w * 4);
  for (let y = 0; y < w; y++) rgba.set(png.rgba.subarray(((y0 + y) * png.width + x0) * 4, ((y0 + y) * png.width + x0 + w) * 4), y * w * 4);
  return { ...png, width: w, height: w, rgba };
}

describe("animation registry", () => {
  it("registers exactly the manifest's enabled types, the starters among them, each with static art and all four states", () => {
    expect(ANIMATED).toEqual(manifestTypes());
    expect(ANIMATED).toEqual(expect.arrayContaining(STARTERS));
    for (const id of ANIMATED) {
      expect(DEFAULT_CONTENT.enemies[id], id).toBeDefined();
      expect(artFor(id), `${id} needs static art as its fallback`).toBeDefined();
      for (const state of ANIMATION_STATES)
        expect(animationsFor(id)![state], `${id}/${state}`).toMatchObject({ texture: sheetKey(id), path: `assets/enemy-animations/${id}.png`, start: ANIMATION_STATES.indexOf(state) * ANIMATION_COLUMNS, loop: state === "idle" || state === "move" });
    }
    expect(animationsFor("warpdrone")).toBeUndefined();
  });

  it("reads clips from the manifest: defaults, per-enemy overrides, dropped states and disabled entries", () => {
    const pack: AnimationManifest = {
      ...ANIMATION_MANIFEST,
      enemies: { drone: { sheet: "a.png", animations: { hurt: { fps: 20 }, death: null } }, tank: { sheet: "b.png", disabled: "wrong artwork" } },
    };
    const clips = manifestClips(pack.enemies.drone, pack);
    expect(clips.hurt).toEqual({ row: 2, frames: 4, fps: 20, loop: false });
    expect(clips.idle).toEqual({ row: 0, frames: 8, fps: 8, loop: true });
    expect(clips.death).toBeUndefined();
    expect(manifestTypes(pack)).toEqual(["drone"]);
  });

  it("loads only the sheets a mission can field, its split and brood offspring included, and releases the rest", () => {
    const content = {
        enemies: {
          ...DEFAULT_CONTENT.enemies,
          mother: { ...DEFAULT_CONTENT.enemies.drone, id: "mother", traits: [{ kind: "brood", type: "egg", every: 2 }] },
          egg: { ...DEFAULT_CONTENT.enemies.drone, id: "egg", traits: [{ kind: "splitOnDeath", type: "wolf", count: 2 }] },
        },
      } as unknown as typeof DEFAULT_CONTENT,
      mission = { waves: [{ bonus: 0, groups: [{ type: "mother" as EnemyId, count: 1, interval: 1, delay: 0 }, { type: "tank" as EnemyId, count: 1, interval: 1, delay: 0 }] }] };
    expect([...missionAnimationTypes(mission, content)].sort()).toEqual(["tank", "wolf"]);
    // Every mission fields at least one animated type and never the whole roster.
    for (const m of DEFAULT_CONTENT.missions) expect(missionAnimationTypes(m, DEFAULT_CONTENT).size, m.id).toBeLessThan(ANIMATED.length);
    const loaded = new Set([sheetKey("tank"), sheetKey("drone")]),
      plan = sheetPlan(new Set<EnemyId>(["tank", "wolf"]), (key) => loaded.has(key));
    expect(plan.load.map((s) => s.texture)).toEqual([sheetKey("wolf")]);
    expect(plan.release).toEqual([sheetKey("drone")]);
    expect(sheetPlan(undefined, (key) => loaded.has(key)).load).toHaveLength(ANIMATED.length - 2);
    expect(sheetPlan(undefined, (key) => loaded.has(key)).release).toEqual([]);
  });

  it("keeps one sheet per type, apart from the static art keys, and every clip valid on one row", () => {
    const keys = allSheets().map((s) => s.texture);
    expect(keys.sort()).toEqual(ANIMATED.map(sheetKey).sort());
    expect(new Set(keys).size).toBe(keys.length);
    for (const id of ANIMATED) expect(keys).not.toContain(artFor(id)!.texture);
    for (const clip of allClips()) {
      expect(clipError(clip), clip.texture).toBeUndefined();
      expect(clip).toMatchObject({ frameWidth: ANIMATION_CELL, frameHeight: ANIMATION_CELL });
    }
    expect(clipError({ ...allClips()[0], fps: 0 })).toMatch(/fps/);
    expect(clipError({ ...allClips()[0], frames: 2.5 })).toMatch(/frames/);
    expect(clipError({ ...allClips()[0], frameHeight: 200 })).toMatch(/square/);
    expect(clipError({ ...allClips()[0], start: 5, frames: 4 })).toMatch(/one row/);
    expect(sheetFrame(animationsFor("tank")!.death!, 3)).toBe(27);
  });

  it("wraps loops, holds one-shots on their last frame and resolves URLs below the base path", () => {
    const loop = { frames: 8, fps: 10, loop: true },
      once = { frames: 4, fps: 14, loop: false };
    expect([0, 0.1, 0.79, 0.8, 1.25].map((t) => clipFrame(loop, t))).toEqual([0, 1, 7, 0, 4]);
    expect([0, 0.1, clipDuration(once), 9].map((t) => clipFrame(once, t))).toEqual([0, 1, 3, 3]);
    expect(clipFrame(loop, -1)).toBe(0);
    expect(clipFrame(loop, NaN)).toBe(0);
    expect(clipUrl(animationsFor("tank")!.idle!, "/game")).toBe("/game/assets/enemy-animations/tank.png");
  });

  it("places animated bodies with the static tuning and the cells' own bounds", () => {
    for (const id of ANIMATED) {
      const art = animationArt(id)!,
        stat = artFor(id)!;
      expect({ ...art, bounds: stat.bounds }).toEqual(stat);
      expect(art.bounds).toBe(ANIMATION_BOUNDS[id]);
    }
    expect(animationArt("warpdrone")).toBeUndefined();
  });
});

describe("animation sheets", () => {
  it("are exactly the registered types' files", () => {
    const files = readdirSync(new URL("public/assets/enemy-animations/", ROOT)).sort();
    expect(files).toEqual(ANIMATED.map((id) => `${id}.png`).sort());
  });

  it("are grids of their declared cells, a power of two, never blank or cut, unused cells empty", () => {
    for (const id of ANIMATED) {
      const set = animationsFor(id)!,
        png = sheet(set.idle!),
        used = new Set(ANIMATION_STATES.flatMap((s) => Array.from({ length: set[s]!.frames }, (_, i) => sheetFrame(set[s]!, i))));
      expect(png.colorType, id).toBe(6);
      expect([png.width, png.height], id).toEqual([ANIMATION_COLUMNS * ANIMATION_CELL, ANIMATION_ROWS * ANIMATION_CELL]);
      expect(png.width & (png.width - 1) || png.height & (png.height - 1), `${id} power of two`).toBe(0);
      for (let f = 0; f < ANIMATION_COLUMNS * ANIMATION_ROWS; f++) {
        const c = cell(png, f, ANIMATION_CELL),
          m = measureArt(c),
          w = ANIMATION_CELL;
        if (!used.has(f)) {
          expect(m.coverage, `${id} unused cell ${f}`).toBe(0);
          continue;
        }
        // A death clip breaks apart over its second half and may end empty; every other frame draws its body.
        const death = f - sheetFrame(set.death!, 0);
        if (death < set.death!.frames / 2) expect(m.coverage, `${id} frame ${f}`).toBeGreaterThan(0.1);
        else if (death < set.death!.frames - 1) expect(m.coverage, `${id} frame ${f}`).toBeGreaterThan(0.002);
        let edge = 0;
        for (let k = 0; k < w; k++) for (const [x, y] of [[k, 0], [k, w - 1], [0, k], [w - 1, k]]) if (c.rgba[(y * w + x) * 4 + 3] > VISIBLE_ALPHA) edge++;
        // Soft glow fades out over alpha 1–16, so the background is what is not visibly drawn.
        expect(m.coverage, `${id} frame ${f} background`).toBeLessThan(0.8);
        // Glow and thrust may graze the cell edge; a cut body would run along it.
        expect(edge / (4 * w), `${id} frame ${f} edge`).toBeLessThan(0.08);
      }
    }
  });

  it("keep the measured idle bounds current (scripts/audit-enemy-animations.ts -- --write)", () => {
    for (const id of ANIMATED) {
      const clip = animationsFor(id)!.idle!,
        png = sheet(clip),
        u = { x0: Infinity, y0: Infinity, x1: 0, y1: 0 };
      for (let i = 0; i < clip.frames; i++) {
        const b = measureArt(cell(png, sheetFrame(clip, i), clip.frameWidth)).bounds;
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
    for (const id of ANIMATED)
      for (const state of ["idle", "move"] as const) {
        const clip = animationsFor(id)![state]!,
          png = sheet(clip),
          centres = Array.from({ length: clip.frames }, (_, i) => measureArt(cell(png, sheetFrame(clip, i), clip.frameWidth)).center);
        for (let i = 0; i < centres.length; i++) {
          const a = centres[i],
            b = centres[(i + 1) % centres.length];
          // Authored banking moves the alpha centre up to 0.05 (drone move) and a gallop up to 0.065 (wolf move: legs and
          // tail sweep); a sliding body (the raw sheets) moved 0.08–0.12.
          expect(Math.hypot(a.x - b.x, a.y - b.y), `${id}/${state} frame ${i + 1}`).toBeLessThan(0.07);
        }
      }
  });

  it("match the supplied pack (manifest version 2): one grid per type, the registry's rows and timing", () => {
    const manifest = ANIMATION_MANIFEST;
    expect(manifest.version).toBe(2);
    expect([manifest.columns, manifest.rows]).toEqual([ANIMATION_COLUMNS, ANIMATION_ROWS]);
    expect(JSON.parse(readFileSync(new URL("assets-src/enemy-animations/manifest.json", ROOT), "utf8"))).toEqual(manifest);
    for (const [id, entry] of Object.entries(manifest.enemies)) {
      expect(DEFAULT_CONTENT.enemies[id as EnemyId], `${id} is an enemy type`).toBeDefined();
      expect(entry.sheet, id).toBe(`assets-src/enemy-animations/${id}.png`);
      const png = decodePng(readFileSync(new URL(entry.sheet, ROOT)));
      expect([png.width, png.height], id).toEqual([manifest.frameWidth * manifest.columns, manifest.frameHeight * manifest.rows]);
      if (entry.disabled) {
        expect(animationsFor(id as EnemyId), `${id} is disabled`).toBeUndefined();
        continue;
      }
      for (const [state, a] of Object.entries(manifestClips(entry)))
        expect(animationsFor(id as EnemyId)![state as "idle"], `${id}/${state}`).toMatchObject({ start: a.row * manifest.columns, frames: a.frames, fps: a.fps, loop: a.loop });
    }
  });

  it("show their own enemy: the idle frames look most like its static art of the whole roster", () => {
    // The first pack shipped ten sheets under each other's names (ant held the wolf, cog the pebble, …).
    const statics = new Map(
      Object.keys(DEFAULT_CONTENT.enemies).flatMap((id) => {
        const art = artFor(id as EnemyId);
        return art ? [[id, artSignature(decodePng(readFileSync(new URL(`public/${artUrl(art, "")}`, ROOT))))] as const] : [];
      }),
    );
    for (const id of ANIMATED) {
      const clip = animationsFor(id)!.idle!,
        png = sheet(clip);
      expect(identify([0, 2, 4, 6].map((i) => cell(png, sheetFrame(clip, i), clip.frameWidth)), statics)[0].id, id).toBe(id);
    }
  });

  it("carry no stray specks around the body (grid-line remnants would inflate the measured bounds)", () => {
    for (const id of ANIMATED)
      for (const state of ["idle", "move"] as const) {
        const clip = animationsFor(id)![state]!,
          png = sheet(clip);
        for (let i = 0; i < clip.frames; i++) {
          const c = cell(png, sheetFrame(clip, i), clip.frameWidth),
            solid = measureArt({ ...c, rgba: c.rgba.map((v, k) => (k % 4 === 3 && v < 128 ? 0 : v)) }).bounds,
            visible = measureArt(c).bounds;
          // Thrust and flame tails reach up to 44 px past the solid body; a speck far off reaches further.
          const reach = Math.max(solid.x0 - visible.x0, visible.x1 - solid.x1, solid.y0 - visible.y0, visible.y1 - solid.y1);
          expect(reach, `${id}/${state} frame ${i + 1}`).toBeLessThan(clip.frameWidth / 4);
        }
      }
  });
});
