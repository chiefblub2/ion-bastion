import type { AttackKind, TowerDefinition } from "./types";
import { isSupport } from "../systems/attacks";
/** Attack kinds whose main job is to hinder or weaken enemies rather than to kill them. */
export const CONTROL_KINDS: ReadonlySet<AttackKind> = new Set<AttackKind>([
  "slow", "stun", "corrode", "pull", "disrupt", "net", "pool",
  "confuse", "encase", "gather",
  "tether", "shrink", "echo", "siphon",
]);
/**
 * A tower's category (index into the build menu's `TOWER_PAGES`: attack, control, trap, support), derived from
 * placement and attack, so content needs no extra field. The Run's drafts, tags and rank XP read it too.
 */
export function pageOf(d: Readonly<TowerDefinition>) {
  if (d.placement === "path") return 2;
  if (isSupport(d.attack)) return 3;
  return CONTROL_KINDS.has(d.attack.kind) ? 1 : 0;
}
