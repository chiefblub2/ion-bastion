import { describe, expect, it } from "vitest";
import { FAMILIES } from "./families";
import { partNote } from "./parts";

describe("parts", () => {
  it("plays the core steps as soon as a family is active and the full figure only at full activity", () => {
    expect(partNote("rapid", 0, 0.01)).toBeNull();
    const first = partNote("rapid", 0, 0.1)!;
    expect(first.voice).toBe(0);
    expect(first.velocity).toBeCloseTo(0.46);
    expect(partNote("rapid", 14, 0.7)).toBeNull();
    expect(partNote("rapid", 14, 0.9)?.voice).toBe(3);
  });
  it("never writes more than eight notes per bar for any family", () => {
    for (const f of FAMILIES) expect(Array.from({ length: 16 }, (_, s) => partNote(f, s, 1)).filter(Boolean).length, f).toBeLessThanOrEqual(8);
  });
  it("answers the first rapid shot within a beat", () => {
    for (let s = 0; s < 16; s += 4) expect(partNote("rapid", s, 0.06)).not.toBeNull();
  });
});
