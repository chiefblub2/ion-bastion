import Phaser from "phaser";
import { DEFAULT_CONTENT } from "./content";
import { isFullyUpgraded, towerColor, towerLevel, towerPath, upgradeOptions } from "./core/upgrades";
import { drawEffect, type EffectOrigin, type VisualEvent } from "./render/effects";
import { MUZZLES } from "./render/muzzles";
import { CELL, type Pen } from "./render/shapes";
import { drawTower } from "./render/towers";
import { Trails } from "./render/trails";
import type { Projectile, Tower, TowerId, TurretStyle } from "./core/types";
// Dev-only page, drawn by the battlefield's own functions at a fixed time so a screenshot shows a whole look at once:
// `/gallery.html?showcase` has every tower at several levels and in its firing pose, `?showcase=shots` every
// projectile in flight, muzzle flash, impact, beam, chain and pulse. Never sets `__gallery.cells`, so
// `scripts/readme-images.ts` ignores it.

const ZOOM = 2;
const TILE = CELL + 8,
  GAP = 6,
  LABEL = 92;
/** Tile columns per tower row. */
const COLUMNS = 6;
const params = new URLSearchParams(location.search);
const SHOTS = params.get("showcase") === "shots";
/** Fixed animation time (`&clock=<s>` overrides), so every run draws the same frame. */
const CLOCK = Number(params.get("clock") ?? 0.6);

const content = DEFAULT_CONTENT,
  towers = Object.keys(content.towers) as TowerId[];
/** Tower row groups side by side, so the sheet stays roughly square. */
const GROUPS = 2,
  perGroup = Math.ceil(towers.length / GROUPS),
  groupWidth = LABEL + COLUMNS * (TILE + GAP);
/** Layout of the shots sheet: wide tiles for flights, beams and chains, big ones for pulses. */
const WIDE = { w: 150, h: 64 },
  SMALL = 64,
  PULSE = 124,
  SHOTS_WIDTH = 1180;
const shooters = towers.filter((t) => content.towers[t].projectile),
  barrels = towers.filter((t) => MUZZLES[content.towers[t].visual.turret] && content.towers[t].placement !== "path"),
  impacts = [...shooters, ...towers.filter((t) => !content.towers[t].projectile && content.towers[t].visual.impact)],
  CHAINS: readonly TurretStyle[] = ["coil", "barrel", "launcher", "prism", "flame", "blade", "tripwire"],
  PULSES: readonly TurretStyle[] = ["emitter", "snare", "gravity", "spring", "hammer", "antenna", "crystal", "heavy", "limpet"];
const sections = [
  { title: "Projectiles in flight (tower on the left, about halfway)", rows: Math.ceil(shooters.length / 7), h: WIDE.h },
  { title: "Muzzle flashes: age 0.03 s, then 0.18 s", rows: 2, h: SMALL },
  { title: "Impacts: age 0.03, 0.12 and 0.3 s", rows: 3, h: SMALL },
  { title: "Beams (Lance at 0.02 / 0.2 s, Focus at power 0.2 / 1) and chains at 0.1 s", rows: 2, h: WIDE.h },
  { title: "Pulses at 0.12 s, then 0.35 s", rows: 2, h: PULSE },
];
const width = SHOTS ? SHOTS_WIDTH : GAP + GROUPS * (groupWidth + 3 * GAP),
  height = SHOTS ? 30 + sections.reduce((sum, s) => sum + 28 + s.rows * (s.h + GAP), 0) : 40 + perGroup * (TILE + GAP);
/** Grid coordinate of a pixel position, the inverse of `px`. */
const grid = (v: number) => v / CELL - 0.5;
const font = (size: number, color = "#cfe3ef") => ({ fontFamily: "monospace", fontSize: `${size}px`, color, resolution: ZOOM });

/** A tower as if bought up to `level` (path upgrades only from `path`), or as far as it goes with `"max"`. */
function built(type: TowerId, level: number | "max", path?: string, cooldown = 0, angle = -Math.PI / 4): Tower {
  const t: Tower = { id: 0, type, x: 0, y: 0, upgrades: [], cooldown, spent: 0, angle, kills: 0, owner: 0 };
  while (level === "max" || towerLevel(t, content) < level) {
    const next = upgradeOptions(t, Infinity, content).find((o) => o.status === "available" && (!o.definition!.path || o.definition!.path === path));
    if (!next) break;
    t.upgrades.push(next.definition!.id);
  }
  return t;
}
/** The tiles of one tower row: label and tower state. */
function variants(type: TowerId): { label: string; tower: Tower }[] {
  const d = content.towers[type],
    paths = Object.keys(d.visual.paths ?? {});
  if (d.attack.kind === "aura")
    return [{ label: "base", tower: built(type, 1) }, ...paths.map((p) => ({ label: p, tower: built(type, "max", p) }))];
  if (paths.length)
    return [
      { label: "L1", tower: built(type, 1) },
      { label: "L1 fire", tower: built(type, 1, undefined, 0.92) },
      { label: "L5", tower: built(type, 5) },
      ...paths.map((p) => ({ label: `L8 ${d.visual.paths![p].name ?? p}`, tower: built(type, "max", p) })),
    ];
  return [
    { label: "L1", tower: built(type, 1) },
    { label: "L1 fire", tower: built(type, 1, undefined, 0.92) },
    { label: "L3", tower: built(type, 3) },
    { label: "max", tower: built(type, "max") },
  ];
}
/** Draws a tower the way the battlefield does. */
function tower(pen: Pen, x: number, y: number, t: Tower) {
  const aura = content.towers[t.type].attack.kind === "aura";
  drawTower(pen, x, y, t, content.towers[t.type], CLOCK, {
    markers: aura ? t.upgrades.length : towerLevel(t, content),
    maxed: isFullyUpgraded(t, content),
    color: towerColor(t, content),
    path: towerPath(t, content),
    boosted: false,
  });
}
/** The first tower with this turret. */
const withTurret = (turret: TurretStyle) => towers.find((t) => content.towers[t].visual.turret === turret)!;

export class Showcase extends Phaser.Scene {
  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
    if (SHOTS) this.shots();
    else this.towers();
  }
  private towers() {
    this.add.text(GAP, 8, `Towers at clock ${CLOCK}`, font(12));
    towers.forEach((type, i) => {
      const group = Math.floor(i / perGroup),
        x0 = GAP + group * (groupWidth + 3 * GAP),
        y = 40 + (i % perGroup) * (TILE + GAP);
      this.add.text(x0, y + 4, content.towers[type].name, { ...font(11), wordWrap: { width: LABEL - 6 } });
      variants(type).forEach((v, j) => {
        const x = x0 + LABEL + j * (TILE + GAP);
        this.tile(x, y, TILE, TILE, (pen, cx, cy) => tower(pen, cx, cy, v.tower));
        this.add.text(x + 2, y + TILE - 9, v.label, font(7, "#7f97a6"));
      });
    });
  }
  private shots() {
    let y = 10;
    const heading = (text: string) => {
        this.add.text(GAP, y, text, font(11));
        y += 22;
      },
      row = <T,>(items: readonly T[], w: number, h: number, perRow: number, draw: (pen: Pen, x: number, y: number, item: T, w: number, h: number) => string) => {
        items.forEach((item, i) => {
          const x = GAP + (i % perRow) * (w + GAP),
            top = y + Math.floor(i / perRow) * (h + GAP);
          let label = "";
          this.tile(x, top, w, h, (pen) => (label = draw(pen, x, top, item, w, h)));
          this.add.text(x + 3, top + h - 10, label, font(7, "#7f97a6"));
        });
        y += Math.ceil(items.length / perRow) * (h + GAP) + 6;
      };
    heading(sections[0].title);
    row(shooters, WIDE.w, WIDE.h, 7, (pen, x, top, type, w, h) => {
      const d = content.towers[type],
        arc = d.visual.projectile === "lob",
        ty = top + (arc ? h - 12 : h / 2),
        t = built(type, 1, undefined, 0.5, 0),
        trails = new Trails();
      t.x = grid(x + 24);
      t.y = grid(ty);
      tower(pen, x + 24, ty, t);
      const p: Projectile = { id: 7, tower: 0, type, target: arc || d.visual.projectile === "rocket" ? null : 1, x: t.x, y: t.y, tx: grid(x + w - 8), ty: t.y, damage: 1, attack: d.attack },
        speed = d.projectile!.speed,
        stop = (p.tx - p.x) * (arc ? 0.5 : 0.62);
      for (let now = 0; p.x - t.x < stop; now += 1 / 60) {
        trails.sync([p], [t], content, now);
        p.x += speed / 60;
        if (p.x - t.x >= stop) trails.draw(pen, now);
      }
      return `${d.name}: ${d.visual.projectile}`;
    });
    heading(sections[1].title);
    for (const age of [0.03, 0.18])
      row(barrels, SMALL, SMALL, 16, (pen, x, top, type) => {
        const t = built(type, 1, undefined, 0.97, -Math.PI / 6);
        t.x = grid(x + SMALL / 2);
        t.y = grid(top + SMALL / 2);
        tower(pen, x + SMALL / 2, top + SMALL / 2, t);
        const d = content.towers[type];
        this.effect(pen, { type: "shot", tower: type, from: { x: t.x, y: t.y }, to: { x: t.x + 2 * Math.cos(t.angle), y: t.y + 2 * Math.sin(t.angle) }, color: d.color }, age, { level: 1, angle: t.angle });
        return d.name;
      });
    heading(sections[2].title);
    for (const age of [0.03, 0.12, 0.3])
      row(impacts, SMALL, SMALL, 16, (pen, x, top, type) => {
        const d = content.towers[type];
        this.effect(pen, { type: "impact", tower: type, at: { x: grid(x + SMALL / 2), y: grid(top + SMALL / 2) }, color: d.color }, age, { heading: 0 });
        return d.name;
      });
    heading(sections[3].title);
    const beams = [
      { label: "Lance 0.02 s", turret: "rail" as const, age: 0.02 },
      { label: "Lance 0.2 s", turret: "rail" as const, age: 0.2 },
      { label: "Focus 0.2", turret: "lens" as const, age: 0.05, power: 0.2 },
      { label: "Focus 1", turret: "lens" as const, age: 0.05, power: 1 },
    ];
    row([...beams, ...CHAINS.map((turret) => ({ label: `chain ${turret}`, turret, age: 0.1, power: undefined }))], WIDE.w, WIDE.h, 7, (pen, x, top, item, w, h) => {
      const type = withTurret(item.turret),
        d = content.towers[type],
        from = { x: grid(x + 24), y: grid(top + h / 2) },
        to = { x: grid(x + w - 12), y: grid(top + h / 2 + 6) };
      if (item.label.startsWith("chain")) {
        this.effect(pen, { type: "chain", from, to, color: d.color }, item.age);
        return `${item.label} (${d.name})`;
      }
      const t = built(type, 1, undefined, 0.95, Math.atan2(to.y - from.y, to.x - from.x));
      t.x = from.x;
      t.y = from.y;
      tower(pen, x + 24, top + h / 2, t);
      this.effect(pen, { type: "beam", from, to, color: d.color, power: item.power }, item.age, { level: 1, angle: t.angle });
      return item.label;
    });
    heading(sections[4].title);
    for (const age of [0.12, 0.35])
      row(PULSES, PULSE, PULSE, 9, (pen, x, top, turret) => {
        const d = content.towers[withTurret(turret)];
        this.effect(pen, { type: "pulse", at: { x: grid(x + PULSE / 2), y: grid(top + PULSE / 2) }, radius: 0.95, color: d.color }, age);
        return d.name;
      });
  }
  private effect(pen: Pen, event: VisualEvent, age: number, origin?: EffectOrigin) {
    drawEffect(pen, event, age, content, origin);
  }
  /** One masked tile with a normal and an additive ink, like a battlefield cell. */
  private tile(x: number, y: number, w: number, h: number, draw: (pen: Pen, cx: number, cy: number) => void) {
    const back = this.add.graphics(),
      shape = this.make.graphics({}, false),
      g = this.add.graphics(),
      glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    back.fillStyle(0x0d1820);
    back.fillRoundedRect(x, y, w, h, 8);
    shape.fillRoundedRect(x, y, w, h, 8);
    const mask = shape.createGeometryMask();
    g.setMask(mask);
    glow.setMask(mask);
    draw({ g, glow }, x + w / 2, y + h / 2);
  }
}

export const showcaseSize = { width: width * ZOOM, height: height * ZOOM };
