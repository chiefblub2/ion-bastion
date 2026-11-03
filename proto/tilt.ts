// Throwaway prototype (not part of the game): Pulse drawn in a slight 3/4 tilt next to the current top-down look.
import Phaser from "phaser";
import { DEFAULT_CONTENT } from "../src/content";
import { OUTPOST } from "../src/content/maps";
import { isFullyUpgraded, towerColor, towerLevel, towerPath, upgradeOptions } from "../src/core/upgrades";
import type { Tower, TowerId } from "../src/core/types";
import { DARK, LIGHT, OUTLINE, PLATE, SHADOW, dome, facing, halo, plate, rivets, sunken } from "../src/render/material";
import { MOTIFS } from "../src/render/tower-art/motifs";
import { CELL, arcBand, disc, oval, px, ring, shade, type Ink, type Pen } from "../src/render/shapes";
import { drawTower } from "../src/render/towers";
import { drawGates, drawTerrain } from "../src/render/terrain";

const content = DEFAULT_CONTENT,
  params = new URLSearchParams(location.search),
  VIEW = params.get("view") ?? "sheet",
  CLOCK = 0.6;

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

/** Tilt: ground depth is squashed by `squash` (cos of the tilt), heights shown at `rise` px per px (its sin). */
interface Tilt {
  squash: number;
  rise: number;
}
const SUBTLE: Tilt = { squash: 0.82, rise: 0.55 },
  STRONG: Tilt = { squash: 0.6, rise: 0.9 };

/** Light direction on the screen for side faces: from the upper left. */
const LX = Math.cos(LIGHT),
  LY = Math.sin(LIGHT);

function quadPts(g: Ink, pts: number[], color: number, alpha = 1) {
  g.fillStyle(color, alpha);
  g.fillTriangle(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]);
  g.fillTriangle(pts[0], pts[1], pts[4], pts[5], pts[6], pts[7]);
}
/** Vertical cylinder of radius `r` standing on (`x`, `y`) on screen, `h` px tall: shaded front half, lit cap. */
function cylinder(g: Ink, x: number, y: number, r: number, h: number, sq: number, color: number, cap = true) {
  const n = 14;
  for (let i = 0; i < n; i++) {
    const t0 = (i / n) * Math.PI,
      t1 = ((i + 1) / n) * Math.PI,
      x0 = x + Math.cos(t0) * r,
      x1 = x + Math.cos(t1) * r,
      y0 = y + Math.sin(t0) * r * sq,
      y1 = y + Math.sin(t1) * r * sq,
      f = facing((t0 + t1) / 2);
    quadPts(g, [x0, y0, x1, y1, x1, y1 - h, x0, y0 - h], shade(color, -0.32 + 0.38 * Math.max(-0.4, f) + (i === n - 3 ? 0.18 : 0)));
  }
  if (cap) {
    oval(g, x, y - h, r, r * sq, shade(color, 0.12));
    oval(g, x - 0.5, y - h - 0.3, r - 1.2, (r - 1.2) * sq, color);
  }
}

/** Pulse in the 3/4 tilt. (`x`, `y`) is the cell centre; the footprint sits a little below it so the height reads. */
function tiltedPulse({ g, glow }: Pen, x: number, y: number, t: Tower, tilt: Tilt) {
  const d = content.towers.pulse,
    b = badges(t),
    level = b.markers,
    p = b.color,
    c = d.color,
    sq = tilt.squash,
    k = tilt.rise,
    gx = x,
    gy = y + 6,
    kick = Math.max(0, (t.cooldown - 0.7) / 0.3) ** 2,
    charge = 1 - t.cooldown,
    tip = level >= 6 ? p : level >= 5 ? shade(c, 0.35) : undefined,
    a = t.angle,
    R = 21,
    HB = 9 * k,
    HP = 6 * k,
    HC = HB + HP + 7 * k,
    rot = 0;
  const flat = (ink: Ink, h: number, draw: () => void) => {
    ink.save();
    ink.translateCanvas(gx, gy - h);
    ink.scaleCanvas(1, sq);
    draw();
    ink.restore();
  };
  // Ground shadow: the block's and the turret's, falling to the lower right.
  flat(g, 0, () => {
    oval(g, 6, 7, R + 6, R + 2, SHADOW, 0.28);
    oval(g, 4, 4, R + 1, R - 1, SHADOW, 0.3);
  });
  // Barrel shadow on the ground (beyond the block, the block covers the rest).
  const reachOf = 21 + level,
    back = -kick * 5,
    end = back + reachOf,
    off = HC * 0.9;
  flat(g, 0, () => {
    const ca = Math.cos(a),
      sa = Math.sin(a),
      sx = off * 0.7,
      sy = off * 0.7 / sq;
    g.fillStyle(SHADOW, 0.2);
    const w = 3.4;
    g.fillTriangle(sx + ca * 6 - sa * w, sy + sa * 6 + ca * w, sx + ca * end - sa * w, sy + sa * end + ca * w, sx + ca * end + sa * w, sy + sa * end - ca * w);
    g.fillTriangle(sx + ca * 6 - sa * w, sy + sa * 6 + ca * w, sx + ca * end + sa * w, sy + sa * end - ca * w, sx + ca * 6 + sa * w, sy + sa * 6 - ca * w);
  });
  // The hex block: front faces, then the raised top.
  const corner = (i: number) => rot + (i * Math.PI) / 3;
  for (let i = 0; i < 6; i++) {
    const a0 = corner(i),
      a1 = corner(i + 1),
      normal = (a0 + a1) / 2;
    if (Math.sin(normal) <= 0.01) continue;
    const x0 = gx + Math.cos(a0) * R,
      y0 = gy + Math.sin(a0) * R * sq,
      x1 = gx + Math.cos(a1) * R,
      y1 = gy + Math.sin(a1) * R * sq,
      f = facing(normal),
      face = shade(PLATE, -0.12 + 0.32 * f);
    quadPts(g, [x0 - 0.6, y0 + 0.8, x1 + 0.6, y1 + 0.8, x1 + 0.6, y1 - HB, x0 - 0.6, y0 - HB], OUTLINE, 0.9);
    quadPts(g, [x0, y0, x1, y1, x1, y1 - HB, x0, y0 - HB], face);
    // Bevel catching the light along the top edge, a dark seam at the bottom, a panel line in the middle.
    quadPts(g, [x0, y0 - HB, x1, y1 - HB, x1, y1 - HB + 1.4, x0, y0 - HB + 1.4], shade(face, 0.35));
    quadPts(g, [x0, y0 - 1.2, x1, y1 - 1.2, x1, y1, x0, y0], shade(face, -0.4));
    g.lineStyle(0.7, shade(face, -0.3), 0.8);
    g.lineBetween(x0 + (x1 - x0) * 0.12, y0 - HB * 0.5 + (y1 - y0) * 0.12, x0 + (x1 - x0) * 0.88, y0 - HB * 0.5 + (y1 - y0) * 0.88);
  }
  flat(g, HB, () => {
    plate(g, 0, 0, { n: 6, rot }, R, PLATE);
    sunken(g, 0, 0, { n: 6, rot }, 16, DARK);
    rivets(g, 0, 0, 19, 3, Math.PI / 2, shade(c, -0.45));
    if (level >= 2) {
      ring(g, 0, 0, 13.5, 2, DARK);
      arcBand(g, 0, 0, 13.7, 0.9, LIGHT - 0.9, LIGHT + 0.9, shade(p, 0.25), 0.85);
    }
    ring(g, 0, 0, 11.5, 1.3, p, 0.6);
  });
  if (level >= 5) flat(glow, HB, () => ring(glow, 0, 0, 11.5, 2, p, 0.35));
  // Path motif on the deck, under the turret.
  const motif = b.path ? d.visual.paths?.[b.path]?.motif : undefined;
  if (motif) {
    const tier = Math.min(3, Math.max(1, level - 5));
    g.save();
    glow.save();
    for (const ink of [g, glow]) {
      ink.translateCanvas(gx, gy - HB);
      ink.scaleCanvas(0.85, 0.85 * sq);
    }
    MOTIFS[motif]({ g, glow, x: 0, y: 0, tower: t, definition: d, clock: CLOCK, level, maxed: b.maxed, color: p, path: b.path, kick, charge, tip, energy: 0.15, peak: 0.6 }, tier, CLOCK + t.id, 0.06 + 0.06 * tier);
    g.restore();
    glow.restore();
  }
  // Barrel shadow on the deck.
  flat(g, HB, () => {
    const ca = Math.cos(a),
      sa = Math.sin(a),
      o = (HC - HB) * 0.9,
      sx = o * 0.7,
      sy = (o * 0.7) / sq,
      w = 3.6,
      e = Math.min(end, 15);
    g.fillStyle(SHADOW, 0.4);
    g.fillTriangle(sx + ca * 4 - sa * w, sy + sa * 4 + ca * w, sx + ca * e - sa * w, sy + sa * e + ca * w, sx + ca * e + sa * w, sy + sa * e - ca * w);
    g.fillTriangle(sx + ca * 4 - sa * w, sy + sa * 4 + ca * w, sx + ca * e + sa * w, sy + sa * e - ca * w, sx + ca * 4 + sa * w, sy + sa * 4 - ca * w);
  });
  // Lamps on the front faces: one from L2, three chasing from L4.
  const lamps = level >= 4 ? [1, 2, 3] : level >= 2 ? [2] : [];
  for (const i of lamps) {
    const n = (corner(i - 1) + corner(i)) / 2 + Math.PI / 3 - Math.PI / 3,
      mid = (corner(i - 1 + 0) + corner(i)) / 2,
      lx = gx + Math.cos(mid) * R * 0.87,
      ly = gy + Math.sin(mid) * R * 0.87 * sq - HB * 0.55,
      on = level >= 4 ? 0.35 + 0.65 * Math.max(0, Math.sin(4 * CLOCK - i)) : 1;
    void n;
    disc(g, lx, ly, 2, OUTLINE, 0.9);
    disc(g, lx, ly, 1.3, shade(p, -0.7 * (1 - on)));
    if (on > 0.5) disc(glow, lx, ly, 3.8, p, 0.3 * on);
  }
  // Pedestal and turret head.
  const hx = gx,
    hy = gy - HC,
    ca = Math.cos(a),
    sa = Math.sin(a),
    sx = ca,
    sy = sa * sq,
    len = Math.hypot(sx, sy) || 1,
    ux = sx / len,
    uy = sy / len,
    scale = len,
    tipLift = 0;
  void tipLift;
  cylinder(g, gx, gy - HB, 7.5, HP, sq, shade(PLATE, 0.1));
  if (level >= 2) {
    // Collar band round the pedestal in the trim colour.
    for (let i = 0; i < 10; i++) {
      const t0 = (i / 10) * Math.PI,
        t1 = ((i + 1) / 10) * Math.PI,
        yb = gy - HB - HP * 0.45;
      quadPts(g, [gx + Math.cos(t0) * 7.7, yb + Math.sin(t0) * 7.7 * sq, gx + Math.cos(t1) * 7.7, yb + Math.sin(t1) * 7.7 * sq, gx + Math.cos(t1) * 7.7, yb + Math.sin(t1) * 7.7 * sq - 1.6, gx + Math.cos(t0) * 7.7, yb + Math.sin(t0) * 7.7 * sq - 1.6], shade(p, -0.25 + 0.3 * facing((t0 + t1) / 2)));
    }
  }
  const barrel = () => {
    const w0 = 3.5 + (level >= 3 ? 0.5 : 0),
      dist = (v: number) => v * scale,
      perp = { x: -uy, y: ux },
      lit = perp.x * LX + perp.y * LY > 0 ? 1 : -1,
      seg = (from: number, to: number, w: number, color: number) => {
        const f0 = dist(from),
          f1 = dist(to),
          pts = (s0: number, s1: number) => [hx + ux * f0 + perp.x * s0, hy + uy * f0 + perp.y * s0, hx + ux * f1 + perp.x * s0, hy + uy * f1 + perp.y * s0, hx + ux * f1 + perp.x * s1, hy + uy * f1 + perp.y * s1, hx + ux * f0 + perp.x * s1, hy + uy * f0 + perp.y * s1];
        quadPts(g, pts(-w - 0.8, w + 0.8), OUTLINE, 0.85);
        quadPts(g, pts(-w, w), color);
        quadPts(g, pts(lit * w, lit * w * 0.25), shade(color, 0.3));
        quadPts(g, pts(lit * w * 0.7, lit * w * 0.45), shade(color, 0.6), 0.8);
        quadPts(g, pts(-lit * w, -lit * w * 0.4), shade(color, -0.35));
      };
    seg(back + 3, end - 4, w0, c);
    if (level >= 3)
      for (const f of [0.45, 0.6]) {
        const v = back + 3 + (end - 7 - back) * f;
        seg(v - 0.5, v + 0.5, w0 + 0.2, shade(c, -0.45));
      }
    seg(end - 4, end, w0 + 0.8, shade(c, -0.3));
    if (tip !== undefined) seg(end - 2.2, end, w0 + 0.8, tip);
    // Muzzle face when the barrel points towards the viewer.
    const toward = sa * Math.sqrt(1 - sq * sq);
    if (toward > 0.05) {
      const ex = hx + ux * dist(end),
        ey = hy + uy * dist(end);
      oval(g, ex, ey, (w0 + 0.8) * toward, w0 + 0.8, shade(c, -0.5), 1, Math.atan2(uy, ux));
      oval(g, ex, ey, 1.6 * toward + 0.3, 1.6, OUTLINE, 1, Math.atan2(uy, ux));
    }
  };
  const away = sa < 0;
  if (away) barrel();
  dome(g, hx, hy, 9, c);
  // Charge slot on the back of the head, glowing as the next shot loads.
  const sbx = hx - ux * 5.2,
    sby = hy - uy * 5.2 - 1;
  disc(g, sbx, sby, 1.9, OUTLINE, 0.9);
  disc(g, sbx, sby, 1.1, shade(c, 0.45), 0.3 + 0.6 * charge);
  disc(glow, sbx, sby, 3, c, Math.min(0.6, 0.2 + 0.4 * charge + (level >= 5 ? 0.15 : 0)));
  if (!away) barrel();
  // Centre bolt on top of the head.
  disc(g, hx - 1, hy - 3, 2.2, b.maxed ? shade(p, 0.8) : DARK);
  arcBand(g, hx - 1, hy - 3, 1.6, 0.8, LIGHT - 1.1, LIGHT + 1.1, b.maxed ? 0xffffff : shade(PLATE, 0.45), 0.9);
  if (b.maxed) {
    disc(glow, hx - 1, hy - 3, 4, p, 0.2);
    halo(glow, gx, gy - HB, 24, p, 0.12 + 0.04 * Math.sin(CLOCK * 2 + t.id));
  }
  if (kick > 0) {
    const mx = hx + ux * dist2(end + 1, scale),
      my = hy + uy * dist2(end + 1, scale);
    halo(glow, mx, my, 4 * (1.3 + kick), c, 0.3 * kick);
    disc(g, mx, my, 4 * 0.35 * (0.5 + kick), shade(c, 0.75));
  }
  // Level bars along the ground below the block.
  const step = level > 5 ? 5 : 6;
  g.fillStyle(p);
  for (let i = 0; i < level; i++) g.fillRect(x - (level * step - 2) / 2 + i * step, gy + R * sq + 4, step - 2, 3);
}
const dist2 = (v: number, s: number) => v * s;

function current(pen: Pen, x: number, y: number, t: Tower) {
  drawTower(pen, x, y, t, content.towers[t.type], CLOCK, badges(t));
}

const ZOOM = 3,
  TILE = CELL + 14,
  GAP = 8,
  LABEL = 120;

class Sheet extends Phaser.Scene {
  create() {
    this.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
    const paths = Object.keys(content.towers.pulse.visual.paths ?? {}),
      states: { label: string; t: () => Tower }[] = [
        { label: "L1", t: () => built("pulse", 1) },
        { label: "L1 firing", t: () => built("pulse", 1, undefined, 0.95) },
        { label: "L3", t: () => built("pulse", 3) },
        { label: "L5", t: () => built("pulse", 5) },
        ...paths.map((p) => ({ label: `L8 ${content.towers.pulse.visual.paths![p].name ?? p}`, t: () => built("pulse", "max", p) })),
      ],
      rows: { label: string; draw: (pen: Pen, x: number, y: number, t: Tower) => void }[] = [
        { label: "Current\n(top-down)", draw: current },
        { label: "Tilt A\nsubtle (~35°)", draw: (pen, x, y, t) => tiltedPulse(pen, x, y, t, SUBTLE) },
        { label: "Tilt B\nstronger (~53°)", draw: (pen, x, y, t) => tiltedPulse(pen, x, y, t, STRONG) },
      ];
    const font = (s: number, color = "#cfe3ef") => ({ fontFamily: "monospace", fontSize: `${s}px`, color, resolution: ZOOM });
    this.add.text(GAP, 6, "Pulse tower: current vs 3/4 tilt", font(10));
    rows.forEach((row, r) => {
      const y = 24 + r * (TILE + GAP);
      this.add.text(GAP, y + TILE / 2 - 10, row.label, font(8));
      states.forEach((s, i) => {
        const x = LABEL + i * (TILE + GAP);
        this.tile(x, y, (pen, cx, cy) => row.draw(pen, cx, cy, s.t()));
        if (r === 0) this.add.text(x, 16, s.label, font(6, "#7f97a6"));
      });
    });
    // Aim angles in tilt A.
    const y = 24 + rows.length * (TILE + GAP) + 10;
    this.add.text(GAP, y + TILE / 2 - 10, "Tilt A\n8 aim angles\n(L5)", font(8));
    for (let i = 0; i < 8; i++) {
      const x = LABEL + i * (TILE + GAP);
      this.tile(x, y, (pen, cx, cy) => tiltedPulse(pen, cx, cy, built("pulse", 5, undefined, 0, (i * Math.PI) / 4 - Math.PI / 2), SUBTLE));
    }
  }
  private tile(x: number, y: number, draw: (pen: Pen, cx: number, cy: number) => void) {
    const back = this.add.graphics(),
      g = this.add.graphics(),
      glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    back.fillStyle(0x3a4a3c);
    back.fillRect(x, y, TILE, TILE);
    back.lineStyle(0.5, 0x2a3a2c, 1);
    back.strokeRect(x + (TILE - CELL) / 2, y + (TILE - CELL) / 2, CELL, CELL);
    draw({ g, glow }, x + TILE / 2, y + TILE / 2);
  }
}

class Board extends Phaser.Scene {
  create() {
    const map = OUTPOST,
      blocked = new Set(map.blocked.map((p) => `${p.x},${p.y}`)),
      tilt = params.get("tilt") === "b" ? STRONG : SUBTLE,
      mode = params.get("mode") ?? "tilt";
    this.cameras.main.setOrigin(0, 0).setZoom(Number(params.get("zoom") ?? 1.5));
    drawTerrain(this, map, (x, y) => blocked.has(`${x},${y}`));
    const gates = { g: this.add.graphics(), glow: this.add.graphics().setBlendMode(Phaser.BlendModes.ADD) };
    drawGates(gates, map, 0, true, 0);
    const paths = Object.keys(content.towers.pulse.visual.paths ?? {});
    // A defence along the first bends: Pulses (tilted or current) beside current towers of other types.
    const placed: { x: number; y: number; t: Tower }[] = [
      { x: 4, y: 2, t: built("pulse", 1, undefined, 0, 0.6) },
      { x: 4, y: 4, t: built("pulse", 3, undefined, 0.95, 0) },
      { x: 6, y: 5, t: built("pulse", 5, undefined, 0, Math.PI) },
      { x: 9, y: 4, t: built("pulse", "max", paths[0], 0, 2.2) },
      { x: 9, y: 5, t: built("pulse", "max", paths[1], 0, Math.PI / 2) },
      { x: 12, y: 4, t: built("pulse", "max", paths[2], 0, -2.4) },
      { x: 7, y: 7, t: built("blast", 3, undefined, 0, -1) },
      { x: 4, y: 7, t: built("frost", 3, undefined, 0, 0) },
      { x: 12, y: 6, t: built("pulse", 5, undefined, 0, Math.PI) },
      { x: 13, y: 6, t: built("pulse", 5, undefined, 0, 0) },
      { x: 13, y: 5, t: built("pulse", 1, undefined, 0, 1.2) },
    ];
    // Towers drawn back to front, so a southern tower covers the head of a northern one.
    placed.sort((a, b) => a.y - b.y || a.x - b.x);
    for (const p of placed) {
      const pen = { g: this.add.graphics(), glow: this.add.graphics().setBlendMode(Phaser.BlendModes.ADD) };
      if (p.t.type === "pulse" && mode === "tilt") tiltedPulse(pen, px(p.x), px(p.y), p.t, tilt);
      else current(pen, px(p.x), px(p.y), p.t);
    }
  }
}

const board = VIEW === "board",
  zoom = Number(params.get("zoom") ?? 1.5);
new Phaser.Game({
  type: Phaser.WEBGL,
  parent: "proto",
  width: board ? OUTPOST.columns * CELL * zoom : (LABEL + 8 * (TILE + GAP)) * ZOOM,
  height: board ? OUTPOST.rows * CELL * zoom : (24 + 4 * (TILE + GAP) + 20) * ZOOM,
  backgroundColor: "#1b2530",
  banner: false,
  audio: { noAudio: true },
  scene: board ? Board : Sheet,
  callbacks: { postBoot: () => ((window as unknown as { __ready: boolean }).__ready = true) },
});
