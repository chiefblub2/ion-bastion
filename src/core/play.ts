import { Game } from "./game";
import { upgradeOptions } from "./upgrades";
import type { GameEvent, MissionDefinition, TowerId } from "./types";
// Free of vitest so that scripts (balance.ts) can run it too; test-helpers re-exports it.
export interface Build {
  tower: TowerId;
  x: number;
  y: number;
}
/** Deterministic test player: before each wave it spends all affordable credits. */
export interface Strategy {
  builds: readonly Build[];
  /** Upgrade existing towers before building the next one. */
  upgradeFirst?: boolean;
}
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
  const upgrade = () => {
    const options = g.state.towers
      .flatMap((t) =>
        upgradeOptions(t, g.state.wallets[0])
          .filter((o) => o.status === "available")
          .map((o) => ({ id: t.id, upgrade: o.definition!.id, cost: o.definition!.cost })),
      )
      .sort((a, b) => a.cost - b.cost);
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
