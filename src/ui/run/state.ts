// The Run page's shared pieces of state: the host, the node kinds and the page's view state.
import type { ContentPack, MissionDefinition, TowerId } from "../../core/types";
import type { Journal } from "../../run/journal";
import type { NodeKind } from "../../run/map";
import type { RunState } from "../../run/run";
import type { MapImage } from "../atlas/model";

/** What the Run page may do in the app; implemented by `app/menu-nav.ts`. */
export interface RunHost {
  /** The game's own pack; each mission's pack derives from it. */
  content: ContentPack;
  /** Loads the mission with its pack (replaying `resumed` first) and switches to the game on success. */
  launch(mission: MissionDefinition, content: ContentPack, resumed?: Journal): void;
  /** False while a multiplayer room is active. */
  canRun(): boolean;
  /** The id of the run mission loaded and still being played, if any: the page then offers to return to it. */
  playing(): string | undefined;
  /** The stored journal of the interrupted run mission, if any. */
  journal(): Journal | undefined;
  resume(): void;
  image: MapImage;
}
export const KIND: Record<NodeKind, { label: string; icon: string; note: string }> = {
  standard: { label: "Mission", icon: "◆", note: "A regular mission. Missions grow longer from act to act." },
  elite: { label: "Elite", icon: "✶", note: "Tougher enemies and a modifier; pays a relic prize and a fourth draft card." },
  boss: { label: "Act boss", icon: "♛", note: "The act's longest mission, with a boss modifier. Win it to cross into the next act." },
  final: { label: "Final Stand", icon: "☗", note: "The run's longest mission, with Titans at the end. Win it and the run is won." },
  shop: { label: "Shop", icon: "⌂", note: "Spend Scrap on repairs, funds, upgrades, a relic or a tower." },
  forge: { label: "Forge", icon: "⚒", note: "Doctrines, drills, rank XP and discounts for your towers." },
  repair: { label: "Repair", icon: "✚", note: "Repair the reactor, or reinforce it for good." },
  event: { label: "Event", icon: "?", note: "Something unexpected. Every choice shows its cost." },
};
export const STARS = (n: number) => "★".repeat(n) + "☆".repeat(3 - n);
/** The Run page's view state; only `run-view.ts` changes it, the screens read it. */
export const page: {
  host: RunHost;
  root: HTMLElement;
  run: RunState | undefined;
  /** Intro: the chosen threat level and run length. */
  threat: number;
  length: "full" | "short";
  /** Map: the lane of the node whose card is open on the map; null when the player closed it. */
  focusLane: number | null | undefined;
  /** A drafted tower waiting for the roster tower it replaces (roster full). */
  replacing: { tower: TowerId; source: "draft" | "shop"; index?: number } | undefined;
  /** A shop item waiting for its target tower (and path, for a Doctrine). */
  targeting: number | undefined;
  /** Doctrine pick: the tower whose paths are shown. */
  doctrineTower: TowerId | undefined;
  /** Two-click confirmations. */
  armed: string | undefined;
  /** The option selected in the current decision (a tower, relic, `<tower>:<path>` or "doctrine"); nothing changes before Take. */
  selected: string | undefined;
  /** The act reward: the player chose the Doctrine and now picks its tower and path. */
  actDoctrine: boolean;
} = {
  host: undefined!,
  root: undefined!,
  run: undefined,
  threat: 0,
  length: "full",
  focusLane: undefined,
  replacing: undefined,
  targeting: undefined,
  doctrineTower: undefined,
  armed: undefined,
  selected: undefined,
  actDoctrine: false,
};
/** Drops every pending choice of the page (a fresh screen). */
export function reset() {
  page.focusLane = undefined;
  page.replacing = undefined;
  page.targeting = undefined;
  page.doctrineTower = undefined;
  page.armed = undefined;
  page.selected = undefined;
  page.actDoctrine = false;
}
