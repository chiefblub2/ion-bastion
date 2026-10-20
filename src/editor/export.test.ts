import { describe, expect, it } from "vitest";
import { parseMap } from "../content/maps";
import { MISSIONS } from "../content/missions";
import { g, wave } from "../content/waves";
import { blankDraft, compileDraft, draftFromMission, type EditorDraft } from "./draft";
import { exportTypeScript } from "./export";

const evaluate = (d: EditorDraft) => {
  const code = exportTypeScript(d)
    .replace(/^export /gm, "")
    .replace(/^\{/m, "return {")
    .replace(/\},\s*$/, "}");
  return new Function("parseMap", "g", "wave", code)(parseMap, g, wave);
};

describe("exportTypeScript", () => {
  it("evaluates to the compiled mission", () => {
    const quoted = { ...blankDraft(), name: 'My "Quoted" Mission', focus: 'Say "hi"' };
    const drafts = [...MISSIONS.map(draftFromMission), quoted];
    for (const d of drafts) {
      const compiled = compileDraft(d);
      if (!compiled.ok) throw new Error(`${d.id}: ${compiled.errors.join("; ")}`);
      expect(evaluate(d), d.id).toEqual(compiled.mission);
    }
  });
});
