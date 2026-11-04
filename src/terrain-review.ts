import Phaser from "phaser";
import { parseMap } from "./content/maps";
import { DEFAULT_CONTENT } from "./content";
import { findMission } from "./content/missions";
import { drawAmbient, drawGates, drawTerrain } from "./render/terrain";
import { THEMES } from "./render/terrain-themes";
import { CELL, px } from "./render/shapes";
import { built, drawBuilt } from "./review-kit";
import { mulberry32 } from "./render/terrain-themes/kit";
import { SHEETS } from "./terrain-sheets";
import { type BushKind, bushOf, bushShadow, drawBush, drawPalm, palmOf, palmShadow, type Posture } from "./render/terrain-themes/island-flora";
import type { MapTheme, TowerId } from "./core/types";
// Dev-only page `/gallery.html?terrain`: one sample map through the battlefield's own terrain functions (baked
// terrain, live ambient and gates) with a few towers standing on it, to judge a theme's obstacles, landmarks and path
// against the tilted towers. `&theme=<id>` (default `island`), `&clock=<s>` freezes the animation at that time,
// `&towers=0` leaves the towers out, `&seed=<text>` re-rolls the decoration, `&map=<missionId>` shows a real mission's map, `&focus=<x>,<y>` zooms in on a cell; `&flora` instead
// shows Palm Atoll's plants on sand, `&props` the theme's prop sheet (`terrain-sheets.ts`), (every palm posture and age, every bush, three rolls each). Never sets `__gallery.cells`, so `scripts/readme-images.ts` ignores it.

const params = new URLSearchParams(location.search),
  /** `&focus=<x>,<y>`: a close-up of 6 × 4 cells around that cell instead of the whole board, at `&zoom=` (default 4). */
  focus = params.get("focus")?.split(",").map(Number),
  flora = params.has("flora"),
  /** `&props`: the theme's prop sheet (`terrain-sheets.ts`). */
  props = params.has("props"),
  ZOOM = Number(params.get("zoom") ?? (focus || flora || props ? 3 : 2)),
  VIEW = props ? { w: 9, h: 8 } : flora ? { w: 9, h: 6 } : focus ? { w: 6, h: 4 } : undefined,
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
/** `&map=<missionId>`: that mission's real map (in its own theme unless `&theme=` is given) instead of the sample board. */
const real = params.get("map") ? findMission(params.get("map")!, DEFAULT_CONTENT)?.map : undefined;
const sample = parseMap(
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
const map = real ? { ...real, id: `${real.id}${seed}`, ...(params.has("theme") && { theme }) } : sample;
/** Towers on buildable cells, to compare the terrain's tilt with theirs. */
const TOWERS: readonly [TowerId, number, number, number][] = [
  ["pulse", 4, 2, 3],
  ["blast", 11, 4, 5],
  ["flak", 8, 6, 2],
  ["tesla", 13, 9, 4],
  ["frost", 15, 4, 1],
];
export const terrainReviewSize = { width: (VIEW?.w ?? map.columns) * CELL * ZOOM, height: (VIEW?.h ?? map.rows) * CELL * ZOOM };

export class TerrainReview extends Phaser.Scene {
  private ink!: Phaser.GameObjects.Graphics;
  private glow!: Phaser.GameObjects.Graphics;
  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
    if (flora) return this.flora();
    if (props) return this.props();
    if (focus && VIEW) this.cameras.main.setScroll((focus[0] + 0.5 - VIEW.w / 2) * CELL, (focus[1] + 0.5 - VIEW.h / 2) * CELL);
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
  /** The plant sheet: three rows of palms (upright, curved, leaning; three adults and a young one each), then the bushes. */
  private flora() {
    const w = 9 * CELL,
      h = 6 * CELL,
      g = this.add.graphics(),
      label = (x: number, y: number, text: string) => this.add.text(x, y, text, { fontFamily: "monospace", fontSize: "8px", color: "#6a5634", resolution: ZOOM });
    g.fillStyle(0xf2eada);
    g.fillRect(0, 0, w, h);
    const shadows = this.add.graphics(),
      bodies = this.add.graphics(),
      postures: Posture[] = ["upright", "curved", "leaning"];
    postures.forEach((posture, row) => {
      for (let i = 0; i < 4; i++) {
        const rand = mulberry32(1000 + row * 10 + i),
          p = palmOf(rand, 0, 0, { posture, dir: i * 1.7, adult: i < 3, young: i === 3 }),
          gx = CELL * (1 + i * 1.15),
          gy = CELL * (1.55 + row * 1.5);
        palmShadow(shadows, gx, gy, p);
        drawPalm(bodies, gx, gy, p);
      }
      label(4, CELL * (0.35 + row * 1.5), posture);
    });
    const kinds: BushKind[] = ["seagrape", "hibiscus", "bougainvillea", "agave", "banana"];
    kinds.forEach((kind, i) => {
      for (let j = 0; j < 2; j++) {
        const b = bushOf(mulberry32(2000 + i * 10 + j), 0, 0, kind, 1),
          gx = CELL * (5.9 + j * 1.3),
          gy = CELL * (0.75 + i * 1.08);
        bushShadow(shadows, gx, gy, b);
        drawBush(bodies, gx, gy, b);
      }
      label(CELL * 5.1, CELL * (0.75 + i * 1.08) - 4, kind);
    });
    (window as unknown as { __terrain: object }).__terrain = { ready: true, theme };
  }
  /** The theme's props, five tiles of 1.8 cells to a row (landmarks two tiles wide), on the theme's ground colour. */
  private props() {
    const items = SHEETS[theme] ?? [],
      g = this.add.graphics(),
      tile = CELL * 1.8,
      shadows = this.add.graphics(),
      bodies = this.add.graphics();
    g.fillStyle(THEMES[theme].ground[0]);
    g.fillRect(0, 0, 9 * CELL, 8 * CELL);
    let slot = 0;
    for (const item of items) {
      const span = item.span ?? 1;
      if ((slot % 5) + span > 5) slot += 5 - (slot % 5);
      const x = (slot % 5) * tile + (tile * span) / 2,
        y = Math.floor(slot / 5) * tile * 1.05 + tile * 0.72;
      item.shadow(shadows, x, y);
      item.draw(bodies, x, y);
      this.add.text(x - tile * span * 0.45, y + tile * 0.12, item.label, { fontFamily: "monospace", fontSize: "7px", color: "#9aa49e", resolution: ZOOM });
      slot += span;
    }
    (window as unknown as { __terrain: object }).__terrain = { ready: true, theme };
  }
  override update(time: number) {
    if (flora || props) return;
    if (frozen === undefined) this.draw(time / 1000);
  }
  private draw(clock: number) {
    this.ink.clear();
    this.glow.clear();
    drawAmbient(this.ink, this.glow, map, clock);
    drawGates({ g: this.ink, glow: this.glow }, map, clock, false, 0);
  }
}
