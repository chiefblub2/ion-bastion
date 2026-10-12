/**
 * Full screen for the whole app, so the sidebar stays usable. The layout
 * reacts to the `is-fullscreen` class on <html>; `onChange` lets the
 * battlefield refit its canvas once the new layout is in place.
 *
 * Without the Fullscreen API (iPhone Safari, some webviews) or when the
 * browser refuses it, an immersive mode applies the same layout inside the
 * normal viewport (`is-immersive`); launched from the home screen
 * (manifest.webmanifest) there are no browser bars around it either.
 */
/** Keyboard Lock API (Chromium); not yet part of the TypeScript DOM types. */
type KeyboardLock = { lock?: (keys: string[]) => Promise<void>; unlock?: () => void };
const keyboard = () => (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard;
export function bindFullscreen(onChange: () => void) {
  const root = document.documentElement,
    button = document.getElementById("fullscreen-btn") as HTMLButtonElement;
  const native = document.fullscreenEnabled && typeof root.requestFullscreen === "function";
  let immersive = false;
  const isActive = () => !!document.fullscreenElement || immersive;
  const sync = () => {
    const on = isActive();
    // A short Esc then reaches the game (cancel build mode); holding Esc still
    // leaves full screen. Browsers without Keyboard Lock exit on the first Esc.
    if (document.fullscreenElement) keyboard()?.lock?.(["Escape"]).catch(() => {});
    else keyboard()?.unlock?.();
    root.classList.toggle("is-fullscreen", on);
    root.classList.toggle("is-immersive", immersive);
    if (immersive) window.scrollTo(0, 0);
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute("aria-label", on ? "Exit fullscreen (F)" : "Fullscreen (F)");
    button.title = on ? "Exit fullscreen (F)" : "Fullscreen (F)";
    requestAnimationFrame(onChange);
  };
  const setImmersive = (on: boolean) => {
    immersive = on;
    sync();
  };
  document.addEventListener("fullscreenchange", sync);
  return {
    isActive,
    async toggle() {
      if (immersive) return setImmersive(false);
      if (document.fullscreenElement) return document.exitFullscreen();
      if (!native) return setImmersive(true);
      // Refused (no user gesture, iframe policy): fall back to the immersive layout.
      await root.requestFullscreen({ navigationUI: "hide" }).catch(() => setImmersive(true));
    },
  };
}
