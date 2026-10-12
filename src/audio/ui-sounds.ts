import type { Audio } from "../app/audio";
// Clicks and hover ticks on menu and HUD controls; the board's canvas is not a control and stays silent.

const CONTROLS = "button:not(:disabled), [role='tab'], a[href]";
export function bindUiSounds(audio: Audio) {
  let hovered: Element | null = null;
  document.addEventListener("click", (e) => {
    if ((e.target as Element).closest?.(CONTROLS)) audio.cue("click");
  }, true);
  document.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return;
    const control = (e.target as Element).closest?.(CONTROLS) ?? null;
    if (control && control !== hovered) audio.cue("hover");
    hovered = control;
  }, true);
}
