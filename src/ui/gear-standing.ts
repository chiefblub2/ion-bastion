import type { Arsenal } from "../campaign/arsenal";
import { standingOf } from "../campaign/arsenal";
import { RANK_PASSIVE } from "../content/arsenal";
import type { ContentPack, TowerId } from "../core/types";
import { escape } from "./format";
import { gearLines, ROMAN } from "./gear-text";
// What the HUD shows of a campaign tower's gear: the Arsenal snapshot a mission was started with, read only while the
// game carries it. Pure; `Interface` holds the snapshot, the build menu, the card and the sidebar read it.

export interface Standing {
  rank: number;
  mark: number;
}
/**
 * The standing of a tower type in the fielded Arsenal, or undefined without a snapshot, outside a game that carries
 * an arsenal (`carried` is `Game.arsenal` being set: Circuit, Training, Run, multiplayer and deep links never do) and
 * for a tower with neither rank nor mark.
 */
export function standingIn(fielded: Arsenal | null, carried: boolean, id: TowerId): Standing | undefined {
  if (!fielded || !carried) return undefined;
  const s = standingOf(fielded, id);
  return s.rank || s.mark ? s : undefined;
}
/** "Rank 3, Gear Mk II" for labels; empty for no standing. */
export function gearLabel(s: Standing | undefined): string {
  if (!s) return "";
  return [s.rank ? `Rank ${s.rank}` : "", s.mark ? `Gear Mk ${ROMAN[s.mark - 1]}` : ""].filter(Boolean).join(", ");
}
/** The sidebar's "Gear" block: the rank's passive, the active marks and at Mk V the signature; empty without standing. Texts read the base pack. */
export function gearBlock(id: TowerId, s: Standing | undefined, base: ContentPack): string {
  if (!s) return "";
  const rows = [
    ...(s.rank ? [`Rank ${s.rank}: build cost −${Math.round(RANK_PASSIVE.build * s.rank * 100)}%`] : []),
    ...(s.mark ? gearLines(id, s.mark, base) : []),
  ];
  return `<div class="gear-block"><b class="gear-block-title">GEAR${s.mark ? ` · MK ${ROMAN[s.mark - 1]}` : ""}</b><ul>${rows.map((r) => `<li>${escape(r)}</li>`).join("")}</ul></div>`;
}
