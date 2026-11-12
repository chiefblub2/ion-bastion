import type { Game } from "../core/game";
import type { ViewState } from "../render/scene";
import type { MultiplayerSession } from "./players";
import { playerName } from "./players";
import { cardTower, towerCardHtml } from "./tower-card";
import { type CardPlacement, placeTowerCard } from "./tower-card-place";
/** Phones in landscape (the full-screen layout's media query) get the slim card. */
const PHONE = "(orientation: landscape) and (max-height: 540px)";
/** Boards narrower than this get the slim card too. */
const SLIM_BOARD = 560;
/** The attributes that name a control on the card, so focus can return to it after a rewrite. */
const CONTROLS = ["data-upgrade", "data-card-open", "data-priority", "data-priority-cycle", "data-sell", "data-deselect"];
/**
 * The selected tower's action card on the board (`#tower-card` in `#board-wrap`). Follows `view.selected`, renders
 * only when its content changes and places itself beside the tower. Reads state only; its buttons reach the game
 * through the click handler in `app/game-input.ts`, except the slim accordion, whose open option is this view's own.
 */
export class TowerCard {
  private el = document.getElementById("tower-card")!;
  private board = document.getElementById("board")!;
  private html = "";
  private phone = matchMedia(PHONE);
  /** Slim card: the choice whose details are open, for the tower `openFor`. */
  private open: string | undefined;
  private openFor: number | undefined;
  /**
   * After an accordion tap the card keeps where it floats and is only clamped back into the board, so it never jumps
   * from under the finger; any other change (a purchase, another tower, zoom, resize) places it afresh.
   */
  private held: { key: string; p: Extract<CardPlacement, { mode: "float" }>; height: number } | undefined;
  private last: CardPlacement | undefined;
  /** What the card was last placed for (`place`). */
  private placed = "";
  constructor(
    private game: Game,
    private view: ViewState,
    private session: () => MultiplayerSession | null,
    /** Page rectangle of a cell through the player's zoom (`Battlefield.cellRect`). */
    private cellRect: (cell: { x: number; y: number }) => DOMRect | null = () => null,
  ) {
    // A press on the card stays on the card; the board never builds or selects underneath it.
    this.el.addEventListener("pointerdown", (e) => e.stopPropagation());
    this.el.addEventListener("click", (e) => {
      const head = (e.target as Element).closest<HTMLElement>("[data-card-open]");
      if (!head) return;
      const id = head.dataset.cardOpen!;
      this.open = this.open === id ? undefined : id;
      this.held = this.last?.mode === "float" ? { key: this.holdKey(), p: this.last, height: this.el.offsetHeight } : undefined;
      this.refresh();
    });
    const replace = () => {
      this.held = undefined;
      this.placed = "";
      this.place();
    };
    addEventListener("resize", replace);
    document.addEventListener("fullscreenchange", () => requestAnimationFrame(replace));
  }
  refresh() {
    const s = this.game.state,
      t = cardTower(s, this.view.selected, this.over()),
      inGame = document.documentElement.dataset.view === "game";
    this.el.hidden = !t || !inGame;
    if (!t || !inGame) {
      this.html = "";
      this.placed = "";
      return;
    }
    if (this.openFor !== t.id) {
      this.openFor = t.id;
      this.open = undefined;
      this.held = undefined;
    }
    const session = this.session(),
      credits = (session?.match ? s.wallets[0] : s.wallets[this.view.player]) ?? 0,
      slim = this.phone.matches || this.board.clientWidth < SLIM_BOARD,
      owner = session && !session.match && t.owner !== this.view.player ? playerName(t.owner) : undefined;
    const html = towerCardHtml(t, s.towers, { credits, slim, owner, open: slim ? this.open : undefined }, this.game.content);
    if (html !== this.html) {
      // The rewrite replaces every button; focus returns to the one that names the same control.
      const focused = this.el.contains(document.activeElement) ? (document.activeElement as HTMLElement) : null,
        attr = focused && CONTROLS.find((a) => focused.hasAttribute(a)),
        value = attr && focused!.getAttribute(attr);
      this.html = html;
      this.el.classList.toggle("slim", slim);
      this.el.innerHTML = html;
      if (attr) this.el.querySelector<HTMLElement>(`[${attr}${value ? `="${CSS.escape(value)}"` : ""}]`)?.focus({ preventScroll: true });
    }
    this.place();
  }
  /** A versus match with a result: its overlay covers the board. */
  private over() {
    return !!this.session()?.match?.result;
  }
  /** What must stay the same for a held placement to stay valid. */
  private holdKey() {
    const t = cardTower(this.game.state, this.view.selected, this.over());
    return [t?.id, t?.upgrades.length, this.view.zoomed, this.board.clientWidth, this.board.clientHeight].join("|");
  }
  /**
   * Beside the tower where it covers the least path, else above or below it, else docked to a board edge. Runs only
   * when the card's content, the board or the zoom changed, so a docked or held card keeps its scroll position.
   */
  private place() {
    const t = cardTower(this.game.state, this.view.selected, this.over());
    if (!t || this.el.hidden) return;
    const { map } = this.game;
    const width = this.board.clientWidth,
      height = this.board.clientHeight,
      left = this.board.offsetLeft,
      top = this.board.offsetTop;
    if (this.held && this.held.key !== this.holdKey()) this.held = undefined;
    // Zoomed in, the board grid no longer matches the screen: dock along the edge away from the tower.
    const cell = this.view.zoomed ? this.cellRect(t) : null,
      board = this.board.getBoundingClientRect(),
      edge: "top" | "bottom" = cell && cell.top + cell.height / 2 > board.top + board.height / 2 ? "top" : "bottom",
      key = [t.id, t.x, t.y, this.html, this.el.classList.contains("slim"), this.view.zoomed && edge, width, height, left, top, !!this.held].join("|");
    if (key === this.placed) return;
    this.placed = key;
    this.el.classList.remove("dock-top", "dock-bottom");
    this.el.style.width = "";
    this.el.style.maxHeight = "";
    const card = { width: this.el.offsetWidth, height: this.el.offsetHeight };
    let p: CardPlacement;
    if (this.view.zoomed) p = { mode: "dock", edge };
    else if (this.held) {
      // Above the tower the card grows upwards, elsewhere downwards; either way it stays inside the board, and a
      // card taller than the board scrolls in place.
      const h = Math.min(card.height, height);
      if (card.height > height) this.el.style.maxHeight = `${height}px`;
      p = { ...this.held.p, y: Math.max(0, Math.min(this.held.p.y + (this.held.p.side === "above" ? this.held.height - h : 0), height - h)) };
    } else p = placeTowerCard({ board: { width, height }, columns: map.columns, rows: map.rows, cell: t, card, path: map.path });
    this.last = p;
    // The board can sit inset in its wrapper (full screen centres it); the card is positioned in the wrapper.
    if (p.mode === "dock") {
      this.el.classList.add(`dock-${p.edge}`);
      this.el.style.width = `${width}px`;
      // A docked card taller than the board scrolls instead of hanging off it.
      this.el.style.maxHeight = `${height}px`;
      this.el.style.transform = `translate(${left}px, ${p.edge === "top" ? top : top + height - this.el.offsetHeight}px)`;
    } else {
      this.el.style.transform = `translate(${Math.round(left + p.x)}px, ${Math.round(top + p.y)}px)`;
    }
  }
}
