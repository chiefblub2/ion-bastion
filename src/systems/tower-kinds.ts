import { resolveUpgrades } from "../core/upgrades";
import type { AttackKind, AttackSpec, ContentPack, Tower } from "../core/types";
/** The resolved attack of kind `K`. */
export type AttackOf<K extends AttackKind> = Extract<AttackSpec, { kind: K }>;
/**
 * Calls `fn` for every tower of attack kind `kind` in build order, with its resolved attack and range. The base
 * definition is checked first (upgrades never change the kind), so a board without such a tower costs one pass.
 * Range and suppression stay with the caller, as each support effect reads them its own way.
 */
export function eachOfKind<K extends AttackKind>(
  towers: readonly Tower[],
  content: ContentPack,
  kind: K,
  fn: (attack: AttackOf<K>, tower: Tower, range: number) => void,
) {
  for (const t of towers) {
    if (content.towers[t.type].attack.kind !== kind) continue;
    const resolved = resolveUpgrades(t, content);
    fn(resolved.attack as AttackOf<K>, t, resolved.stats.range);
  }
}
