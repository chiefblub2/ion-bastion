/**
 * The Run page (`/#run`): start a run (full, short or daily, at a threat level), pick the starter pack, walk each
 * act's map, deploy or resume missions, take rewards, visit camps, cross act transitions and read the summary.
 * Loaded on first entry like the editor; every decision is a pure transition of `run/run.ts`, stored after each step.
 */
import "./run.css";
import type { ContentPack, MissionDefinition, TowerId } from "../core/types";
import { isSpecialization } from "../core/upgrades";
import { MAX_THREAT, THREAT_TEXT, threatRules } from "../run/ascension";
import { bossModOf } from "../run/boss";
import { DAILY_THREAT, dailyDate, dailySeed } from "../run/daily";
import { eventOf } from "../run/events";
import { runMission } from "../run/generate";
import type { Journal } from "../run/journal";
import { isMissionKind, LANES, missionsOf, type NodeKind, type RunNode } from "../run/map";
import { MASTERY, MAX_RANK, nextRankAt, rankText } from "../run/ranks";
import { relicFit } from "../run/relic-fit";
import { hasFlag, relicOf, signatureOf, type RelicId } from "../run/relics";
import { rewardProgress, rewardSteps } from "../run/rewards";
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
import { rosterCovers, threatsOf, type Need } from "../run/threats";
import { REINFORCE_NODE, REPAIR_NODE, RETIRE, SKIP_RELIC, SKIP_TOWER, XP_BOUGHT } from "../run/tuning";
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
  standard: { label: "Mission", icon: "◆", note: "A regular mission. Missions grow longer from act to act." },
  elite: { label: "Elite", icon: "✶", note: "Tougher enemies and a modifier; pays a relic prize and a fourth draft card." },
  boss: { label: "Act boss", icon: "♛", note: "The act's longest mission, with a boss modifier. Win it to cross into the next act." },
  final: { label: "Final Stand", icon: "☗", note: "The run's longest mission, with Titans at the end. Win it and the run is won." },
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
  /** Map: the lane of the node whose card is open on the map; null when the player closed it. */
  focusLane: number | null | undefined,
  /** A drafted tower waiting for the roster tower it replaces (roster full). */
  replacing: { tower: TowerId; source: "draft" | "shop"; index?: number } | undefined,
  /** A shop item waiting for its target tower (and path, for a Doctrine). */
  targeting: number | undefined,
  /** Doctrine pick: the tower whose paths are shown. */
  doctrineTower: TowerId | undefined,
  /** Two-click confirmations. */
  armed: string | undefined,
  /** The option selected in the current decision (a tower, relic, `<tower>:<path>` or "doctrine"); nothing changes before Take. */
  selected: string | undefined,
  /** The act reward: the player chose the Doctrine and now picks its tower and path. */
  actDoctrine = false;
const randomSeed = () => Math.floor(Math.random() * 36 ** 6);
export function openRun(h: RunHost) {
  host = h;
  root = document.getElementById("run-root")!;
  if (!root.dataset.bound) {
    root.dataset.bound = "1";
    root.addEventListener("click", onClick);
    root.addEventListener("submit", onSubmit);
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && root.querySelector(".run-decision")) {
        // Esc steps back: out of a replacement or the act's Doctrine, else clears the selection.
        if (replacing || targeting !== undefined) reset();
        else if (actDoctrine) actDoctrine = false;
        else selected = undefined;
        render();
        root.querySelector<HTMLElement>(".run-option")?.focus();
        return;
      }
      if (e.key !== "Escape" || !root.querySelector(".run-inspector")) return;
      const lane = openLane();
      focusLane = null;
      render();
      if (lane !== undefined) root.querySelector<HTMLElement>(`.run-node[data-run="focus:${lane}"]`)?.focus();
    });
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
  selected = undefined;
  actDoctrine = false;
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
    case "focus": {
      // A second tap on the open node, or the card's ✕, closes the card.
      const lane = a === "" ? null : Number(a);
      focusLane = lane !== null && lane === openLane() ? null : lane;
      render();
      return focusCard(lane === null ? undefined : lane);
    }
    case "travel":
      return run && update(chooseNode(run, Number(a), content));
    case "deploy": {
      // From the map card: choose the mission node and deploy it in one step.
      if (!run || !host.canRun()) return;
      const chosen = a === "" ? run : chooseNode(run, Number(a), content);
      if (chosen.phase !== "mission" || !chosen.node || chosen.deployed) return;
      const next = deploy(chosen);
      saveRun(next);
      run = next;
      reset();
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
    case "pick":
      // Selects an option of the current decision; Take confirms it.
      selected = c ? `${a}:${c}` : a;
      render();
      return root.querySelector<HTMLElement>(`.run-option[data-run="${b.dataset.run}"]`)?.focus();
    case "take":
      return run && take(run);
    case "skip":
      return run && skip(run);
    case "act-back":
      actDoctrine = false;
      selected = "doctrine";
      return render();
    case "cancel": {
      // Back to the decision it came from, with the same option still selected.
      const back = targeting !== undefined ? String(targeting) : replacing ? (replacing.source === "shop" ? String(replacing.index) : replacing.tower) : undefined;
      reset();
      selected = back;
      return render();
    }
    case "reroll":
      return run && update(reroll(run, content));
    case "doctrine-tower":
      doctrineTower = a as TowerId;
      selected = undefined;
      return render();
    case "retire":
      if (!run) return;
      if (armed !== `retire:${a}`) {
        armed = `retire:${a}`;
        return render();
      }
      return update(retire(run, a as TowerId));
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
/** Confirms the selected option of the current decision. */
function take(r: RunState) {
  const content = host.content,
    pick = selected;
  if (!pick) return;
  if (replacing) {
    if (!r.roster.includes(pick as TowerId)) return;
    return update(replacing.source === "draft" ? pickTower(r, replacing.tower, pick as TowerId) : buy(r, replacing.index!, content, { tower: pick as TowerId }));
  }
  if (targeting !== undefined) {
    const [tower, path] = pick.split(":");
    return update(buy(r, targeting, content, { tower: tower as TowerId, path }));
  }
  const step = rewardSteps(r)[0];
  if (r.phase === "camp" && !(step && !r.offers.event)) return takeCamp(r, pick);
  if (step === "towers") {
    if (r.roster.length >= rosterCap(r)) {
      replacing = { tower: pick as TowerId, source: "draft" };
      selected = undefined;
      return render();
    }
    return update(pickTower(r, pick as TowerId));
  }
  if (step === "act" && pick === "doctrine") {
    actDoctrine = true;
    selected = undefined;
    return render();
  }
  if (step === "doctrine" || (step === "act" && actDoctrine)) {
    const [tower, path] = pick.split(":");
    return update(pickDoctrine(r, tower as TowerId, path, content));
  }
  if (step === "relics" || step === "prize" || step === "legendary" || step === "act") return update(pickRelic(r, step === "act" ? "legendary" : step, pick as RelicId));
}
/** Camp decisions: buy the selected item (asking for its target or the tower it replaces first), repair, or an event choice. */
function takeCamp(r: RunState, pick: string) {
  const content = host.content;
  if (r.offers.shop) {
    const i = Number(pick),
      item = r.offers.shop[i];
    if (!item || shopBlock(r, item)) return;
    if (TARGETED.has(item.kind)) {
      targeting = i;
      selected = undefined;
      return render();
    }
    if (item.kind === "tower" && r.roster.length >= rosterCap(r)) {
      replacing = { tower: item.tower!, source: "shop", index: i };
      selected = undefined;
      return render();
    }
    return update(buy(r, i, content));
  }
  if (r.offers.repair && (pick === "heal" || pick === "reinforce")) return update(repairChoice(r, pick));
  if (r.offers.event) return update(eventChoice(r, Number(pick), content));
}
/** Skips the current decision (the act reward: both of its halves). */
function skip(r: RunState) {
  const step = rewardSteps(r)[0],
    content = host.content;
  if (step === "towers") return update(pickTower(r, null));
  if (step === "doctrine") return update(pickDoctrine(r, null, undefined, content));
  if (step === "act") return update(pickDoctrine(pickRelic(r, "legendary", null), null, undefined, content));
  if (step) return update(pickRelic(r, step, null));
}
// ── Pieces ──
const towerName = (id: TowerId) => host.content.towers[id].name;
const pips = (id: TowerId, rank: number) =>
  rank ? `<span class="run-rank"${rank >= 4 && MASTERY[id] ? " data-mastery" : ""} title="Rank ${rank}: ${escape(rankText(id, rank))}">${"▮".repeat(rank)}${"▯".repeat(MAX_RANK - rank)}</span>` : "";
function towerChip(r: RunState, id: TowerId, extra = "") {
  const d = host.content.towers[id],
    doctrines = r.doctrines.filter((x) => x.startsWith(`${id}:`)).map((x) => d.visual.paths?.[x.split(":")[1]]?.name ?? x.split(":")[1]);
  return `<li class="run-chip" title="${escape(`${d.role}. ${rankHint(r.ranks[id])}`)}">${towerIconHtml(d)}<span>${escape(d.name)}</span>${pips(id, rankOfTower(r, id))}${
    doctrines.length ? `<em class="run-doctrine-tag">${escape(doctrines.join(" + "))}</em>` : ""
  }${extra}</li>`;
}
function relicChip(id: RelicId) {
  const r = relicOf(id);
  return `<li class="run-chip run-relic" data-rarity="${r.rarity}" title="${escape(r.description)}"><i aria-hidden="true">${r.icon}</i><span>${escape(r.name)}</span></li>`;
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
function modsHtml(node: RunNode, r?: RunState) {
  // An act boss that opens an act transition shows the technology it may leave behind.
  const transition = r && node.kind === "boss" && r.length === "full",
    loot = transition ? (node.mods ?? []).map(signatureOf).find((id) => id) : undefined;
  return node.mods?.length
    ? `<ul class="run-mods">${node.mods
        .map((id) => {
          const m = bossModOf(id);
          return `<li title="${escape(m.description)}"><i aria-hidden="true">${m.icon}</i><b>${escape(m.name)}</b> <span class="run-mod-text">${escape(m.description)}</span></li>`;
        })
        .join("")}${
        loot
          ? `<li class="run-loot" title="${escape(relicOf(loot).description)}"><i aria-hidden="true">${relicOf(loot).icon}</i><b>Boss tech:</b> ${escape(relicOf(loot).name)}${
              relicFit(r!, loot, host.content).fits ? "" : " (needs " + escape(relicOf(loot).wantsText ?? "a fitting tower") + ")"
            }</li>`
          : ""
      }</ul>`
    : "";
}
function missionFacts(r: RunState, node: RunNode) {
  const { mission } = runMission(r, node, host.content);
  return `<p class="run-facts">${mission.waves.length} waves · ◇ ${mission.startingCredits} starting credits · ⚡ ${mission.reactorEnergy} reactor energy</p>`;
}
/**
 * The card of a node, opened on the map beside it: what waits there and the one action, Deploy for a mission (it
 * chooses the node and starts the mission in one step), Go for a camp, Resume for a deployed mission.
 */
function nodeCard(r: RunState, node: RunNode) {
  const k = KIND[node.kind],
    blocked = !host.canRun(),
    close = `<button class="quiet run-inspector-close" data-run="focus:" aria-label="Close">✕</button>`,
    head = (title: string) => `<p class="choice-index">${k.label.toUpperCase()}</p><h3>${title}</h3>`;
  if (!isMissionKind(node.kind))
    return { body: `${head(`${k.icon} ${k.label}`)}<p>${k.note}</p>`, action: `<button class="primary" data-run="travel:${node.lane}">Go to the ${k.label.toLowerCase()} <span>→</span></button>`, close };
  const { mission } = runMission(r, node, host.content),
    source = host.content.missions.find((m) => m.id === node.mission)!,
    chosen = r.phase === "mission" && r.node?.column === node.column && r.node.lane === node.lane,
    playing = chosen && host.playing() === mission.id,
    journal = host.journal(),
    resumable = chosen && r.deployed && journal?.missionId === mission.id;
  const action = playing
    ? `<button class="primary" data-run="resume">Return to mission <span>→</span></button>`
    : resumable
      ? `<button class="primary" data-run="resume"${blocked ? " disabled" : ""}>Resume mission (wave ${Math.max(1, journal!.wave ?? 1)}) <span>→</span></button><p class="run-note">It continues where you left it and cannot be restarted.</p>`
      : chosen && r.deployed
        ? `<p class="run-note">This mission was interrupted and its record is gone. It counts as lost.</p><button class="primary" data-run="forfeit">End the run</button>`
        : `<button class="primary" data-run="deploy:${node.lane}"${blocked ? " disabled" : ""}>Deploy <span>→</span></button><p class="run-note">${blocked ? "Leave the multiplayer room to play a run." : "Once deployed, it can be resumed but never restarted."}</p>`;
  return {
    body: `<div class="run-map" data-map="${node.mission}">${mapPreviewSvg(source.map)}<img alt=""></div><div class="run-inspector-text">${head(escape(source.map.name))}<p>${k.note}</p>${modsHtml(node, r)}${missionFacts(r, node)}${threatChips(r, node)}</div>`,
    action,
    // A deployed mission cannot be swapped for another, so its card stays open.
    close: chosen && r.deployed ? "" : close,
  };
}
/** The lane whose card is open: the player's pick, else the only choice or the chosen mission. */
function openLane(): number | undefined {
  if (!run || (run.phase !== "map" && run.phase !== "mission")) return undefined;
  if (run.phase === "mission" && run.deployed) return run.node!.lane;
  if (focusLane === null) return undefined;
  if (focusLane !== undefined) return focusLane;
  if (run.phase === "mission") return run.node!.lane;
  const choices = mapChoices(run, host.content);
  return choices.length === 1 ? choices[0].lane : undefined;
}
/** After the card opens, its action takes the focus (keyboard play). */
function focusCard(lane: number | undefined) {
  if (lane !== undefined) root.querySelector<HTMLElement>(".run-inspector-action :is(button, a)")?.focus({ preventScroll: true });
}
function mapHtml(r: RunState) {
  const columns = actMapOf(r, host.content),
    choices = mapChoices(r, host.content),
    // A deployed mission is the only way on.
    locked = r.phase === "mission" && r.deployed,
    reachable = new Set(choices.filter((n) => !locked || n.lane === r.node!.lane).map((n) => `${n.column}:${n.lane}`)),
    lane = openLane(),
    focus = lane !== undefined ? choices.find((n) => n.lane === lane) : undefined,
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
  // The card covers the columns on the roomier side of its node (ahead, or behind for the late columns) and points at it.
  let card = "";
  if (focus) {
    const c = nodeCard(r, focus),
      side = x(focus.column) > 50 ? "before" : "after",
      at = `--c:${x(focus.column)}%;--l:${y(focus)}%`;
    card = `<i class="run-inspector-tip" data-kind="${focus.kind}" data-side="${side}" style="${at}" aria-hidden="true"></i><section class="run-inspector" data-kind="${focus.kind}" data-side="${side}" style="${at}" aria-label="${escape(KIND[focus.kind].label)}">${c.close}<div class="run-inspector-body">${c.body}</div><div class="run-inspector-action">${c.action}</div></section>`;
  }
  const act = actName(r, host.content);
  return `<div class="run-map-head"><h2 class="run-step-title">${r.act >= 3 ? "The Final Stand" : `Act ${["I", "II", "III"][r.act]}: ${escape(act)}`}</h2>${abandonHtml()}</div><p class="run-note run-map-note">${
    locked ? "Your deployed mission waits." : choices.length ? "Pick where to go next. Missions, camps and the act boss lie ahead; lines show the roads." : ""
  }${focus || locked ? "" : " Select a highlighted node to see what waits there."}</p><div class="run-routemap" data-act="${r.act}"${focus ? " data-open" : ""}>${svg(false)}${svg(true)}${nodes}${card}</div>`;
}
const abandonHtml = () => `<button class="quiet run-abandon" data-run="abandon">${armed === "abandon" ? "Press again to abandon the run" : "Abandon run"}</button>`;
// ── Rewards: one decision at a time ──
/** A selectable option of a decision; `key` is what `pick:` and `take` carry. */
interface Option {
  key: string;
  html: string;
  rarity?: string;
  label: string;
  /** Shown but not selectable (sold, too dear for an event choice, a tower that holds the mod). */
  disabled?: boolean;
}
/**
 * One decision: its options as compact cards (a tap selects), the selected option's details beside them, and the
 * actions in a fixed row: confirm, skip, reroll. `head` carries the mission's result above the first one.
 */
function decisionHtml(d: { step: string; eyebrow: string; title: string; note?: string; options: Option[]; preview: string; actions: string; head?: string; extra?: string }) {
  const options = d.options
    .map(
      (o) =>
        `<button class="choice-card run-card run-option"${o.rarity ? ` data-rarity="${o.rarity}"` : ""} data-run="pick:${o.key}" aria-pressed="${selected === o.key}" aria-label="${escape(o.label)}"${o.disabled ? " disabled" : ""}>${o.html}</button>`,
    )
    .join("");
  return `<section class="run-decision" data-step="${d.step}" aria-label="${escape(d.title)}">${d.head ?? ""}<header class="run-decision-head"><p class="choice-index">${d.eyebrow}</p><h2 class="run-step-title">${d.title}</h2></header>${d.extra ?? ""}<div class="run-choices" data-count="${d.options.length}">${options}</div><div class="run-preview" aria-live="polite">${
    d.note ? `<p class="run-decision-note">${d.note}</p>` : ""
  }${d.preview}</div><div class="run-decision-actions">${d.actions}</div></section>`;
}
const takeButton = (label: string | undefined, enabled = !!label) =>
  `<button class="primary run-take" data-run="take"${enabled ? "" : " disabled"}>${label ? escape(label) : "Select an option"} <span>→</span></button>`;
const emptyPreview = (text: string) => `<p class="run-preview-empty">${text}</p>`;
/** The eyebrow of a reward decision: "REWARD 2 OF 3", or the step's own name when it is the only one. */
function eyebrow(r: RunState, own: string) {
  const { index, total } = rewardProgress(r);
  return total > 1 ? `REWARD ${index} OF ${total} · ${own}` : own;
}
const NEED_TEXT: Record<Need, string> = { air: "hits flyers", detect: "reveals stealth", under: "hits burrowed units" };
/** What a tower adds to the roster's answers (flyers, stealth, burrowed units). */
function addsText(r: RunState, id: TowerId) {
  const before = rosterCovers(r.roster, host.content),
    mine = rosterCovers([id], host.content),
    fresh = (Object.keys(mine) as Need[]).filter((n) => mine[n] && !before[n]);
  return fresh.length ? `<p class="run-gain">New for your roster: ${fresh.map((n) => NEED_TEXT[n]).join(", ")}.</p>` : "";
}
function towerOption(r: RunState, id: TowerId): Option {
  const d = host.content.towers[id],
    rarity = towerRarity(id, host.content),
    shared = sharedTags(id, r.roster, host.content);
  return {
    key: id,
    rarity,
    label: d.name,
    html: `<span class="run-icon">${towerIconHtml(d)}</span><span class="run-option-text"><strong>${escape(d.name)}</strong><small>${rarity} · ${TOWER_PAGES[pageOf(d)].name} · ◇ ${d.cost}</small>${
      shared.length ? `<em class="run-fit">Synergy</em>` : ""
    }</span>`,
  };
}
function towerPreview(r: RunState, id: TowerId) {
  const d = host.content.towers[id],
    shared = sharedTags(id, r.roster, host.content),
    tags = tagsOf(d).map((t) => `<li${shared.includes(t) ? " data-shared" : ""}>${TAG_LABEL[t]}</li>`).join("");
  return `<h3>${escape(d.name)}</h3><p><b>${escape(d.role)}.</b> ${escape(d.description)}</p><ul class="run-tags">${tags}</ul>${
    shared.length ? `<p class="run-synergy">Synergy with your roster: ${shared.map((t) => TAG_LABEL[t]).join(", ")}</p>` : ""
  }${addsText(r, id)}`;
}
function draftDecision(r: RunState, head = "") {
  const offers = r.offers.towers!,
    full = r.roster.length >= rosterCap(r),
    pick = selected && offers.includes(selected as TowerId) ? (selected as TowerId) : undefined;
  return decisionHtml({
    step: "towers",
    head,
    eyebrow: eyebrow(r, "TOWER DRAFT"),
    title: "Draft a tower",
    note: full ? `Your roster is full (${r.roster.length}/${rosterCap(r)}): a new tower replaces one, and you see what it costs first.` : undefined,
    options: offers.map((id) => towerOption(r, id)),
    preview: pick ? towerPreview(r, pick) : emptyPreview("Select a tower to see what it does and how it fits your roster."),
    actions: `<button class="quiet" data-run="skip">Skip (+◈ ${SKIP_TOWER})</button><button class="quiet" data-run="reroll"${r.scrap < rerollPrice(r) ? " disabled" : ""}>Reroll (◈ ${rerollPrice(r)})</button>${takeButton(
      pick && (full ? `Replace a tower with ${towerName(pick)}` : `Draft ${towerName(pick)}`),
    )}`,
  });
}
function relicOption(r: RunState, id: RelicId, slot: RelicSlot): Option {
  const relic = relicOf(id),
    fit = relicFit(r, id, host.content);
  return {
    key: id,
    rarity: relic.rarity,
    label: relic.name,
    html: `<span class="run-icon run-glyph" aria-hidden="true">${relic.icon}</span><span class="run-option-text"><strong>${escape(relic.name)}</strong><small>${relic.rarity === "signature" ? "boss tech" : relic.rarity}${slot === "prize" && relic.rarity === "cursed" ? " · +◈ 30" : ""}</small>${
      relic.wantsText || relic.category === "build" ? `<em class="run-fit" data-fits="${fit.fits}">${fit.fits ? "Fits your build" : "No fit yet"}</em>` : ""
    }</span>`,
  };
}
function relicPreview(r: RunState, id: RelicId, slot: RelicSlot) {
  const relic = relicOf(id),
    fit = relicFit(r, id, host.content),
    upside = relic.downside ? relic.description.replace(relic.downside, "").replace(/[;,]\s*(but\s*)?$/i, "").trim().replace(/[^.]$/, "$&.") : relic.description;
  return `<h3><i aria-hidden="true">${relic.icon}</i> ${escape(relic.name)}</h3>${
    relic.boss ? `<p class="run-origin">Boss technology recovered from the ${escape(bossModOf(relic.boss).name)}. Lasts for this run.</p>` : ""
  }<p class="run-upside">${escape(upside)}</p>${
    relic.downside ? `<p class="run-downside">Price: ${escape(relic.downside)}</p>` : ""
  }${slot === "prize" && relic.rarity === "cursed" ? `<p class="run-gain">Taking it pays 30 Scrap.</p>` : ""}<p class="run-fit-note" data-fits="${fit.fits}">${escape(fit.note)}</p>`;
}
type RelicSlot = "relics" | "prize" | "legendary";
const RELIC_STEP: Record<RelicSlot, { title: string; own: string; skip: () => string }> = {
  relics: { title: "Take a relic", own: "RELIC", skip: () => `Skip (+◈ ${SKIP_RELIC})` },
  prize: { title: "Elite prize", own: "ELITE PRIZE", skip: () => "Skip the prize" },
  legendary: { title: "A legendary relic", own: "LEGENDARY RELIC", skip: () => "Skip" },
};
function relicDecision(r: RunState, slot: RelicSlot, head = "") {
  const offers = r.offers[slot]!,
    pick = selected && offers.includes(selected as RelicId) ? (selected as RelicId) : undefined,
    s = RELIC_STEP[slot];
  return decisionHtml({
    step: slot,
    head,
    eyebrow: eyebrow(r, s.own),
    title: s.title,
    note: slot === "prize" ? "Rare and legendary relics, and a cursed one that pays Scrap." : undefined,
    options: offers.map((id) => relicOption(r, id, slot)),
    preview: pick ? relicPreview(r, pick, slot) : emptyPreview("Select a relic to see what it does and whether it fits your build."),
    actions: `<button class="quiet" data-run="skip">${s.skip()}</button>${takeButton(pick && `Take ${relicOf(pick).name}`)}`,
  });
}
/** The roster towers that can take a Doctrine as tabs, and the paths of the selected one as options. */
function doctrineDecision(r: RunState, head = "", mode: "reward" | "act" | "shop" = "reward") {
  const act = mode === "act";
  const candidates = doctrineCandidates(r, host.content),
    tower = doctrineTower && candidates.includes(doctrineTower) ? doctrineTower : candidates[0];
  if (!tower)
    return decisionHtml({ step: "doctrine", head, eyebrow: eyebrow(r, "DOCTRINE"), title: "Choose a Doctrine", options: [], preview: emptyPreview("No tower in your roster can take a Doctrine."), actions: `<button class="quiet" data-run="skip">Skip</button>` });
  const d = host.content.towers[tower],
    paths = doctrinePaths(r, tower, host.content),
    pick = selected && selected.startsWith(`${tower}:`) && paths.includes(selected.split(":")[1]) ? selected.split(":")[1] : undefined,
    tabs = candidates.map((id) => `<button class="quiet run-mini" data-run="doctrine-tower:${id}"${id === tower ? ' aria-pressed="true"' : ""}>${escape(towerName(id))}</button>`).join(""),
    options = paths.map((path): Option => {
      const v = d.visual.paths?.[path],
        color = v ? `#${v.color.toString(16).padStart(6, "0")}` : "var(--run)";
      return { key: `${tower}:${path}`, label: v?.name ?? path, html: `<span class="run-path-dot" style="--path:${color}" aria-hidden="true"></span><span class="run-option-text"><strong>${escape(v?.name ?? path)}</strong><small>${escape(v?.role ?? "")}</small></span>` };
    });
  let preview = emptyPreview("A Doctrine unlocks one specialization path (levels 6–8) of a tower type for the rest of the run. Select a path to see its tiers.");
  if (pick) {
    const v = d.visual.paths?.[pick],
      tiers = d.upgrades.filter((u) => isSpecialization(u) && u.path === pick);
    preview = `<h3>${escape(towerName(tower))}: ${escape(v?.name ?? pick)}</h3><p>${escape(v?.role ?? "")}</p><ol class="run-tiers">${tiers.map((u) => `<li>${escape(u.description)}</li>`).join("")}</ol><p class="run-note">${escape(towerName(tower))} is committed to this path for the rest of the run.</p>`;
  }
  return decisionHtml({
    step: "doctrine",
    head,
    eyebrow: mode === "shop" ? `FORGE · ◈ ${r.offers.shop?.[targeting ?? -1]?.price ?? ""}` : eyebrow(r, "DOCTRINE"),
    title: act ? "Your act reward: a Doctrine" : mode === "shop" ? "Buy a Doctrine" : "Choose a Doctrine",
    extra: `<div class="run-row run-doctrine-tabs" aria-label="Tower">${tabs}</div>`,
    options,
    preview,
    actions: `${act ? `<button class="quiet" data-run="act-back">Back</button>` : mode === "shop" ? `<button class="quiet" data-run="cancel">Cancel</button>` : `<button class="quiet" data-run="skip">Skip</button>`}${takeButton(pick && `${mode === "shop" ? "Buy" : "Commit to"} ${d.visual.paths?.[pick]?.name ?? pick}`)}`,
  });
}
/** The act transition: a legendary relic or a Doctrine (one of the two, unless Master License grants both). */
function actDecision(r: RunState, head = "") {
  if (actDoctrine) return doctrineDecision(r, head, "act");
  const offers = r.offers.legendary!,
    options: Option[] = [
      ...offers.map((id) => relicOption(r, id, "legendary")),
      { key: "doctrine", label: "Doctrine", html: `<span class="run-icon run-glyph" aria-hidden="true">✦</span><span class="run-option-text"><strong>A Doctrine</strong><small>levels 6–8 for a tower</small></span>` },
    ],
    pick = selected && (selected === "doctrine" || offers.includes(selected as RelicId)) ? selected : undefined;
  return decisionHtml({
    step: "act",
    head,
    eyebrow: eyebrow(r, "ACT REWARD"),
    title: "Choose your act reward",
    note: offers.some((id) => relicOf(id).boss)
      ? "The boss's technology, a legendary relic or a Doctrine: taking one gives up the others."
      : "A legendary relic or a Doctrine: taking one gives up the other.",
    options,
    preview: !pick
      ? emptyPreview("Select a relic or the Doctrine to see the details.")
      : pick === "doctrine"
        ? `<h3>✦ A Doctrine</h3><p>Unlock one specialization path (levels 6–8) of a roster tower for the rest of the run. You choose the tower and path next.</p><p class="run-fit-note" data-fits="true">${escape(doctrineCandidates(r, host.content).map(towerName).join(", "))} can take one.</p>`
        : relicPreview(r, pick as RelicId, "legendary"),
    actions: `<button class="quiet" data-run="skip">Skip both</button>${takeButton(pick && (pick === "doctrine" ? "Choose the Doctrine" : `Take ${relicOf(pick as RelicId).name}`))}`,
  });
}
/** Replacing a roster tower: what the replaced one takes with it, before anything changes. */
function replaceDecision(r: RunState) {
  const t = replacing!.tower,
    pick = selected && r.roster.includes(selected as TowerId) ? (selected as TowerId) : undefined,
    options = r.roster.map((id): Option => {
      const d = host.content.towers[id],
        rank = rankOfTower(r, id);
      return { key: id, label: d.name, html: `<span class="run-icon">${towerIconHtml(d)}</span><span class="run-option-text"><strong>${escape(d.name)}</strong><small>rank ${rank}${r.doctrines.some((x) => x.startsWith(`${id}:`)) ? " · Doctrine" : ""}${r.mods.some((m) => m.tower === id) ? " · mods" : ""}</small></span>` };
    });
  return decisionHtml({
    step: "replace",
    eyebrow: "ROSTER FULL",
    title: `Replace a tower with ${escape(towerName(t))}`,
    options,
    preview: pick ? replacePreview(r, pick, t) : emptyPreview(`Select the roster tower ${escape(towerName(t))} replaces to see what you lose.`),
    actions: `<button class="quiet" data-run="cancel">Cancel</button>${takeButton(pick && `Replace ${towerName(pick)}`)}`,
  });
}
function replacePreview(r: RunState, out: TowerId, incoming: TowerId) {
  const xp = r.ranks[out] ?? 0,
    rank = rankOfTower(r, out),
    d = host.content.towers[out],
    doctrines = r.doctrines.filter((x) => x.startsWith(`${out}:`)).map((x) => d.visual.paths?.[x.split(":")[1]]?.name ?? x.split(":")[1]),
    mods = r.mods.filter((m) => m.tower === out).map((m) => (m.kind === "drill" ? "Drill (level 2 for 1 credit)" : "Prototype discount (25% off)")),
    before = rosterCovers(r.roster, host.content),
    after = rosterCovers([...r.roster.filter((id) => id !== out), incoming], host.content),
    lost = (Object.keys(before) as Need[]).filter((n) => before[n] && !after[n]),
    gained = (Object.keys(before) as Need[]).filter((n) => !before[n] && after[n]),
    rows = [
      `<li data-loss="${xp > 0}">Rank ${rank}, ${xp} XP${xp ? " — lost" : ""}</li>`,
      doctrines.length ? `<li data-loss="true">Doctrine: ${escape(doctrines.join(", "))} — lost</li>` : `<li>No Doctrine</li>`,
      mods.length ? `<li data-loss="true">Shop mods: ${escape(mods.join(", "))} — lost</li>` : `<li>No shop mods</li>`,
      lost.length ? `<li data-loss="true">Your roster no longer ${lost.map((n) => NEED_TEXT[n]).join(", ")}.</li>` : "",
      gained.length ? `<li data-gain="">${escape(towerName(incoming))} adds: ${gained.map((n) => NEED_TEXT[n]).join(", ")}.</li>` : "",
    ].join("");
  return `<h3>${escape(d.name)} → ${escape(towerName(incoming))}</h3><ul class="run-loss">${rows}</ul><p class="run-note">Nothing changes until you confirm.</p>`;
}
/** The mission's result, above the first reward decision. */
function clearedHtml(r: RunState) {
  const last = r.log[r.log.length - 1],
    ups = r.offers.rankUps
      ?.map((id) => {
        const rank = rankOfTower(r, id),
          m = rank >= 4 ? MASTERY[id] : undefined;
        return `${escape(towerName(id))} rank ${rank}${m ? `, Mastery: ${escape(m.name)}` : ""}`;
      })
      .join(" · ");
  return `<p class="run-cleared"><b>Mission cleared</b> ${last?.stars ? `${STARS(last.stars)} · ` : ""}+◈ ${last?.scrap ?? 0} · reactor ${last?.end ?? r.reactor} → ${r.reactor}${ups ? ` · <span class="run-rankup">▲ ${ups}</span>` : ""}</p>`;
}
/** The current decision of a reward, camp or act screen, or undefined when every pick is made; `head` tops the first one. */
function pendingDecision(r: RunState, head = "") {
  if (replacing) return replaceDecision(r);
  if (rewardProgress(r).index > 1) head = "";
  const step = rewardSteps(r)[0];
  if (!step) return undefined;
  return step === "towers" ? draftDecision(r, head) : step === "doctrine" ? doctrineDecision(r, head) : step === "act" ? actDecision(r, head) : relicDecision(r, step, head);
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
  const head = clearedHtml(r);
  return (
    pendingDecision(r, head) ??
    `<section class="run-decision run-done">${head}<header class="run-decision-head"><p class="choice-index">REWARDS CLAIMED</p><h2 class="run-step-title">${r.node?.kind === "boss" ? "Act boss defeated" : "Ready to move on"}</h2></header>${rosterManageHtml(r)}${continueHtml(r, r.node?.kind === "boss" ? "Cross to the next act" : "Back to the map")}</section>`
  );
}
/** A shop item as an option: its price, and why it cannot be bought when it cannot. */
function shopOption(r: RunState, item: ShopItem, i: number): Option {
  const name = item.relic ? relicOf(item.relic).name : item.tower ? towerName(item.tower) : SHOP_NAME[item.kind],
    icon = item.tower ? towerIconHtml(host.content.towers[item.tower]) : `<span class="run-glyph" aria-hidden="true">${item.relic ? relicOf(item.relic).icon : SHOP_ICON[item.kind]}</span>`;
  return {
    key: String(i),
    label: name,
    disabled: !!item.sold,
    html: `<span class="run-icon">${icon}</span><span class="run-option-text"><strong>${escape(name)}</strong><small>${item.sold ? "sold" : `◈ ${item.price}`}${!item.sold && r.scrap < item.price ? " · too dear" : ""}</small></span>`,
  };
}
const SHOP_NAME: Record<ShopItem["kind"], string> = { patch: "Reactor patch", funds: "Field funds", drill: "Drill", discount: "Prototype discount", relic: "Relic", tower: "Tower", doctrine: "Doctrine", xp: "Field drills" };
const SHOP_ICON: Record<ShopItem["kind"], string> = { patch: "✚", funds: "◇", drill: "⚙", discount: "%", relic: "◆", tower: "▲", doctrine: "✦", xp: "▮" };
/** Why a shop item cannot be bought now, or undefined. */
function shopBlock(r: RunState, item: ShopItem) {
  if (item.sold) return "Sold.";
  if (r.scrap < item.price) return `Needs ◈ ${item.price}; you have ◈ ${r.scrap}.`;
  if (item.kind === "patch" && r.reactor >= r.reactorMax) return "The reactor is whole.";
  if (item.kind === "doctrine" && !doctrineCandidates(r, host.content).length) return "No roster tower can take a Doctrine.";
  return undefined;
}
function shopPreview(r: RunState, item: ShopItem) {
  const block = shopBlock(r, item),
    body = item.relic ? relicPreview(r, item.relic, "relics") : item.tower ? towerPreview(r, item.tower) : `<h3>${escape(SHOP_NAME[item.kind])}</h3><p>${escape(SHOP_TEXT[item.kind])}</p>`;
  return `${body}${item.tower && r.roster.length >= rosterCap(r) ? `<p class="run-decision-note">Your roster is full: it replaces a tower, and you see what that costs first.</p>` : ""}${block ? `<p class="run-downside">${escape(block)}</p>` : ""}`;
}
/** The camp of the node: a shop or forge to buy from, a repair to choose, or an event's choices; each as one decision. */
function campDecision(r: RunState) {
  const node = r.node!,
    k = KIND[node.kind];
  if (r.offers.shop) {
    const stock = r.offers.shop,
      i = selected === undefined ? -1 : Number(selected),
      item = stock[i];
    return decisionHtml({
      step: "shop",
      eyebrow: `${k.icon} ${k.label.toUpperCase()}`,
      title: node.kind === "forge" ? "Hone your towers" : "Spend your Scrap",
      options: stock.map((it, n) => shopOption(r, it, n)),
      preview: item ? shopPreview(r, item) : emptyPreview(`${k.note} Select an item to see what it does.`),
      actions: `<button class="quiet" data-run="continue">Leave</button>${takeButton(item && !shopBlock(r, item) ? `Buy ${item.relic ? relicOf(item.relic).name : item.tower ? towerName(item.tower) : SHOP_NAME[item.kind]} (◈ ${item.price})` : undefined)}`,
    });
  }
  if (r.offers.repair) {
    const zealot = hasFlag(r.relics, "zealot"),
      heal = zealot ? 0 : Math.round(REPAIR_NODE * threatRules(r.threat).repair),
      options: Option[] = [
        { key: "heal", label: "Repair", disabled: !heal || r.reactor >= r.reactorMax, html: `<span class="run-glyph" aria-hidden="true">✚</span><span class="run-option-text"><strong>Repair</strong><small>+${heal} reactor</small></span>` },
        { key: "reinforce", label: "Reinforce", html: `<span class="run-glyph" aria-hidden="true">⬢</span><span class="run-option-text"><strong>Reinforce</strong><small>+${REINFORCE_NODE} maximum</small></span>` },
      ],
      text: Record<string, string> = {
        heal: zealot ? "Zealot: camps no longer repair the reactor." : `Patch the reactor by ${heal} (${r.reactor}/${r.reactorMax} now), up to its maximum.`,
        reinforce: `The reactor holds ${REINFORCE_NODE} more energy for the rest of the run${zealot ? "" : `, and gains ${REINFORCE_NODE} now`}.`,
      };
    return decisionHtml({
      step: "repair",
      eyebrow: `${k.icon} ${k.label.toUpperCase()}`,
      title: "Tend the reactor",
      options,
      preview: selected && text[selected] ? `<h3>${selected === "heal" ? "Repair" : "Reinforce"}</h3><p>${escape(text[selected])}</p>` : emptyPreview(k.note),
      actions: takeButton(selected === "heal" ? "Repair the reactor" : selected === "reinforce" ? "Reinforce the reactor" : undefined, selected === "reinforce" || (selected === "heal" && !options[0].disabled)),
    });
  }
  const event = r.offers.event ? eventOf(r.offers.event) : undefined;
  if (event) {
    const choices = event.choices(r, host.content),
      c = selected === undefined ? undefined : choices[Number(selected)];
    return decisionHtml({
      step: "event",
      eyebrow: `${k.icon} EVENT`,
      title: escape(event.title),
      note: escape(event.text),
      options: choices.map((ch, i): Option => ({ key: String(i), label: ch.label, disabled: !ch.ok, html: `<span class="run-option-text"><strong>${escape(ch.label)}</strong></span>` })),
      preview: c ? `<h3>${escape(c.label)}</h3><p>${escape(c.detail)}</p>${c.ok ? "" : `<p class="run-downside">Not possible right now.</p>`}` : emptyPreview("Every choice shows its cost. Select one to see it."),
      actions: takeButton(c?.ok ? c.label : undefined),
    });
  }
  return `<section class="run-decision run-done"><header class="run-decision-head"><p class="choice-index">${k.icon} ${k.label.toUpperCase()}</p><h2 class="run-step-title">Nothing left here</h2></header><div class="run-row run-continue"><button class="primary" data-run="continue">Leave <span>→</span></button></div></section>`;
}
/** A shop item that applies to one roster tower: pick the tower, see the effect, confirm. */
function targetDecision(r: RunState) {
  const item = r.offers.shop![targeting!];
  if (item.kind === "doctrine") return doctrineDecision(r, "", "shop");
  const held = (id: TowerId) => item.kind !== "xp" && r.mods.some((m) => m.tower === id && m.kind === item.kind),
    pick = selected && r.roster.includes(selected as TowerId) && !held(selected as TowerId) ? (selected as TowerId) : undefined,
    options = r.roster.map((id): Option => ({
      key: id,
      label: towerName(id),
      disabled: held(id),
      html: `<span class="run-icon">${towerIconHtml(host.content.towers[id])}</span><span class="run-option-text"><strong>${escape(towerName(id))}</strong><small>${held(id) ? "has it" : `rank ${rankOfTower(r, id)}`}</small></span>`,
    })),
    effect = (id: TowerId) =>
      item.kind === "drill"
        ? `${towerName(id)}'s level 2 costs 1 credit for the rest of the run.`
        : item.kind === "discount"
          ? `${towerName(id)} costs 25% less (◇ ${Math.round(host.content.towers[id].cost * 0.75)} instead of ◇ ${host.content.towers[id].cost}) for the rest of the run.`
          : `${towerName(id)} gains ${XP_BOUGHT} rank XP. ${rankHint((r.ranks[id] ?? 0) + XP_BOUGHT)}`;
  return decisionHtml({
    step: "target",
    eyebrow: `${SHOP_NAME[item.kind].toUpperCase()} · ◈ ${item.price}`,
    title: "Choose the tower",
    options,
    preview: pick ? `<h3>${escape(towerName(pick))}</h3><p>${escape(effect(pick))}</p><p class="run-note">A replaced or retired tower takes its shop mods with it.</p>` : emptyPreview(escape(SHOP_TEXT[item.kind])),
    actions: `<button class="quiet" data-run="cancel">Cancel</button>${takeButton(pick && `Apply to ${towerName(pick)}`)}`,
  });
}
function campHtml(r: RunState) {
  const decision = r.offers.event ? undefined : pendingDecision(r);
  if (decision) return decision;
  if (targeting !== undefined && r.offers.shop) return targetDecision(r);
  return campDecision(r);
}
function actHtml(r: RunState) {
  const next = r.length === "full" && r.act + 1 >= 3 ? "The Final Stand" : `Act ${["I", "II", "III"][r.act + 1]}: ${escape(actName({ act: r.act + 1 }, host.content))}`,
    head = `<p class="run-cleared"><b>Act ${["I", "II", "III"][r.act]} cleared</b> · reactor fully repaired (${r.reactor}/${r.reactorMax}) · next: ${next} · roster up to ${rosterCap({ ...r, act: r.act + 1 })} towers</p>`;
  return (
    pendingDecision(r, head) ??
    `<section class="run-decision run-done">${head}<header class="run-decision-head"><p class="choice-index">ACT REWARD CLAIMED</p><h2 class="run-step-title">On to ${next}</h2></header>${continueHtml(r, `On to ${next}`)}</section>`
  );
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
            ? mapHtml(r)
            : r.phase === "reward"
              ? rewardHtml(r)
              : r.phase === "camp"
                ? campHtml(r)
                : r.phase === "act"
                  ? actHtml(r)
                  : endHtml(r);
  // The map carries Abandon in its own header row.
  const onMap = r?.phase === "map" || r?.phase === "mission";
  root.innerHTML = `${r ? statusHtml(r) : ""}<div class="run-body"${onMap ? ' data-map-view=""' : ""}>${body}</div>${live && !onMap ? abandonHtml() : ""}`;
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
