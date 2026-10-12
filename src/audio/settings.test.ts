import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, loadSettings, parseSettings } from "./settings";

describe("sound settings", () => {
  it("falls back to the defaults for missing or broken data", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{nope")).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.muted).toBe(true);
  });
  it("keeps valid values and clamps volumes to 0–1", () => {
    const s = parseSettings(JSON.stringify({ muted: false, master: 2, sfx: -1, ui: 0.3, music: "loud" }));
    expect(s).toEqual({ muted: false, master: 1, sfx: 0, ui: 0.3, music: DEFAULT_SETTINGS.music });
  });
  it("loads the defaults when storage is unavailable", () => {
    // Node has no localStorage, like a browser that blocks site data.
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
