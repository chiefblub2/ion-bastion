import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { GameEvent, TowerId } from "../core/types";
import { stepLength } from "./clock";
import { Conductor, type Voices } from "./conductor";
import { MUSIC } from "./harmony";
import { POLYPHONY } from "./engine";
import { LENGTH, type Instrument } from "./instruments";

const rapid = Object.values(DEFAULT_CONTENT.towers).find((d) => d.attack.kind === "direct" && !d.placement)!.id as TowerId;
const electric = Object.values(DEFAULT_CONTENT.towers).find((d) => d.attack.kind === "chain" && !d.placement)!.id as TowerId;
const at = { x: 0, y: 0 };
class Recorder implements Voices {
  notes: { name: Instrument; at: number; hz: number; bus?: string }[] = [];
  effects = 0;
  ducks = 0;
  energies: number[] = [];
  ambience = { chord: () => {}, tone: () => {} };
  energy(level: number) {
    this.energies.push(level);
  }
  play() {
    this.effects++;
    return true;
  }
  instrument(name: Instrument, hz: number, at: number, _velocity: number, _pan: number, bus?: string) {
    this.notes.push({ name, at, hz, bus });
    return true;
  }
  duck() {
    this.ducks++;
  }
}
/** Drives a conductor through `bars` bars of rapid fire at `rate` shots per second, frame by frame like the game. */
function run(rate: number, bars: number, tower = rapid, defense = 0, threat = 0) {
  const r = new Recorder(),
    c = new Conductor(r),
    frame = 1 / 30;
  c.theme("outpost", 0);
  const end = bars * stepLength(c.score.clock, 1);
  let owed = 0,
    first = -1;
  for (let t = 0; t < end; t += frame) {
    const events: GameEvent[] = [];
    for (owed += rate * frame; owed >= 1; owed--) events.push({ type: "shot", tower, from: at, to: at, color: 0 });
    if (events.length && first < 0) first = t;
    c.shots(events, DEFAULT_CONTENT, t);
    c.measure({ threat, defense, clear: 5, heavies: 0, bosses: 0, drums: true, playing: true });
    c.window(t, t + frame);
  }
  return { r, first, end, beat: stepLength(c.score.clock, 4) };
}
/** Plucks inside the run (its last frame may reach into the next bar). */
const plucks = ({ r, end }: ReturnType<typeof run>) => r.notes.filter((n) => n.name === "pluck" && n.at < end).length;

describe("Conductor", () => {
  it("keeps the note count set by the composition, however fast the towers fire", () => {
    const slow = plucks(run(1, 4)),
      fast = plucks(run(80, 4));
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeLessThanOrEqual(4 * 8);
  });
  it("answers a family's first shot within a beat", () => {
    const { r, first, beat } = run(2, 2);
    expect(r.notes.find((n) => n.name === "pluck")!.at - first).toBeLessThanOrEqual(beat + 1e-6);
  });
  it("plays no drums at low threat", () => {
    expect(run(10, 2).r.notes.some((n) => ["kick", "snare", "hat"].includes(n.name))).toBe(false);
  });
  it("plays stingers on instruments and alerts as effects", () => {
    const r = new Recorder(),
      c = new Conductor(r);
    c.theme("outpost", 0);
    c.cue("won", 0.1);
    expect(r.notes.length).toBeGreaterThan(1);
    expect(r.ducks).toBe(1);
    expect(r.notes.every((n) => n.bus === "sfx")).toBe(true);
    expect(r.effects).toBe(0);
    c.cue("reject", 0.1);
    expect(r.effects).toBe(1);
  });
  it("leaves every instrument room at full defense, arpeggio and electric bells together", () => {
    const { r } = run(20, 4, electric, 0.9);
    for (const n of r.notes) {
      const sounding = r.notes.filter((m) => m.name === n.name && m.at <= n.at && n.at < m.at + LENGTH[m.name]).length;
      expect(sounding, `${n.name} at ${n.at.toFixed(2)}`).toBeLessThanOrEqual(POLYPHONY);
    }
  });
  it("escalates at the top: phrase marks, rapid part an octave up, more energy", () => {
    const calm = run(20, 8, rapid, 0, 0.1),
      top = run(20, 8, rapid, 0, 0.9);
    const names = new Set(top.r.notes.map((n) => n.name));
    for (const name of ["metal", "riser", "slam"] as const) expect(names.has(name), name).toBe(true);
    expect(plucks(top)).toBeGreaterThan(plucks(calm) * 1.8);
    expect(top.r.energies.at(-1)!).toBeGreaterThan(calm.r.energies.at(-1)! + 0.5);
  });
  it("plays the enemies on the industrial kit with dissonance at high threat", () => {
    const { r } = run(0, 2, rapid, 0, 0.9),
      names = new Set(r.notes.map((n) => n.name));
    for (const clean of ["kick", "snare", "hat", "tom", "bass"] as const) expect(names.has(clean), clean).toBe(false);
    for (const machine of ["thud", "clank", "tick", "grit"] as const) expect(names.has(machine), machine).toBe(true);
    const step = 60 / MUSIC.outpost.bpm / 4,
      grit = r.notes.filter((n) => n.name === "grit" && n.at < 16 * step),
      root = grit.find((n) => Math.abs(n.at) < 1e-6)!,
      tritone = grit.find((n) => Math.abs(n.at - 6 * step) < 1e-6)!;
    expect(12 * Math.log2(tritone.hz / root.hz)).toBeCloseTo(6);
  });
  it("reports how long ago each family's latest note began, ignoring notes still ahead", () => {
    const r = new Recorder(),
      c = new Conductor(r);
    c.theme("outpost", 0);
    c.shots([{ type: "shot", tower: rapid, from: at, to: at, color: 0 }], DEFAULT_CONTENT, 0);
    c.measure({ threat: 0, defense: 0, clear: 5, heavies: 0, bosses: 0, drums: true, playing: true });
    c.window(0, 0.1);
    expect(c.ages(-0.01).rapid).toBeUndefined();
    expect(c.ages(0.05).rapid).toBeCloseTo(0.05);
  });
});
