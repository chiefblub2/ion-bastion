/** What a keyboard step on a bar tells the bar's owner: the item reached. */
type Go = (item: HTMLElement) => void;
interface RovingOptions {
  /** Where the items are looked up; the bar itself by default. */
  scope?: ParentNode;
  /** Up and Down step too (bars that wrap into rows or columns). */
  vertical?: boolean;
  /** The current item's index; by default the item holding the focus. */
  current?: (items: HTMLElement[], target: HTMLElement) => number;
}
/**
 * Arrow keys, Home and End move between the items (`selector`) of a tab bar or list: Left and Right (with `vertical`
 * also Up and Down) step and wrap around, Home and End jump to the ends. `go` shows the item reached.
 */
export function rovingKeys(bar: HTMLElement, selector: string, go: Go, { scope = bar, vertical = false, current }: RovingOptions = {}) {
  bar.addEventListener("keydown", (e) => {
    const items = [...scope.querySelectorAll<HTMLElement>(selector)],
      target = e.target as HTMLElement,
      at = current ? current(items, target) : items.indexOf(target.closest<HTMLElement>(selector)!),
      steps: Record<string, number> = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: items.length - 1 };
    if (vertical) Object.assign(steps, { ArrowDown: at + 1, ArrowUp: at - 1 });
    const next = steps[e.key];
    if (next === undefined || !items.length) return;
    e.preventDefault();
    go(items[(next + items.length) % items.length]);
  });
}
