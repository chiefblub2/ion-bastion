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
    name: "Koop",
    minPlayers: 2,
    maxPlayers: 4,
    versus: false,
    sends: false,
    rules:
      "Ihr verteidigt dieselbe Karte und teilt die Reaktorenergie. Jeder hat eigene Credits: Start-Credits, Abschussprämien und Wellenbonus werden geteilt, Raffinerien zahlen an ihren Besitzer. Türme verbessern und verkaufen kann nur, wer sie gebaut hat. Mission, Neustart und Tempo bestimmt der Host.",
  },
  race: {
    id: "race",
    name: "Wettlauf",
    minPlayers: 2,
    maxPlayers: 4,
    versus: true,
    sends: false,
    rules:
      "Jeder verteidigt seine eigene Kopie der Mission gegen dieselben Wellen. Die Wellen starten für alle gleichzeitig, sobald alle bereit sind oder der Countdown abläuft. Wer seinen Reaktor als Letzter hält, gewinnt; überstehen mehrere alle Wellen, entscheidet die Reaktorenergie.",
  },
  siege: {
    id: "siege",
    name: "Belagerung",
    minPlayers: 2,
    maxPlayers: 4,
    versus: true,
    sends: true,
    rules:
      "Wie Wettlauf, aber ihr könnt Credits ausgeben, um Gegner in das Feld des nächsten Mitspielers zu schicken. Geschickte Gegner bringen dem Verteidiger keine Prämie. Schicken kannst du nur Gegnertypen, die schon in einer Welle vorkamen.",
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
