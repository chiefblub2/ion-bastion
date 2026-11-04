import type { Build, Strategy } from "../core/play";
/**
 * A build; `path` names the specialization path it buys (traps, support towers and Aura), `track` Aura's track.
 * Every trap, support and Aura build names a path, picked for what it stands beside: Aura takes Execution Field
 * next to Decay or Executioner, Piercing Field next to Lance or Acid, else Harmonics; a Detector Exposure Scan in A
 * and Afterimage in B; Mines, Caltrops and Tar Pits among damage towers take Chain Reaction, Open Wounds and Brittle
 * Tar, alone Quick Rearm, Serrated and Spreading Bog; Pitfall takes Sinkhole, Bear Trap Exposure, Refinery
 * Compounding. Attack-tower builds name none, so they stop at level 5.
 */
export const b = (tower: Build["tower"], x: number, y: number, path?: string, track?: string): Build => ({
  tower, x, y, ...(path ? { path } : {}), ...(track ? { track } : {}),
});
/** Per mission id: A plays the intended tactic, B an alternative. */
export type Strategies = Record<string, Record<"A" | "B", Strategy>>;
