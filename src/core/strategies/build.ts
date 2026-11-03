import type { Build, Strategy } from "../test-helpers";
/** A build; `path` names the specialization path it buys (traps, support towers and Aura), `track` Aura's track. */
export const b = (tower: Build["tower"], x: number, y: number, path?: string, track?: string): Build => ({
  tower, x, y, ...(path ? { path } : {}), ...(track ? { track } : {}),
});
/** Per mission id: A plays the intended tactic, B an alternative. */
export type Strategies = Record<string, Record<"A" | "B", Strategy>>;
