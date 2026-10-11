import Phaser from "phaser";
import { Game, FIXED_STEP, isRunning } from "../core/game";
import { isFullyUpgraded, resolveUpgrades, towerColor, towerLevel, towerPath } from "../core/upgrades";
import { attackModule } from "../systems/attacks";
import { effectiveTowerStats, isInAura } from "../systems/auras";
import { statusFlags } from "../systems/status";
import { isHidden, traitFlags } from "../systems/traits";
import { enemyAt } from "./pick";
import type { GameEvent, GameState, Point, TowerId } from "../core/types";
import { PLAYER_COLORS } from "../net/protocol";
import { drawEffect, effectLifetime, INCOME_LIFETIME, isVisual, type EffectOrigin, type VisualEvent } from "./effects";
import { DEPTH } from "./depths";
import { enemyContext } from "./enemies";
import { artUrl, ENEMY_ART } from "./enemy-art";
import { drawEnemyLayers, EnemySprites } from "./enemy-sprites";
import { CELL, px, type Pen } from "./shapes";
import { drawAmbient, drawTerrain, themeAccent, themeGlow } from "./terrain";
import { drawTower } from "./towers";
import { Trails } from "./trails";
export { CELL } from "./shapes";
/** Upper bound for the canvas's longer side in pixels, so a huge 4K full screen stays cheap to fill. */
const MAX_CANVAS = 4096;
/** Art textures that failed to load: never queued again (their enemies stay procedural) and warned about once. */
const failedArt = new Set<string>();
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
interface Hooks {
  /** `keepBuilding`: stay in build mode after placing (Shift+click). */
  chooseCell: (x: number, y: number, keepBuilding: boolean) => void;
  /** Click on a visible enemy outside build mode. */
  chooseEnemy: (id: number) => void;
  /** Right click: leave build mode and drop the selection. */
  cancel: () => void;
  refresh: () => void;
  events: (events: GameEvent[]) => void;
}
interface Effect {
  event: VisualEvent;
  age: number;
  /** What the effect knows about its source from the moment it arrived. */
  origin?: EffectOrigin;
  /** Floating "+N ◇" over a refinery payout. */
  label?: Phaser.GameObjects.Text;
}
export class Battlefield extends Phaser.Scene {
  private ambient!: Phaser.GameObjects.Graphics;
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
  /** Painted bodies (Images at `DEPTH.enemySprites`) for enemy types with art; they replace the procedural body. */
  private enemySprites = new EnemySprites({
    hasTexture: (key) => !failedArt.has(key) && this.textures.exists(key),
    createImage: (key) => this.add.image(0, 0, key),
  });
  /** Foreground above the enemies: selection ring, shots, effects, portal pulse, and the additive light of shots and effects. */
  private ink!: Phaser.GameObjects.Graphics;
  private glow!: Phaser.GameObjects.Graphics;
  private effects: Effect[] = [];
  private trails = new Trails();
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
  constructor(
    private sim: Game,
    private view: ViewState,
    private hooks: Hooks,
  ) {
    super("battlefield");
    this.driver = new LocalDriver(sim, view);
  }
  /** Queues the enemy art once per game; a scene restart finds it in the texture cache. */
  preload() {
    const queued = Object.values(ENEMY_ART).filter((art) => !this.textures.exists(art.texture) && !failedArt.has(art.texture));
    for (const art of queued) this.load.image(art.texture, artUrl(art));
    // A missing file and an undecodable one both end without a texture (only the first raises FILE_LOAD_ERROR).
    if (queued.length)
      this.load.once(Phaser.Loader.Events.COMPLETE, () => {
        for (const art of queued)
          if (!this.textures.exists(art.texture)) {
            failedArt.add(art.texture);
            console.warn(`Enemy art '${art.texture}' (${artUrl(art)}) did not load; those enemies keep their procedural body.`);
          }
      });
  }
  create() {
    this.effects = [];
    // Phaser destroys the scene's objects on shutdown; drop the sprite references with them.
    const cleanup = () => {
      this.enemySprites.reset();
      this.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
      this.events.off(Phaser.Scenes.Events.DESTROY, cleanup);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    this.trails.reset();
    this.driver.reset?.();
    this.resize();
    // FIT never changes the game size on its own; follow every size change of the board (window, full screen, layout).
    if (!this.observer && this.scale.parent) {
      this.observer = new ResizeObserver(() => this.fit());
      this.observer.observe(this.scale.parent);
    }
    drawTerrain(this, this.sim.map, (x, y) => this.sim.isBlocked(x, y));
    // Explicit depths (`DEPTH`), so sprites created mid-game sort between the enemy layers; equal depths keep creation order.
    this.ambient = this.add.graphics().setDepth(DEPTH.ambient);
    // Additive light is dimmed on light ground, so it never washes out.
    const glow = themeGlow(this.sim.map);
    this.towerInk = this.add.graphics().setDepth(DEPTH.towers);
    this.towerGlow = this.add.graphics().setDepth(DEPTH.towers).setBlendMode(Phaser.BlendModes.ADD).setAlpha(glow);
    this.enemyUnderlay = this.add.graphics().setDepth(DEPTH.enemyUnderlay);
    this.enemyBody = this.add.graphics().setDepth(DEPTH.enemyBody);
    this.enemyOverlay = this.add.graphics().setDepth(DEPTH.enemyOverlay);
    this.ink = this.add.graphics().setDepth(DEPTH.foreground);
    this.glow = this.add.graphics().setDepth(DEPTH.foreground).setBlendMode(Phaser.BlendModes.ADD).setAlpha(glow);
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      this.view.hover = { x: Math.floor(w.x / CELL), y: Math.floor(w.y / CELL) };
    });
    this.input.on("gameout", () => {
      this.view.hover = null;
    });
    // Right click cancels instead of opening the browser menu on the board.
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) return this.hooks.cancel();
      const shift = (p.event as MouseEvent | undefined)?.shiftKey ?? false,
        w = this.cameras.main.getWorldPoint(p.x, p.y);
      const enemy = this.view.build ? undefined : enemyAt(this.sim, w.x, w.y, CELL);
      if (enemy) return this.hooks.chooseEnemy(enemy.id);
      this.hooks.chooseCell(Math.floor(w.x / CELL), Math.floor(w.y / CELL), shift);
    });
    this.sharpenText();
    this.hooks.refresh();
  }
  /** Refits the canvas after its container changed size, e.g. entering full screen or leaving the start screen. */
  fit() {
    // Before Phaser has booted the scene there is nothing to fit yet.
    if (!this.scale || !this.cameras?.main) return;
    this.resize();
    this.scale.refresh();
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
    this.cameras.main.setOrigin(0, 0).setSize(width, height).setZoom(width / worldWidth, height / worldHeight);
    this.textResolution = Math.max(1, zoom);
    this.sharpenText();
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
    const { path, loop } = this.sim.map,
      i = loop ? Math.floor(distance) % path.length : Math.min(Math.floor(distance), path.length - 2),
      a = path[i],
      b = path[(i + 1) % path.length];
    return Math.atan2(b.y - a.y, b.x - a.x);
  }
  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.2);
    this.clock += dt;
    this.driver.advance(dt);
    const s = this.sim.state;
    if (s !== this.tracked) {
      this.tracked = s;
      this.trails.reset();
      // Enemy ids restart with the new state; no old image may stand in for a new unit.
      this.enemySprites.reset();
      for (const f of this.effects) f.label?.destroy();
      this.effects = [];
    }
    if (!s.paused) this.fxClock += dt;
    this.trails.sync(s.projectiles, s.towers, this.sim.content, this.fxClock);
    const events = this.sim.drainEvents(),
      flashed = new Set<string>();
    this.hooks.events(events);
    for (const event of events) if (isVisual(event)) this.addEffect(event, flashed);
    this.effects = this.effects.filter((f) => {
      if (f.age < effectLifetime(f.event, this.sim.content)) return true;
      f.label?.destroy();
      return false;
    });
    if (!s.paused) for (const f of this.effects) f.age += dt;
    for (const f of this.effects) if (f.label && (f.event.type === "income" || f.event.type === "repair")) this.placeLabel(f.label, f.event.at, f.age);
    this.draw();
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
      if (tower) origin = { level: towerLevel(tower, content), angle: tower.angle };
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
  private draw() {
    const g = this.towerInk,
      s = this.sim.state,
      content = this.sim.content,
      { towers, enemies } = content,
      towerPen: Pen = { g: this.towerInk, glow: this.towerGlow },
      pen: Pen = { g: this.ink, glow: this.glow };
    for (const layer of [this.towerInk, this.towerGlow, this.enemyUnderlay, this.enemyBody, this.enemyOverlay, this.ink, this.glow]) layer.clear();
    this.ambient.clear();
    drawAmbient(this.ambient, this.sim.map, this.clock);
    const selected = s.towers.find((t) => t.id === this.view.selected),
      hover = this.view.hover;
    const preview = this.view.build && hover ? { ...hover, type: this.view.build, upgrades: [] } : selected;
    if (preview && s.status !== "won" && s.status !== "lost") {
      const valid = !this.view.build || this.sim.canBuild(preview.x, preview.y, this.view.build),
        color = valid ? towerColor(preview, content) : 0xff647c,
        x = px(preview.x),
        y = px(preview.y),
        r = effectiveTowerStats(preview, s.towers, content).range * CELL;
      // Towers without an area, such as the refinery, show no range circle.
      if (r > 0) {
        g.fillStyle(color, 0.045);
        g.fillCircle(x, y, r);
        g.lineStyle(1.5, color, 0.35);
        g.strokeCircle(x, y, r);
        // Mortar: the dead zone it cannot fire into, as a dashed inner ring.
        const attack = resolveUpgrades(preview, content).attack,
          dead = (attackModule(attack)?.minRange?.(attack) ?? 0) * CELL;
        if (dead > 0)
          for (let i = 0; i < 16; i++) {
            const a = (i * Math.PI) / 8;
            g.beginPath();
            g.arc(x, y, dead, a, a + Math.PI / 16);
            g.strokePath();
          }
      }
      g.lineStyle(2, color, 0.8);
      g.strokeRoundedRect(preview.x * CELL + 3, preview.y * CELL + 3, CELL - 6, CELL - 6, 6);
      if (this.view.build) {
        g.fillStyle(color, 0.25);
        g.fillCircle(x, y, 16);
        g.lineStyle(2, color, 0.7);
        g.strokeCircle(x, y, 16);
        g.lineBetween(x - 6, y, x + 6, y);
        g.lineBetween(x, y - 6, x, y + 6);
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
        g.strokeCircle(px(target.x), px(target.y), 27);
      }
    }
    for (const t of s.towers) {
      const d = towers[t.type],
        aura = d.attack.kind === "aura";
      drawTower(towerPen, px(t.x), px(t.y), t, d, this.clock, {
        markers: aura ? t.upgrades.length : towerLevel(t, content),
        maxed: isFullyUpgraded(t, content),
        color: towerColor(t, content),
        path: towerPath(t, content),
        boosted: Object.values(effectiveTowerStats(t, s.towers, content).bonuses).some(Boolean),
      });
      // Co-op: a corner mark in the owner's colour.
      if (this.sim.players > 1) {
        const color = PLAYER_COLORS[t.owner] ?? 0xffffff;
        g.fillStyle(0x050b10, 0.8);
        g.fillCircle(px(t.x) - CELL / 2 + 7, px(t.y) - CELL / 2 + 7, 5.5);
        g.fillStyle(color, 1);
        g.fillCircle(px(t.x) - CELL / 2 + 7, px(t.y) - CELL / 2 + 7, 3.5);
      }
    }
    const units = s.enemies.map((e) =>
      enemyContext(px(e.x), px(e.y), CELL, e, enemies[e.type], this.heading(e.distance), statusFlags(e, s.time), traitFlags(this.sim, e), this.clock),
    );
    drawEnemyLayers({ underlay: this.enemyUnderlay, body: this.enemyBody, overlay: this.enemyOverlay }, this.enemySprites, units);
    const ink = this.ink;
    const marked = s.enemies.find((e) => e.id === this.view.enemy);
    if (marked && !isHidden(this.sim, marked)) {
      const r = enemies[marked.type].size * CELL + 6 + Math.sin(this.clock * 6);
      ink.lineStyle(2, 0xffffff, 0.85);
      ink.strokeCircle(px(marked.x), px(marked.y), r);
    }
    this.trails.draw(pen, this.fxClock);
    for (const f of this.effects) drawEffect(pen, f.event, f.age, content, f.origin);
    // A ring has no reactor: its portal pulses instead and turns red close to the enemy limit.
    const circle = this.sim.mission.circle,
      end = circle ? this.sim.map.path[0] : this.sim.map.path.at(-1)!,
      critical = circle ? s.enemies.length >= circle.limit * 0.8 : s.lives <= 5;
    ink.lineStyle(1, critical ? 0xff647c : themeAccent(this.sim.map), 0.35 + 0.2 * Math.sin(this.clock * 3));
    ink.strokeCircle(px(end.x), px(end.y), 26 + Math.sin(this.clock * 2) * 2);
  }
}
