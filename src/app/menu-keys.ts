import type { Game } from "../core/game";
import { bindCodexPreviews } from "../ui/codex-preview";
import type { CodexTab } from "../ui/enemy-codex";
import { renderCodex, renderTowerCodexPage } from "../ui/interface";
import { rovingKeys } from "./roving-keys";

/** Switches the enemy codex to another tab and keeps the focus on the tab bar. */
export function showCodexTab(game: Game, tab: CodexTab) {
  renderCodex(game, tab);
  document.getElementById(`codex-tab-${tab}`)?.focus();
}
/** Switches the tower codex to another category and keeps the focus on its tab. */
export function showTowerCodex(game: Game, page: number) {
  renderTowerCodexPage(game, page);
  document.getElementById(`tower-codex-tab-${page}`)?.focus({ preventScroll: true });
}
interface MenuKeysDeps {
  game: Game;
  /** Features a mission in the atlas without loading it. */
  pickMission: (id: string) => void;
  /** Switches the atlas to the sector `index` and keeps the focus on the bar `bar`. */
  showSector: (index: number, bar: string) => void;
}
/**
 * The keyboard of the codices and the atlas: arrow keys, Home and End move between the codex tabs, the missions of
 * the shown sector and the tabs of the mode and sector bars.
 */
export function bindMenuKeys({ game, pickMission, showSector }: MenuKeysDeps) {
  rovingKeys(document.getElementById("tower-codex-tabs")!, "[data-tower-codex]", (tab) => showTowerCodex(game, Number(tab.dataset.towerCodex)), { scope: document });
  bindCodexPreviews(document.getElementById("codex-list")!);
  rovingKeys(document.getElementById("codex-tabs")!, "[data-codex-tab]", (tab) => showCodexTab(game, tab.dataset.codexTab as CodexTab), { scope: document });
  // The missions of the sector: the one reached is featured.
  rovingKeys(
    document.getElementById("mission-list")!,
    "[data-pick]",
    (node) => {
      pickMission(node.dataset.pick!);
      node.focus({ preventScroll: true });
    },
    { vertical: true },
  );
  // Game modes or the sector cards of a mode.
  for (const bar of ["mission-modes", "sector-tabs"])
    rovingKeys(document.getElementById(bar)!, "[data-sector]", (tab) => showSector(Number(tab.dataset.sector), bar), { vertical: true });
}
