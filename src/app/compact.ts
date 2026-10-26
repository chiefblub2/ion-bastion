/**
 * The compact game layout for phones in landscape (`is-compact` on <html>, style.css): the page chrome folds away
 * and board, side rail and tower column fit the viewport, with or without full screen. `onChange` refits the
 * battlefield once the new layout is in place.
 */
export const COMPACT_QUERY = "(pointer: coarse) and (orientation: landscape) and (max-height: 540px)";
export function bindCompact(onChange: () => void) {
  const query = matchMedia(COMPACT_QUERY),
    sync = () => {
      document.documentElement.classList.toggle("is-compact", query.matches);
      requestAnimationFrame(onChange);
    };
  query.addEventListener("change", sync);
  sync();
}
