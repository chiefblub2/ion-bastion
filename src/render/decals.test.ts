import { describe, expect, it } from "vitest";
import { DEFAULT_CONTENT } from "../content";
import type { GameEvent } from "../core/types";
import { MAX_SCORCHES, SCORCH_LIFE, Scorches } from "./decals";
const impact = (tower: "blast" | "pulse", x = 1): GameEvent => ({ type: "impact", tower, at: { x, y: 1 }, color: 0 });
const count = (s: Scorches) => (s as unknown as { marks: unknown[] }).marks.length;
describe("scorch marks", () => {
  it("come from splash impacts and strikes only, bounded and expiring", () => {
    const s = new Scorches();
    s.consume([impact("pulse"), impact("blast"), { type: "strike", at: { x: 2, y: 2 }, radius: 1.2, color: 0 }], DEFAULT_CONTENT, 0);
    expect(count(s)).toBe(2);
    s.consume(Array.from({ length: MAX_SCORCHES + 5 }, (_, i) => impact("blast", i)), DEFAULT_CONTENT, 1);
    expect(count(s)).toBe(MAX_SCORCHES);
    s.consume([], DEFAULT_CONTENT, 1 + SCORCH_LIFE + 0.1);
    expect(count(s)).toBe(0);
  });
});
