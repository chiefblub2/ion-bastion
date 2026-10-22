import { describe, expect, it } from "vitest";
import { blankDraft } from "./draft";
import { keepTarget, withDraft, withoutDraft } from "./storage";

const edited = { ...blankDraft(10, 8), name: "Mine" };
const other = { ...blankDraft(10, 8), id: "other", name: "Other" };

describe("keepTarget", () => {
  it("ignores an untouched blank draft", () => {
    expect(keepTarget(blankDraft(10, 8), other, [])).toBeUndefined();
  });
  it("ignores a draft equal to its saved copy", () => {
    expect(keepTarget(edited, other, [edited])).toBeUndefined();
  });
  it("keeps an edited draft under its own id when nothing clashes", () => {
    expect(keepTarget(edited, other, [])).toEqual(edited);
  });
  it("saves beside a different saved copy with the same id", () => {
    const saved = { ...edited, startingCredits: edited.startingCredits + 1 };
    expect(keepTarget(edited, other, [saved])).toEqual({ ...edited, id: `${edited.id}-2`, name: "Mine (2)" });
  });
  it("takes the next free suffix", () => {
    const saved = { ...edited, startingCredits: edited.startingCredits + 1 };
    const taken = { ...edited, id: `${edited.id}-2`, name: "Mine (2)" };
    expect(keepTarget(edited, other, [saved, taken])).toEqual({ ...edited, id: `${edited.id}-3`, name: "Mine (3)" });
  });
  it("suffixes when the incoming draft has the same id", () => {
    expect(keepTarget(edited, { ...other, id: edited.id }, [])).toEqual({ ...edited, id: `${edited.id}-2`, name: "Mine (2)" });
  });
});

describe("stored draft list", () => {
  const future = { version: 2, id: "future", name: "From a newer build" };
  it("keeps entries it cannot read when saving and deleting", () => {
    const saved = withDraft([future], edited);
    expect(saved).toEqual([future, edited]);
    expect(withDraft(saved, { ...edited, name: "Renamed" })).toEqual([future, { ...edited, name: "Renamed" }]);
    expect(withoutDraft(saved, edited.id)).toEqual([future]);
  });
});
