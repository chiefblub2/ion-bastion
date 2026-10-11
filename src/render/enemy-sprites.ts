import type Phaser from "phaser";
import type { EnemyId } from "../core/types";
import { DEPTH } from "./depths";
import { bodyMotion, resolveEnemyTint } from "./enemy-appearance";
import { ART_SCALE, artFor, type EnemyArt } from "./enemy-art";
import { drawEnemyAccents, type EnemyFeedback } from "./enemy-feedback";
import { bodyLift, drawEnemyBody, drawEnemyOverlay, drawEnemyUnderlay, type EnemyDrawContext } from "./enemies";
import type { Ink } from "./shapes";
/** The parts of a Phaser Image the manager uses. */
export type SpriteImage = Pick<
  Phaser.GameObjects.Image,
  "setOrigin" | "setDepth" | "setPosition" | "setRotation" | "setDisplaySize" | "setVisible" | "setTint" | "setTintFill" | "clearTint" | "destroy"
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
/** Applied tint, encoded so a change is one comparison: -1 none, a colour, or a colour + `FILLED` for a fill. */
const NO_TINT = -1,
  FILLED = 0x1000000;
interface Sprite {
  type: EnemyId;
  image: SpriteImage;
  tint: number;
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
      const motion = look ? bodyMotion(c, look.now) : undefined,
        size = c.r * 2 * (art.scale ?? ART_SCALE) * (motion?.scale ?? 1),
        back = (art.shift ?? 0) * c.r;
      sprite.image
        .setPosition(c.x - Math.cos(c.heading) * back, c.y - Math.sin(c.heading) * back - bodyLift(c) + (motion?.dy ?? 0))
        .setRotation(c.heading + (art.angleOffset ?? 0))
        .setDisplaySize(size, size)
        .setVisible(true);
      this.tint(sprite, look ? resolveEnemyTint(c, look.feedback.flash(id, look.now, c.enemy.maxHp), look.now) : undefined);
      this.shown.add(id);
    }
    for (const [id, sprite] of this.sprites) if (!this.alive.has(id)) this.drop(id, sprite);
  }
  /** Whether a visible sprite replaces this enemy's procedural body in the current frame. */
  isRendering(id: number) {
    return this.shown.has(id);
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
    const sprite = { type, image: this.host.createImage(art.texture).setOrigin(0.5, 0.5).setDepth(DEPTH.enemySprites), tint: NO_TINT };
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
 * depths, not from this order), then every underlay, the bodies (a sprite where one is shown, otherwise the
 * procedural body, never both) and every overlay, with the unit's feedback accents under its markers and HP bar.
 */
export function drawEnemyLayers(layers: { underlay: Ink; body: Ink; overlay: Ink }, sprites: EnemySprites, units: readonly EnemyDrawContext[], look?: EnemyLook) {
  look?.feedback.observe(units, look.now);
  const tints = sprites.tints;
  sprites.sync(units, look);
  for (const c of units) drawEnemyUnderlay(layers.underlay, c, sprites.isRendering(c.enemy.id));
  for (const c of units) if (!sprites.isRendering(c.enemy.id)) drawEnemyBody(layers.body, c);
  for (const c of units) {
    // A sprite that cannot be tinted (canvas renderer) gets the overlay's hit highlight like a procedural body.
    if (look) drawEnemyAccents(layers.overlay, c, look.feedback, look.now, sprites.isRendering(c.enemy.id) && tints);
    drawEnemyOverlay(layers.overlay, c);
  }
}
