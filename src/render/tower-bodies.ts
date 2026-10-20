import Phaser from "phaser";
import type { Tower, TowerDefinition } from "../core/types";
import { DEPTH } from "./depths";
import { bodyKey, drawTowerBody, stillBody, type TowerBadges } from "./towers";
/** World size of a baked body; the widest base with its shadow reaches about 28 px from the centre. */
const BOX = 72;
/** Bodies bake at twice the canvas resolution: a texture has no multisampling, so the edges are smoothed by scaling down. */
const SUPERSAMPLE = 2;
/**
 * Still tower bodies (shadow, base plate, collar), baked once per `bodyKey` at the camera zoom and shown as one Image
 * per tower below `towerInk`, so a full board no longer re-tessellates hundreds of plates every frame. Render only.
 */
export class TowerBodies {
  private images = new Map<number, { image: Phaser.GameObjects.Image; key: string; seen: boolean }>();
  /** Baked texture name per body key. */
  private baked = new Map<string, string>();
  private painter?: Phaser.GameObjects.Graphics;
  private zoom = 0;
  private serial = 0;
  constructor(private scene: Phaser.Scene) {}
  /** Re-bakes at a new camera zoom (pixels per world pixel). */
  setZoom(zoom: number) {
    if (Math.abs(zoom - this.zoom) < 0.01) return;
    this.reset();
    this.zoom = zoom;
  }
  /** Shows tower `t`'s body as a baked Image; false when its base animates and must be drawn live. */
  place(t: Tower, definition: Readonly<TowerDefinition>, badges: TowerBadges, x: number, y: number) {
    if (!this.zoom || !stillBody(t, definition, badges)) return false;
    const key = bodyKey(t, badges),
      texture = this.baked.get(key) ?? this.bake(key, t, definition, badges);
    let entry = this.images.get(t.id);
    if (!entry) {
      entry = { image: this.scene.add.image(x, y, texture).setDepth(DEPTH.towerBodies).setDisplaySize(BOX, BOX), key, seen: true };
      this.images.set(t.id, entry);
    } else if (entry.key !== key) {
      entry.image.setTexture(texture).setDisplaySize(BOX, BOX);
      entry.key = key;
    }
    entry.image.setPosition(x, y);
    entry.seen = true;
    return true;
  }
  /** Drops the Images of towers not placed since the last sweep, and textures no tower shows any more. */
  sweep() {
    for (const [id, entry] of this.images) {
      if (entry.seen) entry.seen = false;
      else {
        entry.image.destroy();
        this.images.delete(id);
      }
    }
    if (this.baked.size <= this.images.size) return;
    const used = new Set([...this.images.values()].map((e) => e.key));
    for (const [key, texture] of this.baked)
      if (!used.has(key)) {
        this.scene.textures.remove(texture);
        this.baked.delete(key);
      }
  }
  reset() {
    for (const entry of this.images.values()) entry.image.destroy();
    this.images.clear();
    for (const texture of this.baked.values()) if (this.scene.textures?.exists(texture)) this.scene.textures.remove(texture);
    this.baked.clear();
    this.painter?.destroy();
    this.painter = undefined;
  }
  private bake(key: string, t: Tower, definition: Readonly<TowerDefinition>, badges: TowerBadges) {
    const size = Math.ceil(BOX * this.zoom * SUPERSAMPLE),
      name = `tower-body-${++this.serial}`,
      texture = this.scene.textures.addDynamicTexture(name, size, size)!;
    this.painter ??= this.scene.add.graphics().setVisible(false);
    this.painter.clear();
    drawTowerBody(this.painter, BOX / 2, BOX / 2, t, definition, badges);
    texture.camera.setOrigin(0, 0).setZoom(size / BOX);
    // Phaser 4 queues draws until `render()`; the painter is reused for the next body.
    texture.draw(this.painter).render();
    this.baked.set(key, name);
    return name;
  }
}
