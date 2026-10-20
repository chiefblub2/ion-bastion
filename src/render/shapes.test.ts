import { describe, expect, it } from "vitest";
import { arcPath, fillRound, type Ink } from "./shapes";

/** Records method names; Phaser's own `arc` spends 100 segments on every arc, however short. */
function recorder() {
  const calls: string[] = [],
    g: Ink = new Proxy({} as Ink, { get: (_, name) => () => (calls.push(String(name)), g) });
  return { g, calls };
}

describe("round shapes", () => {
  it("draws a short dash with a few segments", () => {
    const { g, calls } = recorder();
    arcPath(g, 0, 0, 20, 0, 0.45);
    expect(calls[0]).toBe("moveTo");
    expect(calls.filter((c) => c === "lineTo").length).toBeLessThanOrEqual(3);
  });

  it("fills a circle in the current style, without setting one", () => {
    const { g, calls } = recorder();
    fillRound(g, 0, 0, 10);
    expect(calls).toEqual(["fillPoints"]);
  });
});
