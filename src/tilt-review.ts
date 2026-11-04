import Phaser from "phaser";
import { DEFAULT_CONTENT } from "./content";
import { towerLevel } from "./core/upgrades";
import type { TowerId } from "./core/types";
import { muzzleTips } from "./render/muzzles";
import { CELL, type Pen } from "./render/shapes";
import { built, drawBuilt, font as fontAt } from "./review-kit";
import { pageOf } from "./ui/tower-pages";
// Dev-only review sheet of every tower (`/gallery.html?tilt`), through the battlefield's own `drawTower`: per tower L1,
// firing (red crosses on `muzzleTips`: barrel tips or the emit point), the last plain level, Aura's tracks at their
// tier III, each path at its top tier (Aura's on the track in the same slot) and the last plain level at five
// headings; traps stand on a strip of path. Dashed squares are the tower's cell, so the reach into the cell above shows.
// `&only=flak,lance` limits the rows, `&tab=attack|control|traps|support` one tab, `&clock=<s>` picks the frame. Screenshots: `scripts/tilt-review.ts`.

const ZOOM = 2;
const params = new URLSearchParams(location.search);
const CLOCK = Number(params.get("clock") ?? 0.6);
const only = params.get("only")?.split(",");
const content = DEFAULT_CONTENT;
const TAB = params.get("tab"),
  TABS: Record<string, number> = { attack: 0, control: 1, traps: 2, support: 3 };
const rows = (Object.keys(content.towers) as TowerId[]).filter((id) => (!only || only.includes(id)) && (!TAB || pageOf(content.towers[id]) === TABS[TAB]));
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
const tracksOf = (id: TowerId) => Object.keys(content.towers[id].visual.tracks ?? {});
const COLUMNS = 6 + HEADINGS.length + Math.max(0, ...rows.map((id) => tracksOf(id).length));
export const tiltReviewSize = { width: (LABEL + COLUMNS * (TW + GAP) + 10) * ZOOM, height: (30 + rows.length * (TH + GAP)) * ZOOM };
const font = fontAt(ZOOM);
/** The last plain level (5 for attack towers and traps, 3 for support, 4 for Aura): one below the lowest path tier. */
function plainLevel(type: TowerId) {
  const levels = content.towers[type].upgrades.filter((u) => u.path && u.effects.level !== undefined).map((u) => u.effects.level!);
  return levels.length ? Math.min(...levels) - 1 : 5;
}
const draw = (pen: Pen, x: number, y: number, t: ReturnType<typeof built>) => drawBuilt(pen, x, y, t, CLOCK);

export class TiltReview extends Phaser.Scene {
  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
    this.add.text(GAP, 6, `Towers at clock ${CLOCK}: L1 | L1 fire | last plain level | Aura's tracks | each path at its top | headings`, font(10));
    rows.forEach((id, i) => {
      const y = 26 + i * (TH + GAP),
        d = content.towers[id];
      this.add.text(GAP, y + 2, d.name, { ...font(9), wordWrap: { width: LABEL - 8 } });
      const paths = Object.keys(d.visual.paths ?? {}),
        tracks = tracksOf(id),
        plain = plainLevel(id),
        trap = d.placement === "path";
      const tiles: { label: string; draw: (pen: Pen, x: number, y: number) => void }[] = [
        { label: "L1", draw: (pen, x, y) => draw(pen, x, y, built(id, 1)) },
        {
          label: "L1 fire",
          draw: (pen, x, y) => {
            const t = built(id, 1, { cooldown: 0.97 });
            draw(pen, x, y, t);
            pen.glow.lineStyle(1, 0xff3040, 1);
            for (const p of muzzleTips(d.visual.turret, 1, x, y, t.angle, Math.max(0, (t.cooldown - 0.7) / 0.3) ** 2)) {
              pen.glow.lineBetween(p.x - 2, p.y - 2, p.x + 2, p.y + 2);
              pen.glow.lineBetween(p.x - 2, p.y + 2, p.x + 2, p.y - 2);
            }
          },
        },
        { label: `L${plain}`, draw: (pen, x, y) => draw(pen, x, y, built(id, plain)) },
        ...tracks.map((k) => ({ label: `L${plain} ${k}`, draw: (pen: Pen, x: number, y: number) => draw(pen, x, y, built(id, plain, { track: k })) })),
        ...paths.map((p, i) => {
          const t = built(id, "max", { path: p, track: tracks[i] });
          return { label: `L${towerLevel(t, content)} ${d.visual.paths![p].name ?? p}`, draw: (pen: Pen, x: number, y: number) => draw(pen, x, y, t) };
        }),
        ...HEADINGS.map((h) => ({ label: `L${plain} ${h.label}`, draw: (pen: Pen, x: number, y: number) => draw(pen, x, y, built(id, plain, { angle: h.a })) })),
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
