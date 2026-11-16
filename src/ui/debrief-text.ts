import type { Debrief } from "../campaign/debrief";
import type { PayLine } from "../campaign/pay";
import { number } from "./format";
import { ROMAN } from "./gear-text";
// The debrief page's wording as pure functions (the page itself is `debrief-view.ts`).

const pct = (v: number) => `${Math.round(v * 100)}%`;
const plural = (n: number, one: string, many: string) => `${number(n)} ${n === 1 ? one : many}`;

/** A ledger line in the player's words. A loss pays only half of its cleared waves, and says so. */
export function ledgerLabel(line: PayLine, won: boolean): string {
  const n = line.count ?? 0;
  switch (line.kind) {
    case "waves":
      return `${plural(n, "wave", "waves")} cleared${won ? "" : " · half pay"}`;
    case "win":
      return "Victory";
    case "firstWin":
      return "First win";
    case "stars":
      return `${plural(n, "new star", "new stars")}`;
    case "cache":
      return "Sector cache";
    case "bounty":
      return "Daily bounty ×2";
  }
}
/** The rank-bonus row: how many ranks were crossed. */
export const rankRowLabel = (ranks: Debrief["ranks"]) => {
  const n = ranks.reduce((sum, g) => sum + (g.rankAfter - g.rankBefore), 0);
  return `${plural(n, "rank-up", "rank-ups")}`;
};
/** The star rule and what was reached: "Reactor 18/20 · ★★★ at 90%, ★★ at 50%"; a ring is rated by its fullest moment. */
export function ratingText({ rating: r }: Pick<Debrief, "rating">): string {
  if (r.kind === "energy") return `Reactor ${r.left ?? 0}/${r.max ?? 0} · ★★★ at ${pct(r.three)}, ★★ at ${pct(r.two)}`;
  return `Ring peaked at ${pct(r.value)} full · ★★★ within ${pct(r.three)}, ★★ within ${pct(r.two)}`;
}
/** The overlay's title, as it has always read. */
export const outcomeTitle = (d: Pick<Debrief, "won" | "rating">) =>
  d.rating.kind === "ring" ? (d.won ? "The ring is empty." : "Ring overloaded.") : d.won ? "The line holds." : "Reactor lost.";
export const wavesText = (d: Pick<Debrief, "waves" | "kills">) =>
  `${d.waves.cleared} of ${d.waves.total} ${d.waves.total === 1 ? "wave" : "waves"} cleared · ${plural(d.kills, "kill", "kills")}`;
/** "Mk II" for one mark newly open to forging, "Mk I–II" for several. */
const marks = (before: number, after: number) => (after - before === 1 ? `Mk ${ROMAN[after - 1]}` : `Mk ${ROMAN[before]}–${ROMAN[after - 1]}`);
/** A rank-up as a line ("Rank 2 · +25 Salvage · Mk II can be forged") and its short form ("R2 · +25"); undefined without one. */
export function rankUpText(g: { rankBefore: number; rankAfter: number; bonus: number }): { long: string; short: string } | undefined {
  if (g.rankAfter <= g.rankBefore) return undefined;
  return {
    long: `Rank ${g.rankAfter} · +${number(g.bonus)} Salvage · ${marks(g.rankBefore, g.rankAfter)} can be forged`,
    short: `R${g.rankAfter} · +${number(g.bonus)}`,
  };
}
/** Leaked enemies, top three: "Drone ×4 · Brute ×2". */
export const leakText = (leaks: Debrief["leaks"]) =>
  leaks
    .slice(0, 3)
    .map((l) => `${l.name} ×${l.count}`)
    .join(" · ");
/** A stable id of one debrief, so it is staged and opened once however often it is read back. */
export const debriefKey = (d: Debrief) => `${d.mission.id}:${d.waves.cleared}:${d.kills}:${d.salvage.before}:${d.salvage.after}`;
