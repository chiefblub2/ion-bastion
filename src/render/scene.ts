import Phaser from "phaser";
import { Game, FIXED_STEP } from "../core/game";
import { isFullyUpgraded, towerColor, towerLevel, towerPath } from "../core/upgrades";
import { effectiveTowerStats, isInAura } from "../systems/auras";
import { statusFlags } from "../systems/status";
import { traitFlags } from "../systems/traits";
import type { GameEvent, Point, TowerId } from "../core/types";
import { PLAYER_COLORS } from "../net/protocol";
import { drawEffect, effectLifetime, INCOME_LIFETIME, isVisual, type VisualEvent } from "./effects";
import { drawEnemy } from "./enemies";
import { drawProjectile } from "./projectiles";
import { CELL, px } from "./shapes";
import { drawAmbient, drawTerrain, themeAccent } from "./terrain";
import { drawTower } from "./towers";
export { CELL } from "./shapes";
export interface ViewState {
  build: TowerId | null;
  selected: number | null;
  hover: Point | null;
  speed: number;
  /** Local player: 0 in single-player and for the co-op host. */
  player: number;
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
    if (this.sim.state.paused || this.sim.state.status !== "wave") {
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
  /** Right click: leave build mode and drop the selection. */
  cancel: () => void;
  refresh: () => void;
  events: (events: GameEvent[]) => void;
}
interface Effect {
  event: VisualEvent;
  age: number;
  /** Floating "+N ◇" over a refinery payout. */
  label?: Phaser.GameObjects.Text;
}
export class Battlefield extends Phaser.Scene {
  private ambient!: Phaser.GameObjects.Graphics;
  private ink!: Phaser.GameObjects.Graphics;
  private effects: Effect[] = [];
  /** Swapped for a lockstep driver in co-op. */
  driver: Driver;
  private clock = 0;
  private lastUI = 0;
  constructor(
    private sim: Game,
    private view: ViewState,
    private hooks: Hooks,
  ) {
    super("battlefield");
    this.driver = new LocalDriver(sim, view);
  }
  create() {
    this.effects = [];
    this.driver.reset?.();
    drawTerrain(this, this.sim.map, (x, y) => this.sim.isBlocked(x, y));
    this.ambient = this.add.graphics();
    this.ink = this.add.graphics();
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      this.view.hover = {
        x: Math.floor(p.x / CELL),
        y: Math.floor(p.y / CELL),
      };
    });
    this.input.on("gameout", () => {
      this.view.hover = null;
    });
    // Right click cancels instead of opening the browser menu on the board.
    this.input.mouse?.disableContextMenu();
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) return this.hooks.cancel();
      const shift = (p.event as MouseEvent | undefined)?.shiftKey ?? false;
      this.hooks.chooseCell(Math.floor(p.x / CELL), Math.floor(p.y / CELL), shift);
    });
    this.hooks.refresh();
  }
  /** Refits the canvas after its container changed size, e.g. entering full screen. */
  fit() {
    this.scale.refresh();
  }
  /** Redraws the terrain after a mission change and fits the canvas to the map size. */
  reload() {
    const { columns, rows } = this.sim.map;
    // The board's aspect ratio follows the map; refresh() alone would fit into the old, cached parent size.
    this.scale.getParentBounds();
    this.scale.setGameSize(columns * CELL, rows * CELL);
    this.scene.restart();
  }
  /** Direction of travel at a path distance, for oriented flying units. */
  private heading(distance: number) {
    const path = this.sim.map.path,
      i = Math.min(Math.floor(distance), path.length - 2);
    return Math.atan2(path[i + 1].y - path[i].y, path[i + 1].x - path[i].x);
  }
  update(_time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.2);
    this.clock += dt;
    this.driver.advance(dt);
    const events = this.sim.drainEvents();
    this.hooks.events(events);
    for (const event of events) if (isVisual(event)) this.effects.push({ event, age: 0, label: this.incomeLabel(event) });
    this.effects = this.effects.filter((f) => {
      if (f.age < effectLifetime(f.event)) return true;
      f.label?.destroy();
      return false;
    });
    if (!this.sim.state.paused) for (const f of this.effects) f.age += dt;
    for (const f of this.effects) if (f.label && f.event.type === "income") this.placeLabel(f.label, f.event.at, f.age);
    this.draw();
    this.lastUI += dt;
    if (this.lastUI > 0.1) {
      this.hooks.refresh();
      this.lastUI = 0;
    }
  }
  private incomeLabel(e: VisualEvent) {
    if (e.type !== "income") return undefined;
    return this.add
      .text(0, 0, `+${e.amount} ◇`, {
        fontFamily: "monospace",
        fontSize: "17px",
        fontStyle: "bold",
        color: `#${e.color.toString(16).padStart(6, "0")}`,
        stroke: "#10161b",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(10);
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
    const g = this.ink,
      s = this.sim.state,
      content = this.sim.content,
      { towers, enemies } = content;
    g.clear();
    this.ambient.clear();
    drawAmbient(this.ambient, this.sim.map, this.clock);
    const selected = s.towers.find((t) => t.id === this.view.selected),
      hover = this.view.hover;
    const preview = this.view.build && hover ? { ...hover, type: this.view.build, upgrades: [] } : selected;
    if (preview && s.status !== "won" && s.status !== "lost") {
      const valid = !this.view.build || this.sim.canBuild(preview.x, preview.y),
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
      (!this.view.build || this.sim.canBuild(preview.x, preview.y))
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
      drawTower(g, px(t.x), px(t.y), t, d, this.clock, {
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
    for (const e of s.enemies)
      drawEnemy(g, px(e.x), px(e.y), CELL, e, enemies[e.type], this.heading(e.distance), statusFlags(e, s.time), traitFlags(this.sim, e), this.clock);
    for (const p of s.projectiles) {
      const d = towers[p.type];
      drawProjectile(g, d.visual.projectile, px(p.x), px(p.y), Math.atan2(p.ty - p.y, p.tx - p.x), d.color);
    }
    for (const f of this.effects) drawEffect(g, f.event, f.age, content);
    const end = this.sim.map.path.at(-1)!;
    g.lineStyle(1, s.lives <= 5 ? 0xff647c : themeAccent(this.sim.map), 0.35 + 0.2 * Math.sin(this.clock * 3));
    g.strokeCircle(px(end.x), px(end.y), 26 + Math.sin(this.clock * 2) * 2);
  }
}
