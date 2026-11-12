import { briefable } from "../campaign/briefable";
import { autoLoadout, fieldedTowers, fitsAll, kitOf, validLoadout } from "../campaign/loadout";
import { gearPack } from "../campaign/gear";
import type { Game } from "../core/game";
import type { MatchCommand } from "../core/match";
import type { CommandResult, MissionDefinition, TowerId } from "../core/types";
import type { MapImage } from "../ui/atlas/model";
import { focusStart, renderBriefing } from "../ui/briefing-view";
import { bountyToday, loadArsenal } from "./arsenal-store";
import { begin, startedWith } from "./campaign-session";
import { campaignRecord } from "./progress";
import { GAME, type Screen } from "./screens";
// The way into a solo campaign mission: the briefing page (`/#briefing`) with its loadout draft, and Start, which
// begins the paying session and loads the mission with the picked towers and the current gear.

/** The briefed mission and the player's picks (undefined until the first change: the auto loadout shows). */
interface Draft {
  id: string;
  picks?: TowerId[];
  tab?: number;
}
const DRAFT_KEY = "ion-bastion:briefing";
function storedDraft(): Draft | undefined {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null") as Draft | null;
    return d && typeof d.id === "string" ? { id: d.id, picks: Array.isArray(d.picks) ? d.picks : undefined, tab: typeof d.tab === "number" ? d.tab : undefined } : undefined;
  } catch {
    return undefined;
  }
}
function storeDraft(d: Draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // Kept in memory only.
  }
}

interface FlowDeps {
  game: Game;
  execute: (c: MatchCommand) => CommandResult;
  screens: { current(): Screen; show(screen: Screen, o?: { replace?: boolean }): void };
  /** Solo play: no multiplayer lobby or session, the atlas not picking for a room. */
  solo: () => boolean;
  unlockAll: boolean;
  /** The campaign lock keeps the mission closed. */
  locked: (id: string) => boolean;
  /** A mission is under way that starting another one resets. */
  underWay: () => boolean;
  /** The mission was started: the app forgets the atlas's browsed selection. */
  started: () => void;
  image: MapImage;
}
const BRIEFING: Screen = { view: "menu", page: "briefing" };
export function createCampaignFlow({ game, execute, screens, solo, unlockAll, locked, underWay, started, image }: FlowDeps) {
  let draft: Draft | undefined,
    message: string | undefined;
  const root = () => document.getElementById("briefing-root")!;
  const content = () => game.baseContent;
  const missionOf = (id: string) => {
    const m = briefable(id, content().missions, { solo: solo(), unlockAll });
    return m && !locked(id) ? m : undefined;
  };
  /** The draft of the briefed mission (memory, else this tab's sessionStorage after a reload). */
  function current() {
    draft ??= storedDraft();
    const m = draft && missionOf(draft.id);
    return m && draft ? { mission: m, draft } : undefined;
  }
  /** Kit, valid picks and fielded towers of the briefed mission right now. */
  function loadout(m: MissionDefinition, d: Draft) {
    const arsenal = loadArsenal(),
      record = campaignRecord(),
      kit = kitOf(m, arsenal, record, content()),
      picks = fitsAll(kit) ? [...kit.pool] : d.picks ? d.picks.filter((id) => kit.pool.includes(id)).slice(0, kit.slots) : autoLoadout(kit, m, arsenal, content(), arsenal.loadout);
    return { arsenal, record, kit, picks, fielded: fieldedTowers(kit, picks, content()) };
  }
  function save(d: Draft) {
    draft = d;
    storeDraft(d);
  }
  function render() {
    const c = current();
    if (!c) return;
    const { mission, draft: d } = c,
      l = loadout(mission, d),
      bounty = bountyToday();
    renderBriefing(
      root(),
      { mission, content: content(), ...l, tab: d.tab ?? -1, bounty: !!bounty && bounty.id === mission.id && !bounty.paid, reset: underWay(), message, image },
      {
        toggle(id) {
          const picks = [...l.picks];
          if (picks.includes(id)) picks.splice(picks.indexOf(id), 1);
          else if (picks.length >= l.kit.slots) {
            message = `Loadout full: drop a tower to field ${content().towers[id].name}.`;
            return render();
          } else picks.push(id);
          message = undefined;
          save({ ...d, picks });
          render();
        },
        tab(page) {
          save({ ...d, tab: page });
          message = undefined;
          render();
          root().querySelector<HTMLElement>(`[data-bf-tab="${page}"]`)?.focus({ preventScroll: true });
        },
        auto() {
          const picks = autoLoadout(l.kit, mission, l.arsenal, content(), l.picks);
          message = picks.length === l.picks.length ? "Loadout full: drop a tower to let Auto-fill choose." : undefined;
          save({ ...d, picks });
          render();
        },
        start,
      },
    );
  }
  /** Loads the briefed mission with its loadout and the current gear; the game replaces the briefing's history entry. */
  function start() {
    const c = current();
    if (!c) return;
    const { mission } = c,
      l = loadout(mission, c.draft);
    if (!validLoadout(l.kit, l.picks) || (!l.picks.length && l.kit.pool.length)) return;
    if (launch(mission.id, l.picks)) {
      started();
      screens.show(GAME, { replace: true });
    }
  }
  /** The paying start: remembered for Replay and as the last loadout, then the `mission` command. */
  function launch(id: string, picks: readonly TowerId[]) {
    const m = content().missions.find((x) => x.id === id);
    if (!m) return false;
    const kit = kitOf(m, loadArsenal(), campaignRecord(), content()),
      chosen = fitsAll(kit) ? kit.pool : picks.filter((p) => kit.pool.includes(p)).slice(0, kit.slots);
    begin(id, chosen);
    return execute({ type: "mission", id, towers: fieldedTowers(kit, chosen, content()), content: gearPack(game.baseContent, loadArsenal()) }).ok;
  }
  return {
    /** Opens the briefing for a briefable mission; false (nothing done) for any other. */
    brief(id: string, { replace = false } = {}): boolean {
      if (!missionOf(id)) return false;
      message = undefined;
      save({ id });
      const now = screens.current();
      if (now.view === "menu" && now.page === "briefing") render();
      // From a finished game ("Next mission") the briefing takes the spent game's place in the history, and from the
      // debrief (`replace`) the debrief's, so Start → Back never lands on either.
      else screens.show(BRIEFING, { replace: replace || now.view === "game" });
      return true;
    },
    /** The briefed mission, or undefined when there is none to show (the page then redirects to the atlas). */
    mission: () => current()?.mission,
    render,
    focusStart: () => focusStart(root()),
    start,
    /**
     * HUD Restart of a paying campaign game: the mission again with the picks it was started with and the gear forged
     * since. False when the game is not one (the plain `restart` command applies).
     */
    restart(): boolean {
      const s = startedWith();
      if (!game.arsenal || !solo() || !s || s.id !== game.mission.id) return false;
      return launch(s.id, s.picks);
    },
  };
}
export type CampaignFlow = ReturnType<typeof createCampaignFlow>;
