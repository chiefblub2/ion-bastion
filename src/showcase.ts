import Phaser from "phaser";
import { DEFAULT_CONTENT } from "./content";
import { drawEffect, type EffectOrigin, type VisualEvent } from "./render/effects";
import { MUZZLES } from "./render/muzzles";
import { PROJECTILES } from "./render/projectiles";
import { CELL, type Pen } from "./render/shapes";
import { Trails } from "./render/trails";
import { built as buy, drawBuilt, font as fontAt, maskedTile } from "./review-kit";
import type { Projectile, Tower, TowerId, TurretStyle } from "./core/types";
// Dev-only page, drawn by the battlefield's own functions at a fixed time so a screenshot shows a whole look at once:
// `/gallery.html?showcase` (or `?showcase=shots`) has every projectile in flight, muzzle flash, impact, beam, chain and
// pulse. The towers at their levels, paths and headings are on the tilt review (`?tilt`, `tilt-review.ts`). Never sets
// `__gallery.cells`, so `scripts/readme-images.ts` ignores it.

const ZOOM = 2;
const GAP = 6;
const params = new URLSearchParams(location.search);
/** Fixed animation time (`&clock=<s>` overrides), so every run draws the same frame. */
const CLOCK = Number(params.get("clock") ?? 0.6);

const content = DEFAULT_CONTENT,
  towers = Object.keys(content.towers) as TowerId[];
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
const width = SHOTS_WIDTH,
  height = 30 + sections.reduce((sum, s) => sum + 28 + s.rows * (s.h + GAP), 0);
/** Grid coordinate of a pixel position, the inverse of `px`. */
const grid = (v: number) => v / CELL - 0.5;
const font = fontAt(ZOOM);

/** A tower at `level` in its firing pose (`cooldown`) aiming at `angle`. */
const built = (type: TowerId, level: number, cooldown: number, angle: number) => buy(type, level, { cooldown, angle, id: 0 });
/** Draws a tower the way the battlefield does. */
const tower = (pen: Pen, x: number, y: number, t: Tower) => drawBuilt(pen, x, y, t, CLOCK);
/** The first tower with this turret. */
const withTurret = (turret: TurretStyle) => towers.find((t) => content.towers[t].visual.turret === turret)!;

export class Showcase extends Phaser.Scene {
  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
    this.shots();
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
        arc = !!(d.visual.projectile && PROJECTILES[d.visual.projectile].arc),
        ty = top + (arc ? h - 12 : h / 2),
        t = built(type, 1, 0.5, 0),
        trails = new Trails();
      t.x = grid(x + 24);
      t.y = grid(ty);
      tower(pen, x + 24, ty, t);
      const p: Projectile = { id: 7, tower: 0, type, target: arc || d.visual.projectile === "rocket" || d.visual.projectile === "starshell" ? null : 1, x: t.x, y: t.y, tx: grid(x + w - 8), ty: t.y, damage: 1, attack: d.attack },
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
        const t = built(type, 1, 0.97, -Math.PI / 6);
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
      const t = built(type, 1, 0.95, Math.atan2(to.y - from.y, to.x - from.x));
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
    maskedTile(this, x, y, w, h, draw);
  }
}

export const showcaseSize = { width: width * ZOOM, height: height * ZOOM };
