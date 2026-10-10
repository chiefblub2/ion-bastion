import { describe, expect, it } from "vitest";
import { Game } from "../core/game";
import { Match } from "../core/match";
import { renderPlayers, renderSends, versusOutcome } from "./players";
function siege(players = 3) {
  const m = new Match("siege", players, 0, new Game());
  m.command({ type: "mission", id: m.fields[0].mission.id, player: 0 });
  return m;
}
describe("multiplayer HUD", () => {
  it("lists partners' credits in co-op", () => {
    const g = new Game();
    g.setPlayers(3);
    g.command({ type: "restart" });
    const html = renderPlayers(g, { mode: "coop", players: 3, match: null }, 1);
    expect(html).toContain("Player 1");
    expect(html).toContain("Player 3");
    expect(html).not.toContain("Player 2");
  });
  it("shows opponents, the send target and the countdown in versus", () => {
    const m = siege();
    m.command({ type: "ready", player: 2 });
    const html = renderPlayers(m.fields[0], { mode: "siege", players: 3, match: m }, 0);
    expect(html).toContain("◎ Target");
    expect(html).toContain("Ready");
    expect(html).toContain("Next wave in <b>30 s</b> · 1/3 ready");
  });
  it("offers only affordable, unlocked enemies to send", () => {
    const m = siege(),
      options = m.sendOptions(0),
      disabled = (html: string) => html.match(/ disabled /g)?.length ?? 0;
    m.fields[0].state.wallets[0] = 100000;
    expect(disabled(renderSends(m, 0, false))).toBe(options.filter((o) => !o.unlocked).length);
    m.fields[0].state.wallets[0] = 0;
    expect(disabled(renderSends(m, 0, false))).toBe(options.length);
  });
  it("names the outcome for the local player", () => {
    const m = siege(2);
    expect(versusOutcome(m, 0)).toBeNull();
    m.fields[1].state.lives = 10000;
    while (!m.result) {
      m.command({ type: "ready", player: 0 });
      m.command({ type: "ready", player: 1 });
      m.tick();
    }
    expect(versusOutcome(m, 1)?.title).toBe("Victory.");
    expect(versusOutcome(m, 0)?.title).toBe("Defeat.");
    expect(versusOutcome(m, 0)?.copy).toMatch(/^1\. Player 2/);
  });
});
