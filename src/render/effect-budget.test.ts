import { describe, expect, it } from "vitest";
import { evictFor } from "./effect-budget";

const fx = (type: string, label?: string) => ({ event: { type }, label });
describe("effect budget", () => {
  it("evicts nothing under the cap, then the oldest of the same type", () => {
    const list = [fx("shot"), fx("kill"), fx("shot")];
    expect(evictFor(list, "kill", 4)).toBeUndefined();
    expect(evictFor(list, "kill", 3)?.event.type).toBe("kill");
    expect(list.map((f) => f.event.type)).toEqual(["shot", "shot"]);
  });
  it("spares labelled effects when no effect of the type is live", () => {
    const list = [fx("income", "+5"), fx("shot")];
    expect(evictFor(list, "pulse", 2)?.event.type).toBe("shot");
    expect(list).toHaveLength(1);
  });
});
