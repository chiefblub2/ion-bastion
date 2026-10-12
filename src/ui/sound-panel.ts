import type { Audio } from "../app/audio";
import { BUSES, type Bus } from "../audio/settings";
// The sound popover: on/off and four volumes, opened from the topbar or the home page.

const GAP = 8,
  GUTTER = 16;
/** Below the button if it fits, else above it, never past the screen gutter. */
export function panelTop(button: { top: number; bottom: number }, height: number, viewport: number) {
  const below = button.bottom + GAP;
  if (below + height <= viewport - GUTTER) return below;
  return Math.max(GUTTER, button.top - GAP - height);
}
export function bindSoundPanel(audio: Audio, notice: (text: string) => void) {
  const panel = document.getElementById("sound-panel")!,
    toggle = panel.querySelector<HTMLInputElement>("#sound-on")!,
    triggers = [...document.querySelectorAll<HTMLButtonElement>(".sound-trigger")],
    slider = (bus: Bus) => panel.querySelector<HTMLInputElement>(`[data-bus="${bus}"]`)!;
  let opener: HTMLButtonElement | null = null;
  const apply = (next: Parameters<Audio["update"]>[0]) => audio.update(next).catch(() => notice("Audio is not available in this browser."));
  function sync() {
    const s = audio.settings;
    toggle.checked = !s.muted;
    for (const bus of BUSES) {
      slider(bus).value = String(Math.round(s[bus] * 100));
      slider(bus).disabled = s.muted;
    }
    for (const t of triggers) t.textContent = s.muted ? "Sound off" : "Sound on";
  }
  function close() {
    panel.hidden = true;
    for (const t of triggers) t.setAttribute("aria-expanded", "false");
    opener?.focus();
    opener = null;
  }
  function open(t: HTMLButtonElement) {
    const r = t.getBoundingClientRect();
    panel.hidden = false;
    panel.style.top = `${panelTop(r, panel.offsetHeight, innerHeight)}px`;
    panel.style.right = `${Math.max(GUTTER, innerWidth - r.right)}px`;
    opener = t;
    t.setAttribute("aria-expanded", "true");
    toggle.focus();
  }
  for (const t of triggers)
    t.addEventListener("click", () => {
      if (panel.hidden) open(t);
      else close();
    });
  toggle.addEventListener("change", () => void apply({ muted: !toggle.checked }));
  panel.addEventListener("input", (e) => {
    const bus = (e.target as HTMLElement).dataset.bus as Bus | undefined;
    if (bus) void apply({ [bus]: Number((e.target as HTMLInputElement).value) / 100 });
  });
  panel.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    close();
  });
  document.addEventListener("pointerdown", (e) => {
    const target = e.target as Element;
    if (!panel.hidden && !panel.contains(target) && !target.closest(".sound-trigger")) close();
  });
  audio.onChange(sync);
  sync();
}
