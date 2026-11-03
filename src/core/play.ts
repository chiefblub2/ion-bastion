import { Game } from "./game";
import { isSpecialization, towerLevel, upgradeOptions } from "./upgrades";
import type { GameEvent, MissionDefinition, TowerId } from "./types";
// Free of vitest so that scripts (balance.ts) can run it too; test-helpers re-exports it.
export interface Build {
  tower: TowerId;
  x: number;
  y: number;
  /** Specialization path whose tiers this build buys; without one it stops at its last plain level. */
  path?: string;
  /** Aura only: the track it takes; without one the cheapest track. */
  track?: string;
}
/** Deterministic test player: before each wave it spends all affordable credits. */
export interface Strategy {
  builds: readonly Build[];
  /** Upgrade existing towers before building the next one. */
  upgradeFirst?: boolean;
}
/** Level every strategy tower reaches before any path tier is bought. */
const CORE_LEVEL = 4;
export function play(
  mission: MissionDefinition,
  strategy?: Strategy,
  afterWave?: (game: Game) => void,
  /** Called after every tick with the events it produced (already drained). */
  onTick?: (game: Game, events: GameEvent[]) => void,
) {
  const g = new Game(mission),
    status = (): string => g.state.status,
    lives: number[] = [];
  const build = () => {
    const next = strategy!.builds.find(
      (b) => !g.state.towers.some((t) => t.x === b.x && t.y === b.y),
    );
    return !!next && g.command({ type: "build", ...next }).ok;
  };
  // Highest level a tower reaches without a path (Aura: its track's tier III).
  const plainMax = (type: TowerId) => Math.max(1, ...g.content.towers[type].upgrades.filter((u) => !u.path).map((u) => u.effects.level ?? 1));
  const upgrade = () => {
    const open = g.state.towers.flatMap((t) => {
      const plan = strategy!.builds.find((b) => b.x === t.x && b.y === t.y && b.tower === t.type);
      return upgradeOptions(t, Infinity)
        // A build buys only the path it names (none: no specialization) and, for Aura, only its track.
        .filter((o) => o.status === "available" && (!isSpecialization(o.definition!) || o.definition!.path === plan?.path))
        .filter((o) => !o.definition!.track || !plan?.track || o.definition!.track === plan.track)
        .map((o) => ({ id: t.id, upgrade: o.definition!.id, cost: o.definition!.cost, special: isSpecialization(o.definition!) }));
    });
    // Path tiers only once every build stands and every tower is at level 4 (or its last plain level, if lower), as a
    // player builds up the defense before specializing; then tiers and the remaining levels go cheapest first.
    const core =
      strategy!.builds.every((b) => g.state.towers.some((t) => t.x === b.x && t.y === b.y)) &&
      g.state.towers.every((t) => towerLevel(t, g.content) >= Math.min(CORE_LEVEL, plainMax(t.type))),
      options = open.filter((o) => (core || !o.special) && o.cost <= g.state.wallets[0]).sort((a, b) => a.cost - b.cost);
    return (
      !!options.length &&
      g.command({ type: "upgrade", id: options[0].id, upgrade: options[0].upgrade }).ok
    );
  };
  const spend = () => {
    if (strategy) while (strategy.upgradeFirst ? upgrade() || build() : build() || upgrade());
  };
  if (mission.circle) {
    // Waves overlap on a ring: spend whenever the timer starts the next one.
    spend();
    g.command({ type: "start" });
    let wave = g.state.wave,
      steps = 0;
    while (g.state.status === "wave" && steps++ < 100000) {
      g.tick();
      onTick?.(g, g.drainEvents());
      if (g.state.wave === wave) continue;
      lives.push(g.state.lives);
      afterWave?.(g);
      wave = g.state.wave;
      spend();
    }
    if (steps >= 100000) throw new Error("ring mission did not finish");
    lives.push(g.state.lives);
    afterWave?.(g);
    return { game: g, lives };
  }
  while (status() === "ready") {
    spend();
    g.command({ type: "start" });
    let steps = 0;
    while (status() === "wave" && steps++ < 30000) {
      g.tick();
      onTick?.(g, g.drainEvents());
    }
    if (steps >= 30000) throw new Error("wave did not finish");
    lives.push(g.state.lives);
    afterWave?.(g);
  }
  return { game: g, lives };
}
