import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { MISSIONS } from "../content/missions";
import { TOWERS } from "../content/towers";
import { isPaged, pageOf, TOWER_PAGES, towerOrder } from "./tower-pages";
const page = (name: string) => TOWER_PAGES.findIndex((p) => p.name === name);
describe("tower menu pages", () => {
  it("sorts every tower into its category", () => {
    const byPage = TOWER_PAGES.map((_, i) => Object.values(TOWERS).filter((t) => pageOf(t) === i).map((t) => t.id));
    expect(byPage[page("Angriff")]).toEqual(["pulse", "blast", "flak", "tesla", "lance", "inferno", "decay", "focus", "mortar", "quake", "executioner", "shrapnel"]);
    expect(byPage[page("Kontrolle")]).toEqual(["frost", "stasis", "acid", "gravity", "jammer", "net"]);
    expect(byPage[page("Unterstützung")]).toEqual(["aura", "refinery", "detector", "beacon", "dock", "tracker"]);
  });
  it("orders the menu and hotkeys page by page", () => {
    const g = new Game(),
      order = towerOrder(g);
    expect(order).toHaveLength(Object.keys(TOWERS).length);
    expect(order.map((id) => pageOf(TOWERS[id]))).toEqual([...order.map((id) => pageOf(TOWERS[id]))].sort());
    expect(order.slice(0, 2)).toEqual(["pulse", "blast"]);
    expect(isPaged(g)).toBe(true);
  });
  it("lists only the mission's towers and skips tabs for a short list", () => {
    const g = new Game(MISSIONS.find((m) => m.id === "bunkerlinie")!);
    expect(towerOrder(g)).toEqual(["pulse", "blast", "flak", "frost"]);
    expect(isPaged(g)).toBe(false);
  });
});
