import type { Game } from "../core/game";
import type { Command, CommandResult } from "../core/types";
export type DialogName = "help" | "restart" | "missions" | "coop";
/** Modal dialogs pause a running wave and resume it when closed; not in co-op, where `autoPause` is false. */
export function createDialogs(game: Game, execute: (c: Command) => CommandResult, autoPause: () => boolean = () => true) {
  const dialogs: Record<DialogName, HTMLDialogElement> = {
    help: document.getElementById("help-dialog") as HTMLDialogElement,
    restart: document.getElementById("restart-dialog") as HTMLDialogElement,
    missions: document.getElementById("mission-dialog") as HTMLDialogElement,
    coop: document.getElementById("coop-dialog") as HTMLDialogElement,
  };
  let resumeAfterDialog = false;
  for (const d of Object.values(dialogs))
    d.addEventListener("close", () => {
      if (resumeAfterDialog && game.state.paused) execute({ type: "pause" });
      resumeAfterDialog = false;
    });
  return {
    open(name: DialogName) {
      resumeAfterDialog = autoPause() && game.state.status === "wave" && !game.state.paused;
      if (resumeAfterDialog) execute({ type: "pause" });
      dialogs[name].showModal();
    },
    close(name: DialogName) {
      dialogs[name].close();
    },
    /** Closes without resuming, e.g. before the mission is replaced anyway. */
    dismiss(name: DialogName) {
      resumeAfterDialog = false;
      if (dialogs[name].open) dialogs[name].close();
    },
    anyOpen: () => Object.values(dialogs).some((d) => d.open),
  };
}
export type Dialogs = ReturnType<typeof createDialogs>;
