import type { Game } from "../core/game";
import type { TowerId } from "../core/types";
import { pageOf } from "../core/tower-pages";
export { pageOf };
/** Category tabs of the build menu, in display order. */
export const TOWER_PAGES = [
  { id: "attack", name: "Attack" },
  { id: "control", name: "Control" },
  { id: "trap", name: "Traps" },
  { id: "support", name: "Support" },
] as const;
/** With fewer available towers the menu shows them all, without tabs. */
export const PAGED_FROM = 10;
/** The mission's towers grouped by page, otherwise in content order; menu order and hotkeys follow it. */
export function towerOrder(game: Game): TowerId[] {
  const towers = game.content.towers;
  // Array.prototype.sort is stable, so content order holds within a page.
  return game.availableTowers().sort((a, b) => pageOf(towers[a]) - pageOf(towers[b]));
}
/** Whether the mission has enough towers to split the menu into tabs. */
export const isPaged = (game: Game) => game.availableTowers().length >= PAGED_FROM;
/** Towers the number keys pick from: with tabs only the open page, numbered from 1 again; otherwise all of them. */
export function hotkeyTowers(game: Game, page: number): TowerId[] {
  const order = towerOrder(game);
  return isPaged(game) ? order.filter((id) => pageOf(game.content.towers[id]) === page) : order;
}
/** Whether a page has any of the mission's towers, i.e. whether its tab is shown. */
export const hasPage = (game: Game, page: number) => towerOrder(game).some((id) => pageOf(game.content.towers[id]) === page);
/**
 * Whether the sidebar's build menu is folded away: while a tower or enemy is selected and no tower is being
 * placed, unless the player opened it by hand (`opened`).
 */
export const menuCollapsed = (view: { build: TowerId | null; selected: number | null; enemy: number | null }, opened: boolean) =>
  !opened && view.build === null && (view.selected !== null || view.enemy !== null);
