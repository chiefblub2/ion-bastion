import { describe, expect, it } from "vitest";
import { parseGraphics } from "./graphics-settings";

describe("graphics settings", () => {
  it("starts with bloom on a desktop and off on a touch device", () => {
    expect(parseGraphics(null, false).glow).toBe(true);
    expect(parseGraphics(null, true).glow).toBe(false);
  });

  it("keeps a saved choice and ignores broken data", () => {
    expect(parseGraphics('{"glow":false}', false).glow).toBe(false);
    expect(parseGraphics('{"glow":true}', true).glow).toBe(true);
    expect(parseGraphics("{oops", false).glow).toBe(true);
    expect(parseGraphics('{"glow":"yes"}', true).glow).toBe(false);
  });
});
