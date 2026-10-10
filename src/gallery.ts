import Phaser from "phaser";
import { Game } from "./core/game";
import { DEFAULT_CONTENT } from "./content";
import { towerColor } from "./core/upgrades";
import { CELL } from "./render/shapes";
import { drawTower } from "./render/towers";
import { drawEnemy } from "./render/enemies";
import { createEnemy } from "./systems/spawn";
import { statusFlags } from "./systems/status";
import { traitFlags, type TraitFlags } from "./systems/traits";
import type { EnemyId, TowerId } from "./core/types";
// Dev-only page (`/gallery.html`, not part of `vite build`): every tower and enemy drawn by the battlefield's own
// functions on one canvas, one tile each. `scripts/readme-images.ts` clips the tiles into the README images.

/** Pixel scale of the canvas, so the PNGs stay sharp on high-density screens. */
const ZOOM = 2;
const COLUMNS = 12;
/** Tile sizes in battlefield pixels: towers keep their cell size, enemies are scaled to one body radius. */
const TOWER_TILE = CELL + 4,
  ENEMY_TILE = 64,
  ENEMY_RADIUS = 15;
const GAP = 6;
/** Fixed animation time, so every run draws the same frame. */
const CLOCK = 0.6;
/** Area traits are drawn as fields several cells wide; in a tile they shrink to a ring around the body. */
const AREAS = ["leader", "healer", "link", "taunt", "cloak", "blind", "jam", "defuse", "suppress", "dampen"] as const satisfies readonly (keyof TraitFlags)[];

export interface GalleryCell {
  kind: "tower" | "enemy";
  id: string;
  /** Canvas pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
}

const towers = Object.keys(DEFAULT_CONTENT.towers) as TowerId[],
  enemies = Object.keys(DEFAULT_CONTENT.enemies) as EnemyId[];
const rows = (n: number) => Math.ceil(n / COLUMNS),
  towerTop = GAP,
  enemyTop = towerTop + rows(towers.length) * (TOWER_TILE + GAP) + 3 * GAP,
  width = GAP + COLUMNS * (Math.max(TOWER_TILE, ENEMY_TILE) + GAP),
  height = enemyTop + rows(enemies.length) * (ENEMY_TILE + GAP);
const cells: GalleryCell[] = [];

class Gallery extends Phaser.Scene {
  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
    towers.forEach((id, i) => this.tile("tower", id, i, towerTop, TOWER_TILE, (g, x, y) => this.tower(g, x, y, id)));
    enemies.forEach((id, i) => this.tile("enemy", id, i, enemyTop, ENEMY_TILE, (g, x, y) => this.enemy(g, x, y, id)));
    (window as unknown as { __gallery: object }).__gallery = { ready: true, cells };
  }
  private tile(kind: GalleryCell["kind"], id: string, i: number, top: number, size: number, draw: (g: Phaser.GameObjects.Graphics, x: number, y: number) => void) {
    const x = GAP + (i % COLUMNS) * (Math.max(TOWER_TILE, ENEMY_TILE) + GAP),
      y = top + Math.floor(i / COLUMNS) * (size + GAP),
      back = this.add.graphics(),
      shape = this.make.graphics({}, false),
      g = this.add.graphics();
    back.fillStyle(0x0d1820);
    back.fillRoundedRect(x, y, size, size, 8);
    // Long bodies and trails must not spill onto the neighbouring tiles.
    shape.fillRoundedRect(x, y, size, size, 8);
    g.setMask(shape.createGeometryMask());
    draw(g, x + size / 2, y + size / 2);
    cells.push({ kind, id, x: x * ZOOM, y: y * ZOOM, w: size * ZOOM, h: size * ZOOM });
  }
  private tower(g: Phaser.GameObjects.Graphics, x: number, y: number, type: TowerId) {
    const definition = DEFAULT_CONTENT.towers[type],
      tower = { id: 0, type, x: 0, y: 0, upgrades: [], cooldown: 0, spent: 0, angle: -Math.PI / 4, kills: 0, owner: 0 };
    drawTower(g, x, y, tower, definition, CLOCK, { markers: 1, maxed: false, boosted: false, color: towerColor(tower) });
  }
  private enemy(g: Phaser.GameObjects.Graphics, x: number, y: number, type: EnemyId) {
    // A real spawn in a throwaway game, so shields, plates and the like start as they do on the field.
    const sim = new Game(),
      e = createEnemy(sim, type, 0.5),
      definition = DEFAULT_CONTENT.enemies[type],
      traits = { ...traitFlags(sim, e), revealed: true, burrowed: false, leaping: false };
    // Draw at the origin, then scale the whole graphic so every body has the same radius. Worms and tentacles
    // trail behind the body (heading 0: to the left), so they get a smaller radius and the body moves right.
    const v = definition.visual,
      tail = v.shape === "worm" ? 0.95 * (v.segments - 1) + 1 : v.shape === "polygon" && v.tentacles ? 2.2 : 1,
      radius = Math.min(ENEMY_RADIUS, (ENEMY_TILE - 10) / (tail + 1)),
      scale = radius / (definition.size * CELL);
    for (const area of AREAS) if (traits[area]) traits[area] = 1.7 * definition.size;
    g.setPosition(x + ((tail - 1) * radius) / 2, y).setScale(scale);
    drawEnemy(g, 0, 0, CELL, e, definition, 0, statusFlags(e, sim.state.time), traits, CLOCK, false);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "gallery",
  width: width * ZOOM,
  height: height * ZOOM,
  transparent: true,
  antialias: true,
  scene: Gallery,
  audio: { noAudio: true },
});
