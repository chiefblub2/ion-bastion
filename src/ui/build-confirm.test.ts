import { describe, expect, it } from "vitest";
import { confirmPlacement } from "./build-confirm";
const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height });
const board = box(0, 0, 600, 400);
describe("confirmPlacement", () => {
  it("puts the buttons right of the cell, centred on its row", () => {
    expect(confirmPlacement(box(100, 100, 40, 40), board, 120, 44)).toEqual({ left: 146, top: 98 });
  });
  it("switches to the left side at the board's right edge", () => {
    expect(confirmPlacement(box(540, 100, 40, 40), board, 120, 44)).toEqual({ left: 414, top: 98 });
  });
  it("stays inside the board vertically", () => {
    expect(confirmPlacement(box(100, 0, 40, 20), board, 120, 44).top).toBe(0);
    expect(confirmPlacement(box(100, 390, 40, 10), board, 120, 44).top).toBe(356);
  });
});
