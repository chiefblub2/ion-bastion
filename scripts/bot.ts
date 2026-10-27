// The player of `scripts/run-balance.ts`. All habits off is the old greedy bot (fixed build order, cheapest upgrade
// first, spending only between waves); each habit fixes one way it played worse than a person and was measured on
// its own with `run-balance.ts -- --benchmark`.
import { Game } from "../src/core/game";
import { resolveUpgrades, upgradeOptions } from "../src/core/upgrades";
import { attackModule, isSupport } from "../src/systems/attacks";
import { pageOf } from "../src/ui/tower-pages";
import type { ContentPack, MissionDefinition, TowerId, UnitLayer } from "../src/core/types";
import type { MissionResult } from "../src/run/run";
import { missionStars } from "../src/app/rating";

export interface Played {
  result: MissionResult;
  /** Game seconds per wave. */
  waveTimes: number[];
  /** Credits unspent at the end, and paid in all (invested plus unspent). */
  left: number;
  earned: number;
  /** Run protocols that went off, per protocol (`systems/protocols.ts`). */
  protocols: Record<string, number>;
}
export interface Habits {
  /** Spends every few seconds during a wave, not only before it, and saves for the next tower of its rotation. */
  midWave: boolean;
  /** Skips towers that hit nothing the remaining waves send, and first builds for a layer the next wave brings unanswered. */
  layers: boolean;
  /** Upgrades the towers on the best cells first instead of the cheapest upgrade anywhere. */
  focus: boolean;
  /** Places towers by the path cells inside their real range: the Mortar's dead zone left out. */
  reach: boolean;
  /** Upgrades attack towers before control towers (slow, stun, ...). */
  attackFirst: boolean;
}
export const GREEDY: Habits = { midWave: false, layers: false, focus: false, reach: false, attackFirst: false };
/** The measured default: answering the coming layers and the real range helped; focus and mid-wave spending did not. */
export const STEADY: Habits = { midWave: false, layers: true, focus: false, reach: true, attackFirst: true };
/** Seconds between purchases during a wave, as a player glances at the credits. */
const SPEND_EVERY = 2;
/** Read through a function, so TypeScript does not narrow the status across commands and ticks. */
const statusOf = (g: Game): string => g.state.status;

export function playBot(mission: MissionDefinition, pack: ContentPack, habits: Habits = STEADY): Played {
  const g = new Game(mission, pack),
    path = mission.map.path,
    /** Path cells a tower on (x, y) reaches; with `reach` only outside its dead zone. */
    coverage = (type: TowerId, x: number, y: number, range: number) => {
      const spec = pack.towers[type].attack,
        dead = habits.reach ? (attackModule(spec)?.minRange?.(spec as never) ?? 0) : 0;
      return path.filter((p) => {
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        return d <= range * range && d >= dead * dead;
      }).length;
    },
    layersFrom = (from: number, count = Infinity) => {
      const seen = new Set<UnitLayer>();
      for (const w of mission.waves.slice(from, from + count)) for (const x of w.groups) seen.add(pack.enemies[x.type].layer);
      return seen;
    },
    hits = (type: TowerId, layers: ReadonlySet<UnitLayer>) => pack.towers[type].targets.some((l) => layers.has(l)),
    // Damage dealers twice in the rotation: a player builds more of what kills than of what slows.
    roster = g
      .availableTowers()
      .filter((id) => !isSupport(pack.towers[id].attack) || pack.towers[id].attack.kind === "detect")
      .flatMap((id) => (pageOf(pack.towers[id]) === 0 ? [id, id] : [id]));
  let turn = 0;
  const cellFor = (id: TowerId) => {
    const d = pack.towers[id],
      trap = d.placement === "path",
      cells = trap ? path.slice(Math.floor(path.length * 0.3)) : undefined;
    let best: { x: number; y: number; score: number } | undefined;
    for (let x = 0; x < mission.map.columns; x++)
      for (let y = 0; y < mission.map.rows; y++) {
        if (!g.canBuild(x, y, id)) continue;
        if (trap && !cells!.some((p) => p.x === x && p.y === y)) continue;
        const score = trap ? -cells!.findIndex((p) => p.x === x && p.y === y) : coverage(id, x, y, d.range || 3);
        if (!best || score > best.score) best = { x, y, score };
      }
    return best;
  };
  const buildOne = (id: TowerId) => {
    const best = cellFor(id);
    return !!best && g.command({ type: "build", tower: id, x: best.x, y: best.y }).ok;
  };
  const build = () => {
    const ahead = layersFrom(g.state.wave),
      next = layersFrom(g.state.wave, 1);
    if (habits.layers) {
      // A layer the next wave brings that no tower answers: the cheapest affordable attack tower for it first.
      const open = [...next].filter((l) => !g.state.towers.some((t) => pageOf(pack.towers[t.type]) !== 3 && pack.towers[t.type].targets.includes(l)));
      if (open.length) {
        const answer = [...new Set(roster)]
          .filter((id) => pageOf(pack.towers[id]) === 0 && hits(id, new Set(open)) && pack.towers[id].cost <= g.state.wallets[0])
          .sort((a, b) => pack.towers[a].cost - pack.towers[b].cost)[0];
        if (answer && buildOne(answer)) return true;
      }
    }
    for (let k = 0; k < roster.length; k++) {
      const id: TowerId = roster[(turn + k) % roster.length],
        d = pack.towers[id];
      if (d.attack.kind === "detect" && g.state.towers.some((t) => t.type === id)) continue;
      if (habits.layers && !hits(id, ahead)) continue;
      // Spending through the wave, it saves up for the next tower of its rotation instead of skipping to a cheaper one.
      if (d.cost > g.state.wallets[0]) {
        if (habits.midWave) return false;
        continue;
      }
      if (buildOne(id)) {
        turn = (turn + k + 1) % roster.length;
        return true;
      }
    }
    return false;
  };
  const upgrade = () => {
    const ahead = layersFrom(g.state.wave),
      // A tower's spot: the path it covers, counted only if it hits what is still coming; control towers half.
      spot = (t: (typeof g.state.towers)[number]) =>
        hits(t.type, ahead) ? coverage(t.type, t.x, t.y, resolveUpgrades(t, pack).stats.range || 3) * (pageOf(pack.towers[t.type]) === 0 ? 1 : 0.5) : 0,
      options = g.state.towers
        .flatMap((t) =>
          upgradeOptions(t, g.state.wallets[0], pack)
            .filter((o) => o.status === "available")
            .map((o) => ({
              id: t.id,
              upgrade: o.definition!.id,
              cost: o.definition!.cost,
              spot: habits.focus ? spot(t) : 0,
              late: habits.attackFirst && pageOf(pack.towers[t.type]) !== 0 ? 1 : 0,
            })),
        )
        // Attack towers before control towers; focus: the best spot first; then the cheapest upgrade.
        .sort((a, b) => a.late - b.late || b.spot - a.spot || a.cost - b.cost);
    return !!options.length && g.command({ type: "upgrade", id: options[0].id, upgrade: options[0].upgrade }).ok;
  };
  // Towers first while there are few, then upgrades first: roughly what the campaign strategies do.
  const spend = () => {
    for (let guard = 0; guard < 60 && (g.state.towers.length < 6 ? build() || upgrade() : upgrade() || build()); guard++);
  };
  const waveTimes: number[] = [],
    protocols: Record<string, number> = {},
    every = Math.round(SPEND_EVERY * 30);
  while (statusOf(g) === "ready") {
    spend();
    g.command({ type: "start" });
    const t0 = g.state.time;
    let steps = 0;
    while (statusOf(g) === "wave" && steps++ < 60000) {
      g.tick();
      for (const e of g.drainEvents()) if (e.type === "protocol") protocols[e.protocol] = (protocols[e.protocol] ?? 0) + 1;
      if (habits.midWave && steps % every === 0) spend();
    }
    waveTimes.push(g.state.time - t0);
  }
  return outcome(g, mission, waveTimes, protocols);
}
function outcome(g: Game, mission: MissionDefinition, waveTimes: number[], protocols: Record<string, number>): Played {
  const kills: Partial<Record<TowerId, number>> = {};
  for (const t of g.state.towers) kills[t.type] = (kills[t.type] ?? 0) + t.kills;
  const won = g.state.status === "won",
    left = g.state.wallets[0];
  return {
    result: {
      won,
      lives: g.state.lives,
      kills,
      built: [...new Set(g.state.towers.map((t) => t.type))],
      stars: won ? missionStars(mission, g.state) : undefined,
      wave: g.state.wave,
    },
    waveTimes,
    left,
    earned: left + g.state.towers.reduce((n, t) => n + t.spent, 0),
    protocols,
  };
}
