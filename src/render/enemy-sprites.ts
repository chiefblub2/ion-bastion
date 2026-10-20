import type Phaser from "phaser";
import type { EnemyId } from "../core/types";
import { DEPTH } from "./depths";
import { bodyMotion, resolveEnemyTint, type BodyMotion } from "./enemy-appearance";
import { animationArt, animationsFor, clipDuration, clipFrame, sheetFrame, type AnimationClip } from "./enemy-animations";
import { animate, freshTrack, type AnimationTrack, type Kill } from "./enemy-animator";
import { ART_FILL, artEdge, artFor, type EnemyArt } from "./enemy-art";
import { drawEnemyAccents, type EnemyFeedback } from "./enemy-feedback";
import { bodyLift, drawEnemyBody, drawEnemyOverlay, drawEnemyUnderlay, type ArtFootprint, type EnemyDrawContext } from "./enemies";
import { hash01, type Ink } from "./shapes";
/** `Phaser.TintModes.MULTIPLY` and `FILL`; the manager stays free of Phaser's runtime (pure tests). */
const TINT_MULTIPLY = 0,
  TINT_FILL = 1;
/** The parts of a Phaser Image the manager uses; an animated body is an Image whose spritesheet frame changes. */
export type SpriteImage = Pick<
  Phaser.GameObjects.Image,
  "setOrigin" | "setDepth" | "setPosition" | "setRotation" | "setDisplaySize" | "setFlip" | "setVisible" | "setTint" | "setTintMode" | "clearTint" | "setTexture" | "setFrame" | "destroy"
>;
/** The scene side: texture lookups and image creation (Phaser in the game, a stub in tests). */
export interface SpriteHost {
  /** True only for a texture that loaded; a failed or missing file never reaches the cache. */
  hasTexture(key: string): boolean;
  /** An Image of a texture; `frame` picks a spritesheet frame (animations). */
  createImage(key: string, frame?: number): SpriteImage;
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
  /** Texture and spritesheet frame shown; `frame` is undefined for static art. */
  texture: string;
  frame?: number;
  /** Animation memory of an animated type (render only). */
  track?: AnimationTrack;
  /** This frame's placement: where a death animation starts. */
  placed?: ArtPlacement;
  /** This frame's visible footprint, for the painted shadow. */
  footprint?: ArtFootprint;
  /** An upright pose faces left (render-only memory, like the projectile trails). */
  left: boolean;
}
/** Most death animations playing at once; further kills keep only the kill effect. */
export const MAX_DYING = 24;
/** A body playing its death clip after its enemy left the state (render only). */
interface Dying {
  image: SpriteImage;
  clip: AnimationClip;
  since: number;
  frame: number;
}
/** What a body shows this frame: a clip frame (animated) or the static art, and the art that places it. */
interface Look {
  texture: string;
  frame?: number;
  art: EnemyArt;
  hurt: boolean;
}
/**
 * Painted enemy bodies (render only): one Image per enemy id with art and a loaded texture, reused across frames.
 * Animated types (`ENEMY_ANIMATIONS`) show a frame of their idle, move or hurt clip (`animate`) from their one sheet
 * on the same Image, so changing clips is a frame change;
 * a missing clip falls back to the other loop, then to the static art, then to the procedural body
 * (`drawEnemyBody`), which every unit that is hidden or burrowed keeps as well. Killed units with a death clip
 * play it once as a bounded set of dying Images (`retire`).
 */
export class EnemySprites {
  private sprites = new Map<number, Sprite>();
  private dying: Dying[] = [];
  /** Death animations started since the manager was made (dev hooks and QA scripts). */
  deaths = 0;
  /** Ids whose body is a visible sprite this frame. */
  private shown = new Set<number>();
  private alive = new Set<number>();
  constructor(private host: SpriteHost) {}
  /** Matches the images to this frame's enemies: creates, moves, animates, tints, hides and destroys them. */
  sync(units: readonly EnemyDrawContext[], look?: EnemyLook) {
    const now = look?.now ?? 0;
    this.shown.clear();
    this.alive.clear();
    this.advanceDying(now);
    for (const c of units) {
      const id = c.enemy.id,
        type = c.enemy.type,
        hidden = c.hidden || c.traits.burrowed;
      this.alive.add(id);
      let sprite = this.sprites.get(id);
      // An id that now belongs to another type must not keep the old image or animation.
      if (sprite && sprite.type !== type) {
        this.drop(id, sprite);
        sprite = undefined;
      }
      const set = animationsFor(type),
        track = sprite?.track ?? (set && freshTrack(c.enemy.distance, now, hash01(id, 29) * 4)),
        pick = set && track ? animate(track, set, (clip) => this.host.hasTexture(clip.texture), { distance: c.enemy.distance, now, struck: look?.feedback.struckAt(id) ?? -Infinity, visible: !hidden }) : undefined,
        moving = pick && animationArt(type),
        art = artFor(type),
        shown: Look | undefined = moving
          ? { texture: pick.clip.texture, frame: sheetFrame(pick.clip, pick.frame), art: moving, hurt: pick.hurt }
          : art && this.host.hasTexture(art.texture)
            ? { texture: art.texture, art, hurt: false }
            : undefined;
      // Nothing loaded: the procedural body.
      if (!shown) {
        if (sprite) this.drop(id, sprite);
        continue;
      }
      // Hidden: only the overlay's shimmer. Burrowed: the faint procedural shape on its mound. A cached image waits hidden.
      if (hidden) {
        sprite?.image.setVisible(false);
        continue;
      }
      sprite ??= this.create(id, type, shown, track);
      this.show(sprite, shown);
      // Everything is derived anew from the context each frame, so no size, offset or tint carries over.
      const at = placeArt(c, shown.art, look ? bodyMotion(c, look.now) : undefined, sprite.left);
      sprite.image.setPosition(at.x, at.y).setRotation(at.rotation).setDisplaySize(at.size, at.size).setFlip(at.flipX, at.flipY).setVisible(true);
      sprite.footprint = at.footprint;
      sprite.placed = at;
      sprite.left = at.left;
      // The hurt frames are the hit feedback; a white flash over them would hide them. Other hits still flash.
      const flash = look && !shown.hurt ? look.feedback.flash(id, look.now, c.enemy.maxHp) : 0;
      this.tint(sprite, look ? resolveEnemyTint(c, flash, look.now) : undefined);
      this.shown.add(id);
    }
    for (const [id, sprite] of this.sprites) if (!this.alive.has(id)) this.drop(id, sprite);
  }
  /**
   * Starts death animations for killed enemies (`killedEnemies` of the frame's events), before the next `sync`
   * drops their images. Only a unit that showed an animated body in the last frame, whose kill colour matches its
   * type (`colorOf`) and that has a loaded death clip plays one, at its last placement, while fewer than `MAX_DYING`
   * play; the others simply vanish under their kill effect. Returns the ids that play.
   */
  retire(killed: ReadonlyMap<number, Kill>, now: number, colorOf: (type: EnemyId) => number) {
    const started: number[] = [];
    for (const [id, kill] of killed) {
      const sprite = this.sprites.get(id),
        death = sprite && animationsFor(sprite.type)?.death;
      if (!sprite || !death || !sprite.placed || sprite.frame === undefined || !this.shown.has(id)) continue;
      if (colorOf(sprite.type) !== kill.color || !this.host.hasTexture(death.texture) || this.dying.length >= MAX_DYING) continue;
      this.sprites.delete(id);
      this.shown.delete(id);
      // The same Image plays on: its last position, heading, mirroring and size stay; status tints end with the unit.
      sprite.image.setTexture(death.texture, sheetFrame(death, 0)).setDisplaySize(sprite.placed.size, sprite.placed.size).clearTint();
      this.dying.push({ image: sprite.image, clip: death, since: now, frame: 0 });
      started.push(id);
      this.deaths++;
    }
    return started;
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
  /** Number of managed images of living enemies (visible or waiting hidden). */
  get size() {
    return this.sprites.size;
  }
  /** Number of death animations playing. */
  get dyingCount() {
    return this.dying.length;
  }
  /** Destroys every image, dying ones included: a new game state, a scene shutdown. */
  reset() {
    for (const [id, sprite] of this.sprites) this.drop(id, sprite);
    for (const d of this.dying) d.image.destroy();
    this.dying = [];
    this.shown.clear();
  }
  /** Steps the death clips on the effect clock (frozen while paused) and destroys those that ended. */
  private advanceDying(now: number) {
    this.dying = this.dying.filter((d) => {
      const elapsed = now - d.since;
      if (elapsed >= clipDuration(d.clip)) {
        d.image.destroy();
        return false;
      }
      const frame = clipFrame(d.clip, elapsed);
      if (frame !== d.frame) d.image.setFrame(sheetFrame(d.clip, frame));
      d.frame = frame;
      return true;
    });
  }
  /** Switches the texture or frame only when it changed (a static texture has no frame). */
  private show(sprite: Sprite, look: Look) {
    if (sprite.texture !== look.texture) look.frame === undefined ? sprite.image.setTexture(look.texture) : sprite.image.setTexture(look.texture, look.frame);
    else if (sprite.frame !== look.frame && look.frame !== undefined) sprite.image.setFrame(look.frame);
    sprite.texture = look.texture;
    sprite.frame = look.frame;
  }
  /** Applies a tint only when it changed; no tint clears it, so the art shows its own colours again. */
  private tint(sprite: Sprite, tint: { color: number; fill: boolean } | undefined) {
    const code = tint ? tint.color + (tint.fill ? FILLED : 0) : NO_TINT;
    if (code === sprite.tint) return;
    sprite.tint = code;
    if (!tint) sprite.image.clearTint();
    // Phaser 4 keeps the tint mode apart from the colour, and it persists: set both every time.
    else sprite.image.setTint(tint.color).setTintMode(tint.fill ? TINT_FILL : TINT_MULTIPLY);
  }
  private create(id: number, type: EnemyId, look: Look, track?: AnimationTrack) {
    const image = this.host.createImage(look.texture, look.frame).setOrigin(0.5, 0.5).setDepth(DEPTH.enemySprites),
      sprite: Sprite = { type, image, tint: NO_TINT, left: false, texture: look.texture, frame: look.frame, track };
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
