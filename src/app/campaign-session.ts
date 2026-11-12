import { settle, xpOf } from "../campaign/arsenal";
import { campaignLocks, newlyUnlocked } from "../campaign/campaign-unlock";
import { type Debrief, debriefOf } from "../campaign/debrief";
import { isFinale, securedOf } from "../campaign/finale";
import { payOf, type RankGain, rankGains } from "../campaign/pay";
import { missionStars } from "../campaign/rating";
import type { MissionTally } from "../campaign/tally";
import { lossTip } from "../campaign/tip";
import { balance } from "../core/economy";
import type { Game } from "../core/game";
import type { TowerId } from "../core/types";
import { arsenalSummary, bountyToday, updateArsenal } from "./arsenal-store";
import { campaignRecord, recordWin } from "./progress";
// The impure glue of a paying campaign mission: what it was started with, and the settle at its end (record, unlocks,
// XP, Salvage, the stored Arsenal) into a `Debrief` mirrored to sessionStorage for the debrief page.

const DEBRIEF_KEY = "ion-bastion:debrief";
const START_KEY = "ion-bastion:campaign-start";
export interface CampaignStart {
  id: string;
  picks: readonly TowerId[];
}
let started: CampaignStart | undefined;

/** Remembers what a campaign mission is started with (Replay) and stores the picks as the last loadout. */
export function begin(missionId: string, picks: readonly TowerId[]) {
  started = { id: missionId, picks: [...picks] };
  try {
    sessionStorage.setItem(START_KEY, JSON.stringify(started));
  } catch {
    // Kept in memory only.
  }
  updateArsenal((a) => ({ ...a, loadout: [...picks] }));
}
/** What the last campaign mission was started with (this tab), or undefined. */
export function startedWith(): CampaignStart | undefined {
  if (started) return started;
  try {
    const d = JSON.parse(sessionStorage.getItem(START_KEY) ?? "null") as CampaignStart | null;
    return d && typeof d.id === "string" && Array.isArray(d.picks) ? d : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Settles a finished paying campaign mission, in order: stars, the previous best, the win recorded, what it opened,
 * XP and rank gains, the Salvage ledger (bounty marked paid), the Arsenal saved, the debrief built and mirrored to
 * sessionStorage. `peak` is the fullest the ring got (`PeakTracker`).
 */
export function end(game: Game, won: boolean, tally: Pick<MissionTally, "leaks">, peak: number): Debrief {
  const mission = game.mission,
    state = game.state,
    // The active pack: the gear pack the mission was played with (same towers, sectors and enemies as the base).
    content = game.content,
    sectors = content.sectors ?? [],
    sector = Math.max(1, sectors.findIndex((s) => s.missions.some((m) => m.id === mission.id)) + 1);
  const stars = won ? missionStars(mission, state, peak) : 0;
  const recordBefore = campaignRecord(),
    best = recordBefore[mission.id] ?? 0,
    locksBefore = campaignLocks(sectors, recordBefore);
  if (won && stars) recordWin(mission.id, stars);
  const record = campaignRecord(),
    locks = campaignLocks(sectors, record),
    unlocked = newlyUnlocked(sectors, locksBefore, locks);
  const xp = xpOf(state, mission, content);
  // `state.wave` is the wave lost on (1-based, counted from its start): the waves cleared are the ones before it.
  const cleared = won ? mission.waves.length : Math.max(0, state.wave - 1),
    bounty = won ? bountyToday() : undefined,
    onBounty = !!bounty && bounty.id === mission.id && !bounty.paid,
    lines = payOf({ won, waves: cleared, sector, firstWin: won && !best, bounty: onBounty, stars: stars || undefined, best, finale: isFinale(mission, sectors) }),
    paid = lines.reduce((n, l) => n + l.amount, 0);
  let gains: RankGain[] = [],
    salvageBefore = 0;
  const after = updateArsenal((a) => {
    gains = rankGains(a, xp);
    salvageBefore = a.salvage;
    const next = settle(a, paid + gains.reduce((n, g) => n + g.bonus, 0), xp);
    return onBounty ? { ...next, bounty: { ...bounty!, paid: true } } : next;
  });
  const d = debriefOf({
    mission,
    content,
    sectors,
    won,
    cleared,
    kills: state.kills,
    lives: state.lives,
    peak,
    stars,
    best,
    lines,
    gains,
    salvageBefore,
    unlocked,
    secured: won ? securedOf(mission, sectors, recordBefore, record, unlocked) : undefined,
    ready: arsenalSummary(after).ready,
    leaks: tally.leaks,
    tip: won ? undefined : lossTip(tally.leaks, mission, game.availableTowers(), after, content, balance(state)),
    record,
    locks,
  });
  try {
    sessionStorage.setItem(DEBRIEF_KEY, JSON.stringify(d));
  } catch {
    // The page then shows only what it was handed in memory.
  }
  last = d;
  return d;
}
let last: Debrief | undefined;
/** The last debrief of this tab (memory, else sessionStorage), or undefined. */
export function lastDebrief(): Debrief | undefined {
  if (last) return last;
  try {
    const d = JSON.parse(sessionStorage.getItem(DEBRIEF_KEY) ?? "null") as Debrief | null;
    return d && d.v === 1 ? d : undefined;
  } catch {
    return undefined;
  }
}
