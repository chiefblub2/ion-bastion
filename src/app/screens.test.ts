import { describe, expect, it } from "vitest";
import { MISSIONS } from "../content/missions";
import { GAME, HOME, screenFromUrl, urlOf } from "./screens";

describe("screen URLs", () => {
  const id = MISSIONS[2].id;
  it("opens the game for a valid deep link, extras included", () => {
    expect(screenFromUrl(`?mission=${id}&wave=3&credits=900`, "", MISSIONS)).toEqual(GAME);
  });
  it("falls back to the menu for an unknown mission", () => {
    expect(screenFromUrl("?mission=nirgendwo", "", MISSIONS)).toEqual(HOME);
  });
  it("reads menu pages from the hash and ignores unknown ones", () => {
    expect(screenFromUrl("", "#missionen", MISSIONS)).toEqual({ view: "menu", page: "missions" });
    expect(screenFromUrl("", "#gegnerakte", MISSIONS)).toEqual({ view: "menu", page: "codex" });
    expect(screenFromUrl("", "#unbekannt", MISSIONS)).toEqual(HOME);
  });
  it("round-trips every screen", () => {
    for (const screen of [HOME, GAME, ...(["missions", "coop", "codex", "help"] as const).map((page) => ({ view: "menu" as const, page }))]) {
      const url = new URL(urlOf(screen, id, "/game/"), "http://localhost");
      expect(url.pathname).toBe("/game/");
      expect(screenFromUrl(url.search, url.hash, MISSIONS)).toEqual(screen);
    }
  });
});
