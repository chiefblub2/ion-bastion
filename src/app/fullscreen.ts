/**
 * Full screen for the whole app, so the sidebar stays usable. The layout
 * reacts to the `is-fullscreen` class on <html>; `onChange` lets the
 * battlefield refit its canvas once the new layout is in place.
 */
/** Keyboard Lock API (Chromium); not yet part of the TypeScript DOM types. */
type KeyboardLock = { lock?: (keys: string[]) => Promise<void>; unlock?: () => void };
const keyboard = () => (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard;
export function bindFullscreen(onChange: () => void) {
  const root = document.documentElement,
    button = document.getElementById("fullscreen-btn") as HTMLButtonElement;
  const supported = document.fullscreenEnabled && typeof root.requestFullscreen === "function";
  button.hidden = !supported;
  const sync = () => {
    const on = !!document.fullscreenElement;
    // A short Esc then reaches the game (cancel build mode); holding Esc still
    // leaves full screen. Browsers without Keyboard Lock exit on the first Esc.
    if (on) keyboard()?.lock?.(["Escape"]).catch(() => {});
    else keyboard()?.unlock?.();
    root.classList.toggle("is-fullscreen", on);
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute("aria-label", on ? "Vollbild beenden (F)" : "Vollbild (F)");
    button.title = on ? "Vollbild beenden (F)" : "Vollbild (F)";
    requestAnimationFrame(onChange);
  };
  document.addEventListener("fullscreenchange", sync);
  return {
    supported,
    isActive: () => !!document.fullscreenElement,
    /** Rejects when the browser refuses, e.g. without a user gesture. */
    async toggle() {
      if (!supported) throw new Error("Vollbild wird nicht unterstützt.");
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.requestFullscreen({ navigationUI: "hide" });
    },
  };
}
