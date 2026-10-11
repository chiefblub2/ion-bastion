import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { Game } from "../core/game";
import { makeEnemy } from "../core/test-helpers";
import type { EnemyId } from "../core/types";
import { statusFlags } from "../systems/status";
import { traitFlags, type TraitFlags } from "../systems/traits";
import { DEPTH } from "./depths";
import { ART_SCALE, ENEMY_ART } from "./enemy-art";
import { drawEnemyLayers, EnemySprites, type SpriteImage } from "./enemy-sprites";
import { enemyContext, type EnemyDrawContext } from "./enemies";
import type { Ink } from "./shapes";

class StubImage {
  x = 0;
  y = 0;
  rotation = 0;
  width = 0;
  height = 0;
  visible = true;
  depth = 0;
  origin = [0, 0];
  destroyed = false;
  constructor(readonly texture: string) {}
  setOrigin(x: number, y: number) {
    this.origin = [x, y];
    return this;
  }
  setDepth(depth: number) {
    this.depth = depth;
    return this;
  }
  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
  setRotation(rotation: number) {
    this.rotation = rotation;
    return this;
  }
  setDisplaySize(width: number, height: number) {
    this.width = width;
    this.height = height;
    return this;
  }
  setVisible(visible: boolean) {
    this.visible = visible;
    return this;
  }
  destroy() {
    this.destroyed = true;
  }
}
/** A Phaser stand-in: `loaded` holds the textures in the cache. */
function host(loaded = Object.values(ENEMY_ART).map((a) => a.texture)) {
  const images: StubImage[] = [],
    textures = new Set(loaded);
  const sprites = new EnemySprites({
    hasTexture: (key) => textures.has(key),
    createImage: (key) => {
      const image = new StubImage(key);
      images.push(image);
      return image as unknown as SpriteImage;
    },
  });
  return { sprites, images, live: () => images.filter((i) => !i.destroyed) };
}
const sim = new Game();
function unit(id: number, type: EnemyId, at: { x?: number; y?: number; heading?: number; traits?: Partial<TraitFlags> } = {}): EnemyDrawContext {
  const e = makeEnemy(id, type, 2, 3);
  return enemyContext(at.x ?? 100, at.y ?? 120, 56, e, DEFAULT_CONTENT.enemies[type], at.heading ?? 0, statusFlags(e, 0), { ...traitFlags(sim, e), ...at.traits }, 0.5);
}
/** A Graphics stand-in that only counts its calls. */
function counter() {
  let calls = 0;
  const g: Ink = new Proxy({} as Ink, {
    get: () => () => {
      calls++;
      return g;
    },
  });
  return { g, calls: () => calls };
}
/** One battlefield frame through `drawEnemyLayers`, with the calls per layer. */
function frame(sprites: EnemySprites, units: EnemyDrawContext[]) {
  const underlay = counter(),
    body = counter(),
    overlay = counter();
  drawEnemyLayers({ underlay: underlay.g, body: body.g, overlay: overlay.g }, sprites, units);
  return { underlay: underlay.calls(), body: body.calls(), overlay: overlay.calls() };
}

describe("enemy sprites", () => {
  it("creates one centred image on first sight and reuses it while the enemy moves and turns", () => {
    const { sprites, images } = host();
    sprites.sync([unit(1, "tank")]);
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ texture: "enemy:tank", origin: [0.5, 0.5], depth: DEPTH.enemySprites, x: 100, y: 120, rotation: 0, visible: true });
    sprites.sync([unit(1, "tank", { x: 140, y: 90, heading: Math.PI / 2 })]);
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ x: 140, y: 90, rotation: Math.PI / 2 });
    expect(sprites.isRendering(1)).toBe(true);
  });

  it("sizes the art from the body radius, never the file size", () => {
    const { sprites, images } = host();
    sprites.sync([unit(1, "drone"), unit(2, "tank")]);
    const drone = DEFAULT_CONTENT.enemies.drone.size * 56 * 2 * ART_SCALE,
      tank = DEFAULT_CONTENT.enemies.tank.size * 56 * 2 * ENEMY_ART.tank.scale;
    expect(images[0].width).toBeCloseTo(drone);
    expect(images[0].height).toBeCloseTo(drone);
    expect(images[1].width).toBeCloseTo(tank);
  });

  it("lifts a walker drawn as flying like the procedural body, and drops it back on landing", () => {
    const { sprites, images } = host();
    sprites.sync([unit(1, "runner", { traits: { leaping: true } })]);
    expect(images[0].y).toBe(116);
    sprites.sync([unit(1, "runner")]);
    expect(images[0].y).toBe(120);
    // Gliders are never lifted: their distant shadow shows the height.
    sprites.sync([unit(2, "glider")]);
    expect(images[1].y).toBe(120);
  });

  it("hides the sprite of an unrevealed stealth unit and shows the same image once revealed", () => {
    const { sprites, images } = host();
    sprites.sync([unit(1, "drone", { traits: { stealth: true } })]);
    expect(images).toHaveLength(0);
    expect(sprites.isRendering(1)).toBe(false);
    sprites.sync([unit(1, "drone", { traits: { stealth: true, revealed: true } })]);
    sprites.sync([unit(1, "drone", { traits: { stealth: true } })]);
    expect(images[0].visible).toBe(false);
    expect(sprites.isRendering(1)).toBe(false);
    sprites.sync([unit(1, "drone", { traits: { stealth: true, revealed: true }, x: 130 })]);
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ visible: true, x: 130 });
  });

  it("hands a burrowed unit back to its procedural body and the mound", () => {
    const { sprites, images } = host();
    sprites.sync([unit(1, "runner")]);
    const burrowed = frame(sprites, [unit(1, "runner", { traits: { burrowed: true } })]);
    expect(images[0].visible).toBe(false);
    expect(sprites.isRendering(1)).toBe(false);
    expect(burrowed.body).toBeGreaterThan(0);
    sprites.sync([unit(1, "runner")]);
    expect(images).toHaveLength(1);
    expect(images[0].visible).toBe(true);
  });

  it("destroys the images of enemies that left, and never keeps another type's texture on a reused id", () => {
    const { sprites, images, live } = host();
    sprites.sync([unit(1, "drone"), unit(2, "boss")]);
    sprites.sync([unit(2, "boss")]);
    expect(images[0].destroyed).toBe(true);
    expect(live()).toHaveLength(1);
    sprites.sync([unit(2, "aegis")]);
    expect(images[1].destroyed).toBe(true);
    expect(live().map((i) => i.texture)).toEqual(["enemy:aegis"]);
    // Same id, now a type without art: no image at all.
    sprites.sync([unit(2, "warpdrone")]);
    expect(live()).toHaveLength(0);
    sprites.sync([]);
    expect(sprites.size).toBe(0);
  });

  it("destroys everything on reset (new game state, scene shutdown)", () => {
    const { sprites, live } = host();
    sprites.sync([unit(1, "drone"), unit(2, "glider", { traits: { stealth: true, revealed: true } })]);
    sprites.sync([unit(1, "drone"), unit(2, "glider", { traits: { stealth: true } })]);
    sprites.reset();
    expect(live()).toHaveLength(0);
    expect(sprites.size).toBe(0);
    expect(sprites.isRendering(1)).toBe(false);
  });
});

describe("procedural fallback", () => {
  it("draws the procedural body for unpainted types and for art whose texture failed to load", () => {
    const { sprites, images } = host(["enemy:drone"]);
    const f = frame(sprites, [unit(1, "warpdrone"), unit(2, "tank")]);
    expect(images).toHaveLength(0);
    expect(sprites.isRendering(1) || sprites.isRendering(2)).toBe(false);
    expect(f.body).toBeGreaterThan(0);
    expect(f.underlay).toBeGreaterThan(0);
    expect(f.overlay).toBeGreaterThan(0);
  });

  it("replaces the procedural body with a loaded sprite but keeps underlay and overlay", () => {
    const { sprites, images } = host();
    const f = frame(sprites, [unit(1, "aegis")]);
    expect(images).toHaveLength(1);
    expect(f.body).toBe(0);
    expect(f.underlay).toBeGreaterThan(0);
    expect(f.overlay).toBeGreaterThan(0);
    // Mixed wave: exactly one body per enemy, sprite or procedural.
    const mixed = host();
    frame(mixed.sprites, [unit(1, "aegis"), unit(2, "warpdrone")]);
    expect(mixed.images).toHaveLength(1);
    expect([mixed.sprites.isRendering(1), mixed.sprites.isRendering(2)]).toEqual([true, false]);
  });
});

describe("layer depths", () => {
  it("orders underlay < procedural body < sprites < overlay < foreground < labels", () => {
    const chain = [DEPTH.terrain, DEPTH.ambient, DEPTH.towers, DEPTH.enemyUnderlay, DEPTH.enemyBody, DEPTH.enemySprites, DEPTH.enemyOverlay, DEPTH.foreground, DEPTH.labels];
    for (let i = 1; i < chain.length; i++) expect(chain[i]).toBeGreaterThan(chain[i - 1]);
    // The income labels have always floated at depth 10.
    expect(DEPTH.labels).toBe(10);
  });
});
