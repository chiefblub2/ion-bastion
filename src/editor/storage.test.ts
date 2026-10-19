import { describe, expect, it } from "vitest";
import { blankDraft } from "./draft";
import { hasUnsavedWork } from "./storage";

describe("hasUnsavedWork", () => {
  it("ignores an untouched blank draft", () => {
    expect(hasUnsavedWork(blankDraft(10, 8), [])).toBe(false);
  });
  it("flags an edited draft with no saved copy", () => {
    expect(hasUnsavedWork({ ...blankDraft(10, 8), name: "Edited" }, [])).toBe(true);
  });
  it("compares against the saved copy with the same id", () => {
    const d = { ...blankDraft(10, 8), name: "Mine" };
    expect(hasUnsavedWork(d, [d])).toBe(false);
    expect(hasUnsavedWork({ ...d, startingCredits: d.startingCredits + 1 }, [d])).toBe(true);
  });
});
