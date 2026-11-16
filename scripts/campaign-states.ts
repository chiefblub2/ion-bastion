/**
 * Campaign states for the browser checks (`menu-fit-check.ts`): stored campaign records and Arsenals at three stages
 * (fresh, mid, late), debriefs for the fullest win and for a loss, a complete campaign for the victory page and the
 * briefing drafts, all built through the campaign's own pure functions, so each is a state a player can reach.
 * `Storage` holds what to write under which key: `local` into localStorage, `session` into sessionStorage.
 */
import { type Arsenal, EMPTY_ARSENAL } from "../src/campaign/arsenal";
import { ARSENAL_VERSION } from "../src/app/arsenal-store";
import { campaignLocks, newlyUnlocked } from "../src/campaign/campaign-unlock";
import { type Debrief, debriefOf } from "../src/campaign/debrief";
import { isFinale, securedOf } from "../src/campaign/finale";
import { payOf, rankGains } from "../src/campaign/pay";
import type { Stars } from "../src/campaign/rating";
import { type CampaignRecord, storedRecord } from "../src/campaign/record";
import { lossTip } from "../src/campaign/tip";
import { CATALOGUE } from "../src/content/arsenal";
import { DEFAULT_CONTENT } from "../src/content";
import { isCircleSector, SECTORS } from "../src/content/missions";
import { balance } from "../src/core/economy";
import { Game } from "../src/core/game";
import type { EnemyId, MissionDefinition, TowerId } from "../src/core/types";

const content = DEFAULT_CONTENT;
export interface Storage {
  local: Record<string, string>;
  session: Record<string, string>;
}
const campaign = SECTORS.filter((s) => !isCircleSector(s)),
  missions = campaign.flatMap((s) => s.missions),
  byId = (id: string): MissionDefinition => {
    const m = missions.find((x) => x.id === id);
    if (!m) throw new Error(`campaign-states: no campaign mission ${id}`);
    return m;
  };
/** Best stars per won mission: every mission of the sectors before `sectors`, plus the first `extra` ones after. */
const wonTo = (count: number, stars: Stars = 3): CampaignRecord => Object.fromEntries(missions.slice(0, count).map((m, i) => [m.id, (i % 3 === 2 ? 2 : stars) as Stars]));
const arsenalText = (a: Arsenal) => JSON.stringify({ v: ARSENAL_VERSION, ...a });
const storage = (record: CampaignRecord, arsenal?: Arsenal): Storage["local"] => ({
  "ion-bastion:campaign": storedRecord(record),
  ...(arsenal && { "ion-bastion:arsenal": arsenalText(arsenal) }),
});

/** A profile in the campaign: its record and Arsenal. `fresh` stores nothing. */
export interface Profile {
  record: CampaignRecord;
  arsenal: Arsenal;
  local: Storage["local"];
}
const profile = (record: CampaignRecord, arsenal: Arsenal): Profile => ({ record, arsenal, local: storage(record, arsenal) });

const researched = (...ids: TowerId[]): TowerId[] => ids;
/** About a third of the campaign won (four sectors), twelve towers owned, a few ranks and marks. */
function mid(): Profile {
  // Pulse rank 2 with Mk I (Mk II is ready to forge), Blast rank 1 with Mk I (Mk II waits for rank 2), Frost rank 3.
  const arsenal: Arsenal = {
    ...EMPTY_ARSENAL,
    salvage: 260,
    researched: researched("lance", "inferno", "acid", "mine", "spikes", "detector"),
    xp: { pulse: 520, blast: 200, frost: 1100, tesla: 160, lance: 30 },
    gear: { pulse: 1, blast: 1, frost: 2 },
    loadout: ["pulse", "blast", "frost", "flak", "tesla", "lance"],
  };
  return profile(wonTo(20), arsenal);
}
/** Everything before the campaign's last mission won, most towers owned, ten slots, one tower at Mk V. */
function late(): Profile {
  const all = Object.keys(CATALOGUE) as TowerId[],
    arsenal: Arsenal = {
      ...EMPTY_ARSENAL,
      salvage: 640,
      // Most of the catalogue: a few of the dearest ones are still to research.
      researched: all.filter((id) => !["orbital", "plasma", "shieldgen", "nexus"].includes(id)),
      xp: { pulse: 5200, blast: 2300, frost: 2300, flak: 1100, tesla: 1100, aura: 460, lance: 1040, inferno: 460, mortar: 160 },
      gear: { pulse: 5, blast: 3, frost: 3, flak: 2, tesla: 2, aura: 1, lance: 2, inferno: 1 },
      loadout: ["pulse", "blast", "frost", "flak", "tesla", "aura", "lance", "inferno", "mortar", "detector"],
    };
  return profile(wonTo(missions.length - 1), arsenal);
}
export const profiles = (): Record<"fresh" | "mid" | "late", Profile> => ({ fresh: { record: {}, arsenal: EMPTY_ARSENAL, local: {} }, mid: mid(), late: late() });

const sectorOf = (m: MissionDefinition) => Math.max(1, SECTORS.findIndex((s) => s.missions.includes(m)) + 1);
/** The campaign's mission in an open state for a profile; its briefing draft starts on `tab` with the auto loadout. */
export interface BriefingState {
  name: string;
  mission: string;
  profile: Profile;
  tab: number;
}
export function briefings(): BriefingState[] {
  const p = profiles();
  return [
    { name: "fresh", mission: "outpost-07", profile: p.fresh, tab: 0 },
    // More towers than slots, a tab of them: the tiles toggle.
    { name: "mid-full-tab", mission: "truemmerallee", profile: p.mid, tab: 0 },
    { name: "late-full-tab", mission: "oase-null", profile: p.late, tab: 0 },
    // The Detector is issued without a slot.
    { name: "stealth", mission: "giftkessel", profile: p.late, tab: 0 },
    // A special operation lends its kit.
    { name: "special-op", mission: "brackwasser", profile: p.mid, tab: 0 },
  ];
}
/** The sessionStorage entry of a briefing draft (`app/campaign-flow.ts`). */
export const briefingDraft = (b: BriefingState): Storage["session"] => ({ "ion-bastion:briefing": JSON.stringify({ id: b.mission, tab: b.tab }) });

/** The fullest win: every ledger line, rank bonuses, eleven towers with three rank-ups, a sector secured with a slot, two unlocks. */
export function fullestWin(): { debrief: Debrief; profile: Profile } {
  const mission = byId("kernfestung"),
    before: CampaignRecord = Object.fromEntries(campaign[0].missions.slice(0, 3).map((m) => [m.id, 3 as Stars])),
    after: CampaignRecord = { ...before, [mission.id]: 3 };
  const locksBefore = campaignLocks(SECTORS, before),
    locksAfter = campaignLocks(SECTORS, after),
    // A finale win opens the next sector only; its first mission is listed too, as the page shows the longest strip.
    opened = newlyUnlocked(SECTORS, locksBefore, locksAfter),
    unlocked = { ...opened, missions: [...opened.missions, ...opened.sectors.flatMap((s) => s.missions.slice(0, 1))] };
  const arsenal: Arsenal = {
    ...EMPTY_ARSENAL,
    salvage: 140,
    researched: researched("lance", "inferno", "acid", "mine", "detector"),
    // Three towers sit just under a rank threshold; the others only gain XP.
    xp: { pulse: 130, blast: 420, frost: 990, flak: 40, tesla: 30, aura: 20, lance: 60, inferno: 10, acid: 5, mine: 15, detector: 0 },
  };
  const xp: Partial<Record<TowerId, number>> = { pulse: 60, blast: 70, frost: 80, flak: 55, tesla: 90, aura: 40, lance: 75, inferno: 45, acid: 35, mine: 70, detector: 40 },
    gains = rankGains(arsenal, xp),
    lines = payOf({ won: true, waves: mission.waves.length, sector: sectorOf(mission), firstWin: true, bounty: true, stars: 3, best: 0, finale: isFinale(mission, SECTORS) }),
    paid = lines.reduce((n, l) => n + l.amount, 0) + gains.reduce((n, g) => n + g.bonus, 0);
  if (gains.filter((g) => g.rankAfter > g.rankBefore).length !== 3) throw new Error("campaign-states: the fullest win needs exactly three rank-ups");
  const debrief = debriefOf({
    mission,
    content,
    sectors: SECTORS,
    won: true,
    cleared: mission.waves.length,
    kills: 412,
    lives: mission.reactorEnergy,
    peak: 0,
    stars: 3,
    best: 0,
    lines,
    gains,
    salvageBefore: arsenal.salvage,
    unlocked,
    secured: securedOf(mission, SECTORS, before, after, unlocked),
    ready: 4,
    leaks: {},
    record: after,
    locks: locksAfter,
  });
  if (debrief.ranks.length < 11 || !debrief.secured?.slot || debrief.unlocked.sectors.length + debrief.unlocked.missions.length < 2 || debrief.salvage.after !== arsenal.salvage + paid)
    throw new Error("campaign-states: the fullest win is not full");
  return { debrief, profile: profile(after, { ...arsenal, salvage: arsenal.salvage + paid }) };
}

/** A loss with leaks and a tip, from a real mission: the leaked type is the first flyer of its waves when it has any. */
export function lossDebrief(): { debrief: Debrief; profile: Profile } {
  const mission = byId("splitterfeld"),
    record = wonTo(2),
    arsenal: Arsenal = { ...EMPTY_ARSENAL, salvage: 90, xp: { pulse: 80, blast: 40 } },
    game = new Game(mission, content),
    types = mission.waves.flatMap((w) => w.groups.map((g) => g.type)),
    air = types.find((t) => content.enemies[t].layer === "air"),
    leaks: Partial<Record<EnemyId, number>> = { [air ?? types[0]]: 7, [types[types.length - 1]]: 3 },
    cleared = Math.floor(mission.waves.length / 2),
    sector = sectorOf(mission),
    lines = payOf({ won: false, waves: cleared, sector, firstWin: false, bounty: false }),
    gains = rankGains(arsenal, { pulse: 70, blast: 30 }),
    locks = campaignLocks(SECTORS, record);
  const debrief = debriefOf({
    mission,
    content,
    sectors: SECTORS,
    won: false,
    cleared,
    kills: 96,
    lives: 0,
    peak: 0,
    stars: 0,
    best: 0,
    lines,
    gains,
    salvageBefore: arsenal.salvage,
    unlocked: { missions: [], sectors: [] },
    ready: 1,
    leaks,
    tip: lossTip(leaks, mission, game.availableTowers(), arsenal, content, balance(game.state)),
    record,
    locks,
  });
  return { debrief, profile: profile(record, arsenal) };
}

/** The debrief page's storage: the debrief, and the "staged" mark so the page shows its final state at once. */
export const debriefStorage = (d: Debrief): Storage["session"] => ({
  "ion-bastion:debrief": JSON.stringify(d),
  "ion-bastion:debrief-staged": `${d.mission.id}:${d.waves.cleared}:${d.kills}:${d.salvage.before}:${d.salvage.after}`,
});
/** A complete campaign (every campaign mission won, three stars on all but a few) for the victory page. */
export function completeProfile(): Profile {
  const record: CampaignRecord = Object.fromEntries(missions.map((m, i) => [m.id, (i % 7 === 0 ? 2 : 3) as Stars])),
    arsenal: Arsenal = { ...late().arsenal, researched: Object.keys(CATALOGUE) as TowerId[], salvage: 1800 };
  return profile(record, arsenal);
}
