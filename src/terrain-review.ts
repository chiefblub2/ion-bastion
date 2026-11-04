import Phaser from "phaser";
import { parseMap } from "./content/maps";
import { drawAmbient, drawGates, drawTerrain } from "./render/terrain";
import { THEMES } from "./render/terrain-themes";
import { CELL, px } from "./render/shapes";
import { built, drawBuilt } from "./review-kit";
import type { MapTheme, TowerId } from "./core/types";
// Dev-only page `/gallery.html?terrain`: one sample map through the battlefield's own terrain functions (baked
// terrain, live ambient and gates) with a few towers standing on it, to judge a theme's obstacles, landmarks and path
// against the tilted towers. `&theme=<id>` (default `island`), `&clock=<s>` freezes the animation at that time,
// `&towers=0` leaves the towers out, `&seed=<text>` re-rolls the decoration. Never sets `__gallery.cells`, so `scripts/readme-images.ts` ignores it.

const ZOOM = 2;
const params = new URLSearchParams(location.search),
  theme = (params.get("theme") ?? "island") as MapTheme,
  frozen = params.has("clock") ? Number(params.get("clock")) : undefined,
  withTowers = params.get("towers") !== "0",
  /** `&seed=<text>` renames the sample map, which re-rolls decor, piece kinds and landmark designs. */
  seed = params.get("seed") ?? "";
if (!THEMES[theme]) throw new Error(`Unknown theme "${theme}"`);
/**
 * Sample board: a serpentine path, single obstacles, pairs and 2×2 blocks (landmarks and big pieces), and a coast of
 * obstacles along the left and bottom edges (open sea on a coastal theme; a pair at the top edge is too small for it).
 */
const map = parseMap(
  `terrain-review-${theme}${seed}`,
  "Terrain Review",
  [
    "......#.......##..",
    "S=========.....#..",
    "##.......=..##....",
    "###......=..##..#.",
    "##...#...=........",
    "##.......======...",
    "###...........=.##",
    "####...##.....=.##",
    "#####..##======...",
    "######...=....#...",
    "########.R........",
  ],
  theme,
);
/** Towers on buildable cells, to compare the terrain's tilt with theirs. */
const TOWERS: readonly [TowerId, number, number, number][] = [
  ["pulse", 4, 2, 3],
  ["blast", 11, 4, 5],
  ["flak", 8, 6, 2],
  ["tesla", 13, 9, 4],
  ["frost", 15, 4, 1],
];
export const terrainReviewSize = { width: map.columns * CELL * ZOOM, height: map.rows * CELL * ZOOM };

export class TerrainReview extends Phaser.Scene {
  private ink!: Phaser.GameObjects.Graphics;
  private glow!: Phaser.GameObjects.Graphics;
  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
    const blocked = new Set(map.blocked.map((p) => `${p.x},${p.y}`));
    drawTerrain(this, map, (x, y) => blocked.has(`${x},${y}`));
    this.ink = this.add.graphics();
    this.glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    if (withTowers) {
      const pen = { g: this.add.graphics(), glow: this.add.graphics().setBlendMode(Phaser.BlendModes.ADD) };
      for (const [type, x, y, level] of TOWERS)
        if (!blocked.has(`${x},${y}`) && !map.path.some((p) => p.x === x && p.y === y)) drawBuilt(pen, px(x), px(y), built(type, level, { angle: -0.6 - x * 0.3 }), 0.6);
    }
    this.draw(frozen ?? 0);
    (window as unknown as { __terrain: object }).__terrain = { ready: true, theme };
  }
  override update(time: number) {
    if (frozen === undefined) this.draw(time / 1000);
  }
  private draw(clock: number) {
    this.ink.clear();
    this.glow.clear();
    drawAmbient(this.ink, this.glow, map, clock);
    drawGates({ g: this.ink, glow: this.glow }, map, clock, false, 0);
  }
}
