import Phaser from "phaser";
import type { Tower, TowerDefinition } from "../core/types";
import { DEPTH } from "./depths";
import { bodyKey, drawTurretInk, stillTurret, type TowerBadges } from "./towers";
/** Steps of a full turn a tilted turret is drawn at: 64 steps of 5.6°, a muzzle 27 px out moves under 1.4 px per step. */
export const ANGLE_STEPS = 64;
/** Recoil steps (0, ½, 1): a full kick slides a barrel back 5–7 px. */
export const KICK_STEPS = 2;
/** The drawn angle of a tilted turret: snapped to `ANGLE_STEPS`, so its picture can be cached and flashes match it. */
export const snapAngle = (a: number) => Math.round((a * ANGLE_STEPS) / (2 * Math.PI)) * ((2 * Math.PI) / ANGLE_STEPS);
export const snapKick = (kick: number) => Math.round(kick * KICK_STEPS) / KICK_STEPS;
/** World box of one turret picture and the tower centre inside it: barrels reach about 50 px up into the cell above. */
const BOX_W = 84,
  BOX_H = 100,
  OX = 42,
  OY = 66;
/** Pictures bake at twice the canvas resolution, like the tower bodies (a texture has no multisampling). */
const SUPERSAMPLE = 2;
/** Atlas pages: square textures of this many pixels, at most `MAX_PAGES` of them (16 MB each). */
const PAGE = 2048,
  MAX_PAGES = 3;
/** New pictures per frame; a turret whose picture is not ready yet is drawn live meanwhile. */
const BAKES_PER_FRAME = 6;
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
 * Pictures of tilted turrets (render only), one per look (`bodyKey`), aim step and recoil step, baked lazily into shared
 * atlas pages and shown as one Image per tower between `towerInk` and the live layer over the turrets. Phaser
 * re-tessellates every Graphics on every frame, so a turret drawn live costs its whole polygon count each frame; a
 * cached one is a single quad. Fast trackers revisit the same steps, so after warm-up they stop baking. The least
 * recently used picture gives up its slot when the pages are full.
 */
export class TurretCache {
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
  constructor(private scene: Phaser.Scene) {}
  /** Re-bakes at a new camera zoom (pixels per world pixel). */
  setZoom(zoom: number) {
    if (Math.abs(zoom - this.zoom) < 0.01) return;
    this.reset();
    this.zoom = zoom;
    this.scale = zoom * SUPERSAMPLE;
    this.cw = Math.ceil(BOX_W * this.scale);
    this.ch = Math.ceil(BOX_H * this.scale);
  }
  /** Starts a frame: the bake budget refills. */
  begin() {
    this.frame++;
    this.bakes = 0;
  }
  /**
   * Shows tower `t`'s turret (at `t.angle` and `kick`, both already snapped) as a cached picture; false when it must be
   * drawn live: not a tilted turret, one whose ink is not still (`stillTurret`), or its picture not baked yet.
   */
  place(t: Tower, definition: Readonly<TowerDefinition>, badges: TowerBadges, x: number, y: number, kick: number) {
    if (!this.zoom || !stillTurret(t, definition, badges)) return false;
    const key = `${bodyKey(t, badges)}|${Math.round((t.angle * ANGLE_STEPS) / (2 * Math.PI))}|${kick}`,
      slot = this.slots.get(key) ?? this.bake(key, t, definition, badges, kick);
    let entry = this.images.get(t.id);
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
        .setOrigin((OX * this.scale) / this.cw, (OY * this.scale) / this.ch)
        .setDisplaySize(this.cw / this.scale, this.ch / this.scale);
      entry = { image, key, seen: true };
      this.images.set(t.id, entry);
    } else if (entry.key !== key) {
      entry.image.setTexture(page, slot.frame).setDisplaySize(this.cw / this.scale, this.ch / this.scale);
      entry.key = key;
    }
    // North to south, like the live towers: a turret reaching into the cell above covers what stands there.
    entry.image.setPosition(x, y).setDepth(DEPTH.towerTurrets + t.y * 1e-4).setVisible(true);
    entry.seen = true;
    return true;
  }
  /** Drops the Images of towers not placed since the last sweep. */
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
    if (!this.free.length && this.pages.length < MAX_PAGES) this.addPage();
    const slot = this.free.pop();
    if (slot) return slot;
    let oldest: Slot | undefined;
    for (const s of this.slots.values()) if (s.used < this.frame && (!oldest || s.used < oldest.used)) oldest = s;
    if (oldest) this.slots.delete(oldest.key!);
    return oldest;
  }
  private addPage() {
    const name = `turret-page-${++this.serial}`,
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
  private bake(key: string, t: Tower, definition: Readonly<TowerDefinition>, badges: TowerBadges, kick: number) {
    if (this.bakes >= BAKES_PER_FRAME) return undefined;
    const slot = this.claim();
    if (!slot) return undefined;
    this.bakes++;
    slot.key = key;
    this.slots.set(key, slot);
    const texture = this.scene.textures.get(this.pages[slot.page]) as Phaser.Textures.DynamicTexture;
    this.painter ??= this.scene.add.graphics().setVisible(false);
    this.painter.clear();
    drawTurretInk(this.painter, slot.x / this.scale + OX, slot.y / this.scale + OY, t, definition, badges, kick);
    // Phaser 4 queues these until `render()`; the painter is reused for the next picture.
    texture.clear(slot.x, slot.y, this.cw, this.ch).draw(this.painter).render();
    return slot;
  }
}
