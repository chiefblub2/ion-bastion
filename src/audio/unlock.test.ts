import { describe, expect, it } from "vitest";
import { unlockOnGesture } from "./unlock";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("unlockOnGesture", () => {
  it("retries on every gesture until the context really runs", async () => {
    const target = new EventTarget(),
      answers = [false, true];
    let calls = 0;
    unlockOnGesture(target, async () => answers[calls++]);
    target.dispatchEvent(new Event("touchend"));
    await flush();
    target.dispatchEvent(new Event("click"));
    await flush();
    target.dispatchEvent(new Event("keydown"));
    await flush();
    expect(calls).toBe(2);
  });
  it("ignores pointerdown, which grants no activation to a touch", async () => {
    const target = new EventTarget();
    let calls = 0;
    unlockOnGesture(target, async () => (calls++, true));
    target.dispatchEvent(new Event("pointerdown"));
    await flush();
    expect(calls).toBe(0);
  });
});
