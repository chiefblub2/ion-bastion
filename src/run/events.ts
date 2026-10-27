import type { ContentPack } from "../core/types";
import { threatRules } from "./ascension";
import { usable } from "./relic-fit";
import { hasFlag, relicOf, relicsOf } from "./relics";
import { draw, streamOf } from "./rng";
import {
  addTower,
  bestTower,
  changeReactor,
  cursedRelic,
  doctrineCandidates,
  gainRelic,
  randomTower,
  rosterCap,
  towerOffers,
  type RunState,
} from "./state";
/**
 * Event nodes: a short scene with two or three choices, each a pure transition of the run with its cost shown up
 * front. What an event offers (which relic, which tower) is drawn from the seed and the node.
 */
export interface EventChoice {
  label: string;
  detail: string;
  /** False: shown disabled (too little Scrap, no room, nothing to trade). */
  ok: boolean;
  apply: (run: RunState, content: ContentPack) => RunState;
}
export interface RunEvent {
  id: string;
  title: string;
  text: string;
  choices: (run: RunState, content: ContentPack) => EventChoice[];
}
const leave: EventChoice = { label: "Move on", detail: "Nothing happens.", ok: true, apply: (run) => run };
const key = (run: RunState) => [run.act, run.column, run.lane];
const heal = (run: RunState, v: number) => (hasFlag(run.relics, "zealot") ? 0 : Math.round(v * threatRules(run.threat).repair));
export const EVENTS: readonly RunEvent[] = [
  {
    id: "depot",
    title: "Derelict depot",
    text: "A supply depot, abandoned in a hurry. Some crates are sealed with warning tape.",
    choices: (run, content) => {
      const r = streamOf(run.seed, "event", ...key(run)),
        rare = draw(r, relicsOf("rare").filter((id) => usable(run, id, content)), 1)[0],
        cursed = cursedRelic(run, key(run), content);
      return [
        { label: rare ? `Take ${relicOf(rare).name}` : "Take the crate", detail: rare ? relicOf(rare).description : "It is empty.", ok: !!rare, apply: (s) => (rare ? gainRelic(s, rare) : s) },
        {
          label: cursed ? `Open the taped crate: ${relicOf(cursed).name}` : "Open the taped crate",
          detail: cursed ? `${relicOf(cursed).description} +30 Scrap.` : "Nothing left.",
          ok: !!cursed,
          apply: (s) => (cursed ? { ...gainRelic(s, cursed), scrap: s.scrap + 30 } : s),
        },
        leave,
      ];
    },
  },
  {
    id: "mercenary",
    title: "Mercenary crew",
    text: "A crew with a heavy turret offers its services. For a price, they stay.",
    choices: (run, content) => {
      const tower = randomTower(run, content, "epic", ["merc", ...key(run)]);
      if (!tower) return [leave];
      const name = content.towers[tower].name,
        room = run.roster.length < rosterCap(run);
      return [
        { label: `Hire ${name} for one mission`, detail: "It joins your next mission only.", ok: true, apply: (s) => ({ ...s, loan: tower }) },
        { label: `Sign ${name} on (35 Scrap)`, detail: room ? "It joins your roster for good." : "Your roster is full.", ok: room && run.scrap >= 35, apply: (s) => ({ ...addTower(s, tower), scrap: s.scrap - 35 }) },
        leave,
      ];
    },
  },
  {
    id: "salvage",
    title: "Wreck field",
    text: "A field of burnt-out hulls. Cutting them open is dangerous work.",
    choices: () => [
      { label: "Salvage the wrecks", detail: "+35 Scrap, −4 reactor energy.", ok: true, apply: (s) => ({ ...changeReactor(s, -4), scrap: s.scrap + 35 }) },
      leave,
    ],
  },
  {
    id: "school",
    title: "Field school",
    text: "Veteran instructors teach an advanced doctrine, but their drills strain the reactor.",
    choices: (run, content) => [
      {
        label: "Enrol a crew",
        detail: "Take a Doctrine; the reactor holds 5 less.",
        ok: doctrineCandidates(run, content).length > 0 && run.reactorMax > 10,
        apply: (s) => ({ ...s, reactorMax: s.reactorMax - 5, reactor: Math.min(s.reactor, s.reactorMax - 5), offers: { ...s.offers, doctrine: true } }),
      },
      leave,
    ],
  },
  {
    id: "drillyard",
    title: "Drill yard",
    text: "An empty training range. Your best crew could use the practice.",
    choices: (run, content) => {
      const best = bestTower(run);
      return [
        { label: best ? `Drill ${content.towers[best].name}` : "Drill", detail: "+120 rank XP.", ok: !!best, apply: (s) => ({ ...s, ranks: { ...s.ranks, [best]: (s.ranks[best] ?? 0) + 120 } }) },
        { label: "Sell the range's spares", detail: "+20 Scrap.", ok: true, apply: (s) => ({ ...s, scrap: s.scrap + 20 }) },
      ];
    },
  },
  {
    id: "quiet",
    title: "Quiet sector",
    text: "No contacts for once. The crews can rest or work.",
    choices: (run) => [
      { label: "Rest and repair", detail: `+${heal(run, 8)} reactor energy.`, ok: heal(run, 8) > 0 && run.reactor < run.reactorMax, apply: (s) => changeReactor(s, heal(s, 8)) },
      { label: "Strip the outpost", detail: "+20 Scrap.", ok: true, apply: (s) => ({ ...s, scrap: s.scrap + 20 }) },
    ],
  },
  {
    id: "smugglers",
    title: "Smugglers",
    text: "Smugglers sell rare hardware, no questions asked.",
    choices: (run, content) => {
      const rare = draw(streamOf(run.seed, "event-smugglers", ...key(run)), relicsOf("rare").filter((id) => usable(run, id, content)), 1)[0];
      return [
        {
          label: rare ? `Buy ${relicOf(rare).name} (40 Scrap)` : "Buy",
          detail: rare ? relicOf(rare).description : "Sold out.",
          ok: !!rare && run.scrap >= 40,
          apply: (s) => (rare ? { ...gainRelic(s, rare), scrap: s.scrap - 40 } : s),
        },
        leave,
      ];
    },
  },
  {
    id: "engineers",
    title: "Stranded engineers",
    text: "A stranded engineering team offers to rework one of your towers.",
    choices: (run, content) => {
      const best = bestTower(run),
        free = best && !run.mods.some((m) => m.tower === best && m.kind === "drill");
      return [
        {
          label: best ? `Rework ${content.towers[best].name}` : "Rework",
          detail: "Its level 2 costs 1 credit for the rest of the run.",
          ok: !!free,
          apply: (s) => ({ ...s, mods: [...s.mods, { tower: best, kind: "drill" }] }),
        },
        { label: "Take their spare parts", detail: "+25 Scrap.", ok: true, apply: (s) => ({ ...s, scrap: s.scrap + 25 }) },
      ];
    },
  },
  {
    id: "core",
    title: "Unstable core",
    text: "A salvaged reactor core could be fused into yours. It will run hot for a while.",
    choices: () => [
      { label: "Fuse it", detail: "+6 reactor maximum, −6 reactor energy now.", ok: true, apply: (s) => changeReactor({ ...s, reactorMax: s.reactorMax + 6 }, -6) },
      leave,
    ],
  },
  {
    id: "scavengers",
    title: "Scavengers",
    text: "Scavengers have towers to trade, or parts to sell.",
    choices: (run, content) => [
      {
        label: "Look at their towers",
        detail: "Draft one of three towers.",
        ok: towerOffers(run, content, 3, false, "scavengers").length > 0,
        apply: (s, c) => ({ ...s, offers: { ...s.offers, towers: towerOffers(s, c, 3, false, "scavengers") } }),
      },
      { label: "Buy their parts", detail: "+20 Scrap.", ok: true, apply: (s) => ({ ...s, scrap: s.scrap + 20 }) },
    ],
  },
];
export const eventOf = (id: string) => EVENTS.find((e) => e.id === id);
/** The event of a camp node, drawn from the seed and the node. */
export const pickEvent = (run: RunState) => draw(streamOf(run.seed, "event-pick", ...key(run)), EVENTS, 1)[0].id;
