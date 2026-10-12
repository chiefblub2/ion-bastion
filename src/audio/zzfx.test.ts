import { describe, expect, it } from "vitest";
import { buildSamples } from "./zzfx";

describe("buildSamples", () => {
  it("lasts attack + decay + sustain + release + delay", () => {
    expect(buildSamples([1, 0, 440, 0.1, 0.2, 0.3], 1000).length).toBe(600);
  });
  it("is deterministic and stays within its volume", () => {
    const params = [0.5, 0.05, 300, 0, 0.05, 0.2, 4, 1, 0, 0, 0, 0, 0, 0.5];
    const a = buildSamples(params, 8000);
    expect(buildSamples(params, 8000)).toEqual(a);
    expect(Math.max(...a.map(Math.abs))).toBeLessThanOrEqual(0.5 + 1e-6);
  });
});
