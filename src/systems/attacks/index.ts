import type { AttackKind, AttackSpec } from "../../core/types";
import { aura } from "./aura";
import { burn } from "./burn";
import { chain } from "./chain";
import { corrode } from "./corrode";
import { decay } from "./decay";
import { detect } from "./detect";
import { direct } from "./direct";
import { income } from "./income";
import { pierce } from "./pierce";
import { slow } from "./slow";
import { splash } from "./splash";
import { stun } from "./stun";
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
};
export const attackModule = (spec: AttackSpec) => ATTACKS[spec.kind] as AttackModule | undefined;
/** Support towers (aura, refinery, detector) never attack, are never buffed and have no targets. */
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
  if (!module) return `Unbekannte Angriffsart '${(spec as AttackSpec).kind}'.`;
  const params = module.params as Record<string, ParamRule>;
  for (const [key, value] of Object.entries(spec)) {
    if (key === "kind" || (spec.kind === "aura" && key === "base")) continue;
    if (!params[key]) return `Unbekannter Angriffswert '${key}'.`;
  }
  for (const [key, rule] of Object.entries(params)) {
    const value = (spec as unknown as Record<string, number>)[key];
    if (!(typeof value === "number" && rule.valid(value))) return `Ungültiger Angriffswert '${key}'.`;
  }
  return module.validate?.(spec as never);
}
/** Error message for an upgrade's `effects.attack` overrides, or undefined. */
export function attackOverrideError(spec: AttackSpec, overrides: Readonly<Record<string, number>>): string | undefined {
  const params = (attackModule(spec)?.params ?? {}) as Record<string, ParamRule>;
  for (const [key, value] of Object.entries(overrides))
    if (!params[key] || !(typeof value === "number" && params[key].valid(value)))
      return `Ungültiger Angriffswert '${key}' für ${spec.kind}.`;
  return undefined;
}
