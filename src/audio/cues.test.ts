import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { GameEvent, GameState, TowerId } from "../core/types";
import { burstGain, cuesFor, newlyEliminated, ReactorWatch } from "./cues";

const towers = Object.values(DEFAULT_CONTENT.towers);
const idOf = (pick: (d: (typeof towers)[number]) => boolean) => towers.find(pick)!.id as TowerId;
const direct = idOf((d) => d.attack.kind === "direct" && !d.placement),
  splash = idOf((d) => d.attack.kind === "splash" && !d.placement);
const at = { x: 0, y: 0 };
const kill: GameEvent = { type: "kill", at, color: 0, reward: 1 };

describe("cuesFor", () => {
  it("leaves shots to the instrument parts and voices only heavy impacts", () => {
    expect(cuesFor([{ type: "shot", tower: direct, from: at, to: at, color: 0 }], DEFAULT_CONTENT, "game")).toEqual([]);
    expect(cuesFor([{ type: "impact", tower: splash, at, color: 0 }], DEFAULT_CONTENT, "game")).toEqual([{ id: "blast", voice: 0, gain: 1 }]);
    expect(cuesFor([{ type: "impact", tower: direct, at, color: 0 }], DEFAULT_CONTENT, "game")).toEqual([]);
  });
  it("merges a burst into one louder cue", () => {
    expect(cuesFor([kill, kill, kill], DEFAULT_CONTENT, "game")).toEqual([{ id: "kill", voice: 0, gain: burstGain(3) }]);
    expect(burstGain(1)).toBe(1);
    expect(burstGain(50)).toBe(1.5);
  });
  it("gives building and upgrading their own chord tones", () => {
    const build: GameEvent = { type: "build", at, tower: direct, color: 0 },
      upgrade: GameEvent = { type: "upgrade", at, tower: direct, color: 0 };
    expect(cuesFor([build, upgrade], DEFAULT_CONTENT, "game").map((c) => c.voice)).toEqual([2, 3]);
  });
  it("keeps only flow cues while the menu is open", () => {
    const events: GameEvent[] = [kill, { type: "leak", at, amount: 1 }, { type: "end", result: "lost" }];
    expect(cuesFor(events, DEFAULT_CONTENT, "menu").map((c) => c.id)).toEqual(["leak", "lost"]);
  });
});

describe("ReactorWatch", () => {
  const state = (lives: number) => ({ lives }) as GameState;
  it("fires once when the reactor falls to 30 % and never on a new state", () => {
    const w = new ReactorWatch(),
      s = state(20);
    expect(w.crossed(s, 20)).toBe(false);
    s.lives = 6;
    expect(w.crossed(s, 20)).toBe(true);
    s.lives = 5;
    expect(w.crossed(s, 20)).toBe(false);
    expect(w.crossed(state(3), 20)).toBe(false);
  });
});

describe("newlyEliminated", () => {
  it("reports opponents who just dropped out, never the local seat", () => {
    expect(newlyEliminated([null, null, null], [120, null, 120], 0)).toEqual([2]);
    expect(newlyEliminated([], [null, null], 1)).toEqual([]);
  });
});
