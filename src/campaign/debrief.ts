import { isCircleSector } from "../content/missions";
import type { ContentPack, EnemyId, MissionDefinition, MissionSector, TowerId } from "../core/types";
import type { Lock, Unlocked } from "./campaign-unlock";
import type { Secured } from "./finale";
import { nextMission } from "./next-mission";
import type { PayLine, RankGain } from "./pay";
import { starThresholds } from "./rating";
import type { CampaignRecord } from "./record";
import type { Tip } from "./tip";
// The debrief: everything the page shows after a paying campaign mission, as plain JSON, so it renders again from
// sessionStorage after a reload. Built from plain inputs; the impure settle lives in `app/campaign-session.ts`.

/** Where the debrief's Next leads. */
export interface AfterDebrief {
  kind: "briefing" | "atlas" | "victory" | "none";
  /** The mission whose briefing opens (`briefing`). */
  id?: string;
  /** The 1-based sector the atlas flies to (`atlas`). */
  sector?: number;
}
export interface Debrief {
  v: 1;
  mission: { id: string; name: string; /** 1-based among the campaign missions. */ number: number };
  sector: { /** 1-based. */ number: number; name: string };
  won: boolean;
  /** Waves cleared (all on a win; on a loss the waves before the one lost on) of the mission's total. */
  waves: { cleared: number; total: number };
  kills: number;
  /** Stars of this play (0 on a loss) and the best before it (0 when never won). */
  stars: number;
  best: number;
  /**
   * The star thresholds and the value reached: `energy` is the reactor share left (`left` of `max`), at least `three`
   * / `two`; `ring` the fullest the ring got (share of its limit), at most `three` / `two`.
   */
  rating: { kind: "energy" | "ring"; three: number; two: number; value: number; left?: number; max?: number };
  /** The Salvage ledger: its lines, the rank-up bonuses and the sum of both. */
  pay: { lines: PayLine[]; ranks: number; total: number };
  salvage: { before: number; after: number };
  /** XP gained per tower type, with ranks crossed and their bonus. */
  ranks: (RankGain & { name: string })[];
  unlocked: { missions: { id: string; name: string }[]; sectors: { number: number; name: string }[] };
  /** A finale's first win. */
  secured?: { number: number; name: string; stars: number; max: number; cache: number; slot: boolean };
  /** Research and forge purchases the Salvage covers now (`arsenalSummary().ready`). */
  ready: number;
  /** Leaked enemies per type, most first. */
  leaks: { enemy: EnemyId; name: string; count: number }[];
  /** The loss tip. */
  tip?: Tip;
  next: AfterDebrief;
}

export interface DebriefInput {
  mission: MissionDefinition;
  /** Names of towers and enemies. */
  content: ContentPack;
  sectors: readonly MissionSector[];
  won: boolean;
  cleared: number;
  kills: number;
  /** Reactor energy left, and the fullest the ring got (circle missions). */
  lives: number;
  peak: number;
  stars: number;
  best: number;
  lines: PayLine[];
  gains: readonly RankGain[];
  salvageBefore: number;
  unlocked: Unlocked;
  secured?: Secured;
  ready: number;
  leaks: Readonly<Partial<Record<EnemyId, number>>>;
  tip?: Tip;
  /** The record and locks after this play, for Next. */
  record: CampaignRecord;
  locks: ReadonlyMap<string, Lock>;
}

const campaignMissions = (sectors: readonly MissionSector[]) => sectors.filter((s) => !isCircleSector(s)).flatMap((s) => s.missions);
const sectorNumber = (sectors: readonly MissionSector[], s: MissionSector) => sectors.indexOf(s) + 1;

export function debriefOf(i: DebriefInput): Debrief {
  const sectorIndex = i.sectors.findIndex((s) => s.missions.some((m) => m.id === i.mission.id)),
    sector = i.sectors[sectorIndex],
    t = starThresholds(i.mission),
    ranks = i.gains.reduce((n, g) => n + g.bonus, 0),
    paid = i.lines.reduce((n, l) => n + l.amount, 0) + ranks,
    order = Object.keys(i.content.enemies) as EnemyId[];
  const d: Omit<Debrief, "next"> = {
    v: 1,
    mission: { id: i.mission.id, name: i.mission.name, number: campaignMissions(i.sectors).findIndex((m) => m.id === i.mission.id) + 1 },
    sector: { number: sectorIndex + 1, name: sector?.name ?? "" },
    won: i.won,
    waves: { cleared: i.cleared, total: i.mission.waves.length },
    kills: i.kills,
    stars: i.won ? i.stars : 0,
    best: i.best,
    rating:
      t.kind === "ring"
        ? { ...t, value: i.peak }
        : { ...t, value: Math.min(1, i.lives / i.mission.reactorEnergy), left: i.lives, max: i.mission.reactorEnergy },
    pay: { lines: i.lines.map((l) => ({ ...l })), ranks, total: paid },
    salvage: { before: i.salvageBefore, after: i.salvageBefore + paid },
    ranks: i.gains.map((g) => ({ ...g, name: i.content.towers[g.id as TowerId]?.name ?? g.id })),
    unlocked: {
      missions: i.unlocked.missions.map((m) => ({ id: m.id, name: m.name })),
      sectors: i.unlocked.sectors.map((s) => ({ number: sectorNumber(i.sectors, s), name: s.name })),
    },
    ...(i.secured && {
      secured: { number: i.secured.index + 1, name: i.secured.sector.name, stars: i.secured.stars, max: i.secured.max, cache: i.secured.cache, slot: i.secured.slot },
    }),
    ready: i.ready,
    leaks: order.filter((id) => (i.leaks[id] ?? 0) > 0).map((id) => ({ enemy: id, name: i.content.enemies[id].name, count: i.leaks[id]! })).sort((a, b) => b.count - a.count),
    ...(i.tip && { tip: i.tip }),
  };
  return { ...d, next: afterDebrief(d, i.sectors, i.record, i.locks) };
}

/**
 * Where Next leads: a loss offers none (the page offers Replay); the campaign's last mission won for the first time
 * leads to the victory page; a win that opened a sector flies the atlas there; otherwise the briefing of the next
 * open unwon campaign mission (`nextMission` after this one), or the atlas at this sector when none is left.
 */
export function afterDebrief(
  d: Pick<Debrief, "won" | "best" | "mission" | "sector" | "unlocked">,
  sectors: readonly MissionSector[],
  record: CampaignRecord,
  locks: ReadonlyMap<string, Lock>,
): AfterDebrief {
  if (!d.won) return { kind: "none" };
  const missions = campaignMissions(sectors);
  if (!d.best && missions.at(-1)?.id === d.mission.id) return { kind: "victory" };
  if (d.unlocked.sectors.length) return { kind: "atlas", sector: d.unlocked.sectors[0].number };
  const mission = missions.find((m) => m.id === d.mission.id),
    next = mission && nextMission(missions, record, { after: mission, locks });
  return next ? { kind: "briefing", id: next.id } : { kind: "atlas", sector: d.sector.number };
}
