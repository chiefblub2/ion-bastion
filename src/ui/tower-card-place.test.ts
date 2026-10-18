import { describe, expect, it } from "vitest";
import { placeTowerCard, type CardPlaceInput } from "./tower-card-place";
const input = (over: Partial<CardPlaceInput>): CardPlaceInput => ({
  board: { width: 900, height: 600 },
  columns: 18,
  rows: 12,
  cell: { x: 6, y: 2 },
  card: { width: 160, height: 140 },
  path: [],
  ...over,
});
describe("tower card placement", () => {
  it("prefers the side that covers fewer path cells", () => {
    const path = Array.from({ length: 10 }, (_, i) => ({ x: 8 + i, y: 3 }));
    expect(placeTowerCard(input({ path }))).toMatchObject({ mode: "float", side: "left" });
  });
  it("stays inside the board for edge cells", () => {
    for (const cell of [{ x: 0, y: 0 }, { x: 17, y: 0 }, { x: 0, y: 11 }, { x: 17, y: 11 }]) {
      const p = placeTowerCard(input({ cell }));
      expect(p.mode).toBe("float");
      if (p.mode !== "float") continue;
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + 160).toBeLessThanOrEqual(900);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y + 140).toBeLessThanOrEqual(600);
    }
  });
  it("falls back to above/below when neither side fits", () => {
    const p = placeTowerCard(input({ board: { width: 300, height: 200 }, columns: 6, rows: 4, card: { width: 200, height: 60 }, cell: { x: 3, y: 2 } }));
    expect(p.mode).toBe("float");
    expect(p.mode === "float" && ["above", "below"].includes(p.side)).toBe(true);
  });
  it("docks when nothing fits, at the top for a bottom-row tower", () => {
    const small = { board: { width: 400, height: 300 }, columns: 8, rows: 6, card: { width: 300, height: 280 } };
    expect(placeTowerCard(input({ ...small, cell: { x: 4, y: 1 } }))).toEqual({ mode: "dock", edge: "bottom" });
    expect(placeTowerCard(input({ ...small, cell: { x: 4, y: 5 } }))).toEqual({ mode: "dock", edge: "top" });
  });
});
