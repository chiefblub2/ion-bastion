import Phaser from "phaser";
import { DEFAULT_CONTENT } from "./content";
import { isFullyUpgraded, towerColor, towerLevel, towerPath, upgradeOptions } from "./core/upgrades";
import type { Tower, TowerId } from "./core/types";
import { muzzleTips } from "./render/muzzles";
import { CELL, type Pen } from "./render/shapes";
import { drawTower, isTilted } from "./render/towers";
// Dev-only review sheet of the towers drawn in the 3/4 tilt (`/gallery.html?tilt`), through the battlefield's own
// `drawTower`: per tower L1, firing (red crosses on `muzzleTips`: barrel tips or the emit point), L5, each path at L8
// and L5 at five headings. Dashed squares are the tower's cell, so the reach into the cell above shows.
// `&only=flak,lance` limits the rows, `&clock=<s>` picks the frame. Screenshots: `scripts/tilt-review.ts`.

const ZOOM = 2;
const params = new URLSearchParams(location.search);
const CLOCK = Number(params.get("clock") ?? 0.6);
const only = params.get("only")?.split(",");
const content = DEFAULT_CONTENT;
const rows = (Object.keys(content.towers) as TowerId[]).filter((id) => isTilted(content.towers[id]) && (!only || only.includes(id)));
const TW = 70,
  TH = 84,
  GAP = 4,
  LABEL = 90,
  HEADINGS = [
    { label: "E", a: 0 },
    { label: "SE", a: Math.PI / 4 },
    { label: "S", a: Math.PI / 2 },
    { label: "W", a: Math.PI },
    { label: "N", a: -Math.PI / 2 },
  ];
const COLUMNS = 6 + HEADINGS.length;
export const tiltReviewSize = { width: (LABEL + COLUMNS * (TW + GAP) + 10) * ZOOM, height: (30 + rows.length * (TH + GAP)) * ZOOM };
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
const draw = (pen: Pen, x: number, y: number, t: Tower) => drawTower(pen, x, y, t, content.towers[t.type], CLOCK, badges(t));

export class TiltReview extends Phaser.Scene {
  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
    this.add.text(GAP, 6, `Tilted towers at clock ${CLOCK}: L1 | L1 fire | L5 | L8 per path | L5 headings`, font(10));
    rows.forEach((id, i) => {
      const y = 26 + i * (TH + GAP),
        d = content.towers[id];
      this.add.text(GAP, y + 2, d.name, { ...font(9), wordWrap: { width: LABEL - 8 } });
      const paths = Object.keys(d.visual.paths ?? {});
      const tiles: { label: string; draw: (pen: Pen, x: number, y: number) => void }[] = [
        { label: "L1", draw: (pen, x, y) => draw(pen, x, y, built(id, 1)) },
        {
          label: "L1 fire",
          draw: (pen, x, y) => {
            const t = built(id, 1, undefined, 0.97);
            draw(pen, x, y, t);
            pen.glow.lineStyle(1, 0xff3040, 1);
            for (const p of muzzleTips(d.visual.turret, 1, x, y, t.angle, Math.max(0, (t.cooldown - 0.7) / 0.3) ** 2)) {
              pen.glow.lineBetween(p.x - 2, p.y - 2, p.x + 2, p.y + 2);
              pen.glow.lineBetween(p.x - 2, p.y + 2, p.x + 2, p.y - 2);
            }
          },
        },
        { label: "L5", draw: (pen, x, y) => draw(pen, x, y, built(id, 5)) },
        ...paths.map((p) => ({ label: `L8 ${d.visual.paths![p].name ?? p}`, draw: (pen: Pen, x: number, y: number) => draw(pen, x, y, built(id, "max", p)) })),
        ...HEADINGS.map((h) => ({ label: `L5 ${h.label}`, draw: (pen: Pen, x: number, y: number) => draw(pen, x, y, built(id, 5, undefined, 0, h.a)) })),
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
