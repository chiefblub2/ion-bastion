import { describe, expect, it } from "vitest";
import { Effects, NEUTRAL_CHORD, STINGER_STEP, type EffectVoices } from "./effects";
import { pitchOf } from "./instruments";
import type { Note } from "./score";
import { STINGERS } from "./stingers";

class Recorder implements EffectVoices {
  notes: Note[] = [];
  phrases: { name: string; hz: number; at: number }[] = [];
  play(note: Note) {
    this.notes.push(note);
    return true;
  }
  instrument(name: string, hz: number, at: number) {
    this.phrases.push({ name, hz, at });
    return true;
  }
  duck() {}
}

describe("effects without the soundtrack", () => {
  it("play cues at once at their recipe's own pitch, kills included", () => {
    const r = new Recorder(),
      fx = new Effects(r);
    fx.play(
      [
        { id: "kill", voice: 0, gain: 1 },
        { id: "kill", voice: 0, gain: 1 },
        { id: "build", voice: 2, gain: 0.5 },
      ],
      3.21,
    );
    expect(r.notes.map((n) => [n.id, n.at, n.rate])).toEqual([
      ["kill", 3.21, 1],
      ["kill", 3.21, 1],
      ["build", 3.21, 1],
    ]);
  });

  it("start a stinger's phrase now on the fixed chord, and never pulse the towers", () => {
    const r = new Recorder(),
      fx = new Effects(r);
    fx.cue("waveEnd", 10);
    const notes = STINGERS.waveEnd!.notes;
    expect(r.phrases).toEqual(notes.map(([name, tone, offset]) => ({ name, hz: pitchOf(name, NEUTRAL_CHORD, tone), at: 10 + offset * STINGER_STEP })));
    expect(fx.ages()).toEqual({});
  });
});
