import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { MISSIONS } from "../content/missions";
import { TOWERS } from "../content/towers";
import { hasPage, hotkeyTowers, isPaged, pageOf, TOWER_PAGES, towerOrder } from "./tower-pages";
const page = (name: string) => TOWER_PAGES.findIndex((p) => p.name === name);
describe("tower menu pages", () => {
  it("sorts every tower into its category", () => {
    const byPage = TOWER_PAGES.map((_, i) => Object.values(TOWERS).filter((t) => pageOf(t) === i).map((t) => t.id));
    expect(byPage[page("Attack")]).toEqual([
      "pulse", "blast", "flak", "skyburst", "tesla", "lance", "inferno", "decay", "focus", "mortar", "quake", "executioner", "shrapnel", "catalyst",
      // ── new towers: g1 (Attack+Control A) ──
      "orbital",
      // ── end g1 ──
    ]);
    expect(byPage[page("Control")]).toEqual([
      "frost", "stasis", "acid", "gravity", "jammer", "net", "plasma",
      // ── new towers: g1 (Attack+Control A) ──
      "mesmer", "amber", "magnetar", "cyclone",
      // ── end g1 ──
      // ── new towers: g2 (Control B) ──
      "tether", "shrink", "hex", "siphon",
      // ── end g2 ──
    ]);
    expect(byPage[page("Traps")]).toEqual([
      "mine", "spikes", "tar", "snare", "grill", "spring", "limpet", "pit", "tripwire",
      // ── new towers: g3 (Traps) ──
      "barricade", "warp", "arc", "oil", "grinder", "harpoon",
      // ── end g3 ──
    ]);
    expect(byPage[page("Support")]).toEqual([
      "aura", "refinery", "detector", "beacon", "dock", "tracker",
      // ── new towers: g4 (Support A) ──
      "overclock", "firectl", "armory", "skylink", "nexus",
      // ── end g4 ──
      // ── new towers: g5 (Support B) ──
      "workshop", "vault", "shieldgen", "recycler",
      // ── end g5 ──
    ]);
  });
  it("orders the menu and hotkeys page by page", () => {
    const g = new Game(),
      order = towerOrder(g);
    expect(order).toHaveLength(Object.keys(TOWERS).length);
    expect(order.map((id) => pageOf(TOWERS[id]))).toEqual([...order.map((id) => pageOf(TOWERS[id]))].sort());
    expect(order.slice(0, 2)).toEqual(["pulse", "blast"]);
    expect(isPaged(g)).toBe(true);
  });
  it("numbers the towers of every tab from 1 again", () => {
    const g = new Game();
    expect(hotkeyTowers(g, page("Attack"))[0]).toBe("pulse");
    expect(hotkeyTowers(g, page("Control"))[0]).toBe("frost");
    expect(hotkeyTowers(g, page("Traps"))[0]).toBe("mine");
    expect(hotkeyTowers(g, page("Support"))[0]).toBe("aura");
    expect(hotkeyTowers(g, page("Attack"))).toHaveLength(Object.values(TOWERS).filter((t) => pageOf(t) === page("Attack")).length);
    // Without tabs the keys run over every tower, whatever page is open.
    const short = new Game(MISSIONS.find((m) => m.id === "bunkerlinie")!);
    expect(hotkeyTowers(short, page("Control"))).toEqual(towerOrder(short));
  });
  it("knows which tabs a mission shows", () => {
    const rift = new Game(MISSIONS.find((m) => m.availableTowers?.length === 10)!);
    expect([0, 1, 2, 3].map((i) => hasPage(rift, i))).toEqual([true, true, false, false]);
  });
  it("lists only the mission's towers and skips tabs for a short list", () => {
    const g = new Game(MISSIONS.find((m) => m.id === "bunkerlinie")!);
    expect(towerOrder(g)).toEqual(["pulse", "blast", "flak", "frost"]);
    expect(isPaged(g)).toBe(false);
  });
});
