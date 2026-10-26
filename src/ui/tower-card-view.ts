import type { Game } from "../core/game";
import type { ViewState } from "../render/scene";
import type { MultiplayerSession } from "./players";
import { playerName } from "./players";
import { cardChoices, cardTower, towerCardHtml } from "./tower-card";
import { type CardPlacement, placeTowerCard } from "./tower-card-place";
/** Phones in landscape (the full-screen layout's media query) get the slim card. */
const PHONE = "(orientation: landscape) and (max-height: 540px)";
/** Boards narrower than this get the slim card too. */
const SLIM_BOARD = 560;
/**
 * The selected tower's action card on the board (`#tower-card` in `#board-wrap`). Follows `view.selected`, renders
 * only when its content changes and places itself beside the tower. Reads state only; its buttons reach the game
 * through the click handler in `app/input.ts`.
 */
export class TowerCard {
  private el = document.getElementById("tower-card")!;
  private board = document.getElementById("board")!;
  private key = "";
  private phone = matchMedia(PHONE);
  constructor(
    private game: Game,
    private view: ViewState,
    private session: () => MultiplayerSession | null,
    /** Page rectangle of a cell through the player's zoom (`Battlefield.cellRect`). */
    private cellRect: (cell: { x: number; y: number }) => DOMRect | null = () => null,
  ) {
    // A press on the card stays on the card; the board never builds or selects underneath it.
    this.el.addEventListener("pointerdown", (e) => e.stopPropagation());
    addEventListener("resize", () => this.place());
    document.addEventListener("fullscreenchange", () => requestAnimationFrame(() => this.place()));
  }
  refresh() {
    const s = this.game.state,
      t = cardTower(s, this.view.selected, this.over()),
      inGame = document.documentElement.dataset.view === "game";
    this.el.hidden = !t || !inGame;
    if (!t || !inGame) {
      this.key = "";
      return;
    }
    const session = this.session(),
      credits = (session?.match ? s.wallets[0] : s.wallets[this.view.player]) ?? 0,
      slim = this.phone.matches || this.board.clientWidth < SLIM_BOARD,
      owner = session && !session.match && t.owner !== this.view.player ? playerName(t.owner) : undefined,
      choices = cardChoices(t, s.towers, credits, this.game.content);
    const key = [t.id, t.upgrades.join(","), t.priority, slim, owner, t.spent, choices.map((c) => `${c.id}:${c.price}:${c.disabled}:${c.changes.map((v) => v.after).join("/")}`).join(",")].join("|");
    if (key !== this.key) {
      this.key = key;
      this.el.classList.toggle("slim", slim);
      this.el.innerHTML = towerCardHtml(t, s.towers, { credits, slim, owner }, this.game.content);
    }
    this.place();
  }
  /** A versus match with a result: its overlay covers the board. */
  private over() {
    return !!this.session()?.match?.result;
  }
  /** Beside the tower where it covers the least path, else above or below it, else docked to a board edge. */
  private place() {
    const t = cardTower(this.game.state, this.view.selected, this.over());
    if (!t || this.el.hidden) return;
    const { map } = this.game;
    this.el.classList.remove("dock-top", "dock-bottom");
    this.el.style.width = "";
    // Zoomed in, the board grid no longer matches the screen: dock along the edge away from the tower.
    const cell = this.view.zoomed ? this.cellRect(t) : null,
      board = this.board.getBoundingClientRect(),
      p: CardPlacement = this.view.zoomed
        ? { mode: "dock", edge: cell && cell.top + cell.height / 2 > board.top + board.height / 2 ? "top" : "bottom" }
        : placeTowerCard({
            board: { width: this.board.clientWidth, height: this.board.clientHeight },
            columns: map.columns,
            rows: map.rows,
            cell: t,
            card: { width: this.el.offsetWidth, height: this.el.offsetHeight },
            path: map.path,
          });
    // The board can sit inset in its wrapper (full screen centres it); the card is positioned in the wrapper.
    const left = this.board.offsetLeft,
      top = this.board.offsetTop;
    if (p.mode === "dock") {
      this.el.classList.add(`dock-${p.edge}`);
      this.el.style.width = `${this.board.clientWidth}px`;
      this.el.style.transform = `translate(${left}px, ${p.edge === "top" ? top : top + this.board.clientHeight - this.el.offsetHeight}px)`;
    } else {
      this.el.style.width = "";
      this.el.style.transform = `translate(${Math.round(left + p.x)}px, ${Math.round(top + p.y)}px)`;
    }
  }
}
