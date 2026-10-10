import { earn } from "../core/economy";
import type { GameState, Sim, Spawn } from "../core/types";
import { payIncome } from "./waves";
/** Pays a wave's bonus and the refineries; on a ring this happens when the next wave starts. */
function payWave(sim: Sim, wave: number) {
  const bonus = sim.mission.waves[wave - 1].bonus;
  earn(sim.state, bonus);
  payIncome(sim);
  sim.state.events.push({ type: "waveEnd", wave, bonus });
}
/**
 * Starts the next wave. Reactor missions start from an empty queue at wave time 0;
 * on a ring the wave joins the running ones and the timer restarts.
 */
export function beginWave(sim: Sim) {
  const s = sim.state,
    circle = sim.mission.circle,
    wave = sim.mission.waves[s.wave];
  if (circle && s.wave) payWave(sim, s.wave);
  s.wave++;
  s.status = "wave";
  s.paused = false;
  const offset = circle ? s.waveTime : 0;
  if (!circle) s.waveTime = 0;
  const spawns: Spawn[] = wave.groups.flatMap((group) =>
    Array.from({ length: group.count }, (_, i) => ({
      at: offset + group.delay + i * group.interval,
      type: group.type,
      ...(circle && { wave: s.wave }),
    })),
  );
  s.queue = (circle ? [...s.queue, ...spawns] : spawns).sort((a, b) => a.at - b.at);
  if (circle) s.circle = { next: circle.interval };
  s.events.push({ type: "waveStart", wave: s.wave });
}
/** Waves still to start on a ring. */
export const wavesLeft = (sim: Sim) => sim.mission.waves.length - sim.state.wave;
/** Credits for calling the next wave now instead of waiting for the timer. */
export const earlyBonus = (sim: Sim) =>
  sim.mission.circle && sim.state.circle ? Math.round(sim.state.circle.next * sim.mission.circle.earlyBonus) : 0;
/** Alive enemies on a ring, compared against the mission's limit. */
export const circleCount = (s: GameState) => s.enemies.length;
/** Replaces `settleWave` on a ring: wave timer, the enemy limit and the final clear. */
export function settleCircle(sim: Sim, dt: number) {
  const s = sim.state,
    rules = sim.mission.circle!;
  if (circleCount(s) > rules.limit) {
    s.status = "lost";
    s.events.push({ type: "end", result: "lost" });
    return;
  }
  if (wavesLeft(sim) > 0) {
    s.circle!.next -= dt;
    if (s.circle!.next <= 0) beginWave(sim);
    return;
  }
  if (!s.enemies.length && !s.queue.length) {
    payWave(sim, s.wave);
    s.projectiles = [];
    s.status = "won";
    s.events.push({ type: "end", result: "won" });
  }
}
