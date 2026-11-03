import type { Tower, TowerDefinition, TurretStyle } from "../core/types";
import { DARK, LIGHT, OUTLINE, SHADOW, halo, led } from "./material";
import { arcBand, disc, oval, ring, shade, type Ink, type Pen } from "./shapes";
import { type TurretContext, type Drawing, at, pip, loop } from "./tower-art/kit";
import { BASES } from "./tower-art/bases";
import { MOTIFS } from "./tower-art/motifs";
import { ATTACK_TURRETS } from "./tower-art/turrets-attack";
import { CONTROL_TURRETS } from "./tower-art/turrets-control";
import { TRAPS_TURRETS } from "./tower-art/turrets-traps";
import { SUPPORT_TURRETS } from "./tower-art/turrets-support";
import { onDeck } from "./tower-art/tilt";
import { TILTED } from "./tower-art/tilted";
import { TILTS } from "./muzzles";
/** The level a tower's paths branch from: one below its lowest path tier (5 for attack towers and traps, 3 for support). */
const branches = new WeakMap<Readonly<TowerDefinition>, number>();
function branchLevel(definition: Readonly<TowerDefinition>) {
  let from = branches.get(definition);
  if (from === undefined) {
    const levels = definition.upgrades.filter((u) => u.path && u.effects.level !== undefined).map((u) => u.effects.level!);
    branches.set(definition, (from = levels.length ? Math.min(...levels) - 1 : 5));
  }
  return from;
}
/**
 * Turret drawings by `visual.turret`, one module per build-menu tab (`tower-art/turrets-*.ts`). A new look is one entry
 * in its tab's module; this type fails to compile while a style has no drawing.
 */
const TURRETS: Record<TurretStyle, Drawing> = { ...ATTACK_TURRETS, ...CONTROL_TURRETS, ...TRAPS_TURRETS, ...SUPPORT_TURRETS };
export interface TowerBadges {
  /** Level for attack towers, number of purchases for support towers. */
  markers: number;
  /** No upgrade left to buy. */
  maxed: boolean;
  boosted: boolean;
  /** Display colour, see `towerColor`. */
  color: number;
  path?: string;
}
/** Ink that drops every call: the still body of a baked tower is not drawn again, its light still is. */
const NO_INK = new Proxy({} as Ink, { get: (_, name) => (name === "then" ? undefined : () => NO_INK) });
function turretContext(pen: Pen, x: number, y: number, tower: Tower, definition: Readonly<TowerDefinition>, clock: number, badges: TowerBadges, kick?: number): TurretContext {
  const p = badges.color,
    level = badges.markers,
    attack = definition.placement !== "path" && definition.targets.length > 0;
  return {
    g: pen.g,
    glow: pen.glow,
    x,
    y,
    tower,
    definition,
    clock,
    level,
    maxed: badges.maxed,
    color: p,
    path: badges.path,
    // Snaps back at once and settles softly: the linear return over the first 30 % of the cycle, squared.
    kick: kick ?? Math.max(0, (tower.cooldown - 0.7) / 0.3) ** 2,
    charge: 1 - tower.cooldown,
    tip: attack && level >= 6 ? p : attack && level >= 5 ? shade(definition.color, 0.35) : undefined,
    energy: attack && level >= 5 ? 0.15 : 0,
    peak: badges.maxed ? 0.42 : 0.6,
  };
}
/**
 * Turrets drawn in the 3/4 tilt (Pulse's Hex Sentinel): their base casts its own shadow and carries its own level
 * language, so the flat collar, rings, lamps and glint are skipped and the path motif lies on the tilted deck.
 */
export const isTilted = (definition: Readonly<TowerDefinition>) => TILTS[definition.visual.turret] !== undefined;
/** The part of a tower that holds still on `g`: shadow, base plate, collar and the r14 ring (the base's light is live). */
function drawBody(ctx: TurretContext) {
  const { g, glow, x, y, definition, level, color: p } = ctx,
    // Traps lie flat on the path: no shadow, no collar and no turret rings.
    trap = definition.placement === "path",
    attack = !trap && definition.targets.length > 0;
  if (isTilted(definition)) return BASES[definition.visual.turret](ctx);
  if (!trap) {
    oval(g, x + 3, y + 6, 22, 15.5, SHADOW, 0.22);
    oval(g, x + 3, y + 6, 18, 12, SHADOW, 0.3);
  }
  BASES[definition.visual.turret](ctx);
  // Level language: a collar from level 2, the r14 ring echoed in light from level 5.
  if (!trap) {
    if (level >= 2) {
      ring(g, x, y, 17, 2.2, DARK);
      arcBand(g, x, y, 17.3, 0.9, LIGHT - 0.9, LIGHT + 0.9, shade(p, 0.25), 0.85);
    }
    ring(g, x, y, 14, 1.5, p, 0.6);
    if (attack && level >= 5) ring(glow, x, y, 14, 2, p, 0.35);
  }
}
/**
 * Everything that moves or changes on its own: the glint, motif, lamps, turret, level bars and the aura badge. With
 * `top`, a tilted tower's turret is on screen as a cached picture (`TurretCache`) between `ctx.g` and `top`: only the
 * live parts under it go to `ctx.g`, the ones over it and the level bars and badge to `top`.
 */
function drawTop(ctx: TurretContext, badges: TowerBadges, top?: Ink) {
  const { g, glow, x, y, tower, definition, clock, level, color: p } = ctx,
    tilted = isTilted(definition),
    // Traps lie flat and tilted turrets carry their own lamps: neither gets the collar's glint and lamps.
    trap = definition.placement === "path",
    flat = !trap && !tilted;
  if (badges.maxed) halo(glow, x, y, 26, p, 0.12 + 0.04 * Math.sin(clock * 2 + tower.id));
  // A glint sweeps the collar at level 8.
  if (flat && level >= 8) arcBand(g, x, y, 17, 1.6, clock * 0.8 + tower.id, clock * 0.8 + tower.id + 0.5, shade(p, 0.8), 0.9);
  // Specialized towers: the path motif turns under the turret, one tier per level above the branch (5, support 3),
  // echoed in light. Aura draws its own.
  const motif = badges.path && definition.attack.kind !== "aura" ? definition.visual.paths?.[badges.path]?.motif : undefined;
  if (motif) {
    const tier = Math.min(3, Math.max(1, level - branchLevel(definition)));
    const tilt = TILTS[definition.visual.turret];
    if (tilt) onDeck([g, glow], x, y + tilt.drop, tilt.deck, () => MOTIFS[motif]({ ...ctx, x: 0, y: 0 }, tier, clock + tower.id, 0.04 + 0.04 * tier));
    else MOTIFS[motif](ctx, tier, clock + tower.id, 0.06 + 0.06 * tier);
  }
  // One lamp from level 2; from level 4 four of them chase round the collar.
  if (flat && level >= 4) {
    g.fillStyle(OUTLINE, 0.9);
    for (let i = 0; i < 4; i++) {
      const q = at(x, y, 0.75 * Math.PI + (i * Math.PI) / 2, 19);
      pip(g, q.x, q.y, 2.2);
    }
    for (let i = 0; i < 4; i++) {
      const q = at(x, y, 0.75 * Math.PI + (i * Math.PI) / 2, 19),
        on = 0.35 + 0.65 * Math.max(0, Math.sin(4 * clock - (i * Math.PI) / 2));
      g.fillStyle(shade(p, -0.7 * (1 - on)));
      pip(g, q.x, q.y, 1.4);
      if (on <= 0.5) continue;
      glow.fillStyle(p, 0.3 * on);
      pip(glow, q.x, q.y, 3.6);
    }
  } else if (flat && level >= 2) {
    const q = at(x, y, 0.75 * Math.PI, 19);
    led(ctx, q.x, q.y, p, 1);
  }
  const art = top ? TILTED[definition.visual.turret] : undefined;
  if (art) {
    art.below(ctx);
    ctx = { ...ctx, g: top! };
    art.above(ctx);
  } else TURRETS[definition.visual.turret](ctx);
  drawBadges(ctx, badges);
}
/** Level bars and the aura badge. */
function drawBadges({ g, x, y, level, color: p }: TurretContext, badges: TowerBadges) {
  // Up to 8 levels: narrower steps keep the row inside the cell.
  const step = level > 5 ? 5 : 6;
  g.fillStyle(p);
  for (let i = 0; i < level; i++) g.fillRect(x - (level * step - 2) / 2 + i * step, y + 20, step - 2, 3);
  if (badges.boosted) {
    disc(g, x + 19, y - 18, 6, 0x0c202a);
    loop(g, x + 19, y - 18, 5, 1.5, 0x78dfff);
    g.lineStyle(1.5, 0x78dfff);
    g.lineBetween(x + 16, y - 18, x + 22, y - 18);
    g.lineBetween(x + 19, y - 21, x + 19, y - 15);
  }
}
/** How the battlefield shows a tower beside what `drawTower` draws. */
export interface TowerView {
  /** The still body is already on screen as a texture (`stillBody`), so only its light is drawn. */
  baked?: boolean;
  /** A tilted turret is on screen as a cached picture (`TurretCache`) above `pen.g`; the parts over it go to `top`. */
  top?: Ink;
  /** Recoil to draw instead of the one the cooldown gives (the cached picture's step). */
  kick?: number;
}
export function drawTower(pen: Pen, x: number, y: number, tower: Tower, definition: Readonly<TowerDefinition>, clock: number, badges: TowerBadges, { baked, top, kick }: TowerView = {}) {
  const ctx = turretContext(pen, x, y, tower, definition, clock, badges, kick);
  // A baked body without light of its own (every tilted base) has nothing left to draw.
  if (!baked) drawBody(ctx);
  else if (bodyLight(tower, badges)) drawBody({ ...ctx, g: NO_INK });
  drawTop(ctx, badges, top);
}
/** Draws only a tilted tower's turret ink (on `g`, centred on `x`, `y`) at the tower's angle and the given recoil, for `TurretCache`. */
export function drawTurretInk(g: Ink, x: number, y: number, tower: Tower, definition: Readonly<TowerDefinition>, badges: TowerBadges, kick: number) {
  const art = TILTED[definition.visual.turret];
  if (art) art.turret({ ...turretContext({ g, glow: NO_INK }, x, y, tower, definition, 0, badges), kick });
}
/** Every call a tilted turret's ink makes, with its arguments; `glow` false once it touched the glow layer. */
function recordTurret(tower: Tower, definition: Readonly<TowerDefinition>, clock: number, badges: TowerBadges, kick: number) {
  const log: string[] = [],
    trace = (onCall: (name: string, args: unknown[]) => void): Ink => {
      const ink: Ink = new Proxy({} as Ink, { get: (_, name) => (name === "then" ? undefined : (...args: unknown[]) => (onCall(String(name), args), ink)) });
      return ink;
    },
    g = trace((name, args) => log.push(name, JSON.stringify(args)));
  let glow = true;
  const art = TILTED[definition.visual.turret]!;
  art.turret({ ...turretContext({ g, glow: trace(() => (glow = false)) }, 0, 0, tower, definition, clock, badges), kick });
  return { log: log.join("\n"), glow };
}
const stillTurrets = new Map<string, boolean>();
/**
 * Whether a tilted tower's turret ink depends only on its look, angle and recoil, so `TurretCache` may keep it as a
 * picture: drawn twice at the same angle and recoil with different time, id and cooldown, it must come out the same
 * and never touch the glow layer. A turret that fails is drawn live (and `tower-bodies.test.ts` fails).
 */
export function stillTurret(tower: Tower, definition: Readonly<TowerDefinition>, badges: TowerBadges) {
  if (!TILTED[definition.visual.turret]) return false;
  const key = bodyKey(tower, badges);
  let known = stillTurrets.get(key);
  if (known === undefined) {
    const a = recordTurret({ ...tower, id: 1, cooldown: 0, angle: 0.7 }, definition, 0, badges, 0.5),
      b = recordTurret({ ...tower, id: 7, cooldown: 0.9, angle: 0.7 }, definition, 2.345, badges, 0.5);
    known = a.glow && b.glow && a.log === b.log;
    stillTurrets.set(key, known);
  }
  return known;
}
/** Draws only the still body (on `g`, centred on `x`, `y`), for baking it into a texture. */
export function drawTowerBody(g: Ink, x: number, y: number, tower: Tower, definition: Readonly<TowerDefinition>, badges: TowerBadges) {
  drawBody(turretContext({ g, glow: NO_INK }, x, y, tower, definition, 0, badges));
}
/** Cache key of a still body: everything `drawBody` reads apart from time and the tower's own state. */
export const bodyKey = (tower: Tower, badges: TowerBadges) => `${tower.type}|${badges.markers}|${badges.color}|${badges.maxed ? 1 : 0}|${badges.path ?? ""}`;
const still = new Map<string, boolean>();
/** Body keys whose still body also draws light (on `glow`), which a baked body must still draw every frame. */
const lit = new Set<string>();
/** Every call `drawBody` makes on `g`, with its arguments as they were at the call; `light` once it drew on `glow`. */
function record(tower: Tower, definition: Readonly<TowerDefinition>, clock: number, badges: TowerBadges) {
  const log: string[] = [],
    ink: Ink = new Proxy({} as Ink, { get: (_, name) => (name === "then" ? undefined : (...args: unknown[]) => (log.push(String(name), JSON.stringify(args)), ink)) });
  let light = false;
  const glow: Ink = new Proxy({} as Ink, { get: (_, name) => (name === "then" ? undefined : () => ((light = true), glow)) });
  drawBody(turretContext({ g: ink, glow }, 0, 0, tower, definition, clock, badges));
  return { log: log.join("\n"), light };
}
/** Whether a baked body (`stillBody` true) still draws light of its own; dark ones are skipped entirely once baked. */
export const bodyLight = (tower: Tower, badges: TowerBadges) => lit.has(bodyKey(tower, badges));
/**
 * Whether a tower's body ink depends only on `bodyKey`, so it can be baked once and shared: it is drawn twice with
 * different time, id, cooldown and angle and must come out the same. Bases that animate their metal stay live.
 */
export function stillBody(tower: Tower, definition: Readonly<TowerDefinition>, badges: TowerBadges) {
  const key = bodyKey(tower, badges);
  let known = still.get(key);
  if (known === undefined) {
    const a = record({ ...tower, id: 1, cooldown: 0, angle: 0 }, definition, 0, badges),
      b = record({ ...tower, id: 7, cooldown: 0.9, angle: 1.9 }, definition, 2.345, badges);
    known = a.log === b.log;
    still.set(key, known);
    if (a.light || b.light) lit.add(key);
  }
  return known;
}
