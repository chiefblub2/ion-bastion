import { fnv } from "../core/hash";
import type { AttackSpec, ContentPack, GameEvent, GameState } from "../core/types";
import { RECIPES, type CueId } from "./recipes";
// Drained game events → sound cues. Every firing emits a `shot` with its tower id; chain, beam and pulse events only
// accompany it and stay silent.

export interface Cue {
  id: CueId;
  /** Playback rate before jitter. */
  pitch: number;
  gain: number;
}
export type View = "menu" | "game";
/** Support kinds never fire, so they have no cue. */
const FIRE: Record<AttackSpec["kind"], CueId | null> = {
  direct: "bolt", pierce: "beam", volley: "bolt", splash: "lob", mortar: "lob", chain: "crackle", focus: "beam", quake: "swell",
  slow: "chime", net: "chime", burn: "hiss", corrode: "hiss", decay: "hiss", stun: "zap", disrupt: "zap", pull: "sweep",
  execute: "crack", bleed: "trap", charge: "trap", pit: "trap", alarm: "trap",
  aura: null, income: null, detect: null, bounty: null, repair: null, mark: null,
};
const BLASTS = new Set<AttackSpec["kind"]>(["splash", "mortar", "charge"]);
const PLAIN: Partial<Record<GameEvent["type"], CueId>> = {
  kill: "kill", evade: "evade", overload: "overload", leak: "leak", build: "build", sell: "sell", upgrade: "upgrade",
  income: "income", repair: "repair", waveStart: "waveStart", waveEnd: "waveEnd",
};
/** A stable pitch per tower id, so towers of one attack kind still sound apart (0.88–1.12). */
export const towerPitch = (tower: string) => 0.88 + (fnv(tower) % 25) / 100;
export const burstGain = (n: number) => Math.min(1.5, 1 + 0.1 * (n - 1));

function cueOf(e: GameEvent, content: ContentPack): { id: CueId; pitch: number } | null {
  switch (e.type) {
    case "shot": {
      const d = content.towers[e.tower];
      const id = d.placement === "path" ? "trap" : FIRE[d.attack.kind];
      return id && { id, pitch: towerPitch(e.tower) };
    }
    case "impact":
      return { id: BLASTS.has(content.towers[e.tower].attack.kind) ? "blast" : "impact", pitch: towerPitch(e.tower) };
    case "end":
      return { id: e.result, pitch: 1 };
    default: {
      const id = PLAIN[e.type];
      return id ? { id, pitch: 1 } : null;
    }
  }
}
/** One cue per sound and pitch in this frame; in the menu only flow cues (a multiplayer wave runs on). */
export function cuesFor(events: readonly GameEvent[], content: ContentPack, view: View): Cue[] {
  const merged = new Map<string, { id: CueId; pitch: number; n: number }>();
  for (const e of events) {
    const c = cueOf(e, content);
    if (!c || (view === "menu" && RECIPES[c.id].pool === "combat")) continue;
    const key = `${c.id}@${c.pitch}`,
      m = merged.get(key);
    if (m) m.n++;
    else merged.set(key, { ...c, n: 1 });
  }
  return [...merged.values()].map(({ id, pitch, n }) => ({ id, pitch, gain: burstGain(n) }));
}
/** Reports the reactor falling to 30 % once per crossing; a new state (restart, mission change) starts fresh. */
export class ReactorWatch {
  private seen: { state: GameState; lives: number } | null = null;
  crossed(state: GameState, max: number) {
    const before = this.seen?.state === state ? this.seen.lives : undefined;
    this.seen = { state, lives: state.lives };
    return before !== undefined && max > 0 && state.lives > 0 && before / max > 0.3 && state.lives / max <= 0.3;
  }
}
/** Seats whose elimination tick appeared since the last frame, without the local player (the `lost` cue covers them). */
export function newlyEliminated(before: readonly (number | null)[], after: readonly (number | null)[], local: number) {
  return after.flatMap((tick, i) => (tick !== null && (before[i] ?? null) === null && i !== local ? [i] : []));
}
