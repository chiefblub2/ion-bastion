import Phaser from "phaser";
import { DEFAULT_CONTENT } from "./content";
import { isFullyUpgraded, towerColor, towerLevel, towerPath, upgradeOptions } from "./core/upgrades";
import type { Tower } from "./core/types";
import { drawEffect } from "./render/effects";
import { muzzleTips } from "./render/muzzles";
import { CELL, type Pen } from "./render/shapes";
import { drawTower } from "./render/towers";
import {
  drawSentinelBase,
  drawSentinelFlash,
  drawSentinelGuides,
  drawSentinelLight,
  drawSentinelTurret,
  type SentinelPose,
} from "./render/tower-art/hex-sentinel-demo";
// Dev-only page `/gallery.html?sentinel` (not part of `vite build`): the current Pulse tower beside the Hex Sentinel
// experiment (`render/tower-art/hex-sentinel-demo.ts`), at the same scale, aim, charge and firing time, with controls.

const content = DEFAULT_CONTENT,
  pulse = content.towers.pulse,
  /** Attack cycle of the Pulse tower; the recoil and recharge follow it as in the game. */
  INTERVAL = pulse.interval,
  LEVELS = [1, 3, 5] as const,
  ZOOMS = [1, 2, 3] as const,
  DPR = Math.min(3, window.devicePixelRatio || 1);
/** Layout in CSS pixels: two square panels, then the eight aim directions of both towers. */
const PANEL = 3 * CELL * 3,
  M = 20,
  TOP = 34,
  W = M * 3 + PANEL * 2,
  ROW_SCALE = 1.5,
  ROW_TILE = CELL * ROW_SCALE + 8,
  ROWS_TOP = TOP + PANEL + 40,
  H = ROWS_TOP + 2 * (ROW_TILE + 6) + 10;
/** Size of a baked foundation in world pixels; the widest part, the contact shadow, reaches about 32 px out. */
const BOX = 80;

interface DemoState {
  angle: number;
  charge: number;
  level: (typeof LEVELS)[number];
  zoom: (typeof ZOOMS)[number];
  auto: boolean;
  guides: boolean;
}
const state: DemoState = { angle: -Math.PI / 4, charge: 0.7, level: 5, zoom: 3, auto: true, guides: false };
let fireAt = -Infinity;

/** A Pulse tower as if bought up to `level`. */
function built(level: number): Tower {
  const t: Tower = { id: 3, type: "pulse", x: 0, y: 0, upgrades: [], cooldown: 0, spent: 0, angle: 0, kills: 0, owner: 0 };
  while (towerLevel(t, content) < level) {
    const next = upgradeOptions(t, Infinity, content).find((o) => o.status === "available" && !o.definition!.path);
    if (!next) break;
    t.upgrades.push(next.definition!.id);
  }
  return t;
}
const towers = new Map(LEVELS.map((l) => [l, built(l)]));
const badges = (t: Tower) => ({ markers: towerLevel(t, content), maxed: isFullyUpgraded(t, content), color: towerColor(t, content), path: towerPath(t, content), boosted: false });

/** Fire timing, as the game derives it from the cooldown: a kick over the first 30 % of the cycle, then the recharge. */
function timing(now: number) {
  const age = now - fireAt,
    charge = age < INTERVAL ? Math.min(state.charge, Math.max(0, age / INTERVAL)) : state.charge,
    kick = age < 0.3 * INTERVAL ? ((0.3 * INTERVAL - age) / (0.3 * INTERVAL)) ** 2 : 0,
    cooldown = age < 0.3 * INTERVAL ? 1 - age / INTERVAL : Math.min(0.7, 1 - charge);
  return { age, charge, kick, cooldown };
}

class SentinelScene extends Phaser.Scene {
  private ground!: Phaser.GameObjects.Graphics;
  private original!: Pen;
  private base!: Phaser.GameObjects.Image;
  private under!: Phaser.GameObjects.Graphics;
  private sentinel!: Pen;
  private guides!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Text;
  private rowPens: { original: Pen; sentinel: Pen; under: Phaser.GameObjects.Graphics; base: Phaser.GameObjects.Image }[] = [];
  private baked = new Map<string, string>();
  private painter?: Phaser.GameObjects.Graphics;
  private shown = "";

  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(DPR);
    const font = (size: number, color = "#cfe3ef") => ({ fontFamily: "monospace", fontSize: `${size}px`, color, resolution: DPR });
    this.add.text(M, 10, "Original Pulse (current game)", font(14));
    this.add.text(M * 2 + PANEL, 10, "Hex Sentinel (demo)", font(14, "#93f5b8"));
    this.info = this.add.text(M, TOP + PANEL + 8, "", font(12, "#8fa7b6"));
    this.add.text(M, ROWS_TOP - 14, `Eight aim directions at level ${5}, ${ROW_SCALE}×: original above, Hex Sentinel below`, font(11, "#8fa7b6"));
    this.ground = this.add.graphics();
    const centre = (i: number) => ({ x: M + i * (PANEL + M) + PANEL / 2, y: TOP + PANEL / 2 }),
      pen = (x: number, y: number, s = 1) => ({
        g: this.add.graphics().setPosition(x, y).setScale(s),
        glow: this.add.graphics().setPosition(x, y).setScale(s).setBlendMode(Phaser.BlendModes.ADD),
      });
    const a = centre(0),
      b = centre(1);
    this.original = pen(a.x, a.y);
    // Draw order: baked foundation, its light, then the live turret ink and light, then the guides.
    this.base = this.add.image(b.x, b.y, "__DEFAULT");
    this.under = this.add.graphics().setPosition(b.x, b.y).setBlendMode(Phaser.BlendModes.ADD);
    this.sentinel = pen(b.x, b.y);
    this.guides = this.add.graphics().setPosition(b.x, b.y);
    for (let i = 0; i < 8; i++) {
      const x = M + ROW_TILE / 2 + i * (ROW_TILE + 6),
        y1 = ROWS_TOP + ROW_TILE / 2,
        y2 = y1 + ROW_TILE + 6,
        base = this.add.image(x, y2, "__DEFAULT"),
        under = this.add.graphics().setPosition(x, y2).setScale(ROW_SCALE).setBlendMode(Phaser.BlendModes.ADD);
      this.rowPens.push({ original: pen(x, y1, ROW_SCALE), base, under, sentinel: pen(x, y2, ROW_SCALE) });
    }
    this.drawRows();
    (window as unknown as { __sentinel: object }).__sentinel = { ready: true, state, set: (p: Partial<DemoState>) => (Object.assign(state, p), controls?.sync()), fire };
  }

  /** The still foundation at `scale` as a texture, baked once per level and scale at twice the device resolution. */
  private bake(level: number, scale: number) {
    const key = `${level}|${scale}`,
      known = this.baked.get(key);
    if (known) return known;
    const size = Math.ceil(BOX * scale * DPR * 2),
      name = `sentinel-base-${this.baked.size}`,
      texture = this.textures.addDynamicTexture(name, size, size)!;
    this.painter ??= this.add.graphics().setVisible(false);
    this.painter.clear();
    drawSentinelBase(this.painter, BOX / 2, BOX / 2, level);
    texture.camera.setOrigin(0, 0).setZoom(size / BOX);
    texture.draw(this.painter).render();
    this.baked.set(key, name);
    return name;
  }

  /** The panel ground: buildable cells as on the battlefield, the tower's cell in the middle. */
  private drawGround() {
    const g = this.ground,
      z = state.zoom,
      cell = CELL * z;
    g.clear();
    for (let i = 0; i < 2; i++) {
      const x0 = M + i * (PANEL + M),
        cx = x0 + PANEL / 2,
        cy = TOP + PANEL / 2,
        n = Math.ceil(PANEL / cell / 2) + 1;
      g.fillStyle(0x16222a);
      g.fillRect(x0, TOP, PANEL, PANEL);
      for (let row = -n; row <= n; row++)
        for (let col = -n; col <= n; col++) {
          const x = cx + (col - 0.5) * cell,
            y = cy + (row - 0.5) * cell,
            l = Math.max(x0, x + 2 * z),
            t = Math.max(TOP, y + 2 * z),
            r = Math.min(x0 + PANEL, x + cell - 2 * z),
            b = Math.min(TOP + PANEL, y + cell - 2 * z);
          if (r <= l || b <= t) continue;
          g.fillStyle(row === 0 && col === 0 ? 0x24343d : 0x1d2b33);
          g.fillRect(l, t, r - l, b - t);
        }
    }
  }

  /** The eight directions never change, so they are drawn once. */
  private drawRows() {
    const t = { ...towers.get(5)! };
    this.rowPens.forEach((row, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI) / 4,
        pose: SentinelPose = { angle, charge: 1, kick: 0, level: 5, clock: 0 };
      t.angle = angle;
      drawTower(row.original, 0, 0, t, pulse, 0.6, badges(t));
      row.base.setTexture(this.bake(5, ROW_SCALE)).setDisplaySize(BOX * ROW_SCALE, BOX * ROW_SCALE);
      drawSentinelLight(row.under, 0, 0, pose);
      drawSentinelTurret(row.sentinel, 0, 0, pose);
    });
  }

  override update(time: number, delta: number) {
    const now = time / 1000;
    if (state.auto) {
      state.angle = (state.angle + 0.6 * (delta / 1000)) % (Math.PI * 2);
      controls?.angle(state.angle);
    }
    const shown = `${state.level}|${state.zoom}`;
    if (shown !== this.shown) {
      this.shown = shown;
      this.drawGround();
      const z = state.zoom;
      this.base.setTexture(this.bake(state.level, z)).setDisplaySize(BOX * z, BOX * z);
      for (const o of [this.original.g, this.original.glow, this.under, this.sentinel.g, this.sentinel.glow, this.guides]) o.setScale(z);
    }
    const { age, charge, kick, cooldown } = timing(now),
      tower = towers.get(state.level)!,
      pose: SentinelPose = { angle: state.angle, charge, kick, level: state.level, clock: now };
    // Original: the game's own drawing and muzzle flash.
    tower.angle = state.angle;
    tower.cooldown = cooldown;
    const o = this.original;
    o.g.clear();
    o.glow.clear();
    drawTower(o, 0, 0, tower, pulse, now, badges(tower));
    if (age < 0.45) {
      // The tower sits at local (0, 0), which is grid position −0.5.
      const from = { x: -0.5, y: -0.5 },
        to = { x: from.x + 2 * Math.cos(state.angle), y: from.y + 2 * Math.sin(state.angle) };
      drawEffect(o, { type: "shot", tower: "pulse", from, to, color: pulse.color }, age, content, { level: state.level, angle: state.angle });
    }
    // Hex Sentinel: baked foundation, live light, turret and flash.
    const s = this.sentinel;
    this.under.clear();
    s.g.clear();
    s.glow.clear();
    drawSentinelLight(this.under, 0, 0, pose);
    drawSentinelTurret(s, 0, 0, pose);
    drawSentinelFlash(s, 0, 0, pose, age);
    this.guides.clear();
    if (state.guides) drawSentinelGuides(this.guides, 0, 0, pose, muzzleTips("barrel", state.level, 0, 0, state.angle, kick)[0]);
    const deg = Math.round(((state.angle * 180) / Math.PI + 360) % 360);
    this.info.setText(`aim ${deg}°   charge ${Math.round(charge * 100)} %   level ${state.level}   zoom ${state.zoom}×   ${state.auto ? "auto-rotating" : "paused"}`);
  }
}

function fire() {
  fireAt = (game?.loop.time ?? 0) / 1000;
}

let game: Phaser.Game | undefined;
let controls: { angle: (a: number) => void; sync: () => void } | undefined;

/** Builds the controls and the canvas inside `root`. */
export function mountSentinelDemo(root: HTMLElement) {
  const bar = document.createElement("div");
  bar.className = "sentinel-controls";
  bar.innerHTML = `
    <label>Rotation <input id="sd-angle" type="range" min="0" max="359" step="1"> <output id="sd-angle-out"></output></label>
    <label>Charge <input id="sd-charge" type="range" min="0" max="100" step="1"> <output id="sd-charge-out"></output></label>
    <button id="sd-fire" type="button">Fire (Space)</button>
    <label>Level <select id="sd-level">${LEVELS.map((l) => `<option value="${l}">${l}</option>`).join("")}</select></label>
    <label>Zoom <select id="sd-zoom">${ZOOMS.map((z) => `<option value="${z}">${z}×</option>`).join("")}</select></label>
    <label><input id="sd-auto" type="checkbox"> Auto-rotate</label>
    <label><input id="sd-guides" type="checkbox"> Guides (outlines, pivot, muzzle: green drawn, red game)</label>`;
  bar.style.cssText = "display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-bottom:10px";
  root.append(bar);
  const el = <T extends HTMLElement>(id: string) => bar.querySelector<T>(`#${id}`)!,
    angle = el<HTMLInputElement>("sd-angle"),
    angleOut = el<HTMLOutputElement>("sd-angle-out"),
    charge = el<HTMLInputElement>("sd-charge"),
    chargeOut = el<HTMLOutputElement>("sd-charge-out"),
    level = el<HTMLSelectElement>("sd-level"),
    zoom = el<HTMLSelectElement>("sd-zoom"),
    auto = el<HTMLInputElement>("sd-auto"),
    guides = el<HTMLInputElement>("sd-guides"),
    showAngle = (a: number) => {
      const deg = Math.round(((a * 180) / Math.PI + 360) % 360);
      angle.value = String(deg);
      angleOut.value = `${deg}°`;
    };
  const sync = () => {
    showAngle(state.angle);
    charge.value = String(Math.round(state.charge * 100));
    chargeOut.value = `${charge.value} %`;
    level.value = String(state.level);
    zoom.value = String(state.zoom);
    auto.checked = state.auto;
    guides.checked = state.guides;
  };
  sync();
  angle.addEventListener("input", () => {
    state.auto = auto.checked = false;
    state.angle = (Number(angle.value) * Math.PI) / 180;
    showAngle(state.angle);
  });
  charge.addEventListener("input", () => {
    state.charge = Number(charge.value) / 100;
    chargeOut.value = `${charge.value} %`;
  });
  level.addEventListener("change", () => (state.level = Number(level.value) as DemoState["level"]));
  zoom.addEventListener("change", () => (state.zoom = Number(zoom.value) as DemoState["zoom"]));
  auto.addEventListener("change", () => (state.auto = auto.checked));
  guides.addEventListener("change", () => (state.guides = guides.checked));
  el("sd-fire").addEventListener("click", fire);
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Space") return;
    e.preventDefault();
    fire();
  });
  controls = { angle: showAngle, sync };
  const host = document.createElement("div");
  root.append(host);
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    width: W * DPR,
    height: H * DPR,
    backgroundColor: "#0f181e",
    antialias: true,
    banner: false,
    scene: SentinelScene,
    audio: { noAudio: true },
  });
  game.canvas.style.width = `${W}px`;
  game.canvas.style.height = `${H}px`;
}
