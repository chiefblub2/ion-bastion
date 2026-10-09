import type { Build, Strategy } from "../test-helpers";
export const b = (tower: Build["tower"], x: number, y: number): Build => ({ tower, x, y });
/** Per mission id: A plays the intended tactic, B an alternative. */
export type Strategies = Record<string, Record<"A" | "B", Strategy>>;
