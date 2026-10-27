import type { ContentPack, TowerId } from "../core/types";
import { missionsOf } from "./map";
import { rankOf } from "./ranks";
import { relicOf, type RelicId } from "./relics";
import type { RunState } from "./state";
/**
 * Whether a relic can still do anything for a run (`usable`), and whether it fits the roster as it stands (`relicFit`).
 * Both are pure: the offers filter on `usable` and make sure one card fits, and the reward cards show the fit.
 */
type Where = Pick<RunState, "length" | "log" | "phase" | "roster" | "relics" | "doctrines" | "ranks">;
/** Missions still to play after the current reward, camp or act screen. */
export const missionsLeft = (run: Where) => missionsOf(run.length) - run.log.filter((h) => h.won).length;
/** Act transitions still ahead: one after each act boss of a full run; the one being chosen no longer counts. */
export function transitionsLeft(run: Where) {
  if (run.length === "short") return 0;
  const bosses = run.log.filter((h) => h.won && h.kind === "boss").length,
    // The reward right after an act boss still has its transition ahead.
    pending = run.phase === "reward" && run.log[run.log.length - 1]?.kind === "boss" ? 1 : 0;
  return Math.max(0, 3 - bosses + pending);
}
export interface RelicFit {
  /** It works through the roster as it stands (always for relics every build profits from). */
  fits: boolean;
  /** Roster towers it works through; empty for relics that work for every build. */
  towers: TowerId[];
  /** A synergy relic that fits: the card the offers make sure of. */
  synergy: boolean;
  /** One short line for the card. */
  note: string;
}
export function relicFit(run: Where, id: RelicId, content: ContentPack): RelicFit {
  const r = relicOf(id);
  if (r.flag === "zealot" || r.flag === "second") {
    const held = run.doctrines.map((d) => d.split(":")[0] as TowerId).filter((t, i, all) => all.indexOf(t) === i && run.roster.includes(t));
    return held.length
      ? { fits: true, towers: held, synergy: true, note: `Works with your Doctrines: ${held.map((t) => content.towers[t].name).join(", ")}.` }
      : { fits: false, towers: [], synergy: false, note: "Pays off once a tower holds a Doctrine." };
  }
  if (r.flag === "veteran") {
    const fresh = run.roster.filter((t) => rankOf(run.ranks[t]) === 0);
    return fresh.length
      ? { fits: true, towers: fresh, synergy: false, note: `Lifts ${fresh.map((t) => content.towers[t].name).join(", ")} to rank 1.` }
      : { fits: false, towers: [], synergy: false, note: "Every roster tower already holds a rank: it helps the towers you draft later." };
  }
  if (!r.wants || !r.wantsText) return { fits: true, towers: [], synergy: false, note: "Helps every build." };
  const towers = run.roster.filter((t) => r.wants!(content.towers[t]));
  return towers.length
    ? { fits: true, towers, synergy: r.category === "synergy", note: `Fits ${towers.map((t) => content.towers[t].name).join(", ")}.` }
    : { fits: false, towers, synergy: false, note: `No ${r.wantsText} in your roster yet.` };
}
/**
 * Can the relic still pay off? Not when it is held, when too few missions or act transitions remain, or when it
 * works only through a family of towers that the roster lacks and too few missions remain to draft one.
 */
export function usable(run: Where, id: RelicId, content?: ContentPack): boolean {
  if (run.relics.includes(id)) return false;
  const r = relicOf(id),
    left = missionsLeft(run);
  if (r.needs?.missions && left < r.needs.missions) return false;
  if (r.needs?.transitions && transitionsLeft(run) < r.needs.transitions) return false;
  if (content && r.wants && r.wantsText && left < 2 && !relicFit(run, id, content).fits) return false;
  if (left < 1) return false;
  return true;
}
