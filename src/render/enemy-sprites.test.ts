import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { Game } from "../core/game";
import { makeEnemy } from "../core/test-helpers";
import type { EnemyId } from "../core/types";
import { statusFlags, type StatusFlags } from "../systems/status";
import { traitFlags, type TraitFlags } from "../systems/traits";
import { DEPTH } from "./depths";
import { ART_SCALE, artFor, ENEMY_ART } from "./enemy-art";
import { bodyMotion, TINTS } from "./enemy-appearance";
import { EnemyFeedback } from "./enemy-feedback";
import { drawEnemyLayers, EnemySprites, type EnemyLook, type SpriteImage } from "./enemy-sprites";
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
  /** The applied tint: undefined (art colours), a multiplied colour, or a fill. */
  tint: { color: number; fill: boolean } | undefined = undefined;
  tintCalls = 0;
  setTint(color: number) {
    this.tint = { color, fill: false };
    this.tintCalls++;
    return this;
  }
  setTintFill(color: number) {
    this.tint = { color, fill: true };
    this.tintCalls++;
    return this;
  }
  clearTint() {
    this.tint = undefined;
    this.tintCalls++;
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
function host(loaded = Object.values(ENEMY_ART).map((a) => a!.texture), canTint = true) {
  const images: StubImage[] = [],
    textures = new Set(loaded);
  const sprites = new EnemySprites({
    hasTexture: (key) => textures.has(key),
    canTint: () => canTint,
    createImage: (key) => {
      const image = new StubImage(key);
      images.push(image);
      return image as unknown as SpriteImage;
    },
  });
  return { sprites, images, live: () => images.filter((i) => !i.destroyed) };
}
const sim = new Game();
/** A type id without art: every content enemy has art now, so this stands for any later one that has none. */
const UNPAINTED = "unpainted" as EnemyId;
function unit(id: number, type: EnemyId, at: { x?: number; y?: number; heading?: number; traits?: Partial<TraitFlags>; status?: Partial<StatusFlags> } = {}): EnemyDrawContext {
  if (type === UNPAINTED) return { ...unit(id, "warpdrone", at), enemy: { ...makeEnemy(id, "warpdrone", 2, 3), type: UNPAINTED } };
  const e = makeEnemy(id, type, 2, 3);
  return enemyContext(at.x ?? 100, at.y ?? 120, 56, e, DEFAULT_CONTENT.enemies[type], at.heading ?? 0, { ...statusFlags(e, 0), ...at.status }, { ...traitFlags(sim, e), ...at.traits }, 0.5);
}
/** A Graphics stand-in that counts its calls and remembers the last one. */
function counter() {
  let calls = 0,
    last = "";
  const g: Ink = new Proxy({} as Ink, {
    get: (_, name) => () => {
      calls++;
      last = String(name);
      return g;
    },
  });
  return { g, calls: () => calls, last: () => last };
}
/** One battlefield frame through `drawEnemyLayers`, with the calls per layer and the overlay's last call. */
function frame(sprites: EnemySprites, units: EnemyDrawContext[], look?: EnemyLook) {
  const underlay = counter(),
    body = counter(),
    overlay = counter();
  drawEnemyLayers({ underlay: underlay.g, body: body.g, overlay: overlay.g }, sprites, units, look);
  return { underlay: underlay.calls(), body: body.calls(), overlay: overlay.calls(), lastOverlay: overlay.last() };
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
      tank = DEFAULT_CONTENT.enemies.tank.size * 56 * 2 * artFor("tank")!.scale!;
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
    sprites.sync([unit(2, UNPAINTED)]);
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
    const f = frame(sprites, [unit(1, UNPAINTED), unit(2, "tank")]);
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
    frame(mixed.sprites, [unit(1, "aegis"), unit(2, UNPAINTED)]);
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

describe("sprite tint and motion", () => {
  const damage = (enemy: number, amount: number) => ({ type: "damage" as const, at: { x: 0, y: 0 }, amount, enemy });
  it("flashes white on a hit, falls back to the status tint and clears it when the status ends", () => {
    const { sprites, images } = host(),
      look = { now: 1, feedback: new EnemyFeedback() },
      slowed = unit(1, "tank", { status: { slowed: true } });
    sprites.sync([slowed], look);
    expect(images[0].tint).toEqual({ color: TINTS.slowed, fill: false });
    look.feedback.consume([damage(1, 400)], 1.01);
    look.now = 1.01;
    sprites.sync([slowed], look);
    expect(images[0].tint).toEqual({ color: 0xffffff, fill: true });
    look.now = 1.5;
    sprites.sync([slowed], look);
    expect(images[0].tint).toEqual({ color: TINTS.slowed, fill: false });
    const calls = images[0].tintCalls;
    sprites.sync([slowed], look);
    // An unchanged tint is not set again.
    expect(images[0].tintCalls).toBe(calls);
    sprites.sync([unit(1, "tank")], look);
    expect(images[0].tint).toBeUndefined();
    expect(images).toHaveLength(1);
  });

  it("hides stealthed and burrowed bodies whatever their tint, and shows them untinted once the status is gone", () => {
    const { sprites, images } = host(),
      look = { now: 1, feedback: new EnemyFeedback() };
    sprites.sync([unit(1, "drone", { status: { burning: true } })], look);
    look.feedback.consume([damage(1, 400)], 1);
    sprites.sync([unit(1, "drone", { status: { burning: true }, traits: { stealth: true } })], look);
    expect(images[0].visible).toBe(false);
    expect(sprites.isRendering(1)).toBe(false);
    look.now = 2;
    sprites.sync([unit(1, "drone", { traits: { burrowed: true } })], look);
    expect(images[0].visible).toBe(false);
    sprites.sync([unit(1, "drone")], look);
    expect(images[0]).toMatchObject({ visible: true, tint: undefined });
  });

  it("derives position, size and rotation from the context each frame, without accumulating", () => {
    const { sprites, images } = host(),
      look = { now: 0, feedback: new EnemyFeedback() },
      c = unit(3, "glider", { heading: 1 }),
      base = c.r * 2 * artFor("glider")!.scale!;
    for (const now of [0.3, 1.7, 0.3]) {
      look.now = now;
      sprites.sync([c], look);
      const m = bodyMotion(c, now);
      // Gliders keep their unlifted position plus the hover; the context itself is untouched.
      expect(images[0]).toMatchObject({ x: 100, rotation: 1 });
      expect(images[0].y).toBeCloseTo(120 + m.dy);
      expect(images[0].width).toBeCloseTo(base * m.scale);
    }
    const first = { ...images[0] };
    sprites.sync([c], look);
    expect(images[0]).toMatchObject({ x: first.x, y: first.y, width: first.width });
    expect([c.x, c.y]).toEqual([100, 120]);
    // A leaping walker keeps the 4 px lift under its hover.
    look.now = 0.8;
    const leap = unit(4, "runner", { traits: { leaping: true } });
    sprites.sync([leap], look);
    expect(images[1].y).toBeCloseTo(116 + bodyMotion(leap, 0.8).dy);
  });

  it("sets worm art back along the heading so it covers the trailing chain", () => {
    const { sprites, images } = host(),
      c = unit(1, "sparkworm", { heading: Math.PI / 2 });
    sprites.sync([c]);
    expect(images[0].x).toBeCloseTo(100);
    expect(images[0].y).toBeCloseTo(120 - artFor("sparkworm")!.shift! * c.r);
  });

  it("drops the procedural tentacles under painted art and keeps markers and the HP bar on top of the accents", () => {
    const look = { now: 0.4, feedback: new EnemyFeedback() },
      painted = frame(host().sprites, [unit(1, "jelly", { status: { burning: true, stunned: true } })], look),
      procedural = frame(host([]).sprites, [unit(1, "jelly", { status: { burning: true, stunned: true } })], look);
    expect(painted.underlay).toBeLessThan(procedural.underlay);
    expect(painted.body).toBe(0);
    expect(procedural.body).toBeGreaterThan(0);
    expect(painted.lastOverlay).toBe("fillRect");
    expect(procedural.lastOverlay).toBe("fillRect");
  });

  it("draws the hit flash on the overlay when the renderer cannot tint sprites", () => {
    const overlayCalls = (canTint: boolean) => {
      const look = { now: 1, feedback: new EnemyFeedback() },
        { sprites } = host(undefined, canTint);
      look.feedback.consume([damage(1, 400)], 1);
      return frame(sprites, [unit(1, "tank")], look).overlay;
    };
    expect(overlayCalls(false)).toBeGreaterThan(overlayCalls(true));
  });

  it("clears tints and images together on reset", () => {
    const { sprites, live } = host(),
      look = { now: 1, feedback: new EnemyFeedback() };
    look.feedback.consume([damage(1, 400)], 1);
    sprites.sync([unit(1, "boss")], look);
    sprites.reset();
    look.feedback.reset();
    expect(live()).toHaveLength(0);
    expect(look.feedback.flash(1, 1, 1000)).toBe(0);
  });
});
