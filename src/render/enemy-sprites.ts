import type Phaser from "phaser";
import type { EnemyId } from "../core/types";
import { DEPTH } from "./depths";
import { bodyMotion, resolveEnemyTint, type BodyMotion } from "./enemy-appearance";
import { ART_FILL, artEdge, artFor, type EnemyArt } from "./enemy-art";
import { drawEnemyAccents, type EnemyFeedback } from "./enemy-feedback";
import { bodyLift, drawEnemyBody, drawEnemyOverlay, drawEnemyUnderlay, type ArtFootprint, type EnemyDrawContext } from "./enemies";
import type { Ink } from "./shapes";
/** The parts of a Phaser Image the manager uses. */
export type SpriteImage = Pick<
  Phaser.GameObjects.Image,
  "setOrigin" | "setDepth" | "setPosition" | "setRotation" | "setDisplaySize" | "setFlip" | "setVisible" | "setTint" | "setTintFill" | "clearTint" | "destroy"
>;
/** The scene side: texture lookups and image creation (Phaser in the game, a stub in tests). */
export interface SpriteHost {
  /** True only for a texture that loaded; a failed or missing file never reaches the cache. */
  hasTexture(key: string): boolean;
  createImage(key: string): SpriteImage;
  /** Whether image tints render (WebGL); Phaser's canvas renderer ignores them. Absent means they do. */
  canTint?(): boolean;
}
/** Time and hit feedback for tints, idle motion and accents; without it bodies stand still in their own colours. */
export interface EnemyLook {
  /** The scene's effect clock: stops while paused. */
  now: number;
  feedback: EnemyFeedback;
}
/** Where a painted body goes in one frame: the Image's centre, rotation and square edge, and its visible footprint. */
export interface ArtPlacement {
  x: number;
  y: number;
  rotation: number;
  /** Displayed edge of the square canvas, world pixels. */
  size: number;
  /** Mirrored across the vertical (an upright pose facing left) or the horizontal axis of the art (a profile moving left). */
  flipX: boolean;
  flipY: boolean;
  /** An upright pose faces left: kept while the unit moves up or down. */
  left: boolean;
  /** The visible art on the ground (unlifted, without hover), for its shadow. */
  footprint: ArtFootprint;
}
/** A heading counts as left or right only when it is mostly horizontal; up and down keep the last facing. */
const SIDEWAYS = 0.5;
/**
 * Places an enemy's art (pure, render only). The visible art is centred on its anchor, the enemy's position or,
 * for worm art, `shift` body radii behind it along the heading. The re-centring offset is the measured centre of the
 * art's visible bounds, taken in the art's own frame (mirrored with it) and rotated with the image, so the art
 * never orbits its position while it turns. The anchor is lifted like the procedural body (`bodyLift`) plus the idle
 * hover; the footprint stays on the ground. `left`: the facing of an upright pose in the last frame. Nothing else
 * carries over between calls.
 */
export function placeArt(c: EnemyDrawContext, art: EnemyArt, motion?: BodyMotion, left = false): ArtPlacement {
  const b = art.bounds ?? { w: ART_FILL, h: ART_FILL, x: 0, y: 0 },
    base = c.r * 2 * artEdge(art),
    size = base * (motion?.scale ?? 1),
    dx = Math.cos(c.heading),
    upright = art.pose === "upright",
    facesLeft = dx < -SIDEWAYS ? true : dx > SIDEWAYS ? false : left,
    flipX = upright && facesLeft,
    flipY = art.pose === "profile" && dx < -SIDEWAYS,
    // The direction the art's right edge points to: the heading, or for an upright pose the side it faces.
    facing = upright ? (facesLeft ? Math.PI : 0) : c.heading,
    rotation = (upright ? 0 : c.heading) + (art.angleOffset ?? 0),
    cos = Math.cos(rotation),
    sin = Math.sin(rotation),
    back = (art.shift ?? 0) * c.r,
    ax = c.x - dx * back,
    ay = c.y - Math.sin(c.heading) * back,
    // Canvas-frame offset of the visible centre (mirrored with the art), rotated into the world.
    bx = flipX ? -b.x : b.x,
    by = flipY ? -b.y : b.y,
    ox = (bx * cos - by * sin) * size,
    oy = (bx * sin + by * cos) * size,
    // Visible extents along and across the facing (an angleOffset of ±90° swaps them).
    along = Math.abs(Math.cos(art.angleOffset ?? 0)),
    across = Math.abs(Math.sin(art.angleOffset ?? 0));
  return {
    x: ax - ox,
    y: ay - oy - bodyLift(c) + (motion?.dy ?? 0),
    rotation,
    size,
    flipX,
    flipY,
    left: facesLeft,
    footprint: { x: ax, y: ay, heading: facing, length: base * (along * b.w + across * b.h), width: base * (across * b.w + along * b.h) },
  };
}
/** Applied tint, encoded so a change is one comparison: -1 none, a colour, or a colour + `FILLED` for a fill. */
const NO_TINT = -1,
  FILLED = 0x1000000;
interface Sprite {
  type: EnemyId;
  image: SpriteImage;
  tint: number;
  /** This frame's visible footprint, for the painted shadow. */
  footprint?: ArtFootprint;
  /** An upright pose faces left (render-only memory, like the projectile trails). */
  left: boolean;
}
/**
 * Painted enemy bodies (render only): one Image per enemy id with art and a loaded texture, reused across frames.
 * Everything else, and every unit that is hidden or burrowed, keeps its procedural body (`drawEnemyBody`).
 */
export class EnemySprites {
  private sprites = new Map<number, Sprite>();
  /** Ids whose body is a visible sprite this frame. */
  private shown = new Set<number>();
  private alive = new Set<number>();
  constructor(private host: SpriteHost) {}
  /** Matches the images to this frame's enemies: creates, moves, tints, hides and destroys them. */
  sync(units: readonly EnemyDrawContext[], look?: EnemyLook) {
    this.shown.clear();
    this.alive.clear();
    for (const c of units) {
      const id = c.enemy.id,
        art = artFor(c.enemy.type);
      this.alive.add(id);
      let sprite = this.sprites.get(id);
      // An id that now belongs to another type (or lost its texture) must not keep the old image.
      if (sprite && (sprite.type !== c.enemy.type || !art || !this.host.hasTexture(art.texture))) {
        this.drop(id, sprite);
        sprite = undefined;
      }
      if (!art || !this.host.hasTexture(art.texture)) continue;
      // Hidden: only the overlay's shimmer. Burrowed: the faint procedural shape on its mound. A cached image waits hidden.
      if (c.hidden || c.traits.burrowed) {
        sprite?.image.setVisible(false);
        continue;
      }
      sprite ??= this.create(id, c.enemy.type, art);
      // Everything is derived anew from the context each frame, so no size, offset or tint carries over.
      const at = placeArt(c, art, look ? bodyMotion(c, look.now) : undefined, sprite.left);
      sprite.image.setPosition(at.x, at.y).setRotation(at.rotation).setDisplaySize(at.size, at.size).setFlip(at.flipX, at.flipY).setVisible(true);
      sprite.footprint = at.footprint;
      sprite.left = at.left;
      this.tint(sprite, look ? resolveEnemyTint(c, look.feedback.flash(id, look.now, c.enemy.maxHp), look.now) : undefined);
      this.shown.add(id);
    }
    for (const [id, sprite] of this.sprites) if (!this.alive.has(id)) this.drop(id, sprite);
  }
  /** Whether a visible sprite replaces this enemy's procedural body in the current frame. */
  isRendering(id: number) {
    return this.shown.has(id);
  }
  /** The visible footprint of this frame's sprite, or undefined where the procedural body is drawn. */
  footprint(id: number) {
    return this.shown.has(id) ? this.sprites.get(id)?.footprint : undefined;
  }
  /** Whether hit flashes show through the sprite's tint; otherwise the overlay draws them as on a procedural body. */
  get tints() {
    return this.host.canTint?.() ?? true;
  }
  /** Number of managed images (visible or waiting hidden). */
  get size() {
    return this.sprites.size;
  }
  /** Destroys every image: a new game state, a scene shutdown. */
  reset() {
    for (const [id, sprite] of this.sprites) this.drop(id, sprite);
    this.shown.clear();
  }
  /** Applies a tint only when it changed; no tint clears it, so the art shows its own colours again. */
  private tint(sprite: Sprite, tint: { color: number; fill: boolean } | undefined) {
    const code = tint ? tint.color + (tint.fill ? FILLED : 0) : NO_TINT;
    if (code === sprite.tint) return;
    sprite.tint = code;
    if (!tint) sprite.image.clearTint();
    else if (tint.fill) sprite.image.setTintFill(tint.color);
    else sprite.image.setTint(tint.color);
  }
  private create(id: number, type: EnemyId, art: EnemyArt) {
    const sprite = { type, image: this.host.createImage(art.texture).setOrigin(0.5, 0.5).setDepth(DEPTH.enemySprites), tint: NO_TINT, left: false };
    this.sprites.set(id, sprite);
    return sprite;
  }
  private drop(id: number, sprite: Sprite) {
    sprite.image.destroy();
    this.sprites.delete(id);
  }
}
/**
 * One frame of enemies on the battlefield's three layers: the sprites are matched first (layer order comes from the
 * depths, not from this order), then every underlay (a sprite casts the shadow of its footprint), the bodies (a sprite where one is shown, otherwise the
 * procedural body, never both) and every overlay, with the unit's feedback accents under its markers and HP bar.
 */
export function drawEnemyLayers(layers: { underlay: Ink; body: Ink; overlay: Ink }, sprites: EnemySprites, units: readonly EnemyDrawContext[], look?: EnemyLook) {
  look?.feedback.observe(units, look.now);
  const tints = sprites.tints;
  sprites.sync(units, look);
  for (const c of units) drawEnemyUnderlay(layers.underlay, c, sprites.footprint(c.enemy.id));
  for (const c of units) if (!sprites.isRendering(c.enemy.id)) drawEnemyBody(layers.body, c);
  for (const c of units) {
    // A sprite that cannot be tinted (canvas renderer) gets the overlay's hit highlight like a procedural body.
    if (look) drawEnemyAccents(layers.overlay, c, look.feedback, look.now, sprites.isRendering(c.enemy.id) && tints);
    drawEnemyOverlay(layers.overlay, c);
  }
}
