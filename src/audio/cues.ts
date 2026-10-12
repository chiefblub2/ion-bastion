import type { AttackSpec, ContentPack, GameEvent, GameState } from "../core/types";
import { voiceOf } from "./harmony";
import { RECIPES, type CueId } from "./recipes";
// Drained game events → sound cues. Every firing emits a `shot` with its tower id; chain, beam and pulse events only
// accompany it and stay silent. `Score.place` decides when and at which pitch a cue sounds.

export interface Cue {
  id: CueId;
  /** Chord-tone index for pitched cues: the tower's own voice, or a fixed tone for flow cues. */
  voice: number;
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
/** Building rises to the fifth, upgrading to the top of the chord; other flow cues sit on the root. */
const FLOW_VOICE: Partial<Record<CueId, number>> = { build: 2, upgrade: 3 };
export const burstGain = (n: number) => Math.min(1.5, 1 + 0.1 * (n - 1));

function cueOf(e: GameEvent, content: ContentPack): { id: CueId; voice: number } | null {
  switch (e.type) {
    case "shot": {
      const d = content.towers[e.tower];
      const id = d.placement === "path" ? "trap" : FIRE[d.attack.kind];
      return id && { id, voice: voiceOf(e.tower) };
    }
    case "impact":
      return { id: BLASTS.has(content.towers[e.tower].attack.kind) ? "blast" : "impact", voice: voiceOf(e.tower) };
    case "end":
      return { id: e.result, voice: 0 };
    default: {
      const id = PLAIN[e.type];
      return id ? { id, voice: FLOW_VOICE[id] ?? 0 } : null;
    }
  }
}
/** One cue per sound and voice in this frame; in the menu only flow cues (a multiplayer wave runs on). */
export function cuesFor(events: readonly GameEvent[], content: ContentPack, view: View): Cue[] {
  const merged = new Map<string, { id: CueId; voice: number; n: number }>();
  for (const e of events) {
    const c = cueOf(e, content);
    if (!c || (view === "menu" && RECIPES[c.id].pool === "combat")) continue;
    const key = `${c.id}@${c.voice}`,
      m = merged.get(key);
    if (m) m.n++;
    else merged.set(key, { ...c, n: 1 });
  }
  return [...merged.values()].map(({ id, voice, n }) => ({ id, voice, gain: burstGain(n) }));
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
