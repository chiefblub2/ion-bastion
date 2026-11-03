import Phaser from "phaser";
import { DEFAULT_CONTENT } from "./content";
import { isFullyUpgraded, towerColor, towerLevel, towerPath, upgradeOptions } from "./core/upgrades";
import type { Tower, TowerId } from "./core/types";
import { CONCEPTS } from "./concepts";
import type { Concept } from "./concepts/types";
import { CELL, shade, type Pen } from "./render/shapes";
import { drawTower } from "./render/towers";
import type { TurretContext } from "./render/tower-art/kit";
import { MOTIFS } from "./render/tower-art/motifs";
import { onDeck } from "./render/tower-art/tilt";
import { pageOf } from "./ui/tower-pages";
// Dev-only concept sheet for the 3/4 tilt of the Control, Traps and Support towers (`/gallery.html?concepts`, throwaway
// like the Attack concepts were): per tower today's flat look at its last plain level, then the concept at L1, firing
// (red crosses on the projected muzzle tips or emit point), the last plain level, each path at its top tier and the
// last plain level at five headings. Traps stand on a strip of path. Dashed squares are the tower's cell, so
// the reach into the cell above shows. `&only=mine,tar` limits the rows, `&tab=control|traps|support` one tab,
// `&clock=<s>` picks the frame.

const ZOOM = 2;
const params = new URLSearchParams(location.search);
const CLOCK = Number(params.get("clock") ?? 0.6);
const only = params.get("only")?.split(",");
const content = DEFAULT_CONTENT;
const tab = params.get("tab");
const TAB_PAGE: Record<string, number> = { control: 1, traps: 2, support: 3 };
const rows = CONCEPTS.filter((c) => (!only || only.includes(c.tower)) && (!tab || pageOf(DEFAULT_CONTENT.towers[c.tower]) === TAB_PAGE[tab]));
const TW = 70,
  TH = 84,
  GAP = 4,
  LABEL = 120,
  HEADINGS = [
    { label: "E", a: 0 },
    { label: "SE", a: Math.PI / 4 },
    { label: "S", a: Math.PI / 2 },
    { label: "W", a: Math.PI },
    { label: "N", a: -Math.PI / 2 },
  ];
const COLUMNS = 7 + HEADINGS.length;
export const conceptsSize = { width: (LABEL + COLUMNS * (TW + GAP) + 10) * ZOOM, height: (30 + rows.length * (TH + GAP)) * ZOOM };
const font = (size: number, color = "#cfe3ef") => ({ fontFamily: "monospace", fontSize: `${size}px`, color, resolution: ZOOM });

/** A tower bought up to `level`, path upgrades only from `path` (`"max"`: as far as it goes). */
function built(type: TowerId, level: number | "max", path?: string, cooldown = 0, angle = -Math.PI / 4): Tower {
  const t: Tower = { id: 3, type, x: 0, y: 0, upgrades: [], cooldown, spent: 0, angle, kills: 0, owner: 0 };
  while (level === "max" || towerLevel(t, content) < level) {
    const next = upgradeOptions(t, Infinity, content).find((o) => o.status === "available" && (!o.definition!.path || o.definition!.path === path));
    if (!next) break;
    t.upgrades.push(next.definition!.id);
  }
  return t;
}
const badges = (t: Tower) => ({ markers: towerLevel(t, content), maxed: isFullyUpgraded(t, content), color: towerColor(t, content), path: towerPath(t, content), boosted: false });
/** The drawing context `render/towers.ts` builds for a turret, for the concept's own drawings. */
function context(pen: Pen, x: number, y: number, t: Tower): TurretContext {
  const d = content.towers[t.type],
    b = badges(t),
    level = b.markers;
  return {
    g: pen.g,
    glow: pen.glow,
    x,
    y,
    tower: t,
    definition: d,
    clock: CLOCK,
    level,
    maxed: b.maxed,
    color: b.color,
    path: b.path,
    kick: Math.max(0, (t.cooldown - 0.7) / 0.3) ** 2,
    charge: 1 - t.cooldown,
    tip: level >= 6 ? b.color : level >= 5 ? shade(d.color, 0.35) : undefined,
    energy: level >= 5 ? 0.15 : 0,
    peak: b.maxed ? 0.42 : 0.6,
  };
}
/** The last plain level (5 for attack towers and traps, 3 for support, 4 for Aura): one below the lowest path tier. */
function plainLevel(type: TowerId) {
  const levels = content.towers[type].upgrades.filter((u) => u.path && u.effects.level !== undefined).map((u) => u.effects.level!);
  return levels.length ? Math.min(...levels) - 1 : 5;
}
/** Draws a concept the way `drawTower` would: base, path motif on the deck, the parts below, turret and above, level bars. */
function drawConcept(pen: Pen, c: Concept, x: number, y: number, t: Tower) {
  const ctx = context(pen, x, y, t),
    d = ctx.definition;
  c.base(ctx);
  const motif = ctx.path ? d.visual.paths?.[ctx.path]?.motif : undefined;
  if (motif) {
    const tier = Math.min(3, Math.max(1, ctx.level - plainLevel(t.type)));
    onDeck([pen.g, pen.glow], x, y + c.tilt.drop, c.tilt.deck, () => MOTIFS[motif]({ ...ctx, x: 0, y: 0 }, tier, CLOCK + t.id, 0.04 + 0.04 * tier));
  }
  c.below(ctx);
  c.turret(ctx);
  c.above(ctx);
  const step = ctx.level > 5 ? 5 : 6;
  pen.g.fillStyle(ctx.color);
  for (let i = 0; i < ctx.level; i++) pen.g.fillRect(x - (ctx.level * step - 2) / 2 + i * step, y + 20, step - 2, 3);
}
/** Projected muzzle tips (sides and fans laid across the aim on the ground plane), or the emit point. */
function tips(c: Concept, level: number, x: number, y: number, angle: number, kick: number) {
  const { drop, squash, height, pitch = 0 } = c.tilt;
  if (!c.reach) return c.tilt.emit === undefined ? [] : [{ x, y: y + drop - c.tilt.emit }];
  const d = c.reach(level) - kick * (c.recoil ?? 0),
    project = (a: number, side: number) => {
      const ca = Math.cos(a),
        sa = Math.sin(a),
        ground = d * Math.cos(pitch);
      return { x: x + ca * ground - sa * side, y: y + drop + (sa * ground + ca * side) * squash - height - d * Math.sin(pitch) };
    };
  if (c.fan) {
    const { count, step } = c.fan(level);
    return Array.from({ length: count }, (_, i) => project(angle + (i - (count - 1) / 2) * step, 0));
  }
  return (c.sides ?? [0]).map((s) => project(angle, s));
}

export class TiltConcepts extends Phaser.Scene {
  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
    this.add.text(GAP, 6, `Tilt concepts at clock ${CLOCK}: now (flat, last plain level) | L1 | L1 fire | last plain level | each path at its top | headings`, font(10));
    rows.forEach((c, i) => {
      const y = 26 + i * (TH + GAP),
        d = content.towers[c.tower];
      this.add.text(GAP, y + 2, `${d.name}\n${c.name}`, { ...font(9), wordWrap: { width: LABEL - 8 } });
      this.add.text(GAP, y + 26, c.idea, { ...font(7, "#8fa6b4"), wordWrap: { width: LABEL - 8 } });
      const paths = Object.keys(d.visual.paths ?? {}),
        plain = plainLevel(c.tower),
        trap = d.placement === "path";
      const tiles: { label: string; draw: (pen: Pen, x: number, y: number) => void }[] = [
        { label: `now L${plain}`, draw: (pen, x, y) => drawTower(pen, x, y, built(c.tower, plain), d, CLOCK, badges(built(c.tower, plain))) },
        { label: "L1", draw: (pen, x, y) => drawConcept(pen, c, x, y, built(c.tower, 1)) },
        {
          label: "L1 fire",
          draw: (pen, x, y) => {
            const t = built(c.tower, 1, undefined, 0.97);
            drawConcept(pen, c, x, y, t);
            pen.glow.lineStyle(1, 0xff3040, 1);
            for (const p of tips(c, 1, x, y, t.angle, Math.max(0, (t.cooldown - 0.7) / 0.3) ** 2)) {
              pen.glow.lineBetween(p.x - 2, p.y - 2, p.x + 2, p.y + 2);
              pen.glow.lineBetween(p.x - 2, p.y + 2, p.x + 2, p.y - 2);
            }
          },
        },
        { label: `L${plain}`, draw: (pen, x, y) => drawConcept(pen, c, x, y, built(c.tower, plain)) },
        ...paths.map((p) => {
          const t = built(c.tower, "max", p);
          return { label: `L${towerLevel(t, content)} ${d.visual.paths![p].name ?? p}`, draw: (pen: Pen, x: number, y: number) => drawConcept(pen, c, x, y, t) };
        }),
        ...HEADINGS.map((h) => ({ label: `L${plain} ${h.label}`, draw: (pen: Pen, x: number, y: number) => drawConcept(pen, c, x, y, built(c.tower, plain, undefined, 0, h.a)) })),
      ];
      tiles.forEach((tile, j) => {
        const x = LABEL + j * (TW + GAP),
          back = this.add.graphics(),
          g = this.add.graphics(),
          glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD),
          cx = x + TW / 2,
          cy = y + TH - CELL / 2 - 4;
        back.fillStyle(0x0d1820);
        back.fillRect(x, y, TW, TH);
        // Traps lie on the path: a strip of path bed through their cell, running east-west.
        if (trap) {
          back.fillStyle(0x2a2620);
          back.fillRect(x, cy - CELL * 0.42, TW, CELL * 0.84);
          back.fillStyle(0x3d3a33);
          back.fillRect(x, cy - CELL * 0.42, TW, 2);
          back.fillRect(x, cy + CELL * 0.42 - 2, TW, 2);
        }
        back.lineStyle(0.5, 0x2c4554, 1);
        for (let k = 0; k < 4; k++) {
          const [ax, ay, bx, by] = [
            [cx - CELL / 2, cy - CELL / 2, cx + CELL / 2, cy - CELL / 2],
            [cx + CELL / 2, cy - CELL / 2, cx + CELL / 2, cy + CELL / 2],
            [cx + CELL / 2, cy + CELL / 2, cx - CELL / 2, cy + CELL / 2],
            [cx - CELL / 2, cy + CELL / 2, cx - CELL / 2, cy - CELL / 2],
          ][k];
          for (let s = 0; s < 1; s += 0.1) back.lineBetween(ax + (bx - ax) * s, ay + (by - ay) * s, ax + (bx - ax) * (s + 0.05), ay + (by - ay) * (s + 0.05));
        }
        tile.draw({ g, glow }, cx, cy);
        this.add.text(x + 2, y + 1, tile.label, font(6, "#7f97a6"));
      });
    });
  }
}
