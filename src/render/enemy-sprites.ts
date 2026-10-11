import type Phaser from "phaser";
import type { EnemyId } from "../core/types";
import { DEPTH } from "./depths";
import { ART_SCALE, artFor, type EnemyArt } from "./enemy-art";
import { bodyLift, drawEnemyBody, drawEnemyOverlay, drawEnemyUnderlay, type EnemyDrawContext } from "./enemies";
import type { Ink } from "./shapes";
/** The parts of a Phaser Image the manager uses. */
export type SpriteImage = Pick<Phaser.GameObjects.Image, "setOrigin" | "setDepth" | "setPosition" | "setRotation" | "setDisplaySize" | "setVisible" | "destroy">;
/** The scene side: texture lookups and image creation (Phaser in the game, a stub in tests). */
export interface SpriteHost {
  /** True only for a texture that loaded; a failed or missing file never reaches the cache. */
  hasTexture(key: string): boolean;
  createImage(key: string): SpriteImage;
}
interface Sprite {
  type: EnemyId;
  image: SpriteImage;
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
  /** Matches the images to this frame's enemies: creates, moves, hides and destroys them. */
  sync(units: readonly EnemyDrawContext[]) {
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
      const size = c.r * 2 * (art.scale ?? ART_SCALE);
      sprite.image
        .setPosition(c.x, c.y - bodyLift(c))
        .setRotation(c.heading + (art.angleOffset ?? 0))
        .setDisplaySize(size, size)
        .setVisible(true);
      this.shown.add(id);
    }
    for (const [id, sprite] of this.sprites) if (!this.alive.has(id)) this.drop(id, sprite);
  }
  /** Whether a visible sprite replaces this enemy's procedural body in the current frame. */
  isRendering(id: number) {
    return this.shown.has(id);
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
  private create(id: number, type: EnemyId, art: EnemyArt) {
    const sprite = { type, image: this.host.createImage(art.texture).setOrigin(0.5, 0.5).setDepth(DEPTH.enemySprites) };
    this.sprites.set(id, sprite);
    return sprite;
  }
  private drop(id: number, sprite: Sprite) {
    sprite.image.destroy();
    this.sprites.delete(id);
  }
}
/**
 * One frame of enemies on the battlefield's three layers: every underlay, then the bodies (a sprite where one is shown,
 * otherwise the procedural body, never both), then every overlay.
 */
export function drawEnemyLayers(layers: { underlay: Ink; body: Ink; overlay: Ink }, sprites: EnemySprites, units: readonly EnemyDrawContext[]) {
  for (const c of units) drawEnemyUnderlay(layers.underlay, c);
  sprites.sync(units);
  for (const c of units) if (!sprites.isRendering(c.enemy.id)) drawEnemyBody(layers.body, c);
  for (const c of units) drawEnemyOverlay(layers.overlay, c);
}
