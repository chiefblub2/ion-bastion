/**
 * The Run page (`/#run`): start a run (full, short or daily, at a threat level), pick the starter pack, walk each
 * act's map, deploy or resume missions, take rewards, visit camps, cross act transitions and read the summary.
 * Loaded on first entry like the editor; every decision is a pure transition of `run/run.ts`, stored after each step.
 */
import "./run.css";
import type { ContentPack, MissionDefinition, TowerId } from "../core/types";
import { isSpecialization } from "../core/upgrades";
import { MAX_THREAT, THREAT_TEXT } from "../run/ascension";
import { bossModOf } from "../run/boss";
import { DAILY_THREAT, dailyDate, dailySeed } from "../run/daily";
import { eventOf } from "../run/events";
import { runMission, FORMATS } from "../run/generate";
import type { Journal } from "../run/journal";
import { isMissionKind, LANES, missionsOf, type NodeKind, type RunNode } from "../run/map";
import { MAX_RANK, nextRankAt, RANK_TEXT } from "../run/ranks";
import { relicOf, type RelicId } from "../run/relics";
import { parseSeed, seedText } from "../run/rng";
import {
  abandon,
  actMapOf,
  actName,
  chooseNode,
  chooseStarter,
  continueRun,
  deploy,
  doctrineCandidates,
  doctrinePaths,
  eventChoice,
  mapChoices,
  newRun,
  pendingPicks,
  pickDoctrine,
  pickRelic,
  pickTower,
  rankOfTower,
  repairChoice,
  rerollPrice,
  retire,
  reroll,
  rosterCap,
  runDepth,
  towerRarity,
  type RunState,
  type ShopItem,
} from "../run/run";
import { buy, SHOP_TEXT, TARGETED } from "../run/shop";
import { dailyPlayed, loadRun, markDaily, recordRun, runRecord, saveRun, unlocks } from "../run/storage";
import { sharedTags, tagsOf, TAG_LABEL } from "../run/tags";
import { threatsOf } from "../run/threats";
import { REINFORCE_NODE, REPAIR_NODE, RETIRE, SKIP_RELIC, SKIP_TOWER } from "../run/tuning";
import { escape } from "./format";
import { mapPreviewSvg } from "./mission-brief";
import { fillImage, type MapImage } from "./sector-atlas";
import { towerIconHtml } from "./tower-codex";
import { pageOf, TOWER_PAGES } from "./tower-pages";

/** What the Run page may do in the app; implemented by `app/input.ts`. */
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
const KIND: Record<NodeKind, { label: string; icon: string; note: string }> = {
  standard: { label: "Mission", icon: "◆", note: "A regular mission: 14 waves." },
  elite: { label: "Elite", icon: "✶", note: "Tougher enemies and a modifier; pays a relic prize and a fourth draft card." },
  boss: { label: "Act boss", icon: "♛", note: "16 waves with a boss modifier. Win it to cross into the next act." },
  final: { label: "Final Stand", icon: "☗", note: "20 waves, Titans at the end. Win it and the run is won." },
  shop: { label: "Shop", icon: "⌂", note: "Spend Scrap on repairs, funds, upgrades, a relic or a tower." },
  forge: { label: "Forge", icon: "⚒", note: "Doctrines, drills, rank XP and discounts for your towers." },
  repair: { label: "Repair", icon: "✚", note: "Repair the reactor, or reinforce it for good." },
  event: { label: "Event", icon: "?", note: "Something unexpected. Every choice shows its cost." },
};
const STARS = (n: number) => "★".repeat(n) + "☆".repeat(3 - n);
let host: RunHost,
  root: HTMLElement,
  run: RunState | undefined,
  /** Intro: the chosen threat level and run length. */
  threat = 0,
  length: "full" | "short" = "full",
  /** Map: the node whose details show below the map. */
  focusLane: number | undefined,
  /** A drafted tower waiting for the roster tower it replaces (roster full). */
  replacing: { tower: TowerId; source: "draft" | "shop"; index?: number } | undefined,
  /** A shop item waiting for its target tower (and path, for a Doctrine). */
  targeting: number | undefined,
  /** Doctrine pick: the tower whose paths are shown. */
  doctrineTower: TowerId | undefined,
  /** Two-click confirmations. */
  armed: string | undefined;
const randomSeed = () => Math.floor(Math.random() * 36 ** 6);
export function openRun(h: RunHost) {
  host = h;
  root = document.getElementById("run-root")!;
  if (!root.dataset.bound) {
    root.dataset.bound = "1";
    root.addEventListener("click", onClick);
    root.addEventListener("submit", onSubmit);
    root.addEventListener("change", onChange);
    root.addEventListener("input", (e) => {
      if (e.target instanceof HTMLInputElement) e.target.setCustomValidity("");
    });
  }
  run = loadRun(host.content);
  threat = Math.min(threat, unlocks(runRecord()).threat);
  reset();
  render();
}
function reset() {
  focusLane = undefined;
  replacing = undefined;
  targeting = undefined;
  doctrineTower = undefined;
  armed = undefined;
}
function update(next: RunState | undefined) {
  const ended = next && run && run.phase !== next.phase && (next.phase === "won" || next.phase === "lost");
  run = next;
  saveRun(run);
  if (ended) recordRun(next!);
  reset();
  render();
}
function start(seed: number, daily?: string) {
  const u = unlocks(runRecord()),
    options = daily
      ? { length: "short" as const, threat: DAILY_THREAT, daily }
      : { length: u.full ? length : ("short" as const), threat, packs: u.packs, trapPack: u.trapPack };
  let next = newRun(seed, options, host.content);
  // The daily run has a fixed starter: everybody plays the same pack.
  if (daily) {
    markDaily(daily);
    next = chooseStarter(next, 0);
  }
  update(next);
}
function onSubmit(e: Event) {
  if (!(e.target instanceof HTMLFormElement) || e.target.id !== "run-seed-form") return;
  e.preventDefault();
  const input = e.target.querySelector("input")!,
    seed = parseSeed(input.value);
  if (seed === undefined) {
    input.setCustomValidity("Up to six letters or digits.");
    input.reportValidity();
    return;
  }
  start(seed);
}
function onChange(e: Event) {
  const t = e.target as HTMLInputElement | HTMLSelectElement;
  if (t.name === "run-threat") threat = Number(t.value);
  if (t.name === "run-length") length = t.value === "short" ? "short" : "full";
}
function onClick(e: Event) {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-run]");
  if (!b || b.disabled) return;
  const [action, a = "", c = ""] = b.dataset.run!.split(":"),
    content = host.content;
  if (action !== "abandon" && action !== "retire") armed = undefined;
  switch (action) {
    case "new":
      return start(randomSeed());
    case "seed":
      return start(Number(a));
    case "daily": {
      const date = dailyDate(new Date());
      return start(dailySeed(date), date);
    }
    case "starter":
      return run && update(chooseStarter(run, Number(a)));
    case "focus":
      focusLane = Number(a);
      return render();
    case "travel":
      return run && update(chooseNode(run, Number(a), content));
    case "deploy": {
      if (!run?.node || !host.canRun()) return;
      const next = deploy(run);
      saveRun(next);
      run = next;
      const { mission, content: pack } = runMission(next, next.node!, content);
      return host.launch(mission, pack);
    }
    case "resume": {
      if (!run?.node) return;
      if (host.playing()) return host.resume();
      const journal = host.journal(),
        { mission, content: pack } = runMission(run, run.node, content);
      if (journal && journal.missionId === mission.id) return host.launch(mission, pack, journal);
      return;
    }
    case "forfeit":
      // A deployed mission without a journal (storage cleared) cannot be resumed: it counts as lost.
      return run && update(abandon(run));
    case "tower": {
      if (!run) return;
      if (a && run.roster.length >= rosterCap(run)) {
        replacing = { tower: a as TowerId, source: "draft" };
        return render();
      }
      return update(pickTower(run, a ? (a as TowerId) : null));
    }
    case "replace": {
      if (!run || !replacing) return;
      if (replacing.source === "draft") return update(pickTower(run, replacing.tower, a as TowerId));
      return update(buy(run, replacing.index!, content, { tower: a as TowerId }));
    }
    case "cancel":
      reset();
      return render();
    case "reroll":
      return run && update(reroll(run, content));
    case "relic":
      return run && update(pickRelic(run, a as "relics" | "prize" | "legendary", c ? (c as RelicId) : null));
    case "doctrine-tower":
      doctrineTower = a as TowerId;
      return render();
    case "doctrine":
      return run && update(pickDoctrine(run, a ? (a as TowerId) : null, c || undefined, content));
    case "retire":
      if (!run) return;
      if (armed !== `retire:${a}`) {
        armed = `retire:${a}`;
        return render();
      }
      return update(retire(run, a as TowerId));
    case "buy": {
      if (!run) return;
      const item = run.offers.shop?.[Number(a)];
      if (!item) return;
      if (TARGETED.has(item.kind)) {
        targeting = Number(a);
        return render();
      }
      if (item.kind === "tower" && run.roster.length >= rosterCap(run)) {
        replacing = { tower: item.tower!, source: "shop", index: Number(a) };
        return render();
      }
      return update(buy(run, Number(a), content));
    }
    case "target": {
      if (!run || targeting === undefined) return;
      return update(buy(run, targeting, content, { tower: a as TowerId, path: c || undefined }));
    }
    case "repair":
      return run && update(repairChoice(run, a as "heal" | "reinforce"));
    case "event":
      return run && update(eventChoice(run, Number(a), content));
    case "continue":
      return run && update(continueRun(run, content));
    case "abandon":
      if (!run) return;
      if (armed !== "abandon") {
        armed = "abandon";
        return render();
      }
      return update(abandon(run));
    case "clear":
      return update(undefined);
  }
}
// ── Pieces ──
const towerName = (id: TowerId) => host.content.towers[id].name;
const pips = (rank: number) => (rank ? `<span class="run-rank" title="Rank ${rank}: ${escape(RANK_TEXT[rank])}">${"▮".repeat(rank)}${"▯".repeat(MAX_RANK - rank)}</span>` : "");
function towerChip(r: RunState, id: TowerId, extra = "") {
  const d = host.content.towers[id],
    doctrines = r.doctrines.filter((x) => x.startsWith(`${id}:`)).map((x) => d.visual.paths?.[x.split(":")[1]]?.name ?? x.split(":")[1]);
  return `<li class="run-chip" title="${escape(`${d.role}. ${rankHint(r.ranks[id])}`)}">${towerIconHtml(d)}<span>${escape(d.name)}</span>${pips(rankOfTower(r, id))}${
    doctrines.length ? `<em class="run-doctrine-tag">${escape(doctrines.join(" + "))}</em>` : ""
  }${extra}</li>`;
}
function relicChip(id: RelicId) {
  const r = relicOf(id);
  return `<li class="run-chip run-relic" data-rarity="${r.rarity}" title="${escape(r.description)}"><i aria-hidden="true">${r.icon}</i><span>${escape(r.name)}</span></li>`;
}
function relicCard(slot: string, id: RelicId) {
  const relic = relicOf(id);
  return `<button class="choice-card run-card run-relic-card" data-rarity="${relic.rarity}" data-run="relic:${slot}:${id}"><span class="choice-index">${relic.rarity.toUpperCase()} RELIC</span><span class="run-icon run-glyph" aria-hidden="true">${relic.icon}</span><strong>${escape(relic.name)}</strong><span>${escape(relic.description)}${slot === "prize" && relic.rarity === "cursed" ? " Pays 30 Scrap." : ""}</span></button>`;
}
function statusHtml(r: RunState) {
  const total = missionsOf(r.length),
    depth = runDepth(r),
    acts = r.length === "short" ? ["I"] : ["I", "II", "III", "Final"],
    actStrip = acts.map((label, i) => `<li data-state="${i < r.act || r.phase === "won" ? "won" : i === r.act ? "current" : "open"}">${label}</li>`).join(""),
    reactor = Math.round((100 * r.reactor) / r.reactorMax);
  return `<section class="run-status" aria-label="This run"><div class="run-meta"><span>${r.daily ? `DAILY <b>${r.daily}</b>` : `SEED <b>${seedText(r.seed)}</b>`}${r.threat ? ` · THREAT <b>${r.threat}</b>` : ""}${r.length === "short" ? " · SHORT RUN" : ""}</span><ol class="run-steps run-acts" aria-label="Acts">${actStrip}</ol><span>MISSION <b>${Math.min(depth + (r.phase === "won" ? 0 : 1), total)}/${total}</b></span></div>
<div class="run-gauges"><div class="run-gauge" title="Reactor energy carries from mission to mission"><span>REACTOR</span><b>${r.reactor}/${r.reactorMax}</b><i style="--fill:${reactor}%" data-low="${reactor < 35}"></i></div><div class="run-gauge"><span>SCRAP</span><b>◈ ${r.scrap}</b></div><div class="run-gauge"><span>ROSTER</span><b>${r.roster.length}/${rosterCap(r)}</b></div>${
    r.funds ? `<div class="run-gauge"><span>NEXT MISSION</span><b>+◇ ${r.funds}</b></div>` : ""
  }${r.loan ? `<div class="run-gauge"><span>ON LOAN</span><b>${escape(towerName(r.loan))}</b></div>` : ""}</div>${
    r.roster.length ? `<div class="run-carry"><h2>Roster</h2><ul class="run-chips">${r.roster.map((id) => towerChip(r, id)).join("")}</ul></div>` : ""
  }${r.relics.length ? `<div class="run-carry"><h2>Relics</h2><ul class="run-chips">${r.relics.map(relicChip).join("")}</ul></div>` : ""}</section>`;
}
function introHtml() {
  const record = runRecord(),
    u = unlocks(record),
    date = dailyDate(new Date()),
    played = dailyPlayed(record, date),
    levels = Array.from({ length: Math.min(MAX_THREAT, u.threat) + 1 }, (_, i) => `<option value="${i}"${i === threat ? " selected" : ""}>${i} · ${escape(THREAT_TEXT[i])}</option>`).join("");
  const history = record.history.length
    ? `<h2 class="run-step-title">Recent runs</h2><ol class="run-history">${record.history
        .map(
          (h) =>
            `<li data-won="${h.won}"><span>${h.daily ? escape(h.daily) : seedText(h.seed)}</span>${h.length === "short" ? "Short" : "Full"}${h.threat ? ` · Threat ${h.threat}` : ""}<b>${h.won ? "Won" : `${h.depth}/${missionsOf(h.length)}`}</b>${
              h.daily ? "" : `<button class="quiet run-mini" data-run="seed:${h.seed}">Play seed</button>`
            }</li>`,
        )
        .join("")}</ol>`
    : "";
  return `<div class="run-intro"><p>Ten missions in three acts and a Final Stand, on campaign maps with waves generated from each map's enemies. You start with three towers. Every win drafts another, earns Scrap and rank XP, and every second one a relic; Doctrines unlock levels 6–8. The reactor's damage carries from mission to mission, and <b>one lost mission ends the run</b>.</p>
<div class="run-options"><fieldset class="run-length"><legend>Length</legend><label><input type="radio" name="run-length" value="full"${length === "full" && u.full ? " checked" : ""}${u.full ? "" : " disabled"}> Full run <small>10 missions${u.full ? "" : " · win a short run first"}</small></label><label><input type="radio" name="run-length" value="short"${length === "short" || !u.full ? " checked" : ""}> Short run <small>act I, 3 missions</small></label></fieldset>
<label class="run-threat">Threat <select name="run-threat"${u.threat ? "" : " disabled"}>${levels}</select></label></div>
<div class="run-start"><button class="primary" data-run="new">New Run <span>→</span></button><form id="run-seed-form" class="run-seed"><label for="run-seed">Seed</label><input id="run-seed" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="4F2K9Q"><button class="quiet">Play seed</button></form>${
    u.daily
      ? `<button class="quiet run-daily" data-run="daily"${played ? " disabled" : ""}>Daily run <small>${played ? `played · ${record.daily[date]}/3` : `${date} · threat ${DAILY_THREAT}`}</small></button>`
      : ""
  }</div>
${record.runs ? `<p class="run-record">Runs <b>${record.runs}</b> · Best full run <b>${record.best}/${missionsOf("full")}</b> · Won <b>${record.wins}</b> full, <b>${record.shortWins}</b> short${u.threat ? ` · Threat unlocked <b>${u.threat}</b>` : ""}</p>` : ""}${history}</div>`;
}
function starterHtml(r: RunState) {
  return `<h2 class="run-step-title">Choose your starter pack</h2><div class="run-cards">${(r.offers.starters ?? [])
    .map(
      (pack, i) =>
        `<button class="choice-card run-card" data-run="starter:${i}"><span class="choice-index">PACK ${String(i + 1).padStart(2, "0")}</span><strong>${pack.map(towerName).join(" · ")}</strong><ul class="run-chips">${pack.map((id) => towerChip(r, id)).join("")}</ul></button>`,
    )
    .join("")}</div>`;
}
/** Threat chips of a generated mission, with what answers each. */
function threatChips(r: RunState, node: RunNode) {
  const { mission, content, suppressed } = runMission(r, node, host.content),
    threats = threatsOf(mission, content, mission.availableTowers ?? r.roster, suppressed);
  if (!threats.length) return "";
  return `<ul class="run-threats">${threats
    .map((t) => {
      const by = t.answeredBy.map(towerName).join(", "),
        hard = t.id === "air" || t.id === "stealth" || t.id === "burrow",
        title = t.suppressed ? `None: no tower in your roster answers ${t.label.toLowerCase()}, so they stay away (no hazard pay).` : hard ? (by ? `Answered by ${by}.` : "Nothing in your roster answers this!") : "";
      return `<li data-threat="${t.id}"${t.suppressed ? " data-suppressed" : ""}${hard && !t.suppressed && !by ? " data-open" : ""} title="${escape(title)}">${escape(t.label)}${t.share ? ` <small>${Math.round(t.share * 100)}%</small>` : ""}</li>`;
    })
    .join("")}</ul>`;
}
function modsHtml(node: RunNode) {
  return node.mods?.length
    ? `<ul class="run-mods">${node.mods
        .map((id) => {
          const m = bossModOf(id);
          return `<li><i aria-hidden="true">${m.icon}</i><b>${escape(m.name)}</b> ${escape(m.description)}</li>`;
        })
        .join("")}</ul>`
    : "";
}
function missionFacts(r: RunState, node: RunNode) {
  const { mission } = runMission(r, node, host.content),
    format = FORMATS[node.kind as keyof typeof FORMATS];
  return `<p class="run-facts">${format.waves} waves · ◇ ${mission.startingCredits} starting credits · ⚡ ${mission.reactorEnergy} reactor energy</p>`;
}
function nodeDetail(r: RunState, node: RunNode, reachable: boolean) {
  const k = KIND[node.kind],
    go = reachable ? `<button class="primary" data-run="travel:${node.lane}">${isMissionKind(node.kind) ? "Choose this mission" : `Go to the ${k.label.toLowerCase()}`} <span>→</span></button>` : `<p class="run-note">Not reachable from where you stand.</p>`;
  if (!isMissionKind(node.kind)) return `<div class="run-node-detail"><p class="choice-index">${k.label.toUpperCase()}</p><h3>${k.icon} ${k.label}</h3><p>${k.note}</p>${go}</div>`;
  const source = host.content.missions.find((m) => m.id === node.mission)!;
  return `<div class="run-node-detail run-deploy" data-kind="${node.kind}"><div class="run-map" data-map="${node.mission}">${mapPreviewSvg(source.map)}<img alt=""></div><div><p class="choice-index">${k.label.toUpperCase()}</p><h3>${escape(source.map.name)}</h3><p>${k.note}</p>${modsHtml(node)}${missionFacts(r, node)}${threatChips(r, node)}${go}</div></div>`;
}
function mapHtml(r: RunState) {
  const columns = actMapOf(r, host.content),
    choices = mapChoices(r, host.content),
    reachable = new Set(choices.map((n) => `${n.column}:${n.lane}`)),
    focus = focusLane !== undefined ? choices.find((n) => n.lane === focusLane) : choices.length === 1 ? choices[0] : undefined,
    x = (c: number) => ((c + 0.5) / columns.length) * 100,
    y = (n: RunNode) => ((columns[n.column].length === 1 ? 1 : n.lane) + 0.5) * (100 / LANES),
    lines: string[] = [];
  for (let c = 0; c + 1 < columns.length; c++)
    for (const a of columns[c])
      for (const b of columns[c + 1])
        if (columns[c + 1].length === 1 || columns[c].length === 1 || Math.abs(a.lane - b.lane) <= 1) {
          // The roads leaving the player's node are the live ones.
          const live = c === r.column && a.lane === r.lane;
          lines.push(`<line x1="${x(c)}" y1="${y(a)}" x2="${x(c + 1)}" y2="${y(b)}"${live ? ' data-live=""' : ""}/>`);
        }
  const svg = (flip: boolean) =>
    `<svg class="run-route-lines${flip ? " is-vertical" : ""}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${flip ? lines.map((l) => l.replace(/x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/, 'x1="$2" y1="$1" x2="$4" y2="$3"')).join("") : lines.join("")}</svg>`;
  const nodes = columns
    .flat()
    .map((n) => {
      const k = KIND[n.kind],
        key = `${n.column}:${n.lane}`,
        state = n.column < r.column || (n.column === r.column && n.lane === r.lane) ? (n.column === r.column && n.lane === r.lane ? "here" : "past") : reachable.has(key) ? "next" : "ahead",
        name = n.mission ? host.content.missions.find((m) => m.id === n.mission)?.map.name : "";
      return `<button class="run-node" data-kind="${n.kind}" data-state="${state}"${focus && focus.column === n.column && focus.lane === n.lane ? ' aria-pressed="true"' : ""} style="--c:${x(n.column)}%;--l:${y(n)}%" data-run="focus:${n.lane}"${state === "next" ? "" : " disabled"} title="${escape(k.label + (name ? `: ${name}` : ""))}"><i aria-hidden="true">${k.icon}</i><span>${escape(name || k.label)}</span></button>`;
    })
    .join("");
  const act = actName(r, host.content);
  return `<h2 class="run-step-title">${r.act >= 3 ? "The Final Stand" : `Act ${["I", "II", "III"][r.act]}: ${escape(act)}`}</h2><p class="run-note">${choices.length ? "Pick where to go next. Missions, camps and the act boss lie ahead; lines show the roads." : ""}</p><div class="run-routemap" data-act="${r.act}">${svg(false)}${svg(true)}${nodes}</div>${
    focus ? nodeDetail(r, focus, true) : `<p class="run-note">Select a highlighted node to see what waits there.</p>`
  }`;
}
function deployHtml(r: RunState) {
  const node = r.node!,
    k = KIND[node.kind],
    { mission } = runMission(r, node, host.content),
    playing = host.playing() === mission.id,
    journal = host.journal(),
    resumable = r.deployed && journal?.missionId === mission.id,
    blocked = !host.canRun(),
    source = host.content.missions.find((m) => m.id === node.mission)!;
  const action = playing
    ? `<button class="primary" data-run="resume">Return to mission <span>→</span></button>`
    : resumable
      ? `<button class="primary" data-run="resume"${blocked ? " disabled" : ""}>Resume mission (wave ${Math.max(1, journal!.wave ?? 1)}) <span>→</span></button><p class="run-note">The mission continues where you left it. It cannot be restarted.</p>`
      : r.deployed
        ? `<p class="run-note">This mission was interrupted and its record is gone. It counts as lost.</p><button class="primary" data-run="forfeit">End the run</button>`
        : `<button class="primary" data-run="deploy"${blocked ? " disabled" : ""}>Deploy <span>→</span></button><p class="run-note">Once deployed, the mission can be resumed but never restarted.</p>`;
  return `<h2 class="run-step-title">Mission ${runDepth(r) + 1} of ${missionsOf(r.length)}</h2><div class="run-deploy" data-kind="${node.kind}"><div class="run-map" data-map="${node.mission}">${mapPreviewSvg(source.map)}<img alt=""></div><div><p class="choice-index">${k.label.toUpperCase()}</p><h3>${escape(mission.name)}</h3><p>${k.note}</p>${modsHtml(node)}${missionFacts(r, node)}${threatChips(r, node)}${action}${
    blocked ? `<p class="run-note">Leave the multiplayer room to play a run.</p>` : ""
  }</div></div>`;
}
function draftHtml(r: RunState) {
  if (!r.offers.towers) return "";
  if (replacing) return replaceHtml(r);
  const cards = r.offers.towers
    .map((id) => {
      const d = host.content.towers[id],
        rarity = towerRarity(id, host.content),
        shared = sharedTags(id, r.roster, host.content),
        tags = tagsOf(d).map((t) => `<li${shared.includes(t) ? " data-shared" : ""}>${TAG_LABEL[t]}</li>`).join("");
      return `<button class="choice-card run-card" data-rarity="${rarity}" data-run="tower:${id}"><span class="choice-index">${rarity.toUpperCase()} · ${TOWER_PAGES[pageOf(d)].name.toUpperCase()} · ◇ ${d.cost}</span><span class="run-icon">${towerIconHtml(d)}</span><strong>${escape(d.name)}</strong><span>${escape(d.role)}: ${escape(d.description)}</span><ul class="run-tags">${tags}</ul>${
        shared.length >= 1 ? `<span class="run-synergy">Synergy: ${shared.map((t) => TAG_LABEL[t]).join(", ")}</span>` : ""
      }</button>`;
    })
    .join("");
  const full = r.roster.length >= rosterCap(r);
  return `<h2 class="run-step-title">Draft a tower</h2>${full ? `<p class="run-note">Your roster is full (${r.roster.length}/${rosterCap(r)}): a new tower replaces one.</p>` : ""}<div class="run-cards">${cards}</div><div class="run-row"><button class="quiet" data-run="reroll"${r.scrap < rerollPrice(r) ? " disabled" : ""}>Reroll (◈ ${rerollPrice(r)})</button><button class="quiet" data-run="tower:">Skip the draft (+◈ ${SKIP_TOWER})</button></div>`;
}
function replaceHtml(r: RunState) {
  const t = replacing!.tower;
  return `<h2 class="run-step-title">Replace a tower with ${escape(towerName(t))}</h2><p class="run-note">The replaced tower loses its rank XP and Doctrine.</p><ul class="run-chips run-pick">${r.roster
    .map((id) => towerChip(r, id, `<button class="quiet run-mini" data-run="replace:${id}">Replace</button>`))
    .join("")}</ul><button class="quiet" data-run="cancel">Cancel</button>`;
}
function relicsHtml(r: RunState) {
  const block = (slot: "relics" | "prize" | "legendary", title: string, skip: string) =>
    r.offers[slot]
      ? `<h2 class="run-step-title">${title}</h2><div class="run-cards">${r.offers[slot]!.map((id) => relicCard(slot, id)).join("")}</div><div class="run-row"><button class="quiet" data-run="relic:${slot}:">${skip}</button></div>`
      : "";
  return (
    block("relics", "Take a relic", `Skip the relic (+◈ ${SKIP_RELIC})`) +
    block("prize", "Elite prize", "Skip the prize") +
    block("legendary", r.phase === "act" ? "A legendary relic" : "Legendary relic", "Skip")
  );
}
function doctrineHtml(r: RunState) {
  if (!r.offers.doctrine) return "";
  const candidates = doctrineCandidates(r, host.content),
    tower = doctrineTower && candidates.includes(doctrineTower) ? doctrineTower : candidates[0];
  return `<h2 class="run-step-title">${r.phase === "act" ? "…or a Doctrine" : "Choose a Doctrine"}</h2><p class="run-note">A Doctrine unlocks one specialization path (levels 6–8) of a tower type for the rest of the run. The type is committed to it.</p>${doctrinePicker(r, candidates, tower, (id, path) => `doctrine:${id}:${path}`)}<div class="run-row"><button class="quiet" data-run="doctrine:">Skip the Doctrine</button></div>`;
}
/** The roster towers that can take a Doctrine, and the paths of the selected one. */
function doctrinePicker(r: RunState, candidates: readonly TowerId[], tower: TowerId | undefined, action: (id: TowerId, path: string) => string) {
  if (!tower) return `<p class="run-note">No tower in your roster can take a Doctrine.</p>`;
  const d = host.content.towers[tower],
    tabs = candidates.map((id) => `<button class="quiet run-mini" data-run="doctrine-tower:${id}"${id === tower ? ' aria-pressed="true"' : ""}>${escape(towerName(id))}</button>`).join(""),
    paths = doctrinePaths(r, tower, host.content)
      .map((path) => {
        const v = d.visual.paths?.[path],
          tiers = d.upgrades.filter((u) => isSpecialization(u) && u.path === path),
          color = v ? `#${v.color.toString(16).padStart(6, "0")}` : "var(--run)";
        return `<button class="choice-card run-card run-path" style="--path:${color}" data-run="${action(tower, path)}"><span class="choice-index">${escape(towerName(tower).toUpperCase())} · LEVELS 6–8</span><strong>${escape(v?.name ?? path)}</strong><span>${escape(v?.role ?? "")}</span><ol class="run-tiers">${tiers.map((u) => `<li>${escape(u.description)}</li>`).join("")}</ol></button>`;
      })
      .join("");
  return `<div class="run-row run-doctrine-tabs">${tabs}</div><div class="run-cards">${paths}</div>`;
}
function rosterManageHtml(r: RunState) {
  if (r.roster.length <= 1) return "";
  return `<details class="run-manage"><summary>Retire a tower (+◈ ${RETIRE})</summary><ul class="run-chips run-pick">${r.roster
    .map((id) => towerChip(r, id, `<button class="quiet run-mini" data-run="retire:${id}">${armed === `retire:${id}` ? "Confirm" : "Retire"}</button>`))
    .join("")}</ul></details>`;
}
function continueHtml(r: RunState, label: string) {
  const open = pendingPicks(r);
  return `<div class="run-row run-continue"><button class="primary" data-run="continue"${open ? " disabled" : ""}>${label} <span>→</span></button>${open ? `<p class="run-note">Pick or skip every offer first.</p>` : ""}</div>`;
}
function rewardHtml(r: RunState) {
  const last = r.log[r.log.length - 1],
    ups = r.offers.rankUps?.map((id) => `${escape(towerName(id))} reached rank ${rankOfTower(r, id)}`).join(" · ");
  return `<p class="run-banner">Mission cleared.</p><p class="run-facts">${last?.stars ? `${STARS(last.stars)} · ` : ""}+◈ ${last?.scrap ?? 0} Scrap · reactor ${last?.end ?? r.reactor} → ${r.reactor} after field repairs</p>${
    ups ? `<p class="run-rankup">▲ ${ups}</p>` : ""
  }${draftHtml(r)}${replacing ? "" : relicsHtml(r) + doctrineHtml(r) + rosterManageHtml(r) + continueHtml(r, r.node?.kind === "boss" ? "Cross to the next act" : "Back to the map")}`;
}
function shopItemHtml(r: RunState, item: ShopItem, i: number) {
  const label =
    item.kind === "relic" && item.relic
      ? `${relicOf(item.relic).name}: ${relicOf(item.relic).description}`
      : item.kind === "tower" && item.tower
        ? `${towerName(item.tower)}: ${host.content.towers[item.tower].role}`
        : SHOP_TEXT[item.kind];
  const disabled = item.sold || r.scrap < item.price || (item.kind === "patch" && r.reactor >= r.reactorMax);
  return `<button class="choice-card run-card run-shop" data-run="buy:${i}"${disabled ? " disabled" : ""}><span class="choice-index">${item.sold ? "SOLD" : `◈ ${item.price}`}</span>${
    item.tower ? `<span class="run-icon">${towerIconHtml(host.content.towers[item.tower])}</span>` : item.relic ? `<span class="run-icon run-glyph">${relicOf(item.relic).icon}</span>` : ""
  }<span>${escape(label)}</span></button>`;
}
function targetHtml(r: RunState) {
  const item = r.offers.shop![targeting!];
  if (item.kind === "doctrine") {
    const candidates = doctrineCandidates(r, host.content),
      tower = doctrineTower && candidates.includes(doctrineTower) ? doctrineTower : candidates[0];
    return `<h2 class="run-step-title">Buy a Doctrine</h2>${doctrinePicker(r, candidates, tower, (id, path) => `target:${id}:${path}`)}<button class="quiet" data-run="cancel">Cancel</button>`;
  }
  return `<h2 class="run-step-title">${escape(SHOP_TEXT[item.kind])}</h2><p class="run-note">Choose the tower.</p><ul class="run-chips run-pick">${r.roster
    .map((id) => towerChip(r, id, `<button class="quiet run-mini" data-run="target:${id}"${item.kind !== "xp" && r.mods.some((m) => m.tower === id && m.kind === item.kind) ? " disabled" : ""}>Choose</button>`))
    .join("")}</ul><button class="quiet" data-run="cancel">Cancel</button>`;
}
function campHtml(r: RunState) {
  const node = r.node!,
    k = KIND[node.kind];
  let body = "";
  if (replacing) body = replaceHtml(r);
  else if (targeting !== undefined && r.offers.shop) body = targetHtml(r);
  else {
    if (r.offers.shop) body += `<div class="run-cards">${r.offers.shop.map((item, i) => shopItemHtml(r, item, i)).join("")}</div>`;
    if (r.offers.repair) {
      const heal = Math.round(REPAIR_NODE * (r.threat >= 8 ? 0.5 : 1));
      body += `<div class="run-cards"><button class="choice-card run-card" data-run="repair:heal"${r.reactor >= r.reactorMax ? " disabled" : ""}><span class="choice-index">REPAIR</span><strong>+${heal} reactor</strong><span>Patch the reactor up to its maximum.</span></button><button class="choice-card run-card" data-run="repair:reinforce"><span class="choice-index">REINFORCE</span><strong>+${REINFORCE_NODE} maximum</strong><span>The reactor holds ${REINFORCE_NODE} more energy for the rest of the run.</span></button></div>`;
    }
    const event = r.offers.event ? eventOf(r.offers.event) : undefined;
    if (event)
      body += `<div class="run-event"><h3>${escape(event.title)}</h3><p>${escape(event.text)}</p><div class="run-cards">${event
        .choices(r, host.content)
        .map((c, i) => `<button class="choice-card run-card" data-run="event:${i}"${c.ok ? "" : " disabled"}><strong>${escape(c.label)}</strong><span>${escape(c.detail)}</span></button>`)
        .join("")}</div></div>`;
    body += draftHtml(r) + doctrineHtml(r);
    if (!r.offers.event && !r.offers.repair) body += `<div class="run-row run-continue"><button class="primary" data-run="continue">Leave <span>→</span></button></div>`;
  }
  return `<h2 class="run-step-title">${k.icon} ${k.label}</h2><p class="run-note">${k.note}</p>${body}`;
}
function actHtml(r: RunState) {
  const next = r.length === "full" && r.act + 1 >= 3 ? "The Final Stand" : `Act ${["I", "II", "III"][r.act + 1]}: ${escape(actName({ act: r.act + 1 }, host.content))}`;
  return `<p class="run-banner">Act ${["I", "II", "III"][r.act]} cleared.</p><p class="run-facts">The reactor is fully repaired (${r.reactor}/${r.reactorMax}). Next: ${next}. Your roster now holds up to ${rosterCap({ ...r, act: r.act + 1 })} towers.</p>${relicsHtml(r)}${doctrineHtml(r)}${continueHtml(r, `On to ${next}`)}`;
}
function endHtml(r: RunState) {
  const won = r.phase === "won",
    depth = runDepth(r),
    total = missionsOf(r.length),
    record = runRecord(),
    lines = r.log
      .map((h, i) => {
        const name = host.content.missions.find((m) => m.id === h.mission)?.map.name ?? h.mission;
        return `<li data-won="${h.won}"><span>${i + 1}</span>${escape(name)} <small>${KIND[h.kind].label}</small><small>⚡ ${h.start} → ${h.end}</small>${h.stars ? `<small>${STARS(h.stars)}</small>` : ""}<b>${h.won ? "Cleared" : `Lost${h.wave ? ` at wave ${h.wave}` : ""}`}</b></li>`;
      })
      .join(""),
    kills = r.log.reduce((n, h) => n + h.kills, 0),
    scrap = r.log.reduce((n, h) => n + h.scrap, 0);
  return `<div class="run-end" data-won="${won}"><p class="eyebrow">${won ? "RUN COMPLETE" : "RUN OVER"}</p><h2>${won ? "Every line held." : `${depth} of ${total} missions cleared.`}</h2><p class="run-facts">${kills} enemies destroyed · ◈ ${scrap} Scrap earned · ${r.relics.length} relics · ${r.doctrines.length} Doctrines</p><ol class="run-history">${lines}</ol><p class="run-record">Best full run <b>${record.best}/${missionsOf("full")}</b> · Won <b>${record.wins}</b> full, <b>${record.shortWins}</b> short · Runs <b>${record.runs}</b></p><div class="run-start"><button class="primary" data-run="new">New Run <span>→</span></button>${
    r.daily ? "" : `<button class="quiet" data-run="seed:${r.seed}">Replay this seed</button>`
  }<button class="quiet" data-run="clear">Close</button></div></div>`;
}
function render() {
  const r = run,
    live = r && r.phase !== "won" && r.phase !== "lost",
    body = !r
      ? introHtml()
      : r.phase === "starter"
        ? starterHtml(r)
        : r.phase === "map"
          ? mapHtml(r)
          : r.phase === "mission"
            ? deployHtml(r)
            : r.phase === "reward"
              ? rewardHtml(r)
              : r.phase === "camp"
                ? campHtml(r)
                : r.phase === "act"
                  ? actHtml(r)
                  : endHtml(r);
  root.innerHTML = `${r ? statusHtml(r) : ""}<div class="run-body">${body}</div>${
    live ? `<button class="quiet run-abandon" data-run="abandon">${armed === "abandon" ? "Press again to abandon the run" : "Abandon run"}</button>` : ""
  }`;
  // The real terrain fades in over the SVG placeholders once it is rendered.
  for (const frame of root.querySelectorAll<HTMLElement>("[data-map]")) {
    const img = frame.querySelector("img")!,
      map = host.content.missions.find((m) => m.id === frame.dataset.map)?.map;
    if (map) fillImage(img, map, host.image);
  }
}
/** How far a tower type is from its next rank. */
const rankHint = (xp?: number) => {
  const next = nextRankAt(xp);
  return next === undefined ? "Top rank." : `${next - (xp ?? 0)} XP to the next rank.`;
};
