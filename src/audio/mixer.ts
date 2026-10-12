import type { CueId, CueSpec, Pool } from "./recipes";
// Which cue may start now. Caps are in real seconds, so a 2× wave stays as dense as a 1× one.

export interface Voice {
  cue: CueId;
  pool: Pool;
  priority: number;
  start: number;
  end: number;
}
export const POOL_CAP: Record<Pool, number> = { combat: 24, flow: 8, ui: 4 };

export function admit<V extends Voice>(
  id: CueId,
  spec: Pick<CueSpec, "pool" | "cap" | "gap" | "priority">,
  voices: readonly V[],
  lastStart: number | undefined,
  now: number,
): { play: false } | { play: true; steal?: V } {
  if (lastStart !== undefined && now - lastStart < spec.gap) return { play: false };
  const alive = voices.filter((v) => v.end > now);
  if (alive.filter((v) => v.cue === id).length >= spec.cap) return { play: false };
  const pool = alive.filter((v) => v.pool === spec.pool);
  if (pool.length < POOL_CAP[spec.pool]) return { play: true };
  const steal = pool.filter((v) => v.priority < spec.priority).sort((a, b) => a.priority - b.priority || a.start - b.start)[0];
  return steal ? { play: true, steal } : { play: false };
}
