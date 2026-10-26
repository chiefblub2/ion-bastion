/**
 * Full screen for the whole app, so the sidebar stays usable. The layout
 * reacts to the `is-fullscreen` class on <html>; `onChange` lets the
 * battlefield refit its canvas once the new layout is in place.
 *
 * Without the Fullscreen API (iPhone Safari, some webviews) or when the
 * browser refuses it, an immersive mode applies the same layout inside the
 * normal viewport (`is-immersive`); launched from the home screen
 * (manifest.webmanifest) there are no browser bars around it either.
 *
 * On a phone the compact layout (app/compact.ts) already is that layout, so without the API the button would do
 * nothing: there it explains the home-screen app (`onHint`), the only way to lose the browser bars on an iPhone,
 * and inside the home-screen app it hides (`fullscreen-moot`, style.css).
 */
/** Keyboard Lock API (Chromium); not yet part of the TypeScript DOM types. */
type KeyboardLock = { lock?: (keys: string[]) => Promise<void>; unlock?: () => void };
const keyboard = () => (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard;
/** Screen Orientation lock; only granted in native full screen (Android), missing from the TypeScript DOM types. */
type OrientationLock = { lock?: (orientation: "landscape") => Promise<void>; unlock?: () => void };
const orientation = () => (screen as Screen & { orientation?: OrientationLock }).orientation;
const isPhone = () => matchMedia("(pointer: coarse)").matches;
/** Started from the home screen (manifest display mode, or iOS's own flag): no browser bars to hide. */
const homeScreenApp = () =>
  matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
export function bindFullscreen(onChange: () => void, onHint: () => void) {
  const root = document.documentElement,
    button = document.getElementById("fullscreen-btn") as HTMLButtonElement;
  const native = document.fullscreenEnabled && typeof root.requestFullscreen === "function";
  let immersive = false;
  root.classList.toggle("fullscreen-moot", !native && homeScreenApp());
  const isActive = () => !!document.fullscreenElement || immersive;
  const sync = () => {
    const on = isActive();
    // A short Esc then reaches the game (cancel build mode); holding Esc still
    // leaves full screen. Browsers without Keyboard Lock exit on the first Esc.
    if (document.fullscreenElement) {
      keyboard()?.lock?.(["Escape"]).catch(() => {});
      // Phones play in landscape; elsewhere a rotate hint in the game view asks for it (style.css).
      if (isPhone()) orientation()?.lock?.("landscape").catch(() => {});
    } else {
      keyboard()?.unlock?.();
      orientation()?.unlock?.();
    }
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
      if (!native && root.classList.contains("is-compact")) return onHint();
      if (!native) return setImmersive(true);
      // Refused (no user gesture, iframe policy): fall back to the immersive layout.
      await root.requestFullscreen({ navigationUI: "hide" }).catch(() => setImmersive(true));
    },
  };
}
