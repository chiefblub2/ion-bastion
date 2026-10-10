import type { EnemyDefinition } from "./types";
export type ModeId = "coop" | "race" | "siege";
export interface ModeDefinition {
  id: ModeId;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  /** Every player defends an own copy of the mission; the last reactor standing wins. */
  versus: boolean;
  /** Players can send enemies into an opponent's field. */
  sends: boolean;
  rules: string;
}
export const MODES: Readonly<Record<ModeId, ModeDefinition>> = {
  coop: {
    id: "coop",
    name: "Co-op",
    minPlayers: 2,
    maxPlayers: 4,
    versus: false,
    sends: false,
    rules:
      "You defend the same map and share the reactor energy. Everyone has their own credits: starting credits, kill bounties and wave bonuses are split, Refineries pay their owner. Only the player who built a tower can upgrade or sell it. The host controls mission, restart and speed.",
  },
  race: {
    id: "race",
    name: "Race",
    minPlayers: 2,
    maxPlayers: 4,
    versus: true,
    sends: false,
    rules:
      "Everyone defends their own copy of the mission against the same waves. Waves start for everyone at the same time, once all players are ready or the countdown runs out. The last player holding their reactor wins; if several survive all waves, reactor energy decides.",
  },
  siege: {
    id: "siege",
    name: "Siege",
    minPlayers: 2,
    maxPlayers: 4,
    versus: true,
    sends: true,
    rules:
      "Like Race, but you can spend credits to send enemies into the next player's field. Sent enemies give the defender no bounty. You can only send enemy types that have already appeared in a wave.",
  },
};
export const MODE_IDS = Object.keys(MODES) as ModeId[];
export const isModeId = (id: unknown): id is ModeId => typeof id === "string" && Object.hasOwn(MODES, id);
export const fitsMode = (mode: ModeId, players: number) =>
  players >= MODES[mode].minPlayers && players <= MODES[mode].maxPlayers;
/** Versus: build time between waves, in simulation ticks (30 s). */
export const READY_COUNTDOWN = 30 * 30;
/** A sent enemy costs this many times its kill reward. */
export const SEND_COST_FACTOR = 4;
export const sendCost = (enemy: Pick<EnemyDefinition, "reward">) => enemy.reward * SEND_COST_FACTOR;
/** Seconds until the first sent enemy appears, and between consecutive sent enemies. */
export const SEND_DELAY = 1;
export const SEND_SPACING = 0.6;
