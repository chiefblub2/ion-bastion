import type { Game } from "../core/game";
import type { Command, Point } from "../core/types";
import type { ViewState } from "../render/scene";
import { coachRefusal, coachStep, freshMemory, type CoachStep } from "./coach";
/** Gap in pixels between the bubble and what it points at. */
const GAP = 12;
/** Space kept free along the window's edges. */
const EDGE = 16;
/**
 * The Training coach on screen: one bubble (`#coach`) beside the element or board cell the current step is about,
 * an outline on that element and the board highlight (`ViewState.highlight`). Reads state only.
 */
export class Coach {
  private memory = freshMemory();
  private el = document.getElementById("coach")!;
  private key = "";
  private marked: Element | null = null;
  private step: CoachStep | null = null;
  constructor(
    private game: Game,
    private view: ViewState,
    /** Page rectangle of a board cell; null while the board is not laid out. */
    private cellRect: (cell: Point) => DOMRect | null,
  ) {
    this.el.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-coach]");
      if (!b || !this.step) return;
      if (b.dataset.coach === "next") this.memory.acked.add(this.step.id);
      else this.memory.skipped = true;
      this.refresh();
    });
    addEventListener("resize", () => this.place());
    addEventListener("scroll", () => this.place(), { passive: true });
  }
  /** A new mission or a restart starts the coaching over. */
  reset() {
    this.memory = freshMemory();
    this.refresh();
  }
  /** Null when the command may run, else why the coach holds it back (only the wave start, before its step). */
  refusal(command: Pick<Command, "type">) {
    return coachRefusal(coachStep(this.game, this.view, this.memory), command);
  }
  refresh() {
    const inGame = document.documentElement.dataset.view === "game",
      step = coachStep(this.game, this.view, this.memory);
    this.step = step;
    this.view.highlight = step?.highlight;
    this.el.hidden = !step || !inGame;
    const key = step ? `${step.id}|${step.title}|${step.text}` : "";
    if (key !== this.key) {
      this.key = key;
      if (step)
        this.el.innerHTML = `<p class="coach-kicker">TRAINING</p><h3>${step.title}</h3><p>${step.text}</p><div class="coach-actions">${step.ack ? `<button class="primary" data-coach="next">${step.id === "speed" ? "Got it" : "Next"} <span>→</span></button>` : ""}<button class="quiet coach-skip" data-coach="skip">Skip training</button></div>`;
    }
    const target = step?.target && "el" in step.target && inGame ? document.querySelector(step.target.el) : null;
    if (target !== this.marked) {
      this.marked?.classList.remove("coach-target");
      target?.classList.add("coach-target");
      this.marked = target;
    }
    this.place();
  }
  /** Puts the bubble below its target, or above it when there is no room; without a target, over the board's top. */
  private place() {
    const step = this.step;
    if (!step || this.el.hidden) return;
    const t = step.target,
      rect = !t ? null : "el" in t ? (this.marked?.getBoundingClientRect() ?? null) : this.cellRect(t.cell),
      board = document.getElementById("board")!.getBoundingClientRect(),
      w = this.el.offsetWidth,
      h = this.el.offsetHeight,
      anchor = rect && rect.width ? rect : new DOMRect(board.left, board.top + EDGE, board.width, 0);
    let top = anchor.bottom + GAP;
    if (top + h > innerHeight - EDGE && anchor.top - GAP - h >= EDGE) top = anchor.top - GAP - h;
    const left = Math.max(EDGE, Math.min(innerWidth - EDGE - w, anchor.left + anchor.width / 2 - w / 2));
    top = Math.max(EDGE, Math.min(innerHeight - EDGE - h, top));
    this.el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    this.el.dataset.side = top < anchor.top ? "above" : "below";
  }
}
