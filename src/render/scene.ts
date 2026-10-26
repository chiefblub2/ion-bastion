import Phaser from "phaser";
import { Game, FIXED_STEP, isRunning } from "../core/game";
import { isFullyUpgraded, resolveUpgrades, towerColor, towerLevel, towerPath } from "../core/upgrades";
import { attackModule, isSupport } from "../systems/attacks";
import { effectiveTowerStats, isInAura } from "../systems/auras";
import { statusFlags } from "../systems/status";
import { isHidden, traitFlags } from "../systems/traits";
import { headingOnPath } from "../systems/path";
import { enemyAt } from "./pick";
import type { GameEvent, GameState, Point, Tower, TowerId } from "../core/types";
import { PLAYER_COLORS } from "../net/protocol";
import { evictFor } from "./effect-budget";
import { drawEffect, effectLifetime, groundLight, INCOME_LIFETIME, isVisual, type EffectOrigin, type VisualEvent } from "./effects";
import { DEPTH } from "./depths";
import { enemyContext } from "./enemies";
import { killedEnemies } from "./enemy-animator";
import { missionAnimationTypes, missionEnemyTypes } from "./enemy-animations";
import { queueEnemyAnimations, queueEnemyArt, sceneSpriteHost } from "./enemy-art-scene";
import { EnemyFeedback } from "./enemy-feedback";
import { drawEnemyLayers, EnemySprites } from "./enemy-sprites";
import { drawControlMarks } from "./control-marks";
import { drawZones } from "./zones";
import { drawSupportFx } from "./support-fx";
import { drawStrikes } from "./strikes";
import { familyOf, type Family } from "../audio/families";
import { halo } from "./material";
import { arcBand, CELL, disc, fillRound, px, ring, strokeRound, type Pen } from "./shapes";
import { pathCoverage, towerReach } from "./coverage";
import { drawAmbient, drawGates, drawTerrain, themeAccent, themeGlow } from "./terrain";
import { FrameStats } from "./frame-stats";
import { drawTower, type TowerBadges } from "./towers";
import { TowerBodies } from "./tower-bodies";
import { ScreenFx } from "./screen-fx";
import { loadGraphics } from "./graphics-settings";
import { Trails } from "./trails";
import { TurretAim } from "./aim";
import { Scorches } from "./decals";
import { anchorView, type BoardSize, type BoardView, clampView, fittedView, panView, snapCell, toScreen, toWorld, ZOOMED } from "./board-camera";
export { CELL } from "./shapes";
/** Upper bound for the canvas's longer side in pixels, so a huge 4K full screen stays cheap to fill. */
const MAX_CANVAS = 4096;
/** Seconds a tower's pulse fades after its family's music note. */
const PULSE = 0.25;
/** Seconds the reactor flares red after a leak. */
const LEAK_ALARM = 1.2;
export interface ViewState {
  build: TowerId | null;
  selected: number | null;
  /** Selected enemy id, shown in the sidebar; independent of the tower selection. */
  enemy: number | null;
  hover: Point | null;
  speed: number;
  /** Local player: 0 in single-player and for the co-op host. */
  player: number;
  /** Open tab of the build menu, an index into `TOWER_PAGES`. */
  page: number;
  /** The coverage overlay (key C): every attack tower's range and how well each path cell is covered. */
  coverage: boolean;
  /** A board cell the Training coach points at; absent everywhere else. */
  highlight?: Point;
  /** Touch only: the cell a tap picked for the armed tower, waiting for ✓ or ✕; absent otherwise. */
  pending?: Point;
  /** The player zoomed into the battlefield (pinch); DOM callouts then dock instead of following the board grid. */
  zoomed?: boolean;
}
/** Advances the simulation once per render frame. */
export interface Driver {
  advance(dt: number): void;
  /** Drops leftover time, e.g. after a mission change. */
  reset?(): void;
}
/** Single-player: fixed steps from real time, scaled by the chosen speed. */
export class LocalDriver implements Driver {
  private accumulator = 0;
  constructor(
    private sim: Game,
    private view: ViewState,
  ) {}
  advance(dt: number) {
    if (this.sim.state.paused || !isRunning(this.sim.state)) {
      this.accumulator = 0;
      return;
    }
    this.accumulator += dt * this.view.speed;
    while (this.accumulator >= FIXED_STEP) {
      this.sim.tick();
      this.accumulator -= FIXED_STEP;
    }
  }
  reset() {
    this.accumulator = 0;
  }
}
/** Finger or pen: no reliable hover, so building asks first. */
const isTouch = (p: Phaser.Input.Pointer) => p.wasTouch || ["touch", "pen"].includes((p.event as PointerEvent | undefined)?.pointerType ?? "");
interface Hooks {
  /** `keepBuilding`: stay in build mode after placing (Shift+click). `touch`: a tap, which asks before building. */
  chooseCell: (x: number, y: number, keepBuilding: boolean, touch: boolean) => void;
  /** Click on a visible enemy outside build mode. */
  chooseEnemy: (id: number) => void;
  /** Right click: leave build mode and drop the selection. */
  cancel: () => void;
  refresh: () => void;
  events: (events: GameEvent[]) => void;
  /** Seconds since each tower family's latest music note (sound on); towers pulse with it. */
  pulses?: () => Partial<Record<Family, number>>;
}
/** Four L-shaped brackets inside the box (x0, y0)–(x1, y1), arms `arm` long and `w` thick, in the current fill. */
function cornerBrackets(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, arm: number, w: number) {
  for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
    g.fillRect(dx > 0 ? cx : cx - arm, dy > 0 ? cy : cy - w, arm, w);
    g.fillRect(dx > 0 ? cx : cx - w, dy > 0 ? cy : cy - arm, w, arm);
  }
}
/** CSS pixels a tap may miss an enemy's body by and still pick it; the mouse keeps 6 world pixels. */
const TOUCH_SLACK = 16;
/** CSS pixels a finger may move before a tap becomes a drag. */
const TAP_MOVE = 10;
/** A finger gesture on the board: a tap until it moves, a pan of the zoomed board, a pinch, or done (ignored to the end). */
type Gesture =
  | { kind: "tap" | "pan"; start: Point; last: Point }
  | { kind: "pinch"; anchor: Point; distance: number; zoom: number }
  | { kind: "done" };
interface Effect {
  event: VisualEvent;
  age: number;
  /** What the effect knows about its source from the moment it arrived. */
  origin?: EffectOrigin;
  /** Floating "+N ◇" over a refinery payout. */
  label?: Phaser.GameObjects.Text;
}
export class Battlefield extends Phaser.Scene {
  /**
   * The static terrain, baked once into a texture at the camera's zoom (re-baked when the zoom changes), so the
   * richly drawn ground costs nothing per frame. `terrainParts` are the hidden source objects of `drawTerrain`.
   */
  private terrain?: Phaser.GameObjects.RenderTexture;
  private terrainParts: Phaser.GameObjects.GameObject[] = [];
  private terrainZoom = 0;
  private ambient!: Phaser.GameObjects.Graphics;
  /** Build-mode cell hints and the coverage overlay. */
  private hints!: Phaser.GameObjects.Graphics;
  /** The tower about to be built, drawn faintly on the hovered cell. */
  private ghost!: Phaser.GameObjects.Graphics;
  /** Cells the armed tower may be built on, recomputed only when the towers, the status or the armed tower change. */
  private buildCells: { key: string; cells: Point[] } = { key: "", cells: [] };
  private still = matchMedia("(prefers-reduced-motion: reduce)");
  /** Towers and their light lie below the enemies, so units cover them and health bars are never lit. */
  private towerInk!: Phaser.GameObjects.Graphics;
  private towerGlow!: Phaser.GameObjects.Graphics;
  /**
   * Enemies in three stages, each a layer across all units: fields, trails and shadows, then bodies, then markers and
   * HP bars. A body never covers another unit's HP bar, and the body layer can later be swapped for sprites.
   */
  private enemyUnderlay!: Phaser.GameObjects.Graphics;
  private enemyBody!: Phaser.GameObjects.Graphics;
  private enemyOverlay!: Phaser.GameObjects.Graphics;
  /**
   * Painted bodies (Images at `DEPTH.enemySprites`) for enemy types with art, animated where sheets exist; they
   * replace the procedural body. Death animations outlive their unit for a moment, render only.
   */
  private enemySprites = new EnemySprites(sceneSpriteHost(this));
  /** Render-only hit flashes and shield ripples per enemy id, on the effect clock. */
  private enemyFeedback = new EnemyFeedback();
  /** Clock and feedback for enemy tints, idle motion and accents; `now` follows `fxClock` every frame. */
  private enemyLook = { now: 0, feedback: this.enemyFeedback };
  /** Foreground above the enemies: selection ring, shots, effects, portal pulse, and the additive light of shots and effects. */
  private ink!: Phaser.GameObjects.Graphics;
  private glow!: Phaser.GameObjects.Graphics;
  private effects: Effect[] = [];
  /** Muzzles that flashed in this frame's batch of events; a salvo flashes once per barrel. */
  private flashed = new Set<string>();
  /** `fxClock` of the last leak, for the reactor's alarm flare. */
  private lastLeak = -Infinity;
  private trails = new Trails();
  private aim = new TurretAim();
  private scorches = new Scorches();
  private angleOf = (t: Tower) => this.aim.angle(t);
  /** Still tower bodies baked into textures; only turrets, lamps and light are drawn per frame. */
  private bodies = new TowerBodies(this);
  /**
   * Badges per tower id, recomputed only when a tower is built, sold or upgraded (`key`): they need the upgrade
   * resolution and the aura query, too costly to run for every tower in every frame.
   */
  private looks = { key: "", byId: new Map<number, TowerBadges>() };
  /** Bloom, reactor-hit flash and strike shake (WebGL only), switched by the Bloom setting. */
  private screenFx = new ScreenFx(this, () => this.still.matches);
  /** The Bloom setting; `main.ts` changes it through `setGlow`. */
  bloom = loadGraphics().glow;
  /** Effect time: advances only while the game is not paused, like the age of effects. */
  private fxClock = 0;
  /** State the trails and effects belong to; a restart swaps it without restarting the scene. */
  private tracked?: GameState;
  /** Swapped for a lockstep driver in co-op. */
  driver: Driver;
  private clock = 0;
  private lastUI = 0;
  /** Canvas pixels per world pixel; text renders at this resolution so it stays sharp when the board is scaled up. */
  private textResolution = 1;
  private observer?: ResizeObserver;
  /** The player's zoom and pan (touch); the fitted board at zoom 1. */
  private boardView: BoardView = { zoom: 1, x: 0, y: 0 };
  /** Camera zoom of the fitted board, per axis; the player's zoom multiplies it. */
  private baseZoom = { x: 1, y: 1 };
  private gesture: Gesture | null = null;
  /** Time of the last finger lift; compatibility mouse events right after it are not clicks. */
  private lastTouch = -Infinity;
  /** Dev builds only: frame timings for `scripts/frame-bench.ts`; render hooks are added once per game. */
  private stats = import.meta.env.DEV ? new FrameStats() : undefined;
  private statsHooked = false;
  constructor(
    private sim: Game,
    private view: ViewState,
    private hooks: Hooks,
  ) {
    super("battlefield");
    this.driver = new LocalDriver(sim, view);
  }
  create() {
    // The mission's animation sheets (about 2 MB each) load in the background: on a slow host, waiting for them in
    // `preload` left the board blank after a mission change. Until a sheet arrives its enemies show their static art.
    // The static art follows the same plan: only the mission's own types, the others released.
    queueEnemyArt(this, missionEnemyTypes(this.sim.mission, this.sim.content));
    queueEnemyAnimations(this, missionAnimationTypes(this.sim.mission, this.sim.content));
    this.load.start();
    this.effects = [];
    // Phaser destroys the scene's objects on shutdown; drop the sprite references with them.
    const cleanup = () => {
      this.enemySprites.reset();
      this.enemyFeedback.reset();
      this.bodies.reset();
      this.screenFx.reset();
      // A resize between shutdown and the next `create` must not bake the destroyed terrain of the old mission.
      this.terrainParts = [];
      this.terrain = undefined;
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
      this.events.off(Phaser.Scenes.Events.DESTROY, cleanup);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    this.trails.reset();
    this.aim.reset();
    this.scorches.reset();
    this.driver.reset?.();
    // A new mission (or restart) shows the whole board again.
    this.boardView = fittedView(this.boardSize());
    this.resize();
    // FIT never changes the game size on its own; follow every size change of the board (window, full screen, layout).
    if (!this.observer && this.scale.parent) {
      this.observer = new ResizeObserver(() => this.fit());
      this.observer.observe(this.scale.parent);
      // Phaser has one touch pointer; if a touch's end never arrives, every later tap on the board is ignored. Before
      // Phaser sees a new touch, free any pointer whose finger is no longer on the screen.
      this.scale.parent.addEventListener("touchstart", (e: TouchEvent) => this.releaseLostTouches(e), { capture: true, passive: true });
      this.bindTouch(this.scale.parent);
      document.getElementById("board-fit")?.addEventListener("click", () => this.resetZoom());
    }
    this.terrainParts = drawTerrain(this, this.sim.map, (x, y) => this.sim.isBlocked(x, y));
    for (const part of this.terrainParts) (part as Phaser.GameObjects.Graphics).setVisible(false);
    this.terrain = undefined;
    this.terrainZoom = 0;
    this.bakeTerrain();
    // Explicit depths (`DEPTH`), so sprites created mid-game sort between the enemy layers; equal depths keep creation order.
    this.ambient = this.add.graphics().setDepth(DEPTH.ambient);
    // Additive light is dimmed on light ground, so it never washes out.
    const glow = themeGlow(this.sim.map);
    this.towerInk = this.add.graphics().setDepth(DEPTH.towers);
    this.towerGlow = this.add.graphics().setDepth(DEPTH.towers).setBlendMode(Phaser.BlendModes.ADD).setAlpha(glow);
    this.hints = this.add.graphics().setDepth(DEPTH.hints);
    this.ghost = this.add.graphics().setDepth(DEPTH.towers).setAlpha(0.55);
    this.buildCells = { key: "", cells: [] };
    this.enemyUnderlay = this.add.graphics().setDepth(DEPTH.enemyUnderlay);
    this.enemyBody = this.add.graphics().setDepth(DEPTH.enemyBody);
    this.enemyOverlay = this.add.graphics().setDepth(DEPTH.enemyOverlay);
    this.ink = this.add.graphics().setDepth(DEPTH.foreground);
    this.glow = this.add.graphics().setDepth(DEPTH.foreground).setBlendMode(Phaser.BlendModes.ADD).setAlpha(glow);
    this.screenFx.setEnabled(this.bloom);
    for (const layer of [this.towerGlow, this.glow]) this.screenFx.bloom(layer, this.cameras.main.zoomX);
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      // A finger has no hover; its preview is the pending cell.
      if (isTouch(p)) return;
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      this.view.hover = { x: Math.floor(w.x / CELL), y: Math.floor(w.y / CELL) };
    });
    this.input.on("gameout", () => {
      this.view.hover = null;
    });
    // Right click cancels instead of opening the browser menu on the board.
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      // Fingers go through `bindTouch` (taps, pinch, pan), including the mouse events a browser may send after them.
      if (p.wasTouch || performance.now() - this.lastTouch < 800) return;
      if (p.rightButtonDown()) return this.hooks.cancel();
      const shift = (p.event as MouseEvent | undefined)?.shiftKey ?? false,
        touch = isTouch(p),
        w = this.cameras.main.getWorldPoint(p.x, p.y);
      if (touch) this.view.hover = null;
      const enemy = this.view.build ? undefined : enemyAt(this.sim, w.x, w.y, CELL, touch ? this.touchSlack() : undefined);
      if (enemy) return this.hooks.chooseEnemy(enemy.id);
      this.hooks.chooseCell(Math.floor(w.x / CELL), Math.floor(w.y / CELL), shift, touch);
    });
    this.sharpenText();
    this.hooks.refresh();
    // Dev builds only: the sprite manager for QA scripts (live and dying counts); stripped from `vite build`.
    if (import.meta.env.DEV) (window as unknown as { __enemySprites: EnemySprites }).__enemySprites = this.enemySprites;
    if (this.stats && !this.statsHooked) {
      const stats = this.stats;
      let start = 0;
      this.game.events.on(Phaser.Core.Events.PRE_RENDER, () => (start = performance.now()));
      this.game.events.on(Phaser.Core.Events.POST_RENDER, () => {
        const now = performance.now();
        stats.add("render", now - start);
        stats.tick(now);
      });
      (window as unknown as { __frameStats: FrameStats }).__frameStats = stats;
      this.statsHooked = true;
    }
  }
  private releaseLostTouches(e: TouchEvent) {
    const down = new Set(Array.from(e.touches, (t) => t.identifier));
    for (const p of this.input.manager.pointers) if (p.id > 0 && p.active && !down.has(p.identifier)) p.reset();
  }
  /** Refits the canvas after its container changed size, e.g. entering full screen or leaving the start screen. */
  fit() {
    // Before Phaser has booted the scene there is nothing to fit yet.
    if (!this.scale || !this.cameras?.main) return;
    this.resize();
    this.scale.refresh();
  }
  /** Page rectangle of a board cell, for DOM callouts, through the player's zoom; null before the canvas is laid out. */
  cellRect(cell: Point): DOMRect | null {
    const r = this.game?.canvas?.getBoundingClientRect();
    if (!r?.width) return null;
    const size = this.boardSize(r),
      a = toScreen(this.boardView, { x: cell.x * CELL, y: cell.y * CELL }, size),
      b = toScreen(this.boardView, { x: (cell.x + 1) * CELL, y: (cell.y + 1) * CELL }, size);
    return new DOMRect(r.left + a.x, r.top + a.y, b.x - a.x, b.y - a.y);
  }
  /** The board's CSS size (the canvas) and the world it shows at zoom 1. */
  private boardSize(rect?: DOMRect): BoardSize {
    const r = rect ?? this.game?.canvas?.getBoundingClientRect();
    return { width: r?.width || 1, height: r?.height || 1, worldWidth: this.sim.map.columns * CELL, worldHeight: this.sim.map.rows * CELL };
  }
  /** Back to the whole board (the ⤢ button). */
  resetZoom() {
    this.boardView = fittedView(this.boardSize());
    this.applyCamera(true);
  }
  /**
   * Points the camera at the player's view. During a gesture only the camera moves (the baked terrain and tower
   * bodies scale with it); `final` re-bakes them at the new zoom so they are sharp again.
   */
  private applyCamera(final: boolean) {
    const v = this.boardView,
      camera = this.cameras.main;
    camera.setZoom(this.baseZoom.x * v.zoom, this.baseZoom.y * v.zoom).centerOn(v.x, v.y);
    if (!final) return;
    const zoom = Math.max(camera.zoomX, camera.zoomY),
      zoomed = v.zoom > ZOOMED;
    this.textResolution = Math.max(1, zoom);
    this.sharpenText();
    this.bakeTerrain();
    this.bodies.setZoom(zoom);
    this.screenFx.setZoom(camera.zoomX);
    if (!!this.view.zoomed !== zoomed) {
      if (zoomed) this.view.zoomed = true;
      else delete this.view.zoomed;
      const fitButton = document.getElementById("board-fit");
      if (fitButton) fitButton.hidden = !zoomed;
      // Zoomed in, one finger pans the board instead of scrolling the page.
      this.scale.parent?.classList.toggle("zoomed", zoomed);
    }
    this.hooks.refresh();
  }
  /** Fingers on the board: a tap picks (on lift, so a drag or pinch never builds), two fingers zoom, one pans when zoomed. */
  private bindTouch(el: HTMLElement) {
    const local = (t: Touch) => {
        const r = this.game.canvas.getBoundingClientRect();
        return { x: t.clientX - r.left, y: t.clientY - r.top };
      },
      pair = (e: TouchEvent) => {
        const a = local(e.touches[0]),
          b = local(e.touches[1]),
          dx = a.x - b.x,
          dy = a.y - b.y;
        return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.max(1, Math.sqrt(dx * dx + dy * dy)) };
      };
    el.addEventListener("touchstart", (e) => {
      if (e.touches.length >= 2) {
        const { mid, distance } = pair(e);
        this.gesture = { kind: "pinch", anchor: toWorld(this.boardView, mid, this.boardSize()), distance, zoom: this.boardView.zoom };
        e.preventDefault();
      } else if (e.touches.length === 1) {
        const p = local(e.touches[0]);
        this.gesture = { kind: "tap", start: p, last: p };
      }
    }, { passive: false });
    el.addEventListener("touchmove", (e) => {
      const g = this.gesture;
      if (!g || g.kind === "done") return;
      if (g.kind === "pinch") {
        if (e.touches.length < 2) return;
        const { mid, distance } = pair(e);
        this.boardView = anchorView(g.anchor, mid, (g.zoom * distance) / g.distance, this.boardSize());
        this.applyCamera(false);
        e.preventDefault();
        return;
      }
      const p = local(e.touches[0]);
      if (g.kind === "tap" && Math.abs(p.x - g.start.x) + Math.abs(p.y - g.start.y) > TAP_MOVE) {
        // At zoom 1 a drag is the page's (scrolling); zoomed in it pans the board.
        if (this.boardView.zoom <= ZOOMED) return void (this.gesture = { kind: "done" });
        g.kind = "pan";
      }
      if (g.kind === "pan") {
        this.boardView = panView(this.boardView, p.x - g.last.x, p.y - g.last.y, this.boardSize());
        this.applyCamera(false);
        e.preventDefault();
      }
      g.last = p;
    }, { passive: false });
    const end = (e: TouchEvent) => {
      this.lastTouch = performance.now();
      const g = this.gesture;
      // One finger of a pinch lifted: the other must not tap or pan when it lifts.
      if (e.touches.length) {
        if (g?.kind === "pinch") {
          this.gesture = { kind: "done" };
          this.applyCamera(true);
        }
        return;
      }
      this.gesture = null;
      if (!g || e.type === "touchcancel") {
        if (g && g.kind !== "tap") this.applyCamera(true);
        return;
      }
      if (g.kind === "tap") this.tap(g.start);
      else this.applyCamera(true);
    };
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
  }
  /** A tap on the board: an enemy near the finger (outside build mode), else the cell, snapped to a buildable neighbour. */
  private tap(p: Point) {
    const size = this.boardSize(),
      w = toWorld(this.boardView, p, size),
      { columns, rows } = this.sim.map;
    this.view.hover = null;
    const enemy = this.view.build ? undefined : enemyAt(this.sim, w.x, w.y, CELL, this.touchSlack());
    if (enemy) return this.hooks.chooseEnemy(enemy.id);
    let cell = { x: Math.floor(w.x / CELL), y: Math.floor(w.y / CELL) };
    if (cell.x < 0 || cell.y < 0 || cell.x >= columns || cell.y >= rows) return;
    const build = this.view.build;
    if (build && !this.sim.state.towers.some((t) => t.x === cell.x && t.y === cell.y))
      cell = snapCell(w, CELL, columns, rows, (x, y) => this.sim.canBuild(x, y, build), Math.max(this.touchSlack(), CELL * 0.3));
    this.hooks.chooseCell(cell.x, cell.y, false, true);
  }
  /** Redraws the terrain after a mission change; `create()` sizes the canvas for the new map. */
  reload() {
    this.scene.restart();
  }
  /**
   * Renders the canvas at the board's device-pixel size instead of the world size, so FIT does not upscale
   * a small bitmap (blurry in full screen and on HiDPI screens). The camera zoom keeps world coordinates in CELL units.
   */
  private resize() {
    this.scale.getParentBounds();
    const parent = this.scale.parentSize,
      worldWidth = this.sim.map.columns * CELL,
      worldHeight = this.sim.map.rows * CELL;
    // The menu view hides the board (0×0); keep the last size until it is shown again.
    if (parent.width <= 0 || parent.height <= 0) return;
    const fit = Math.min(parent.width / worldWidth, parent.height / worldHeight),
      dpr = Math.min(window.devicePixelRatio || 1, 2),
      zoom = Math.min(fit * dpr, MAX_CANVAS / Math.max(worldWidth, worldHeight)),
      width = Math.max(1, Math.round(worldWidth * zoom)),
      height = Math.max(1, Math.round(worldHeight * zoom));
    if (width !== this.scale.gameSize.width || height !== this.scale.gameSize.height) this.scale.setGameSize(width, height);
    // Zoomed about its centre and centred on the view: Phaser's filter cameras (bloom) assume the default origin.
    this.cameras.main.setSize(width, height);
    this.baseZoom = { x: width / worldWidth, y: height / worldHeight };
    this.boardView = clampView(this.boardView, this.boardSize());
    this.applyCamera(true);
  }
  /** Draws the terrain's source objects into a texture of the canvas's pixel size, shown at world size. */
  private bakeTerrain() {
    const camera = this.cameras.main,
      width = this.sim.map.columns * CELL,
      height = this.sim.map.rows * CELL,
      // Zoomed in, the texture grows with the camera up to the largest texture phones take.
      zoom = Math.min(Math.max(camera.zoomX, camera.zoomY), MAX_CANVAS / Math.max(width, height));
    if (!this.terrainParts.length || Math.abs(zoom - this.terrainZoom) < 0.01) return;
    this.terrainZoom = zoom;
    this.terrain?.destroy();
    const texture = this.add
      .renderTexture(0, 0, Math.ceil(width * zoom), Math.ceil(height * zoom))
      .setOrigin(0, 0)
      .setDepth(DEPTH.terrain);
    texture.setDisplaySize(width, height);
    texture.camera.setOrigin(0, 0).setZoom(zoom);
    // The map labels are Text: render them at the texture's resolution too.
    this.textResolution = Math.max(1, zoom);
    this.sharpenText();
    // Phaser 4 queues draws until `render()`.
    texture.draw(this.terrainParts).render();
    this.terrain = texture;
  }
  private sharpenText() {
    for (const child of this.children.list)
      if (child instanceof Phaser.GameObjects.Text) {
        child.setResolution(this.textResolution);
        // Phaser reads the source resolution only at construction; without this the bigger bitmap would also draw bigger.
        child.frame.source.resolution = this.textResolution;
      }
  }
  /** Direction of travel at a path distance, for oriented flying units. */
  private heading(distance: number) {
    return headingOnPath(this.sim.map.path, distance, this.sim.map.loop);
  }
  /**
   * Pick slack for a finger in world pixels: `TOUCH_SLACK` CSS pixels around a unit's body, through the canvas's CSS
   * scale (`displayScale`: canvas pixels per CSS pixel) and the camera zoom, never less than the mouse's 6.
   */
  private touchSlack() {
    return Math.max(6, (TOUCH_SLACK * this.scale.displayScale.x) / this.cameras.main.zoomX);
  }
  override update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.2);
    this.clock += dt;
    const simStart = performance.now();
    this.driver.advance(dt);
    const drawStart = performance.now();
    const s = this.sim.state;
    if (s !== this.tracked) {
      this.tracked = s;
      this.trails.reset();
      this.aim.reset();
      this.scorches.reset();
      this.lastLeak = -Infinity;
      // Enemy ids restart with the new state; no old image may stand in for a new unit.
      this.enemySprites.reset();
      this.enemyFeedback.reset();
      this.bodies.reset();
      this.looks.key = "";
      for (const f of this.effects) f.label?.destroy();
      this.effects = [];
    }
    if (!s.paused) this.fxClock += dt;
    this.aim.sync(this.sim, s.paused ? 0 : dt);
    this.trails.sync(s.projectiles, s.towers, this.sim.content, this.fxClock, this.angleOf);
    const events = this.sim.drainEvents();
    this.flashed.clear();
    this.hooks.events(events);
    // Damage events drive the hit flashes and hurt clips; they are not effects (`isVisual`), and the batch stays as it is for them.
    this.enemyFeedback.consume(events, this.fxClock);
    this.screenFx.consume(events, this.fxClock);
    this.scorches.consume(events, this.sim.content, this.fxClock);
    if (events.some((e) => e.type === "leak")) this.lastLeak = this.fxClock;
    this.screenFx.update(this.fxClock);
    // Killed units with a death clip play it where they were last drawn; the kill effect plays as before.
    this.enemySprites.retire(killedEnemies(events), this.fxClock, (type) => this.sim.content.enemies[type].color);
    for (const event of events) if (isVisual(event)) this.addEffect(event, this.flashed);
    // Drops expired effects in place, without a new array per frame.
    let kept = 0;
    for (const f of this.effects) {
      if (f.age < effectLifetime(f.event, this.sim.content)) this.effects[kept++] = f;
      else f.label?.destroy();
    }
    this.effects.length = kept;
    if (!s.paused) for (const f of this.effects) f.age += dt;
    for (const f of this.effects) if (f.label && (f.event.type === "income" || f.event.type === "repair")) this.placeLabel(f.label, f.event.at, f.age);
    this.draw();
    if (this.stats) {
      this.stats.add("sim", drawStart - simStart);
      this.stats.add("draw", performance.now() - drawStart);
    }
    this.lastUI += dt;
    if (this.lastUI > 0.1) {
      this.hooks.refresh();
      this.lastUI = 0;
    }
  }
  /** Keeps a visual event as an effect, with what it needs to know about its source at this moment. */
  private addEffect(event: VisualEvent, flashed: Set<string>) {
    const s = this.sim.state,
      content = this.sim.content;
    let origin: EffectOrigin | undefined;
    if (event.type === "shot" || event.type === "beam") {
      const { x, y } = event.from,
        tower = s.towers.find((t) => t.x === x && t.y === y);
      // The drawn turret snapped onto the shot this frame, so this is the barrel the shot left.
      if (tower) origin = { level: towerLevel(tower, content), angle: this.aim.angle(tower) };
      // A salvo flashes once per barrel, not once per target.
      if (event.type === "shot" && content.towers[event.tower].visual.muzzle !== "bolt") {
        if (flashed.has(`${x},${y}`)) return;
        flashed.add(`${x},${y}`);
      }
      // A tower's new beam replaces its last one, so a continuous beam never piles up on the additive layer.
      if (event.type === "beam" && tower) this.effects = this.effects.filter((f) => f.event.type !== "beam" || f.event.from.x !== x || f.event.from.y !== y);
    } else if (event.type === "impact") {
      const arrival = this.trails.landed(event.tower, event.at);
      if (arrival) origin = { heading: arrival.angle, radius: arrival.radius };
    }
    evictFor(this.effects, event.type)?.label?.destroy();
    this.effects.push({ event, age: 0, origin, label: this.incomeLabel(event) });
  }
  private incomeLabel(e: VisualEvent) {
    if (e.type !== "income" && e.type !== "repair") return undefined;
    return this.add
      .text(0, 0, `+${e.amount} ${e.type === "income" ? "◇" : "⚡"}`, {
        fontFamily: "monospace",
        fontSize: "17px",
        fontStyle: "bold",
        color: `#${e.color.toString(16).padStart(6, "0")}`,
        stroke: "#10161b",
        strokeThickness: 4,
        resolution: this.textResolution,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.labels);
  }
  /** Pops in above the refinery, rises and fades out over the effect's lifetime. */
  private placeLabel(label: Phaser.GameObjects.Text, at: Point, age: number) {
    const k = age / INCOME_LIFETIME,
      pop = Math.min(1, age / 0.18);
    label
      .setPosition(px(at.x), px(at.y) - 30 - 34 * (1 - Math.pow(1 - k, 2)))
      .setScale(0.6 + 0.55 * pop - 0.15 * Math.min(1, Math.max(0, (age - 0.18) / 0.2)))
      .setAlpha(k < 0.65 ? 1 : Math.max(0, 1 - (k - 0.65) / 0.35));
  }
  /** Marks every cell the armed tower may go on: a soft fill in its colour and corner ticks, gently breathing. */
  private drawBuildCells(type: TowerId) {
    const s = this.sim.state,
      key = `${type}|${s.status}|${s.towers.map((t) => `${t.x},${t.y}`).join(";")}`;
    if (key !== this.buildCells.key) {
      const cells: Point[] = [];
      for (let y = 0; y < this.sim.map.rows; y++) for (let x = 0; x < this.sim.map.columns; x++) if (this.sim.canBuild(x, y, type)) cells.push({ x, y });
      this.buildCells = { key, cells };
    }
    const g = this.hints,
      color = this.sim.content.towers[type].color,
      breath = this.still.matches ? 1 : 0.8 + 0.2 * Math.sin(this.fxClock * 2.6),
      tick = 7,
      inset = 5;
    for (const { x, y } of this.buildCells.cells) {
      const x0 = x * CELL,
        y0 = y * CELL,
        x1 = x0 + CELL,
        y1 = y0 + CELL;
      g.fillStyle(color, 0.08 * breath);
      g.fillRect(x0 + inset, y0 + inset, CELL - 2 * inset, CELL - 2 * inset);
      g.fillStyle(color, 0.5 * breath);
      cornerBrackets(g, x0 + inset, y0 + inset, x1 - inset, y1 - inset, tick, 1.5);
    }
  }
  /** The Training coach's cell: a breathing fill and corner brackets that reach out from the cell. */
  private drawHighlight({ x, y }: Point) {
    const g = this.hints,
      color = themeAccent(this.sim.map),
      breath = this.still.matches ? 0.5 : 0.5 + 0.5 * Math.sin(this.fxClock * 4),
      out = 2 + 4 * breath,
      arm = 12,
      w = 3,
      x0 = x * CELL - out,
      y0 = y * CELL - out,
      x1 = (x + 1) * CELL + out,
      y1 = (y + 1) * CELL + out;
    g.fillStyle(color, 0.12 + 0.12 * breath);
    g.fillRect(x * CELL + 3, y * CELL + 3, CELL - 6, CELL - 6);
    g.fillStyle(color, 0.95);
    cornerBrackets(g, x0, y0, x1, y1, arm, w);
  }
  /**
   * Every attack tower's range, faint enough that overlaps build up into a heat map, and a strip along the path:
   * red where no tower reaches a ground unit, amber for one, the map's accent for two or more.
   */
  private drawCoverage(strength: number) {
    const g = this.hints,
      { content, map } = this.sim,
      reach = towerReach(this.sim.state.towers, content, this.sim);
    // Shown on its own while building, it waits for the first attack tower instead of painting the whole path red.
    if (strength < 1 && !reach.length) return;
    for (const r of reach) {
      const color = towerColor(r.tower, content);
      disc(g, px(r.tower.x), px(r.tower.y), r.range * CELL, color, 0.035 * strength);
      ring(g, px(r.tower.x), px(r.tower.y), r.range * CELL, 1.5, color, 0.3 * strength);
    }
    const counts = pathCoverage(map, reach),
      accent = themeAccent(map);
    map.path.forEach((cell, i) => {
      const next = map.path[i + 1] ?? (map.loop ? map.path[0] : undefined),
        prev = map.path[i - 1],
        dir = next ? { x: next.x - cell.x, y: next.y - cell.y } : { x: cell.x - prev.x, y: cell.y - prev.y },
        n = counts[i],
        color = n === 0 ? 0xff5a6e : n === 1 ? 0xffc94a : accent,
        half = CELL * 0.42,
        x = px(cell.x),
        y = px(cell.y);
      g.fillStyle(color, 0.75 * strength);
      if (dir.x !== 0) g.fillRect(x - half, y - 2, half * 2, 4);
      else g.fillRect(x - 2, y - half, 4, half * 2);
    });
  }
  private draw() {
    const g = this.towerInk,
      s = this.sim.state,
      content = this.sim.content,
      { towers, enemies } = content,
      towerPen: Pen = { g: this.towerInk, glow: this.towerGlow },
      pen: Pen = { g: this.ink, glow: this.glow };
    for (const layer of [this.towerInk, this.towerGlow, this.hints, this.ghost, this.enemyUnderlay, this.enemyBody, this.enemyOverlay, this.ink, this.glow]) layer.clear();
    for (const layer of [this.towerGlow, this.glow]) this.screenFx.prime(layer, this.sim.map.columns * CELL, this.sim.map.rows * CELL);
    this.ambient.clear();
    this.scorches.draw({ g: this.hints, glow: this.towerGlow }, this.fxClock);
    drawAmbient(this.ambient, this.towerGlow, this.sim.map, this.clock, this.still.matches);
    const selected = s.towers.find((t) => t.id === this.view.selected),
      hover = (this.view.build && this.view.pending) || this.view.hover,
      over = !this.view.build && hover ? s.towers.find((t) => t.x === hover.x && t.y === hover.y) : undefined,
      ended = s.status === "won" || s.status === "lost",
      armed = this.view.build && !ended ? towers[this.view.build] : undefined;
    // Without anything armed or selected, hovering a tower shows its range.
    const preview = this.view.build && hover ? { ...hover, type: this.view.build, upgrades: [] } : (selected ?? over);
    // Traps only: their cells on the path are marked while placing (a cursor on the board), since they cannot go beside it.
    const trap = armed?.placement === "path";
    if (trap && this.view.build && hover) this.drawBuildCells(this.view.build);
    if (this.view.coverage || (armed && hover && !isSupport(armed.attack) && armed.placement !== "path")) this.drawCoverage(this.view.coverage ? 1 : 0.55);
    if (this.view.highlight && !ended) this.drawHighlight(this.view.highlight);
    if (preview && !ended) {
      const valid = !this.view.build || this.sim.canBuild(preview.x, preview.y, this.view.build),
        color = valid ? towerColor(preview, content) : 0xff647c,
        x = px(preview.x),
        y = px(preview.y),
        r = effectiveTowerStats(preview, s.towers, content).range * CELL;
      // Towers without an area, such as the refinery, show no range circle.
      if (r > 0 && (valid || !trap)) {
        disc(g, x, y, r, color, 0.07);
        ring(g, x, y, r, 2, color, 0.6);
        // A dashed outer ring turns slowly, so the edge of the range reads against any ground.
        const spin = this.still.matches ? 0 : this.fxClock * 0.15;
        for (let i = 0; i < 24; i++) {
          const a = spin + (i * Math.PI) / 12;
          arcBand(g, x, y, r + 5, 2, a, a + Math.PI / 24, color, 0.35);
        }
        // Mortar: the dead zone it cannot fire into, as a dashed inner ring.
        const attack = resolveUpgrades(preview, content).attack,
          dead = (attackModule(attack)?.minRange?.(attack) ?? 0) * CELL;
        if (dead > 0)
          for (let i = 0; i < 16; i++) {
            const a = (i * Math.PI) / 8;
            arcBand(g, x, y, dead, 1.5, a, a + Math.PI / 16, color, 0.55);
          }
      }
      const cx = preview.x * CELL,
        cy = preview.y * CELL;
      g.lineStyle(2, color, preview === over ? 0.45 : 0.8);
      g.strokeRoundedRect(cx + 3, cy + 3, CELL - 6, CELL - 6, 6);
      if (this.view.build && !trap) {
        // Other towers: a crosshair on the cell, red where it cannot go.
        disc(g, x, y, 16, color, 0.25);
        ring(g, x, y, 16, 2, color, 0.7);
        g.lineBetween(x - 6, y, x + 6, y);
        g.lineBetween(x, y - 6, x, y + 6);
      } else if (this.view.build && valid) {
        const ghost: Tower = { id: -1, type: this.view.build, x: preview.x, y: preview.y, upgrades: [], cooldown: 0, spent: 0, angle: -Math.PI / 2, kills: 0, owner: this.view.player },
          d = towers[ghost.type];
        drawTower({ g: this.ghost, glow: this.ghost }, x, y, ghost, d, this.clock, { markers: 1, maxed: false, color: towerColor(ghost, content), path: undefined, boosted: false });
      } else if (this.view.build) {
        // Not buildable: a red cell with a cross.
        g.fillStyle(color, 0.16);
        g.fillRect(cx + 4, cy + 4, CELL - 8, CELL - 8);
        g.lineStyle(3, color, 0.85);
        g.lineBetween(x - 9, y - 9, x + 9, y + 9);
        g.lineBetween(x + 9, y - 9, x - 9, y + 9);
      }
    }
    if (
      preview &&
      towers[preview.type].attack.kind === "aura" &&
      (!this.view.build || this.sim.canBuild(preview.x, preview.y, this.view.build))
    ) {
      const color = towerColor(preview, content);
      for (const target of s.towers) {
        if (!isInAura(preview, target, content)) continue;
        g.lineStyle(1.5, color, 0.35);
        g.lineBetween(px(preview.x), px(preview.y), px(target.x), px(target.y));
        g.lineStyle(2, color, 0.8);
        strokeRound(g, px(target.x), px(target.y), 27);
      }
    }
    if (s.zones) drawZones(this.hints, this.towerGlow, s.zones, s.time, this.clock, content);
    drawSupportFx({ g: this.hints, glow: this.towerGlow }, this.sim, this.clock);
    if (s.strikes) drawStrikes(this.hints, this.towerGlow, s.strikes, s.time, this.clock, content);
    const pulses = this.hooks.pulses?.() ?? {},
      looks = this.towerLooks();
    for (const t of s.towers) {
      const d = towers[t.type],
        badges = looks.get(t.id)!,
        x = px(t.x),
        y = px(t.y),
        angle = this.aim.angle(t);
      drawTower(towerPen, x, y, angle === t.angle ? t : { ...t, angle }, d, this.clock, badges, this.bodies.place(t, d, badges, x, y));
      const family = familyOf(d),
        age = family ? pulses[family] : undefined;
      // The music visibly comes from the towers: a soft halo when their family's note sounds.
      if (age !== undefined && age < PULSE && !this.still.matches) halo(this.towerGlow, x, y, CELL * 0.6, badges.color, 0.6 * (1 - age / PULSE));
      // Co-op: a corner mark in the owner's colour.
      if (this.sim.players > 1) {
        const color = PLAYER_COLORS[t.owner] ?? 0xffffff;
        g.fillStyle(0x050b10, 0.8);
        fillRound(g, x - CELL / 2 + 7, y - CELL / 2 + 7, 5.5);
        g.fillStyle(color, 1);
        fillRound(g, x - CELL / 2 + 7, y - CELL / 2 + 7, 3.5);
      }
    }
    this.bodies.sweep();
    this.enemyLook.now = this.fxClock;
    const units = s.enemies.map((e) =>
      enemyContext(px(e.x), px(e.y), CELL, e, enemies[e.type], this.heading(e.distance), statusFlags(e, s.time), traitFlags(this.sim, e), this.clock),
    );
    drawEnemyLayers({ underlay: this.enemyUnderlay, body: this.enemyBody, overlay: this.enemyOverlay }, this.enemySprites, units, this.enemyLook);
    drawControlMarks({ under: this.enemyUnderlay, over: this.enemyOverlay, glow: this.glow }, this.sim, units, this.clock);
    const ink = this.ink;
    const marked = s.enemies.find((e) => e.id === this.view.enemy);
    if (marked && !isHidden(this.sim, marked)) {
      const r = enemies[marked.type].size * CELL + 6 + Math.sin(this.clock * 6);
      ink.lineStyle(2, 0xffffff, 0.85);
      strokeRound(ink, px(marked.x), px(marked.y), r);
    }
    this.trails.draw(pen, this.fxClock);
    for (const f of this.effects) {
      // Shots and impacts light the ground below the enemies; the effect itself draws above them.
      groundLight(this.towerGlow, f.event, f.age, content, f.origin);
      drawEffect(pen, f.event, f.age, content, f.origin);
    }
    // Entry and reactor live below the enemies; the reactor (a ring's portal) flares red close to the end and after a leak.
    const circle = this.sim.mission.circle,
      critical = circle ? s.enemies.length >= circle.limit * 0.8 : s.lives <= 5,
      alarm = Math.max(critical ? 1 : 0, 1 - (this.fxClock - this.lastLeak) / LEAK_ALARM);
    drawGates({ g: this.ambient, glow: this.towerGlow }, this.sim.map, this.clock, this.still.matches, alarm);
  }
  /** Turns the bloom and the screen effects on or off (the Bloom setting). */
  setGlow(on: boolean) {
    this.bloom = on;
    this.screenFx.setEnabled(on);
  }
  /** Badges of every tower, rebuilt only when a tower was built, sold or upgraded. */
  private towerLooks() {
    const s = this.sim.state,
      content = this.sim.content;
    let key = "";
    for (const t of s.towers) key += `${t.id}:${t.upgrades.length},`;
    if (key !== this.looks.key) {
      this.looks.key = key;
      this.looks.byId.clear();
      for (const t of s.towers)
        this.looks.byId.set(t.id, {
          markers: content.towers[t.type].attack.kind === "aura" ? t.upgrades.length : towerLevel(t, content),
          maxed: isFullyUpgraded(t, content),
          color: towerColor(t, content),
          path: towerPath(t, content),
          boosted: Object.values(effectiveTowerStats(t, s.towers, content).bonuses).some(Boolean),
        });
    }
    return this.looks.byId;
  }
}
