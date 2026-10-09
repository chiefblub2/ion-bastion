import { describe, expect, it } from "vitest";
import { parseMap } from "./maps";
describe("map sketches", () => {
  it("trace the path from S to R and collect obstacles", () => {
    const map = parseMap("t", "Test", [
      "S=..#",
      ".=...",
      ".===R",
    ]);
    expect(map.columns).toBe(5);
    expect(map.rows).toBe(3);
    expect(map.path).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 },
      { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 },
    ]);
    expect(map.blocked).toEqual([{ x: 4, y: 0 }]);
  });
  it("reject branches, dead ends, stray path cells and ragged rows with the position", () => {
    expect(() => parseMap("t", "T", ["S==", ".=.", ".=R"])).toThrow("Map t: Pfad verzweigt bei 1,0");
    expect(() => parseMap("t", "T", ["S=.", "...", "..R"])).toThrow("ohne Reaktor");
    expect(() => parseMap("t", "T", ["S=R", "...", "=.."])).toThrow("ohne Verbindung");
    expect(() => parseMap("t", "T", ["S=R", ".."])).toThrow("Zeile 2");
    expect(() => parseMap("t", "T", ["S=X"])).toThrow("Unbekanntes Zeichen");
  });
});
