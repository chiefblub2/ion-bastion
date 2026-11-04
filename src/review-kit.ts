import Phaser from "phaser";
import { DEFAULT_CONTENT } from "./content";
import { isFullyUpgraded, towerColor, towerLevel, towerPath, upgradeOptions } from "./core/upgrades";
import type { Tower, TowerId } from "./core/types";
import type { Pen } from "./render/shapes";
import { drawTower, type TowerBadges } from "./render/towers";
// Shared pieces of the dev-only tower review pages (`tilt-review.ts`, `showcase.ts`, `gallery.ts`): towers bought to a
// level, their badges, a label font and a masked tile with a normal and an additive ink, like a battlefield cell.

const content = DEFAULT_CONTENT;
/**
 * A tower bought up to `level` (`"max"`: as far as it goes): path upgrades only from `path`, Aura's tracks only from
 * `track` (else the first one offered).
 */
export function built(type: TowerId, level: number | "max", { path, track, cooldown = 0, angle = -Math.PI / 4, id = 3 }: { path?: string; track?: string; cooldown?: number; angle?: number; id?: number } = {}): Tower {
  const t: Tower = { id, type, x: 0, y: 0, upgrades: [], cooldown, spent: 0, angle, kills: 0, owner: 0 };
  while (level === "max" || towerLevel(t, content) < level) {
    const next = upgradeOptions(t, Infinity, content).find(
      (o) => o.status === "available" && (!o.definition!.path || o.definition!.path === path) && (!track || !o.definition!.track || o.definition!.track === track),
    );
    if (!next) break;
    t.upgrades.push(next.definition!.id);
  }
  return t;
}
export const badgesOf = (t: Tower): TowerBadges => ({ markers: towerLevel(t, content), maxed: isFullyUpgraded(t, content), color: towerColor(t, content), path: towerPath(t, content), boosted: false });
/** Draws a tower the way the battlefield does, at a fixed animation time. */
export const drawBuilt = (pen: Pen, x: number, y: number, t: Tower, clock: number) => drawTower(pen, x, y, t, content.towers[t.type], clock, badgesOf(t));
/** Monospace label style at the page's pixel scale. */
export const font = (zoom: number) => (size: number, color = "#cfe3ef") => ({ fontFamily: "monospace", fontSize: `${size}px`, color, resolution: zoom });
/** One rounded tile (dark backdrop) whose inks are masked to it, so long shots and bodies never spill over. */
export function maskedTile(scene: Phaser.Scene, x: number, y: number, w: number, h: number, draw: (pen: Pen, cx: number, cy: number) => void) {
  const back = scene.add.graphics(),
    shape = scene.make.graphics({}, false),
    g = scene.add.graphics(),
    glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  back.fillStyle(0x0d1820);
  back.fillRoundedRect(x, y, w, h, 8);
  shape.fillRoundedRect(x, y, w, h, 8);
  const mask = shape.createGeometryMask();
  g.setMask(mask);
  glow.setMask(mask);
  draw({ g, glow }, x + w / 2, y + h / 2);
}
