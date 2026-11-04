import Phaser from "phaser";
import type { Ink } from "./shapes";
/** Steps of a full turn a turret is drawn at: 64 steps of 5.6°, a muzzle 27 px out moves under 1.4 px per step. */
export const ANGLE_STEPS = 64;
/** Recoil steps (0, ½, 1): a full kick slides a barrel back 5–7 px. */
export const KICK_STEPS = 2;
/** The drawn angle of a turret: snapped to `ANGLE_STEPS`, so its picture can be cached and flashes match it. */
export const snapAngle = (a: number) => Math.round((a * ANGLE_STEPS) / (2 * Math.PI)) * ((2 * Math.PI) / ANGLE_STEPS);
export const snapKick = (kick: number) => Math.round(kick * KICK_STEPS) / KICK_STEPS;
/** Index of a snapped angle among the `ANGLE_STEPS`, for picture keys. */
export const angleStep = (a: number) => Math.round((a * ANGLE_STEPS) / (2 * Math.PI));
/** Pictures bake at twice the canvas resolution: a texture has no multisampling, so the edges are smoothed by scaling down. */
const SUPERSAMPLE = 2;
/** Atlas pages are square textures of this many pixels (16 MB each). */
const PAGE = 2048;
export interface PictureOptions {
  /** Texture name prefix of the pages. */
  name: string;
  /** World box of one picture and the tower centre inside it. */
  w: number;
  h: number;
  ox: number;
  oy: number;
  /** Pages at most; when they are full the least recently used picture gives up its slot. */
  pages: number;
  /** New pictures per frame; a tower whose picture is not ready yet is drawn live meanwhile. */
  perFrame: number;
}
/** Draws a picture's ink on `g` with the tower centre at (`x`, `y`). */
export type Paint = (g: Ink, x: number, y: number) => void;
interface Slot {
  page: number;
  frame: string;
  /** Pixel rectangle in the page. */
  x: number;
  y: number;
  key?: string;
  used: number;
}
/**
 * Pictures of still tower parts (render only), baked lazily per key into shared atlas pages at the camera zoom and
 * shown as one Image per tower. Phaser re-tessellates every Graphics on every frame, so a part drawn live costs its whole
 * polygon count each frame; a cached one is a single quad. The battlefield keeps two: the still bodies (one picture per
 * `bodyKey`) and the turrets (per look, aim step and recoil step; fast trackers revisit the same steps, so after warm-up
 * they stop baking). The least recently used picture gives up its slot when the pages are full.
 */
export class TowerPictures {
  private images = new Map<number, { image: Phaser.GameObjects.Image; key: string; seen: boolean }>();
  private slots = new Map<string, Slot>();
  private free: Slot[] = [];
  private pages: string[] = [];
  private painter?: Phaser.GameObjects.Graphics;
  private zoom = 0;
  private frame = 0;
  private bakes = 0;
  private serial = 0;
  /** Picture size in page pixels, and the scale from world to page pixels. */
  private cw = 0;
  private ch = 0;
  private scale = 0;
  constructor(
    private scene: Phaser.Scene,
    private o: PictureOptions,
  ) {}
  /** Re-bakes at a new camera zoom (pixels per world pixel). */
  setZoom(zoom: number) {
    if (Math.abs(zoom - this.zoom) < 0.01) return;
    this.reset();
    this.zoom = zoom;
    this.scale = zoom * SUPERSAMPLE;
    this.cw = Math.ceil(this.o.w * this.scale);
    this.ch = Math.ceil(this.o.h * this.scale);
  }
  /** Starts a frame: the bake budget refills. */
  begin() {
    this.frame++;
    this.bakes = 0;
  }
  /**
   * Shows the picture `key` for tower `id` at (`x`, `y`), baking it with `paint` first if needed; false when it is not
   * ready (no zoom yet, the bake budget spent or every slot shown this frame), so the caller draws the part live.
   */
  show(id: number, key: string, x: number, y: number, depth: number, paint: Paint) {
    if (!this.zoom) return false;
    const slot = this.slots.get(key) ?? this.bake(key, paint);
    let entry = this.images.get(id);
    if (!slot) {
      entry?.image.setVisible(false);
      if (entry) entry.seen = true;
      return false;
    }
    slot.used = this.frame;
    const page = this.pages[slot.page];
    if (!entry) {
      const image = this.scene.add
        .image(x, y, page, slot.frame)
        .setOrigin((this.o.ox * this.scale) / this.cw, (this.o.oy * this.scale) / this.ch)
        .setDisplaySize(this.cw / this.scale, this.ch / this.scale);
      entry = { image, key, seen: true };
      this.images.set(id, entry);
    } else if (entry.key !== key) {
      entry.image.setTexture(page, slot.frame).setDisplaySize(this.cw / this.scale, this.ch / this.scale);
      entry.key = key;
    }
    entry.image.setPosition(x, y).setDepth(depth).setVisible(true);
    entry.seen = true;
    return true;
  }
  /** Drops the Images of towers not shown since the last sweep. */
  sweep() {
    for (const [id, entry] of this.images) {
      if (entry.seen) entry.seen = false;
      else {
        entry.image.destroy();
        this.images.delete(id);
      }
    }
  }
  reset() {
    for (const entry of this.images.values()) entry.image.destroy();
    this.images.clear();
    for (const page of this.pages) if (this.scene.textures?.exists(page)) this.scene.textures.remove(page);
    this.pages = [];
    this.slots.clear();
    this.free = [];
    this.painter?.destroy();
    this.painter = undefined;
  }
  /** Pictures held and pages in use, for QA (`window.__turretCache`). */
  stats() {
    return { pictures: this.slots.size, pages: this.pages.length, images: this.images.size };
  }
  /** A free slot: a new one, a new page's, or the least recently used picture's (never one shown this frame). */
  private claim(): Slot | undefined {
    if (!this.free.length && this.pages.length < this.o.pages) this.addPage();
    const slot = this.free.pop();
    if (slot) return slot;
    let oldest: Slot | undefined;
    for (const s of this.slots.values()) if (s.used < this.frame && (!oldest || s.used < oldest.used)) oldest = s;
    if (oldest) this.slots.delete(oldest.key!);
    return oldest;
  }
  private addPage() {
    const name = `${this.o.name}-${++this.serial}`,
      texture = this.scene.textures.addDynamicTexture(name, PAGE, PAGE)!,
      columns = Math.floor(PAGE / this.cw),
      rows = Math.floor(PAGE / this.ch),
      index = this.pages.length;
    texture.camera.setOrigin(0, 0).setZoom(this.scale);
    this.pages.push(name);
    for (let r = rows - 1; r >= 0; r--)
      for (let c = columns - 1; c >= 0; c--) {
        const frame = `s${r}-${c}`;
        texture.add(frame, 0, c * this.cw, r * this.ch, this.cw, this.ch);
        this.free.push({ page: index, frame, x: c * this.cw, y: r * this.ch, used: 0 });
      }
  }
  private bake(key: string, paint: Paint) {
    if (this.bakes >= this.o.perFrame) return undefined;
    const slot = this.claim();
    if (!slot) return undefined;
    this.bakes++;
    slot.key = key;
    this.slots.set(key, slot);
    const texture = this.scene.textures.get(this.pages[slot.page]) as Phaser.Textures.DynamicTexture;
    this.painter ??= this.scene.add.graphics().setVisible(false);
    this.painter.clear();
    paint(this.painter, slot.x / this.scale + this.o.ox, slot.y / this.scale + this.o.oy);
    // Phaser 4 queues these until `render()`; the painter is reused for the next picture.
    texture.clear(slot.x, slot.y, this.cw, this.ch).draw(this.painter).render();
    return slot;
  }
}
/** Still tower bodies: the widest base with its shadow reaches about 28 px from the centre. */
export const bodyPictures = (scene: Phaser.Scene) => new TowerPictures(scene, { name: "tower-body", w: 72, h: 72, ox: 36, oy: 36, pages: 2, perFrame: Infinity });
/** Turrets per look, aim step and recoil step: barrels reach about 50 px up into the cell above. */
export const turretPictures = (scene: Phaser.Scene) => new TowerPictures(scene, { name: "turret-page", w: 84, h: 100, ox: 42, oy: 66, pages: 3, perFrame: 6 });
