import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { GameEvent, TowerId } from "../core/types";
import { familyOf } from "./families";
import { BUDGET, panOf, rateOf, ShotMixer, type ShotVoice } from "./shots";

const rapid = Object.values(DEFAULT_CONTENT.towers).find((d) => familyOf(d) === "rapid")!.id as TowerId,
  heavy = Object.values(DEFAULT_CONTENT.towers).find((d) => familyOf(d) === "heavy")!.id as TowerId;
const shot = (tower: TowerId, x = 0): GameEvent => ({ type: "shot", tower, from: { x, y: 0 }, to: { x, y: 0 }, color: 0 });
/** `seconds` of 60 fps frames with `rate` rapid shots per second; the voices of the last `measure` seconds. */
function storm(rate: number, seconds = 6, measure = 3) {
  const m = new ShotMixer(),
    voices: ShotVoice[] = [];
  let owed = 0;
  for (let t = 0; t < seconds; t += 1 / 60) {
    const events: GameEvent[] = [];
    for (owed += rate / 60; owed >= 1; owed--) events.push(shot(rapid));
    const out = m.frame(events, DEFAULT_CONTENT, 16, t);
    if (t >= seconds - measure) voices.push(...out);
  }
  return voices;
}
/** Summed power per second of the voices (gain²). */
const power = (voices: ShotVoice[], seconds = 3) => voices.reduce((sum, v) => sum + v.gain ** 2, 0) / seconds;

describe("ShotMixer", () => {
  it("starts no more voices per second than the family's budget, one per frame at most", () => {
    const voices = storm(200);
    expect(voices.length / 3).toBeLessThanOrEqual(BUDGET.rapid + 0.5);
    expect(voices.length / 3).toBeGreaterThan(BUDGET.rapid - 1.5);
  });
  it("keeps the summed loudness about level from 3 to 30 and 200 shots per second", () => {
    const db = (r: number) => 10 * Math.log10(power(storm(r)));
    expect(Math.abs(db(30) - db(3))).toBeLessThan(2);
    expect(Math.abs(db(200) - db(3))).toBeLessThan(2);
  });
  it("merges a frame's shots of one family and gives other families their own voice", () => {
    const m = new ShotMixer(),
      out = m.frame([shot(rapid, 0), shot(rapid, 15), shot(heavy, 15)], DEFAULT_CONTENT, 16, 0);
    expect(out.map((v) => v.family)).toEqual(["rapid", "heavy"]);
    // The merged voice sits at the shots' mean column, the middle.
    expect(out[0].pan).toBeCloseTo(0);
    expect(out[1].pan).toBeCloseTo(0.7);
  });
  it("pans by column within ±0.7 and keeps one pitch per tower type", () => {
    expect(panOf(0, 16)).toBeCloseTo(-0.7);
    expect(panOf(15, 16)).toBeCloseTo(0.7);
    expect(panOf(3, 1)).toBe(0);
    expect(rateOf(rapid)).toBe(rateOf(rapid));
    expect(Math.abs(12 * Math.log2(rateOf(heavy)))).toBeLessThanOrEqual(2);
  });
});
