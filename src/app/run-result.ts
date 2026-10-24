import type { Game } from "../core/game";
import type { TowerId } from "../core/types";
import type { MissionResult } from "../run/run";
import { missionStars } from "./rating";
/** What a finished run mission reports to its run: reactor left, kills and builds per tower type, stars. */
export function runResult(game: Game, won: boolean): MissionResult {
  const kills: Partial<Record<TowerId, number>> = {};
  for (const t of game.state.towers) kills[t.type] = (kills[t.type] ?? 0) + t.kills;
  return {
    won,
    lives: game.state.lives,
    kills,
    built: [...new Set(game.state.towers.map((t) => t.type))],
    stars: won ? missionStars(game.mission, game.state) : undefined,
    wave: game.state.wave,
  };
}
