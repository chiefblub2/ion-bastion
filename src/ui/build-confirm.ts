import type { Game } from "../core/game";
import type { Point } from "../core/types";
import type { ViewState } from "../render/scene";
/** Space between the cell and the buttons, in CSS pixels. */
const GAP = 6;
interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}
/**
 * Where the ✓/✕ group goes: right of the cell, or left of it when it would leave the board,
 * centred on the cell's row and clamped inside the board.
 */
export function confirmPlacement(cell: Box, board: Box, w: number, h: number): { left: number; top: number } {
  const right = cell.right + GAP,
    left = right + w <= board.right ? right : Math.max(board.left, cell.left - GAP - w),
    top = Math.max(board.top, Math.min(board.bottom - h, cell.top + cell.height / 2 - h / 2));
  return { left: Math.round(left), top: Math.round(top) };
}
/** Touch only: the ✓ Build and ✕ buttons beside the tapped cell (`ViewState.pending`). */
export class BuildConfirm {
  private el = document.getElementById("build-confirm")!;
  private key = "";
  constructor(
    private game: Game,
    private view: ViewState,
    /** Page rectangle of a board cell; null while the board is not laid out. */
    private cellRect: (cell: Point) => DOMRect | null,
    actions: { confirm: () => void; cancel: () => void },
  ) {
    this.el.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-confirm]");
      if (b?.dataset.confirm === "build") actions.confirm();
      else if (b) actions.cancel();
    });
    addEventListener("resize", () => this.place());
    addEventListener("scroll", () => this.place(), { passive: true });
  }
  refresh() {
    const { pending, build } = this.view,
      status = this.game.state.status,
      show = !!pending && !!build && status !== "won" && status !== "lost" && document.documentElement.dataset.view === "game";
    this.el.hidden = !show;
    if (!show) return;
    const d = this.game.content.towers[build],
      key = `${build}|${d.cost}`;
    if (key !== this.key) {
      this.key = key;
      this.el.innerHTML = `<button class="primary" data-confirm="build" aria-label="Build ${d.name} for ${d.cost} credits">✓ <span>◇ ${d.cost}</span></button><button class="quiet" data-confirm="cancel" aria-label="Cancel">✕</button>`;
    }
    this.place();
  }
  private place() {
    const cell = this.view.pending;
    if (!cell || this.el.hidden) return;
    const rect = this.cellRect(cell);
    if (!rect) return;
    const board = document.getElementById("board")!.getBoundingClientRect(),
      { left, top } = confirmPlacement(rect, board, this.el.offsetWidth, this.el.offsetHeight);
    this.el.style.transform = `translate(${left}px, ${top}px)`;
  }
}
