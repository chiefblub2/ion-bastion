import { describe, expect, it } from "vitest";
import { panelTop } from "./sound-panel";

describe("panelTop", () => {
  it("opens below the button when it fits", () => {
    expect(panelTop({ top: 20, bottom: 50 }, 200, 800)).toBe(58);
  });
  it("opens above the button near the bottom edge", () => {
    expect(panelTop({ top: 685, bottom: 725 }, 200, 800)).toBe(477);
  });
  it("keeps the 16 px gutter when neither side fits", () => {
    expect(panelTop({ top: 100, bottom: 140 }, 300, 390)).toBe(16);
  });
});
