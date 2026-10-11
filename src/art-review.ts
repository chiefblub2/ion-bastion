import Phaser from "phaser";
import { Game } from "./core/game";
import { DEFAULT_CONTENT } from "./content";
import type { EnemyId, MapTheme } from "./core/types";
import { DEPTH } from "./render/depths";
import { artFor, artScale } from "./render/enemy-art";
import { queueEnemyArt, sceneSpriteHost } from "./render/enemy-art-scene";
import { EnemyFeedback } from "./render/enemy-feedback";
import { drawEnemyLayers, EnemySprites } from "./render/enemy-sprites";
import { drawEnemy, enemyContext, type EnemyDrawContext } from "./render/enemies";
import { CELL, shade, type Ink } from "./render/shapes";
import { THEMES } from "./render/terrain";
import { createEnemy } from "./systems/spawn";
import { statusFlags, type StatusFlags } from "./systems/status";
import { traitFlags, type TraitFlags } from "./systems/traits";
// Dev-only artwork QA (`/gallery.html?art`, not part of `vite build`): every painted enemy through the battlefield's
// own sprite path (`EnemySprites` + `drawEnemyLayers`, so the registry's scale, shift and angleOffset and the body
// lift apply exactly as in a mission), at its real size in battlefield pixels, on the path band of several terrains.
//
//   ?art              sheet per enemy: four headings and a diagonal, six terrains, overlays (shield, burning, slowed,
//                     60% HP), a hidden stealth unit, a burrowed one and the procedural fallback; `&page=<n>` (from 0)
//   ?art=lineup       every enemy at heading 0 side by side, ordered by body size (visual hierarchy)
//   ?art=stress       `&n=<count>` (default 400) units turning every frame; `__artReview.stats` holds frame times
//   &zoom=<z>         canvas pixels per battlefield pixel (default 2, like a HiDPI screen); &marks=0 hides the marks
//   &ids=a,b          only these enemies; &tiles=0,5 only these sheet columns (0-3 headings, 4 corner, 5-10
//                     terrains, 11 overlays, 12 hidden, 13 burrowed, 14 procedural)
//
// Marks (above everything): a cross at the logical position and a dashed ring of the body radius `r`, the
// selection and hit geometry that the art never changes. `scripts/enemy-art-review.ts` screenshots every page.

const params = new URLSearchParams(location.search),
  MODE = params.get("art") || "sheet",
  ZOOM = Number(params.get("zoom") ?? 2),
  MARKS = params.get("marks") !== "0",
  PAGE = Number(params.get("page") ?? 0),
  STRESS = Number(params.get("n") ?? 400);
/** Rows per sheet page: one canvas stays well below the browsers' texture limits. */
export const ROWS_PER_PAGE = 12;
const TILE = 96,
  LABEL = 170,
  GAP = 4,
  HEAD = 40;
/** Fixed effect time, so screenshots repeat (idle motion and tints are functions of it). */
const NOW = 0.6;

const content = DEFAULT_CONTENT,
  all = (Object.keys(content.enemies) as EnemyId[]).filter((id) => artFor(id)),
  chosen = params.get("ids")?.split(",").filter((id): id is EnemyId => id in content.enemies) ?? all;
export const reviewPages = Math.ceil(all.length / ROWS_PER_PAGE);

/** Representative terrains: the dark default, icy, light sand, light ash, dark green, deep sea and crystal. */
const TERRAINS: readonly MapTheme[] = ["frost", "dune", "volcano", "jungle", "abyss", "geode"];
/** Headings on the battlefield are per path segment (`Battlefield.heading`), so always one of the four axes. */
const HEADINGS = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
const headingLabel = (a: number) => `${Math.round((a * 180) / Math.PI)}°`;
interface Tile {
  label: string;
  theme: MapTheme;
  heading: number;
  status?: Partial<StatusFlags>;
  traits?: Partial<TraitFlags>;
  hp?: number;
  /** Drawn procedurally, as if the art were missing. */
  procedural?: true;
  /** The path comes in from the left and turns up at the tile centre; the unit has just turned (heading -90°). */
  corner?: true;
}
const TILES: readonly Tile[] = [
  ...HEADINGS.map((heading) => ({ label: headingLabel(heading), theme: "outpost" as const, heading })),
  { label: "corner", theme: "outpost", heading: -Math.PI / 2, corner: true },
  ...TERRAINS.map((theme) => ({ label: theme, theme, heading: 0 })),
  { label: "overlays", theme: "outpost", heading: 0, status: { burning: true, slowed: true }, traits: { shield: 0.7 }, hp: 0.6 },
  { label: "hidden", theme: "outpost", heading: 0, traits: { stealth: true, revealed: false } },
  { label: "burrowed", theme: "outpost", heading: 0, traits: { burrowed: true } },
  { label: "procedural", theme: "outpost", heading: 0, procedural: true },
];
/** `&tiles=0,5,11`: only these columns (indices into `TILES`), for close-ups. */
const SHEET = params.get("tiles")?.split(",").map((i) => TILES[Number(i)]).filter(Boolean) ?? TILES;
/** Area traits shrink to a ring around the body, as in the gallery. */
const AREAS = ["leader", "healer", "link", "taunt", "cloak", "blind", "jam", "defuse", "suppress", "dampen"] as const satisfies readonly (keyof TraitFlags)[];

const font = (size: number, color = "#cfe3ef") => ({ fontFamily: "monospace", fontSize: `${size}px`, color, resolution: ZOOM });
const sheetRows = chosen.slice(PAGE * ROWS_PER_PAGE, (PAGE + 1) * ROWS_PER_PAGE);
const lineupColumns = 12,
  size = {
    sheet: { width: LABEL + SHEET.length * (TILE + GAP) + GAP, height: HEAD + sheetRows.length * (TILE + GAP) },
    lineup: { width: GAP + lineupColumns * (TILE + GAP), height: HEAD + Math.ceil(chosen.length / lineupColumns) * (TILE + 14 + GAP) },
    stress: { width: 1200, height: 800 },
  }[MODE] ?? { width: 400, height: 200 };
export const artReviewSize = { width: Math.round(size.width * ZOOM), height: Math.round(size.height * ZOOM) };

/**
 * A path band through the tile along the heading, drawn like `drawTerrain` draws the path (glow, edge, bed, lane);
 * a corner tile bends it from the left edge up to the top edge.
 */
function ground(g: Phaser.GameObjects.Graphics, theme: MapTheme, x: number, y: number, w: number, h: number, heading: number, corner = false) {
  const t = THEMES[theme],
    cx = x + w / 2,
    cy = y + h / 2,
    dx = Math.abs(Math.cos(heading)) * (w / 2),
    dy = Math.abs(Math.sin(heading)) * (h / 2),
    legs = corner ? [[x, cy, cx, cy], [cx, cy, cx, y]] : [[cx - dx, cy - dy, cx + dx, cy + dy]];
  g.fillStyle(t.ground[0]);
  g.fillRect(x, y, w, h);
  const band = (width: number, color: number, alpha = 1) => {
    g.lineStyle(width, color, alpha);
    for (const [x0, y0, x1, y1] of legs) g.lineBetween(x0, y0, x1, y1);
    // Flat caps leave a notch in the bend; a square fills it.
    if (corner) {
      g.fillStyle(color, alpha);
      g.fillRect(cx - width / 2, cy - width / 2, width, width);
    }
  };
  // The outer glow is clipped to the tile, so neighbouring tiles stay clean.
  band(Math.min(54, w), t.path.line, 0.06);
  band(42, t.path.edge);
  band(38, t.path.bed);
  band(20, shade(t.path.bed, 0.06));
  band(2, t.path.line, 0.4);
}

export class ArtReview extends Phaser.Scene {
  private sprites = new EnemySprites(sceneSpriteHost(this));
  private feedback = new EnemyFeedback();
  private sim = new Game();
  private layers!: { underlay: Ink; body: Ink; overlay: Ink };
  private marks!: Phaser.GameObjects.Graphics;
  preload() {
    queueEnemyArt(this);
  }
  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
    this.layers = {
      underlay: this.add.graphics().setDepth(DEPTH.enemyUnderlay),
      body: this.add.graphics().setDepth(DEPTH.enemyBody),
      overlay: this.add.graphics().setDepth(DEPTH.enemyOverlay),
    };
    this.marks = this.add.graphics().setDepth(DEPTH.foreground);
    const review = { ready: false, mode: MODE, pages: reviewPages, stats: undefined as unknown };
    (window as unknown as { __artReview: typeof review }).__artReview = review;
    if (MODE === "stress") return this.stress(review);
    const units = MODE === "lineup" ? this.lineup() : this.sheet();
    drawEnemyLayers(this.layers, this.sprites, units, { now: NOW, feedback: this.feedback });
    review.ready = true;
  }
  /** One enemy as on the battlefield: a real spawn (shields, plates), the tile's flags on top. */
  private unit(type: EnemyId, x: number, y: number, tile: Pick<Tile, "heading" | "status" | "traits" | "hp">): EnemyDrawContext {
    const e = createEnemy(this.sim, type, 0.5),
      definition = content.enemies[type],
      traits = { ...traitFlags(this.sim, e), revealed: true, burrowed: false, leaping: false, ...tile.traits };
    for (const area of AREAS) if (traits[area]) traits[area] = 1.7 * definition.size;
    if (tile.hp) e.hp = Math.round(e.maxHp * tile.hp);
    return enemyContext(x, y, CELL, e, definition, tile.heading, { ...statusFlags(e, 0), ...tile.status }, traits, NOW);
  }
  private mark(c: EnemyDrawContext) {
    if (!MARKS) return;
    const g = this.marks;
    g.lineStyle(1, 0xff3df2, 0.95);
    g.lineBetween(c.x - 4, c.y, c.x + 4, c.y);
    g.lineBetween(c.x, c.y - 4, c.x, c.y + 4);
    g.lineStyle(1, 0xffffff, 0.45);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      g.beginPath();
      g.arc(c.x, c.y, c.r, a, a + Math.PI / 12);
      g.strokePath();
    }
  }
  private sheet() {
    const bg = this.add.graphics().setDepth(DEPTH.terrain),
      units: EnemyDrawContext[] = [];
    this.add.text(GAP, 6, `Enemy art review · page ${PAGE + 1}/${Math.ceil(chosen.length / ROWS_PER_PAGE)} · effect clock ${NOW} s · ${ZOOM}× · cross: position, dashed ring: body radius`, font(11));
    SHEET.forEach((tile, i) => this.add.text(LABEL + i * (TILE + GAP) + 3, HEAD - 14, tile.label, font(9, "#7f97a6")));
    sheetRows.forEach((type, row) => {
      const y = HEAD + row * (TILE + GAP),
        d = content.enemies[type],
        art = artFor(type)!,
        tuning = [`scale ${artScale(art).toFixed(2)}`, art.pose, art.shift && `shift ${art.shift}`, art.angleOffset && `angle ${art.angleOffset.toFixed(2)}`].filter(Boolean).join(" · ");
      this.add.text(GAP, y + 6, type, font(12));
      this.add.text(GAP, y + 24, `${d.name}\n${d.layer} · size ${d.size} · ${d.hp} HP\n${tuning}`, { ...font(9, "#7f97a6"), lineSpacing: 2 });
      SHEET.forEach((tile, i) => {
        const x = LABEL + i * (TILE + GAP);
        ground(bg, tile.theme, x, y, TILE, TILE, tile.heading, tile.corner);
        const c = this.unit(type, x + TILE / 2, y + TILE / 2, tile);
        if (tile.procedural) {
          // The fallback as the battlefield draws it when a texture is missing.
          drawEnemy(this.add.graphics().setDepth(DEPTH.enemyBody), c.x, c.y, CELL, c.enemy, d, tile.heading, c.status, c.traits, NOW);
          this.mark(c);
          return;
        }
        units.push(c);
        this.mark(c);
      });
    });
    return units;
  }
  private lineup() {
    const bg = this.add.graphics().setDepth(DEPTH.terrain),
      ordered = [...chosen].sort((a, b) => content.enemies[a].size - content.enemies[b].size || a.localeCompare(b));
    this.add.text(GAP, 6, `Enemy line-up by body size · heading 0 · ${ZOOM}×`, font(11));
    return ordered.map((type, i) => {
      const x = GAP + (i % lineupColumns) * (TILE + GAP),
        y = HEAD + Math.floor(i / lineupColumns) * (TILE + 14 + GAP);
      ground(bg, "outpost", x, y, TILE, TILE, 0);
      this.add.text(x + 2, y + TILE + 1, `${type} ${content.enemies[type].size}`, font(9, "#7f97a6"));
      const c = this.unit(type, x + TILE / 2, y + TILE / 2, { heading: 0 });
      this.mark(c);
      return c;
    });
  }
  /**
   * Dense-wave timing: `STRESS` units of all painted types on a grid, turning and moving every frame through the
   * full per-frame path (feedback, sprite sync, three layers). Records the mean and p95 frame time and the CPU time
   * of the enemy draw itself after a warm-up.
   */
  private stress(review: { ready: boolean; stats: unknown }) {
    const columns = 25,
      base = Array.from({ length: STRESS }, (_, i) => this.unit(all[i % all.length], 24 + (i % columns) * 46, 24 + Math.floor(i / columns) * 46, { heading: 0 })),
      frames: number[] = [],
      draws: number[] = [];
    this.add.text(GAP, size.height - 16, `${STRESS} units`, font(11));
    let last = performance.now(),
      t = 0;
    this.events.on(Phaser.Scenes.Events.UPDATE, (_: number, delta: number) => {
      t += delta / 1000;
      const now = performance.now();
      frames.push(now - last);
      last = now;
      for (const l of Object.values(this.layers)) (l as Phaser.GameObjects.Graphics).clear();
      const units = base.map((c, i) => ({ ...c, x: c.x + Math.sin(t * 2 + i) * 6, heading: t + i, clock: t }));
      const start = performance.now();
      drawEnemyLayers(this.layers, this.sprites, units, { now: t, feedback: this.feedback });
      draws.push(performance.now() - start);
      if (frames.length === 240) {
        const tail = (xs: number[]) => xs.slice(60).sort((a, b) => a - b),
          mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length,
          f = tail(frames),
          d = tail(draws);
        review.stats = {
          units: STRESS,
          images: this.sprites.size,
          textures: all.filter((id) => this.textures.exists(artFor(id)!.texture)).length,
          renderer: this.sys.game.renderer.type === Phaser.WEBGL ? "webgl" : "canvas",
          frameMs: { mean: mean(f), p95: f[Math.floor(f.length * 0.95)] },
          enemyDrawMs: { mean: mean(d), p95: d[Math.floor(d.length * 0.95)] },
        };
        review.ready = true;
      }
    });
  }
}


