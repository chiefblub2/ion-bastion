import type { Command } from "../core/types";
/**
 * The journal of a run mission: every command with the simulation tick it was applied at. The simulation is
 * deterministic, so replaying the journal rebuilds the mission exactly (the `run` command's `replay`), which makes a
 * run mission resumable after a reload and impossible to restart for free.
 */
export interface JournalEntry {
  tick: number;
  command: Command;
}
export interface Journal {
  missionId: string;
  entries: JournalEntry[];
  /** Ticks simulated when the journal was saved. */
  ticks: number;
  /** `stateHash` at `ticks`; a replay that ends elsewhere is reported. */
  hash?: number;
  /** The wave the mission stood at, for the Resume button. */
  wave?: number;
}
export const newJournal = (missionId: string): Journal => ({ missionId, entries: [], ticks: 0 });
/** Commands that load a mission are never journaled: the journal belongs to one loaded mission. */
const LOADS: ReadonlySet<Command["type"]> = new Set(["run", "mission", "restart", "playtest"]);
export function record(j: Journal, tick: number, command: Command): Journal {
  if (LOADS.has(command.type)) return j;
  const { player: _player, ...plain } = command;
  return { ...j, entries: [...j.entries, { tick, command: plain as Command }] };
}
export const mark = (j: Journal, ticks: number, hash: number, wave: number): Journal => ({ ...j, ticks, hash, wave });
export function parseJournal(raw: string | null): Journal | undefined {
  try {
    const d = raw ? JSON.parse(raw) : undefined;
    if (!d || typeof d.missionId !== "string" || !Array.isArray(d.entries) || !Number.isInteger(d.ticks)) return undefined;
    if (!d.entries.every((e: JournalEntry) => Number.isInteger(e?.tick) && typeof e?.command?.type === "string")) return undefined;
    return d as Journal;
  } catch {
    return undefined;
  }
}
