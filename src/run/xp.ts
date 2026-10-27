import { resolveUpgrades } from "../core/upgrades";
import type { ContentPack, GameState, MissionDefinition, TowerId } from "../core/types";
import { isSupport } from "../systems/attacks";
import { dist } from "../systems/path";
import { pageOf } from "../ui/tower-pages";
import { ASSIST_CAP, ASSIST_REACH, ASSIST_SHARE } from "./tuning";
/**
 * Assist XP: Control, trap and Support towers rarely land the kill, so rank XP from kills alone left them at rank 0
 * (run-balance: about 15 XP per mission against 105 for Attack towers). A tower that works on the path earns a share
 * of the kills of the other towers it stands beside: those whose enemies it slowed, held or buffed. Everything is read
 * from the finished state, so it is deterministic and costs the simulation nothing.
 *
 * - A tower assists the towers of other types within its range plus `ASSIST_REACH` cells (a Support tower: within
 *   its range, its aura or beacon radius). Support towers without a radius (Refinery, Vault, Dock, Shield Generator)
 *   earn the build bonus only.
 * - Idle towers earn nothing: a Control tower or trap must reach the path, a Support tower must cover a partner.
 * - Each partner tower counts once per assisting type, and a type earns at most `ASSIST_CAP` per mission.
 */
export function assistsOf(state: Pick<GameState, "towers">, mission: Pick<MissionDefinition, "map">, content: ContentPack): Partial<Record<TowerId, number>> {
  const out: Partial<Record<TowerId, number>> = {},
    partners = new Map<TowerId, Set<number>>();
  for (const t of state.towers) {
    const d = content.towers[t.type];
    if (pageOf(d) === 0) continue;
    const range = resolveUpgrades(t, content).stats.range,
      support = isSupport(d.attack);
    if (range <= 0) continue;
    if (!support && !mission.map.path.some((p) => dist(p, t) <= range)) continue;
    const reach = support ? range : range + ASSIST_REACH,
      seen = partners.get(t.type) ?? new Set<number>();
    partners.set(t.type, seen);
    for (const o of state.towers) if (o.type !== t.type && o.kills > 0 && dist(o, t) <= reach) seen.add(o.id);
  }
  for (const [type, ids] of partners) {
    const kills = state.towers.filter((o) => ids.has(o.id)).reduce((n, o) => n + o.kills, 0),
      xp = Math.min(ASSIST_CAP, Math.round(kills * ASSIST_SHARE));
    if (xp > 0) out[type] = xp;
  }
  return out;
}
