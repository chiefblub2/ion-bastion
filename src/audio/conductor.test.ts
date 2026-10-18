import { describe, expect, it } from "vitest";
import { stepLength } from "./clock";
import { Conductor, type Measure, type Voices } from "./conductor";
import { MUSIC } from "./harmony";
import { MUSIC_VOICES, POLYPHONY, type Layer } from "./engine";
import { LENGTH, type Instrument } from "./instruments";

class Recorder implements Voices {
  notes: { name: Instrument; at: number; hz: number; layer?: Layer; length?: number }[] = [];
  effects = 0;
  ducks = 0;
  pumps: number[] = [];
  tempos: number[] = [];
  energies: number[] = [];
  ambience = { chord: () => {}, tone: () => {} };
  energy(level: number) {
    this.energies.push(level);
  }
  play() {
    this.effects++;
    return true;
  }
  instrument(name: Instrument, hz: number, at: number, _velocity: number, _pan: number, layer?: Layer, length?: number) {
    this.notes.push({ name, at, hz, layer, length });
    return true;
  }
  duck() {
    this.ducks++;
  }
  pump(at: number) {
    this.pumps.push(at);
  }
  tempo(bpm: number) {
    this.tempos.push(bpm);
  }
}
const WAVE: Measure = { phase: "wave", threat: 0, danger: 0, arc: 0, heavies: 0, bosses: 0 };
/** Drives a conductor through `bars` bars in one measured state, frame by frame like the game. */
function run(bars: number, m: Partial<Measure> = {}) {
  const r = new Recorder(),
    c = new Conductor(r),
    frame = 1 / 30;
  c.theme("outpost", 0);
  const end = bars * stepLength(c.score.clock, 1);
  for (let t = 0; t < end; t += frame) {
    c.measure({ ...WAVE, ...m });
    c.window(t, t + frame);
  }
  return { r, c, names: new Set(r.notes.map((n) => n.name)) };
}
const step = 60 / MUSIC.outpost.bpm / 4;

describe("Conductor", () => {
  it("arranges by phase: pad and a soft arpeggio in the menu, a held bass between waves, nothing while paused", () => {
    expect(run(1, { phase: "menu" }).names).toEqual(new Set(["arp"]));
    const build = run(1, { phase: "build" }).r.notes.filter((n) => n.name === "synthBass");
    expect(build).toHaveLength(1);
    expect(build[0].length).toBeCloseTo(15.5 * step);
    expect(run(1, { phase: "paused" }).r.notes).toEqual([]);
  });
  it("plays no drums at low threat and builds the drum machine with it", () => {
    expect(["kick", "snare", "hat"].some((d) => run(2, { threat: 0.1 }).names.has(d as Instrument))).toBe(false);
    const top = run(2, { threat: 0.8 }).names;
    for (const d of ["kick", "snare", "hat", "synthBass"] as const) expect(top.has(d), d).toBe(true);
  });
  it("starts late waves fuller: the mission's progress puts a floor under the threat", () => {
    expect(run(1, { threat: 0, arc: 1 }).names.has("kick")).toBe(true);
  });
  it("pumps pad and bass on every kick", () => {
    const { r } = run(2, { threat: 0.3 });
    expect(r.pumps).toEqual(r.notes.filter((n) => n.name === "kick").map((n) => n.at));
    expect(r.pumps.length).toBeGreaterThan(0);
  });
  it("sets the delay's tempo on a theme change", () => {
    const r = new Recorder(),
      c = new Conductor(r);
    c.theme("outpost", 0);
    c.theme("frost", 1);
    expect(r.tempos).toEqual([MUSIC.outpost.bpm, MUSIC.frost.bpm]);
  });
  it("plays stingers on instruments and alerts as effects", () => {
    const r = new Recorder(),
      c = new Conductor(r);
    c.theme("outpost", 0);
    c.cue("won", 0.1);
    expect(r.notes.length).toBeGreaterThan(1);
    expect(r.ducks).toBe(1);
    expect(r.notes.every((n) => n.layer === "sfx")).toBe(true);
    expect(r.effects).toBe(0);
    c.cue("build", 0.1);
    expect(r.effects).toBe(1);
  });
  it("stays within every instrument's polyphony and the music's voice limit at the top", () => {
    const { r } = run(8, { threat: 0.95, heavies: 2, arc: 1 });
    for (const n of r.notes) {
      const sounding = (m: (typeof r.notes)[number]) => m.at <= n.at && n.at < m.at + (m.length ?? LENGTH[m.name]);
      expect(r.notes.filter((m) => m.name === n.name && sounding(m)).length, `${n.name} at ${n.at.toFixed(2)}`).toBeLessThanOrEqual(POLYPHONY);
      expect(r.notes.filter(sounding).length).toBeLessThanOrEqual(MUSIC_VOICES);
    }
  });
  it("escalates at the top: phrase marks, the lead, 16th bass and more energy", () => {
    const calm = run(8, { threat: 0.3 }),
      top = run(8, { threat: 0.9 });
    for (const name of ["crash", "riser", "tom", "lead"] as const) expect(top.names.has(name), name).toBe(true);
    expect(calm.names.has("lead")).toBe(false);
    const riser = top.r.notes.find((n) => n.name === "riser")!;
    expect(riser.length).toBeCloseTo(8 * step);
    expect(top.r.energies.at(-1)!).toBeGreaterThan(calm.r.energies.at(-1)! + 0.5);
  });
  it("lets the bass's tritone in from threat 0.5", () => {
    const bass = run(1, { threat: 0.6 }).r.notes.filter((n) => n.name === "synthBass"),
      root = bass.find((n) => Math.abs(n.at) < 1e-6)!,
      tritone = bass.find((n) => Math.abs(n.at - 6 * step) < 1e-6)!;
    // Outpost's octave line plays the octave on step 6, so the tritone sits an octave and a tritone up.
    expect(12 * Math.log2(tritone.hz / root.hz)).toBeCloseTo(18);
  });
  it("holds an escalation until the threat clearly drops", () => {
    const c = new Conductor(new Recorder());
    c.theme("outpost", 0);
    c.measure({ ...WAVE, threat: 0.9 });
    c.measure({ ...WAVE, threat: 0.8 });
    expect(c.escalating).toBe(true);
    c.measure({ ...WAVE, threat: 0.7 });
    expect(c.escalating).toBe(false);
  });
  it("gives a boss the full escalated groove even at low threat", () => {
    const { names } = run(1, { threat: 0.1, bosses: 1 });
    for (const part of ["kick", "snare", "hat", "synthBass"] as const) expect(names.has(part), part).toBe(true);
  });
  it("darkens with danger to the reactor, with hysteresis", () => {
    const c = new Conductor(new Recorder());
    c.theme("outpost", 0);
    c.measure({ ...WAVE, danger: 0.1 });
    expect(c.color).toBe("bright");
    c.measure({ ...WAVE, danger: 0.7 });
    expect(c.color).toBe("dark");
    c.measure({ ...WAVE, danger: 0.55 });
    expect(c.color).toBe("dark");
  });
  it("routes each part to its layer", () => {
    const { r } = run(2, { threat: 0.95 }),
      layerOf = (name: Instrument) => new Set(r.notes.filter((n) => n.name === name).map((n) => n.layer));
    expect(layerOf("kick")).toEqual(new Set(["drums"]));
    expect(layerOf("synthBass")).toEqual(new Set(["bass"]));
    expect(layerOf("arp")).toEqual(new Set(["keys"]));
  });
  it("lets the towers pulse with the beat in a wave and not outside one", () => {
    const { c, r } = run(1, { threat: 0.3 }),
      kick = r.notes.find((n) => n.name === "kick")!.at;
    expect(c.ages(kick + 0.05).rapid).toBeCloseTo(0.05);
    expect(c.ages(kick + 0.05).heavy).toBeCloseTo(0.05);
    expect(c.ages(kick - 0.01).rapid).toBeUndefined();
    const build = run(1, { phase: "build" });
    expect(build.c.ages(0.5)).toEqual({});
  });
});
