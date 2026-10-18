import type { AttackKind, AttackSpec } from "../../core/types";
import { airburst } from "./airburst";
import { alarm } from "./alarm";
import { aura } from "./aura";
import { bleed } from "./bleed";
import { catalyze } from "./catalyze";
import { burn } from "./burn";
import { chain } from "./chain";
import { charge } from "./charge";
import { corrode } from "./corrode";
import { decay } from "./decay";
import { disrupt } from "./disrupt";
import { detect } from "./detect";
import { direct } from "./direct";
import { execute } from "./execute";
import { focus } from "./focus";
import { income } from "./income";
import { mortar } from "./mortar";
import { net } from "./net";
import { pierce } from "./pierce";
import { pit } from "./pit";
import { pool } from "./pool";
import { pull } from "./pull";
import { quake } from "./quake";
import { slow } from "./slow";
import { splash } from "./splash";
import { stun } from "./stun";
import { bounty, mark, repair } from "./support";
import { volley } from "./volley";
// ── new towers: g1 (Attack+Control A) ──
import { confuse } from "./confuse";
import { encase } from "./encase";
import { gather } from "./gather";
import { strike } from "./strike";
// ── end g1 ──
// ── new towers: g2 (Control B) ──
import { echo } from "./echo";
import { shrink } from "./shrink";
import { siphon } from "./siphon";
import { tether } from "./tether";
// ── end g2 ──
// ── new towers: g3 (Traps) ──
import { block } from "./block";
import { grind } from "./grind";
import { harpoon } from "./harpoon";
import { oil } from "./oil";
import { warp } from "./warp";
// ── end g3 ──
// ── new towers: g4 (Support A) ──
import { crit, overclock, pierceaura, skylink, synergy } from "./boosters";
// ── end g4 ──
// ── new towers: g5 (Support B) ──
import { barrier, discount, interest, overkill } from "./economy";
// ── end g5 ──
import type { AttackModule, ParamRule } from "./types";
export type { AttackModule, Impact, ParamRule } from "./types";
export { canAcquire, canTarget } from "./targeting";
/**
 * All attack mechanics. A new mechanic is one module file, one entry here and
 * one member of `AttackSpec` in `core/types.ts`; UI, tooltips, validation and
 * upgrades pick it up through `params`.
 */
const ATTACKS: { [K in AttackKind]: AttackModule<Extract<AttackSpec, { kind: K }>> } = {
  direct,
  splash,
  slow,
  chain,
  aura,
  pierce,
  burn,
  stun,
  corrode,
  decay,
  income,
  detect,
  focus,
  pull,
  mortar,
  bleed,
  charge,
  pit,
  alarm,
  quake,
  execute,
  volley,
  disrupt,
  net,
  bounty,
  repair,
  mark,
  airburst,
  catalyze,
  pool,
  // ── new towers: g1 (Attack+Control A) ──
  strike,
  confuse,
  encase,
  gather,
  // ── end g1 ──
  // ── new towers: g2 (Control B) ──
  tether,
  shrink,
  echo,
  siphon,
  // ── end g2 ──
  // ── new towers: g3 (Traps) ──
  block,
  warp,
  oil,
  grind,
  harpoon,
  // ── end g3 ──
  // ── new towers: g4 (Support A) ──
  overclock,
  crit,
  pierceaura,
  skylink,
  synergy,
  // ── end g4 ──
  // ── new towers: g5 (Support B) ──
  discount,
  interest,
  barrier,
  overkill,
  // ── end g5 ──
};
export const attackModule = (spec: AttackSpec) => ATTACKS[spec.kind] as AttackModule | undefined;
/** Support towers (aura, refinery, detector, beacon, dock, tracker) never attack, are never buffed and have no targets. */
export const isSupport = (spec: AttackSpec) => attackModule(spec)?.aim === "none";
export interface StatRow {
  key: string;
  label: string;
  value: number;
  unit: string;
}
/** Display rows for the numeric parameters of an attack, e.g. for tooltips. */
export function describeAttack(spec: AttackSpec, keys?: readonly string[]): StatRow[] {
  const params = (attackModule(spec)?.params ?? {}) as Record<string, ParamRule>;
  return Object.entries(params)
    .filter(([key]) => !keys || keys.includes(key))
    .map(([key, rule]) => {
      const raw = (spec as unknown as Record<string, number>)[key];
      return { key, label: rule.label, value: rule.show ? rule.show(raw) : raw, unit: rule.unit ?? "" };
    });
}
/** Error message for an invalid spec, or undefined. */
export function attackError(spec: AttackSpec): string | undefined {
  const module = attackModule(spec);
  if (!module) return `Unknown attack kind '${(spec as AttackSpec).kind}'.`;
  const params = module.params as Record<string, ParamRule>;
  for (const [key, value] of Object.entries(spec)) {
    if (key === "kind" || (spec.kind === "aura" && key === "base")) continue;
    if (!params[key]) return `Unknown attack value '${key}'.`;
  }
  for (const [key, rule] of Object.entries(params)) {
    const value = (spec as unknown as Record<string, number>)[key];
    if (!(typeof value === "number" && rule.valid(value))) return `Invalid attack value '${key}'.`;
  }
  return module.validate?.(spec as never);
}
/** Error message for an upgrade's `effects.attack` overrides, or undefined. */
export function attackOverrideError(spec: AttackSpec, overrides: Readonly<Record<string, number>>): string | undefined {
  const params = (attackModule(spec)?.params ?? {}) as Record<string, ParamRule>;
  for (const [key, value] of Object.entries(overrides))
    if (!params[key] || !(typeof value === "number" && params[key].valid(value)))
      return `Invalid attack value '${key}' for ${spec.kind}.`;
  return undefined;
}
