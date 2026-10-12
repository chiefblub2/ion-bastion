import { describe, expect, it } from "vitest";
import { barAt, nextSlot } from "./clock";
import { chordOf, MUSIC, snap, type Extent } from "./harmony";
import { RECIPES, TIMING, type CueId } from "./recipes";
import { Score } from "./score";

describe("Score", () => {
  it("starts on the first theme and switches tempo on the next bar line", () => {
    const s = new Score();
    expect(s.theme("outpost", 10)).toBe(true);
    expect(s.clock).toEqual({ origin: 10, bpm: MUSIC.outpost.bpm });
    expect(s.theme("outpost", 11)).toBe(false);
    s.theme("frost", 11);
    expect(s.clock).toEqual({ origin: nextSlot({ origin: 10, bpm: MUSIC.outpost.bpm }, 11, 1), bpm: MUSIC.frost.bpm });
  });
  it("places a pitched cue on its grid at a chord tone near its own pitch", () => {
    const s = new Score();
    s.theme("outpost", 0);
    s.extent = 4;
    const n = s.place({ id: "bolt", voice: 1, gain: 1 }, 0.01),
      base = RECIPES.bolt.params[2]!;
    expect(n.at).toBe(nextSlot(s.clock, 0.01, TIMING.bolt.grid));
    expect(n.rate).toBeCloseTo(snap(base, chordOf(MUSIC.outpost, barAt(s.clock, n.at), 4), 1) / base);
  });
  it("plays instant and unpitched cues unchanged", () => {
    const s = new Score();
    s.theme("outpost", 0);
    expect(s.place({ id: "reject", voice: 0, gain: 1 }, 0.37)).toEqual({ id: "reject", rate: 1, gain: 1, at: 0.37 });
    expect(s.noteAt("kick", 3, 0.6, 2)).toEqual({ id: "kick", rate: 1, gain: 0.6, at: 2 });
  });
  it("climbs the chord with every kill", () => {
    const s = new Score();
    s.theme("outpost", 0);
    const base = RECIPES.kill.params[2]!,
      chord = chordOf(MUSIC.outpost, 0),
      rates = [0, 1, 2].map(() => s.place({ id: "kill", voice: 0, gain: 1 }, 0).rate);
    expect(rates).toEqual([0, 1, 2].map((i) => snap(base, chord, i) / base));
  });
  it("keeps every pitched cue within half an octave of its recipe in every theme, bar and extent", () => {
    const pitched = (Object.keys(TIMING) as CueId[]).filter((id) => TIMING[id].pitched);
    for (const music of Object.values(MUSIC))
      for (const extent of [3, 4, 5] as Extent[])
        for (let bar = 0; bar < 4; bar++)
          for (const id of pitched)
            for (let voice = 0; voice < 8; voice++) {
              const base = RECIPES[id].params[2] ?? 220,
                rate = snap(base, chordOf(music, bar, extent), voice) / base;
              expect(rate, id).toBeGreaterThanOrEqual(0.7);
              expect(rate, id).toBeLessThanOrEqual(1.42);
            }
  });
});
