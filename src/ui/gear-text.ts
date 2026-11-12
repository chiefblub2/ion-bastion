import { MAX_MARK, type MarkEffect, SIGNATURES } from "../content/arsenal";
import { gearClassOf, markDelta, markEffects } from "../campaign/gear";
import type { ContentPack, TowerDefinition, TowerId } from "../core/types";
import { number } from "./format";
// Texts for gear marks and Mk V signatures, derived from the data (`GEAR_MARKS`, `SIGNATURES`, the pack's real values)
// so numbers never drift. Pure; the menu and the HUD both use it.

export const ROMAN = ["I", "II", "III", "IV", "V"] as const;

const pct = (factor: number) => Math.round(Math.abs(1 - factor) * 100);
/** The word the HUD uses for a class's reach: Support towers with an area have a radius, the others a range. */
const reach = (t: TowerDefinition) => (gearClassOf(t) === "support" ? "radius" : "range");

/** One short phrase for a mark's effect; marks state totals, so "+8% damage" replaces an earlier "+4% damage". */
export function markText(e: MarkEffect, t: TowerDefinition): string {
  if ("stat" in e) return `+${pct(e.total)}% ${e.stat === "damage" ? "damage" : reach(t)}`;
  if ("early" in e) return t.id === "aura" ? `Track tiers I–II cost ${pct(e.early)}% less` : `Levels 2–3 cost ${pct(e.early)}% less`;
  if ("paths" in e) return `Specialization tiers cost ${pct(e.paths)}% less`;
  return `Build cost −${pct(e.build)}%`;
}

const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
const effectKey = (e: MarkEffect) => ("stat" in e ? `stat:${e.stat}` : Object.keys(e)[0]);

/** The Mk V signature of a tower: its name and one sentence, or undefined for a tower without one. */
export function signatureText(id: TowerId, base: ContentPack): { name: string; text: string } | undefined {
  const sig = SIGNATURES[id];
  if (!sig) return undefined;
  const name = sig.name;
  if ("hit" in sig) {
    const h = sig.hit;
    if (h.kind === "slow") return { name, text: `Enemies it hits are slowed to ${number(h.factor * 100)}% speed for ${number(h.duration)} s.` };
    if (h.kind === "stun") return { name, text: `Enemies it hits are stunned for ${number(h.duration)} s (then immune for ${number(h.recovery)} s).` };
    return { name, text: `Enemies it hits take ${number(h.amount * 100)}% more damage for ${number(h.duration)} s.` };
  }
  if ("bounty" in sig) return { name, text: `Its kills pay +${number(sig.bounty)} ${sig.bounty === 1 ? "credit" : "credits"}.` };
  const c = markDelta(base, id, MAX_MARK)[0];
  if (!c) return { name, text: "" };
  const change = `${number(c.before)} → ${number(c.after)}${c.unit}`;
  if ("stat" in sig) return { name, text: `${sig.stat === "range" ? cap(reach(base.towers[id])) : c.label} ${sig.factor >= 1 ? "+" : "−"}${pct(sig.factor)}% (${change})` };
  return { name, text: `${c.label} ${change}` };
}

/** What is active at `mark`: the latest total of each kind from Mk I–IV, then the signature at Mk V. */
export function gearLines(id: TowerId, mark: number, base: ContentPack): string[] {
  const t = base.towers[id],
    totals = new Map<string, MarkEffect>();
  for (const e of markEffects(t).slice(0, Math.min(mark, MAX_MARK - 1))) totals.set(effectKey(e), e);
  const lines = [...totals.values()].map((e) => markText(e, t));
  if (mark >= MAX_MARK) {
    const s = signatureText(id, base);
    if (s) lines.push(`${s.name}: ${s.text}`);
  }
  return lines;
}
