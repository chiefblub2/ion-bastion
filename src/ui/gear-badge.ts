import { MAX_MARK } from "../content/arsenal";
import { ROMAN } from "./gear-text";
// Rank chevrons and mark pips as HTML strings (styled by `.rank-chevrons`, `.mk-pips`, `.mk-badge` in style.css).

const clampTo = (n: number, max: number) => Math.max(0, Math.min(max, Math.floor(n)));
const mkName = (mark: number) => `Mk ${ROMAN[mark - 1]}`;

/** Veterancy rank as 0–5 chevrons; empty at rank 0. */
export function rankChevrons(rank: number): string {
  const n = clampTo(rank, 5);
  return n ? `<span class="rank-chevrons" role="img" aria-label="Rank ${n}">${"<i></i>".repeat(n)}</span>` : "";
}
/** Five pips, filled up to `mark`; with `ready` the next one is marked as forgeable. */
export function markPips(mark: number, ready = false): string {
  const n = clampTo(mark, MAX_MARK);
  const pips = Array.from({ length: MAX_MARK }, (_, i) => `<i${i < n ? ' class="on"' : ready && i === n ? ' class="ready"' : ""}></i>`).join("");
  return `<span class="mk-pips" role="img" aria-label="Gear ${n ? mkName(n) : "none"}">${pips}</span>`;
}
/** Compact standing: chevrons plus "Mk III"; empty when both are 0. */
export function gearBadge(s: { rank: number; mark: number }): string {
  const mark = clampTo(s.mark, MAX_MARK),
    chevrons = rankChevrons(s.rank);
  if (!chevrons && !mark) return "";
  const label = mark ? `<b class="mk-badge${mark === MAX_MARK ? " is-max" : ""}" role="img" aria-label="Gear ${mkName(mark)}">${mkName(mark)}</b>` : "";
  return `<span class="gear-badge">${chevrons}${label}</span>`;
}
