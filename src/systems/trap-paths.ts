import { resolveUpgrades } from "../core/upgrades";
import type { Enemy, Sim, SpecializationSpec, Tower } from "../core/types";
import { trance } from "./attacks/confuse";
import { dist } from "./path";
import { applyStatus } from "./status";
/**
 * New abilities of the trap paths (levels 6 to 8). The trap modules call these hooks; every per-tower field here
 * (`Tower.alerted`, `Tower.flare`) stays absent until its path is used and is cleared after every wave.
 */
type Of<K extends SpecializationSpec["kind"]> = Extract<SpecializationSpec, { kind: K }>;

/** Ignition radius of tar that counts as oil (Flammable Tar); a burn leaps this far to other oiled enemies. */
export const TAR_OIL_RADIUS = 1;
/** Seconds the Choke Point weakness outlasts the last spike hit, so it holds between two triggers. */
export const HOLD_WINDOW = 0.5;

/** Open Wounds, Concussion, Choke Point: a vulnerability through the shared `vulnerable` status (stronger replaces, equal extends). */
const expose = (sim: Sim, e: Enemy, bonus: number, until: number) => applyStatus(sim, e, { kind: "vulnerable", amount: bonus, until });

/** Caltrops: a bleed that took hold also slows (Hamstring) or weakens (Open Wounds) the enemy until it ends. */
export function bleedPath(sim: Sim, e: Enemy, special: SpecializationSpec | undefined, until: number) {
  if (special?.kind === "hamstring") applyStatus(sim, e, { kind: "slow", factor: 1 - special.slow, until });
  else if (special?.kind === "open-wounds") expose(sim, e, special.bonus, until);
}

/** Flammable Tar: a tarred enemy is oiled, so burns on it deal `boost` times and leap to other oiled enemies. */
export function tarOil(sim: Sim, e: Enemy, special: Of<"tar-oil">) {
  if (e.hp > 0) applyStatus(sim, e, { kind: "oiled", boost: special.boost, radius: TAR_OIL_RADIUS, until: sim.state.time + special.duration });
}

/** Concussion: a thrown enemy takes more damage from the throw until `duration` seconds after it lands (`release`). */
export function concussion(sim: Sim, e: Enemy, special: Of<"concussion">, release: number) {
  expose(sim, e, special.bonus, release + special.duration);
}

/** Choke Point: an enemy held at the wall stays weakened while the spikes keep hitting it. */
export function holdExposure(sim: Sim, e: Enemy, special: SpecializationSpec | undefined) {
  if (special?.kind === "held-exposure") expose(sim, e, special.bonus, sim.state.time + HOLD_WINDOW);
}

/** Disorient: a warped enemy is confused (walks backwards) for `duration` seconds; pull-resistant units shrug it off. */
export function warpDaze(sim: Sim, e: Enemy, special: SpecializationSpec | undefined) {
  if (special?.kind === "warp-daze" && e.hp > 0) trance(sim, e, special.duration, 0);
}

/** Tripwire paths: Volley Signal arms the alerted towers' next shot; Flare lights up the alarm radius. */
export function alarmPath(sim: Sim, tripwire: number, alerted: readonly Tower[], special: SpecializationSpec | undefined) {
  if (special?.kind === "alarm-volley")
    for (const t of alerted) t.alerted = Math.max(t.alerted ?? 0, special.bonus);
  else if (special?.kind === "flare") {
    const t = sim.state.towers.find((x) => x.id === tripwire);
    if (t) t.flare = Math.max(t.flare ?? -Infinity, sim.state.time + special.duration);
  }
}

/** Volley Signal: damage factor of the tower's shot, consuming a pending alarm bonus; 1 without one. */
export function volleyFactor(t: Tower) {
  if (t.alerted === undefined) return 1;
  const bonus = t.alerted;
  delete t.alerted;
  return 1 + bonus;
}

/** Burning flares (position and the Tripwire's alarm radius) for this tick's detection; empty without a Flare path. */
export function activeFlares(sim: Sim): { x: number; y: number; radius: number }[] {
  const time = sim.state.time,
    flares: { x: number; y: number; radius: number }[] = [];
  for (const t of sim.state.towers) {
    if (t.flare === undefined || time >= t.flare) continue;
    const attack = resolveUpgrades(t, sim.content).attack;
    if (attack.kind === "alarm") flares.push({ x: t.x, y: t.y, radius: attack.radius });
  }
  return flares;
}
export const flareReveals = (e: Enemy, flares: readonly { x: number; y: number; radius: number }[]) =>
  flares.length > 0 && flares.some((f) => dist(e, f) <= f.radius);

/** After every wave: pending volley bonuses and burning flares are dropped. */
export function resetTrapPaths(sim: Sim) {
  for (const t of sim.state.towers) {
    delete t.alerted;
    delete t.flare;
  }
}
