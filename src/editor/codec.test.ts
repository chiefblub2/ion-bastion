import { describe, expect, it } from "vitest";
import { MISSIONS } from "../content/missions";
import { decodeDraft, encodeDraft, shareUrl } from "./codec";
import { blankDraft, draftFromMission } from "./draft";

const b64 = (s: string) => btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");

describe("share codec", () => {
  it("round-trips", () => {
    const circle = MISSIONS.find((m) => m.circle)!;
    const ring = { ...draftFromMission(circle), name: 'ü"<' };
    for (const d of [blankDraft(), ring]) expect(decodeDraft(encodeDraft(d))).toEqual(d);
  });

  it("the code is URL-safe", () => {
    const d = { ...blankDraft(), name: 'ü"<>?~' };
    expect(encodeDraft(d)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(shareUrl(d, "https://x.test/")).toBe(`https://x.test/?draft=${encodeDraft(d)}#editor`);
  });

  it("decodeDraft rejects garbage", () => {
    const code = encodeDraft(blankDraft());
    const d = blankDraft();
    const enc = (o: unknown) => b64(JSON.stringify(o));
    for (const bad of [
      "garbage",
      "",
      code.slice(0, code.length / 2),
      enc({ version: 2 }),
      enc({ ...d, sketch: [d.sketch[0], d.sketch[1].slice(1), ...d.sketch.slice(2)] }),
      enc({ ...d, sketch: d.sketch.map((r, i) => (i === 0 ? "X" + r.slice(1) : r)) }),
      enc({ ...d, theme: "nope" }),
      enc({ ...d, startingCredits: null }),
    ])
      expect(decodeDraft(bad)).toBeUndefined();
  });
});
