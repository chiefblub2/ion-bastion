import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import { Game } from "../core/game";
import { makeEnemy } from "../core/test-helpers";
import type { EnemyId } from "../core/types";
import { statusFlags, type StatusFlags } from "../systems/status";
import { traitFlags, type TraitFlags } from "../systems/traits";
import { DEPTH } from "./depths";
import { artEdge, artFor, artScale, ENEMY_ART, type EnemyArt } from "./enemy-art";
import { bodyMotion, TINTS } from "./enemy-appearance";
import { EnemyFeedback } from "./enemy-feedback";
import { allClips, animationArt, animationsFor, clipDuration, ENEMY_ANIMATIONS, sheetKey, type EnemyAnimationState } from "./enemy-animations";
import { drawEnemyLayers, EnemySprites, MAX_DYING, placeArt, type EnemyLook, type SpriteImage } from "./enemy-sprites";
import { bodyLift, enemyContext, type EnemyDrawContext } from "./enemies";
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
  /** Texture and frame changes after creation. */
  switches = 0;
  constructor(
    public texture: string,
    public frame?: number,
  ) {}
  setTexture(key: string, frame?: number) {
    this.texture = key;
    this.frame = frame;
    this.switches++;
    return this;
  }
  setFrame(frame: number) {
    this.frame = frame;
    this.switches++;
    return this;
  }
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
  flip = [false, false];
  setFlip(x: boolean, y: boolean) {
    this.flip = [x, y];
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
    createImage: (key, frame) => {
      const image = new StubImage(key, frame);
      images.push(image);
      return image as unknown as SpriteImage;
    },
  });
  return { sprites, images, textures, live: () => images.filter((i) => !i.destroyed) };
}
const sim = new Game();
/** A type id without art: every content enemy has art now, so this stands for any later one that has none. */
const UNPAINTED = "unpainted" as EnemyId;
function unit(id: number, type: EnemyId, at: { x?: number; y?: number; heading?: number; traits?: Partial<TraitFlags>; status?: Partial<StatusFlags> } = {}): EnemyDrawContext {
  if (type === UNPAINTED) return { ...unit(id, "warpdrone", at), enemy: { ...makeEnemy(id, "warpdrone", 2, 3), type: UNPAINTED } };
  const e = makeEnemy(id, type, 2, 3);
  return enemyContext(at.x ?? 100, at.y ?? 120, 56, e, DEFAULT_CONTENT.enemies[type], at.heading ?? 0, { ...statusFlags(e, 0), ...at.status }, { ...traitFlags(sim, e), ...at.traits }, 0.5);
}
/** World position of the centre of an image's visible art: the image centre plus the rotated bounds offset. */
function visibleCentre(image: StubImage, art: EnemyArt) {
  const raw = art.bounds ?? { x: 0, y: 0 },
    b = { x: image.flip[0] ? -raw.x : raw.x, y: image.flip[1] ? -raw.y : raw.y },
    cos = Math.cos(image.rotation),
    sin = Math.sin(image.rotation);
  return { x: image.x + (b.x * cos - b.y * sin) * image.width, y: image.y + (b.x * sin + b.y * cos) * image.width };
}
const near = (actual: { x: number; y: number }, x: number, y: number) => {
  expect(actual.x).toBeCloseTo(x, 6);
  expect(actual.y).toBeCloseTo(y, 6);
};
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
    expect(images[0]).toMatchObject({ texture: "enemy:tank", origin: [0.5, 0.5], depth: DEPTH.enemySprites, rotation: 0, visible: true });
    near(visibleCentre(images[0], artFor("tank")!), 100, 120);
    sprites.sync([unit(1, "tank", { x: 140, y: 90, heading: Math.PI / 2 })]);
    expect(images).toHaveLength(1);
    expect(images[0].rotation).toBe(Math.PI / 2);
    near(visibleCentre(images[0], artFor("tank")!), 140, 90);
    expect(sprites.isRendering(1)).toBe(true);
  });

  it("sizes the art from the body radius and its visible bounds, never the file size", () => {
    const { sprites, images } = host();
    sprites.sync([unit(1, "drone"), unit(2, "tank"), unit(3, "boss")]);
    for (const [i, type] of (["drone", "tank", "boss"] as const).entries()) {
      const art = artFor(type)!,
        b = art.bounds!,
        edge = DEFAULT_CONTENT.enemies[type].size * 56 * 2 * artEdge(art);
      expect(images[i].width).toBeCloseTo(edge);
      expect(images[i].height).toBeCloseTo(edge);
      // The visible longest side, not the canvas, is `artScale` body diameters (the boss PNG is twice as large).
      expect(edge * Math.max(b.w, b.h)).toBeCloseTo(DEFAULT_CONTENT.enemies[type].size * 56 * 2 * (art.scale ?? 1.1));
    }
  });

  it("lifts a walker drawn as flying like the procedural body, and drops it back on landing", () => {
    const { sprites, images } = host();
    const runner = artFor("runner")!;
    sprites.sync([unit(1, "runner", { traits: { leaping: true } })]);
    near(visibleCentre(images[0], runner), 100, 116);
    sprites.sync([unit(1, "runner")]);
    near(visibleCentre(images[0], runner), 100, 120);
    // Gliders are never lifted: their distant shadow shows the height.
    sprites.sync([unit(2, "glider")]);
    near(visibleCentre(images[1], artFor("glider")!), 100, 120);
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
    expect(images[0].visible).toBe(true);
    near(visibleCentre(images[0], artFor("drone")!), 130, 120);
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
      glider = artFor("glider")!,
      base = c.r * 2 * artEdge(glider);
    for (const now of [0.3, 1.7, 0.3]) {
      look.now = now;
      sprites.sync([c], look);
      const m = bodyMotion(c, now);
      // Gliders keep their unlifted position plus the hover; the context itself is untouched.
      expect(images[0].rotation).toBe(1);
      expect(images[0].width).toBeCloseTo(base * m.scale);
      near(visibleCentre(images[0], glider), 100, 120 + m.dy);
    }
    const first = { ...images[0] };
    sprites.sync([c], look);
    expect(images[0]).toMatchObject({ x: first.x, y: first.y, width: first.width });
    expect([c.x, c.y]).toEqual([100, 120]);
    // A leaping walker keeps the 4 px lift under its hover.
    look.now = 0.8;
    const leap = unit(4, "runner", { traits: { leaping: true } });
    sprites.sync([leap], look);
    expect(visibleCentre(images[1], artFor("runner")!).y).toBeCloseTo(116 + bodyMotion(leap, 0.8).dy);
  });

  it("sets worm art back along the heading so it covers the trailing chain", () => {
    const { sprites, images } = host(),
      c = unit(1, "sparkworm", { heading: Math.PI / 2 }),
      worm = artFor("sparkworm")!;
    sprites.sync([c]);
    // Heading down: the art trails up the screen, behind the head.
    near(visibleCentre(images[0], worm), 100, 120 - worm.shift! * c.r);
    sprites.sync([unit(1, "sparkworm", { heading: Math.PI })]);
    near(visibleCentre(images[0], worm), 100 + worm.shift! * c.r, 120);
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

describe("art placement", () => {
  const QUARTERS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  /** Visible centre of a placement, from its image centre and the mirrored, rotated bounds offset. */
  const centreOf = (at: ReturnType<typeof placeArt>, art: EnemyArt) => {
    const b = art.bounds!,
      bx = at.flipX ? -b.x : b.x,
      by = at.flipY ? -b.y : b.y;
    return { x: at.x + (bx * Math.cos(at.rotation) - by * Math.sin(at.rotation)) * at.size, y: at.y + (bx * Math.sin(at.rotation) + by * Math.cos(at.rotation)) * at.size };
  };

  it("keeps off-centre art on its position at every heading, so it never orbits while turning", () => {
    // Nautilus, warden and twin have visibly off-centre art in their canvases.
    for (const type of ["nautilus", "warden", "twin", "moth"] as const) {
      const art = artFor(type)!;
      expect(Math.hypot(art.bounds!.x, art.bounds!.y), type).toBeGreaterThan(0.05);
      for (const heading of QUARTERS) {
        const c = unit(1, type, { heading });
        // Flyers (moth) float `bodyLift` above their position, like the procedural body.
        near(centreOf(placeArt(c, art), art), 100, 120 - bodyLift(c));
      }
    }
  });

  it("turns top-down art with the heading, and lets an angleOffset correct art that does not face right", () => {
    for (const heading of QUARTERS) {
      const tank = placeArt(unit(1, "tank", { heading }), artFor("tank")!);
      expect([tank.rotation, tank.flipX, tank.flipY]).toEqual([heading, false, false]);
      expect(placeArt(unit(1, "monolith", { heading }), artFor("monolith")!).rotation).toBeCloseTo(heading + Math.PI / 2);
    }
  });

  it("mirrors a profile instead of turning it upside down while it moves left", () => {
    const art = artFor("salamander")!;
    for (const heading of QUARTERS) {
      const at = placeArt(unit(1, "salamander", { heading }), art);
      expect(at.rotation).toBe(heading);
      expect(at.flipY).toBe(heading === Math.PI);
      expect(at.flipX).toBe(false);
    }
  });

  it("keeps an upright pose standing, facing its last horizontal direction while it moves up or down", () => {
    const { sprites, images } = host(),
      art = artFor("warlord")!,
      step = (heading: number) => {
        sprites.sync([unit(1, "warlord", { heading })]);
        return { rotation: images[0].rotation, left: images[0].flip[0], y: images[0].flip[1] };
      };
    expect(step(0)).toEqual({ rotation: 0, left: false, y: false });
    // Down after moving right: still facing right.
    expect(step(Math.PI / 2)).toEqual({ rotation: 0, left: false, y: false });
    expect(step(Math.PI)).toEqual({ rotation: 0, left: true, y: false });
    // Up after moving left: still facing left, and the visible art stays on the position.
    expect(step(-Math.PI / 2)).toEqual({ rotation: 0, left: true, y: false });
    near(visibleCentre(images[0], art), 100, 120);
    expect(step(0).left).toBe(false);
  });

  it("is pure: the same context gives the same placement, and worm art trails along the heading", () => {
    const c = unit(1, "mole", { heading: -Math.PI / 2 }),
      art = artFor("mole")!;
    expect(placeArt(c, art)).toEqual(placeArt(c, art));
    // Moving up: the head at the position, the art's centre `shift` radii below it.
    near(centreOf(placeArt(c, art), art), 100, 120 + art.shift! * c.r);
    expect(placeArt(c, art).footprint).toMatchObject({ x: 100, heading: -Math.PI / 2 });
    expect(placeArt(c, art).footprint.y).toBeCloseTo(120 + art.shift! * c.r);
  });

  it("measures the shadow footprint from the visible art, turned with the body and left on the ground", () => {
    const { sprites } = host(),
      look = { now: 0.4, feedback: new EnemyFeedback() },
      tank = unit(1, "tank", { heading: Math.PI / 2 }),
      flyer = unit(2, "stormbird", { heading: 0 });
    sprites.sync([tank, flyer], look);
    const f = sprites.footprint(1)!,
      b = artFor("tank")!.bounds!;
    expect(f.heading).toBe(Math.PI / 2);
    expect(f.length / f.width).toBeCloseTo(b.w / b.h);
    // The visible length is the art's: artScale body diameters.
    expect(f.length).toBeCloseTo(tank.r * 2 * artScale(artFor("tank")!));
    // A hovering flyer's footprint stays on its position; the lift and hover move only the image.
    expect(sprites.footprint(2)).toMatchObject({ x: 100, y: 120 });
    // Hidden and burrowed units have no sprite and so no painted shadow.
    sprites.sync([unit(1, "tank", { traits: { burrowed: true } }), unit(2, "stormbird", { traits: { stealth: true } })], look);
    expect([sprites.footprint(1), sprites.footprint(2)]).toEqual([undefined, undefined]);
  });

  it("casts the painted shadow instead of the shape's, and no shadow at all for a burrowed unit", () => {
    const calls = (units: EnemyDrawContext[], loaded?: string[]) => frame(host(loaded).sprites, units).underlay;
    // A painted worm casts one oval instead of five segment shadows.
    expect(calls([unit(1, "sparkworm")])).toBeLessThan(calls([unit(1, "sparkworm")], []));
    expect(calls([unit(1, "tank", { traits: { burrowed: true } })])).toBe(calls([unit(1, "tank", { traits: { burrowed: true } })], []));
  });
});

describe("animated bodies", () => {
  const everything = [...Object.values(ENEMY_ART).map((a) => a!.texture), ...allClips().map((c) => c.texture)];
  const at = (c: EnemyDrawContext, distance: number): EnemyDrawContext => ({ ...c, enemy: { ...c.enemy, distance } });
  const look = (now: number, feedback = new EnemyFeedback()): EnemyLook => ({ now, feedback });
  /** The clip an image shows: its sheet and a frame in the clip's row. */
  const clipOf = (image: StubImage) => {
    const set = animationsFor(image.texture.split(":")[1] as EnemyId);
    if (!set || image.texture !== set.idle!.texture) return undefined;
    return (Object.entries(set) as [EnemyAnimationState, { start: number; frames: number }][]).find(([, c]) => image.frame! >= c.start && image.frame! < c.start + c.frames)?.[0];
  };
  const red = (type: EnemyId) => DEFAULT_CONTENT.enemies[type].color;

  it("creates one Image per animated unit and steps its frames without recreating it", () => {
    const { sprites, images } = host(everything),
      l = look(0);
    sprites.sync([at(unit(1, "drone"), 1)], l);
    expect(images).toHaveLength(1);
    expect(images[0].texture).toBe(sheetKey("drone"));
    expect(clipOf(images[0])).toBe("idle");
    const switches: number[] = [];
    for (let i = 1; i <= 20; i++) {
      l.now = i / 30;
      sprites.sync([at(unit(1, "drone"), 1 + i * 0.05)], l);
      switches.push(images[0].switches);
    }
    expect(images).toHaveLength(1);
    expect(clipOf(images[0])).toBe("move");
    // A repeated frame at the same time changes nothing.
    const before = images[0].switches;
    sprites.sync([at(unit(1, "drone"), 2)], l);
    sprites.sync([at(unit(1, "drone"), 2)], l);
    expect(images[0].switches).toBe(before);
    expect(switches.at(-1)).toBeLessThan(20);
  });

  it("places the animated body with the static tuning, sized to the same visible length", () => {
    const { sprites, images } = host(everything);
    // Without a look there is no idle breathing, so the size is the bare placement.
    sprites.sync([unit(1, "tank", { heading: 1 })]);
    const art = animationArt("tank")!,
      stat = artFor("tank")!;
    expect(art).toMatchObject({ scale: stat.scale });
    expect(images[0].width * Math.max(art.bounds!.w, art.bounds!.h)).toBeCloseTo(unit(1, "tank").r * 2 * artScale(stat), 1);
    expect(images[0].rotation).toBeCloseTo(1);
    // The visible centre sits on the unit, as for static art.
    near(visibleCentre(images[0], art), 100, 120);
  });

  it("falls back to the static art without the sheet, then to the procedural body", () => {
    // Clip by clip fallbacks (move ↔ idle, no hurt) are `animate`'s (enemy-animator.test.ts).
    const staticOnly = host(everything.filter((t) => t !== sheetKey("runner")));
    staticOnly.sprites.sync([unit(1, "runner")], look(0));
    expect(staticOnly.images[0]).toMatchObject({ texture: "enemy:runner", frame: undefined });
    const nothing = host(everything.filter((t) => !t.startsWith("enemy:runner")));
    const f = frame(nothing.sprites, [unit(1, "runner")], look(0));
    expect(nothing.images).toHaveLength(0);
    expect(f.body).toBeGreaterThan(0);
  });

  it("plays the hurt clip on a hit without the white flash, then returns to its loop with the status tint", () => {
    const { sprites, images } = host(everything),
      feedback = new EnemyFeedback(),
      c = unit(1, "aegis", { status: { slowed: true } });
    sprites.sync([c], look(0, feedback));
    feedback.recordDamage(1, 40, 0.5);
    sprites.sync([c], look(0.5, feedback));
    expect(clipOf(images[0])).toBe("hurt");
    expect(images[0].tint).toEqual({ color: TINTS.slowed, fill: false });
    sprites.sync([c], look(0.5 + clipDuration(animationsFor("aegis")!.hurt!) + 0.01, feedback));
    expect(clipOf(images[0])).toBe("idle");
    expect(images[0].tint).toEqual({ color: TINTS.slowed, fill: false });
    // A static body still flashes.
    const plain = host();
    plain.sprites.sync([c], look(0.5, feedback));
    expect(plain.images[0].tint?.fill).toBe(true);
  });

  it("keeps hidden and burrowed animated units invisible, and shows the same Image on its loop afterwards", () => {
    const { sprites, images } = host(everything),
      feedback = new EnemyFeedback();
    sprites.sync([unit(1, "glider")], look(0, feedback));
    feedback.recordDamage(1, 10, 0.2);
    sprites.sync([unit(1, "glider", { traits: { stealth: true } })], look(0.2, feedback));
    expect(images[0].visible).toBe(false);
    expect(sprites.isRendering(1)).toBe(false);
    sprites.sync([unit(1, "glider", { traits: { burrowed: true } })], look(0.25, feedback));
    expect(images[0].visible).toBe(false);
    // The hit taken while hidden plays no hurt clip later.
    sprites.sync([unit(1, "glider")], look(0.3, feedback));
    expect(images).toHaveLength(1);
    expect(images[0].visible).toBe(true);
    expect(clipOf(images[0])).toBe("idle");
  });

  it("plays one death clip at the last placement, then destroys it; paused frames hold", () => {
    const { sprites, images } = host(everything),
      c = unit(7, "boss", { heading: 0.7 });
    sprites.sync([c], look(1));
    const placed = { x: images[0].x, y: images[0].y, rotation: images[0].rotation, width: images[0].width };
    expect(sprites.retire(new Map([[7, { at: { x: 2, y: 3 }, color: red("boss") }]]), 1.02, red)).toEqual([7]);
    sprites.sync([], look(1.02));
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ texture: sheetKey("boss"), frame: animationsFor("boss")!.death!.start, destroyed: false, tint: undefined, ...placed });
    expect(sprites.size).toBe(0);
    expect(sprites.isRendering(7)).toBe(false);
    sprites.sync([], look(1.3));
    const paused = images[0].frame;
    sprites.sync([], look(1.3));
    expect(images[0].frame).toBe(paused);
    sprites.sync([], look(1.02 + clipDuration(animationsFor("boss")!.death!) + 1e-6));
    expect(images[0].destroyed).toBe(true);
    expect(sprites.dyingCount).toBe(0);
  });

  it("never plays a death for an escape, an unseen or hidden unit, a mismatched kill or a static body", () => {
    const { sprites, images } = host(everything);
    sprites.sync([unit(1, "tank"), unit(2, "drone", { traits: { stealth: true } }), unit(3, "runner")], look(0));
    // Unit 1 leaked (no kill), 2 was hidden, 3's kill colour belongs to another type, 9 was never drawn.
    const kills = new Map([
      [2, { at: { x: 0, y: 0 }, color: red("drone") }],
      [3, { at: { x: 0, y: 0 }, color: red("boss") }],
      [9, { at: { x: 0, y: 0 }, color: red("tank") }],
    ]);
    expect(sprites.retire(kills, 0.1, red)).toEqual([]);
    sprites.sync([], look(0.1));
    expect(images.every((i) => i.destroyed)).toBe(true);
    const staticOnly = host();
    staticOnly.sprites.sync([unit(1, "tank")], look(0));
    expect(staticOnly.sprites.retire(new Map([[1, { at: { x: 0, y: 0 }, color: red("tank") }]]), 0.1, red)).toEqual([]);
  });

  it("runs every type added after the starters through its own sheet: placement, move, hurt, death, fallback", () => {
    const added = (Object.keys(ENEMY_ANIMATIONS) as EnemyId[]).filter((t) => !["drone", "runner", "tank", "boss", "glider", "aegis"].includes(t));
    expect(added.length).toBeGreaterThan(0);
    for (const type of added) {
      const { sprites, images } = host(everything),
        stat = host(everything.filter((t) => t !== sheetKey(type))),
        feedback = new EnemyFeedback(),
        c = unit(1, type, { heading: 0.6 });
      sprites.sync([at(c, 1)], look(0, feedback));
      stat.sprites.sync([at(c, 1)], look(0, feedback));
      expect(images[0].texture, type).toBe(sheetKey(type));
      expect(clipOf(images[0]), type).toBe("idle");
      // Without its sheet the type shows its static art, and both sit on the same visible centre and heading.
      expect(stat.images[0], type).toMatchObject({ texture: artFor(type)!.texture, frame: undefined });
      const a = visibleCentre(images[0], animationArt(type)!),
        s = visibleCentre(stat.images[0], artFor(type)!);
      near(a, s.x, s.y);
      expect(images[0].rotation).toBeCloseTo(stat.images[0].rotation);
      for (let i = 1; i <= 20; i++) sprites.sync([at(c, 1 + i * 0.05)], look(i / 30, feedback));
      expect(clipOf(images[0]), type).toBe("move");
      feedback.recordDamage(1, 10, 0.7);
      sprites.sync([at(c, 2)], look(0.7, feedback));
      expect(clipOf(images[0]), type).toBe("hurt");
      expect(sprites.retire(new Map([[1, { at: { x: 0, y: 0 }, color: red(type) }]]), 0.75, red), type).toEqual([1]);
      sprites.sync([], look(0.75, feedback));
      expect(clipOf(images[0]), type).toBe("death");
      sprites.sync([], look(0.75 + clipDuration(animationsFor(type)!.death!) + 1e-6, feedback));
      expect(images[0].destroyed, type).toBe(true);
      // An id that comes back as another type never keeps the old sheet.
      const other = added.find((t) => t !== type)!;
      sprites.sync([unit(1, type)], look(1, feedback));
      sprites.sync([unit(1, other)], look(1.1, feedback));
      expect(images.filter((i) => !i.destroyed).map((i) => i.texture), type).toEqual([sheetKey(other)]);
    }
  });

  it("bounds the death animations and clears them on reset", () => {
    const { sprites, live } = host(everything),
      units = Array.from({ length: MAX_DYING + 6 }, (_, i) => unit(i + 1, "drone"));
    sprites.sync(units, look(0));
    const kills = new Map(units.map((u) => [u.enemy.id, { at: { x: 0, y: 0 }, color: red("drone") }]));
    expect(sprites.retire(kills, 0.05, red)).toHaveLength(MAX_DYING);
    sprites.sync([], look(0.05));
    expect(live()).toHaveLength(MAX_DYING);
    sprites.reset();
    expect(live()).toHaveLength(0);
    expect(sprites.dyingCount).toBe(0);
  });
});
