/**
 * The compact game layout for phones in landscape (`is-compact` on <html>, style.css): the page chrome folds away
 * and board, side rail and tower column fit the viewport, with or without full screen. `onChange` refits the
 * battlefield once the new layout is in place.
 *
 * iOS reports the notch's safe-area inset on both sides in landscape, though the camera cut-out sits on one side
 * only: `data-notch` on <html> names that side from the screen's rotation, so the layout keeps only a slim margin
 * on the other (style.css, `--inset-l`/`--inset-r`).
 */
export const COMPACT_QUERY = "(pointer: coarse) and (orientation: landscape) and (max-height: 540px)";
/**
 * The fitted menu layout (menu.css): a short landscape viewport, measured by height so every landscape phone from
 * 667×375 to 956×440 gets it, whatever its width, and a short desktop window too. The home page and the Sector Atlas
 * then fill the screen without scrolling; the atlas shows the map beside a tabbed mission inspector.
 */
export const FIT_QUERY = "(orientation: landscape) and (max-height: 540px)";
/** The side of the camera cut-out in landscape: rotated a quarter turn counter-clockwise (90°) puts it on the left. */
export function notchSide(angle: number | undefined): "left" | "right" | undefined {
  const a = (((angle ?? 0) % 360) + 360) % 360;
  return a === 90 ? "left" : a === 270 ? "right" : undefined;
}
/**
 * The screen's rotation. `window.orientation` first: deprecated but still in iOS Safari, where 90 reliably means the
 * notch is on the left; the Screen Orientation API elsewhere.
 */
function screenAngle() {
  return (window as Window & { orientation?: number }).orientation ?? screen.orientation?.angle;
}
export function bindCompact(onChange: () => void) {
  const root = document.documentElement,
    query = matchMedia(COMPACT_QUERY),
    sync = () => {
      root.classList.toggle("is-compact", query.matches);
      const side = notchSide(screenAngle());
      if (side) root.dataset.notch = side;
      else delete root.dataset.notch;
      requestAnimationFrame(onChange);
    };
  query.addEventListener("change", sync);
  screen.orientation?.addEventListener("change", sync);
  addEventListener("orientationchange", sync);
  sync();
}
