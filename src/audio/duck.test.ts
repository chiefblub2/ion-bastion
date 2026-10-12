import { describe, expect, it } from "vitest";
import { addDuck } from "./duck";

describe("addDuck", () => {
  it("merges overlapping ducks, so one's recovery never cuts into the next", () => {
    expect(addDuck([{ start: 1, end: 1.6 }], { start: 1.3, end: 1.9 }, 0)).toEqual([{ start: 1, end: 1.9 }]);
  });
  it("keeps a later stinger's duck when an earlier one is added afterwards", () => {
    expect(addDuck([{ start: 3, end: 3.6 }], { start: 1, end: 1.6 }, 0)).toEqual([
      { start: 1, end: 1.6 },
      { start: 3, end: 3.6 },
    ]);
  });
  it("drops ducks that are over", () => {
    expect(addDuck([{ start: 1, end: 1.6 }], { start: 5, end: 5.6 }, 2)).toEqual([{ start: 5, end: 5.6 }]);
  });
});
