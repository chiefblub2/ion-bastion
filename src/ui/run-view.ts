/**
 * The Run page (`/#run`): start a run, pick the starter pack, the route and the rewards, launch each mission and see
 * how the run ended. Loaded on first entry like the editor; all decisions are the pure transitions of `run/run.ts`,
 * stored after every step (`run/storage.ts`).
 */
import "./run.css";
import type { ContentPack, MissionDefinition, TowerId } from "../core/types";
import { runMission } from "../run/generate";
import { relicOf, type RelicId } from "../run/relics";
import { parseSeed, seedText } from "../run/rng";
import { chooseRoute, chooseStarter, newRun, pickRelic, pickTower, RUN_LENGTH, runDepth, type RouteNode, type RunState } from "../run/run";
import { loadRun, recordRun, runRecord, saveRun } from "../run/storage";
import { escape } from "./format";
import { mapPreviewSvg } from "./mission-brief";
import { fillImage, type MapImage } from "./sector-atlas";
import { towerIconHtml } from "./tower-codex";
import { pageOf, TOWER_PAGES } from "./tower-pages";

/** What the Run page may do in the app; implemented by `app/input.ts`. */
export interface RunHost {
  /** The game's own pack; relics derive each mission's pack from it. */
  content: ContentPack;
  /** Loads the mission with its pack and switches to the game on success. */
  launch(mission: MissionDefinition, content: ContentPack): void;
  /** False while a multiplayer room is active. */
  canRun(): boolean;
  /** The id of the run mission loaded and still being played, if any: the page then offers to return to it. */
  playing(): string | undefined;
  resume(): void;
  image: MapImage;
}
const KIND_LABEL: Record<RouteNode["kind"], string> = { normal: "Standard", elite: "Elite", boss: "Final" };
const KIND_NOTE: Record<RouteNode["kind"], string> = {
  normal: "Regular enemy strength.",
  elite: "15% tougher enemies, but the reward always includes a relic.",
  boss: "The last stand: a longer mission that ends with Titans.",
};
let host: RunHost,
  root: HTMLElement,
  run: RunState | undefined,
  /** Abandon asks twice: the first click arms it. */
  abandonArmed = false;
const randomSeed = () => Math.floor(Math.random() * 36 ** 6);
export function openRun(h: RunHost) {
  host = h;
  root = document.getElementById("run-root")!;
  if (!root.dataset.bound) {
    root.dataset.bound = "1";
    root.addEventListener("click", onClick);
    root.addEventListener("submit", onSubmit);
    root.addEventListener("input", (e) => {
      if (e.target instanceof HTMLInputElement) e.target.setCustomValidity("");
    });
  }
  run = loadRun(host.content);
  abandonArmed = false;
  render();
}
function update(next: RunState | undefined) {
  run = next;
  saveRun(run);
  abandonArmed = false;
  render();
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
  update(newRun(seed));
}
function onClick(e: Event) {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-run]");
  if (!b) return;
  const [action, arg] = b.dataset.run!.split(":"),
    content = host.content;
  switch (action) {
    case "new":
      return update(newRun(randomSeed()));
    case "starter":
      return run && update(chooseStarter(run, Number(arg), content));
    case "route":
      return run && update(chooseRoute(run, Number(arg)));
    case "tower":
      return run && update(pickTower(run, arg ? (arg as TowerId) : null, content));
    case "relic":
      return run && update(pickRelic(run, arg ? (arg as RelicId) : null, content));
    case "deploy": {
      if (!run?.node || !host.canRun()) return;
      const { mission, content: pack } = runMission(run, run.node, content);
      return host.launch(mission, pack);
    }
    case "resume":
      return host.resume();
    case "abandon":
      if (!run) return;
      if (!abandonArmed) {
        abandonArmed = true;
        return render();
      }
      // An abandoned run counts as ended where it stood.
      recordRun(runDepth(run));
      return update({ ...run, phase: "lost" });
    case "clear":
      return update(undefined);
  }
}
const towerName = (id: TowerId) => host.content.towers[id].name;
function towerChip(id: TowerId) {
  const d = host.content.towers[id];
  return `<li class="run-chip" title="${escape(d.role)}">${towerIconHtml(d)}<span>${escape(d.name)}</span></li>`;
}
function relicChip(id: RelicId) {
  const r = relicOf(id);
  return `<li class="run-chip run-relic" title="${escape(r.description)}"><i aria-hidden="true">${r.icon}</i><span>${escape(r.name)}</span></li>`;
}
/** Seed, progress, roster and relics: what the run carries from mission to mission. */
function statusHtml(r: RunState) {
  const steps = Array.from({ length: RUN_LENGTH }, (_, i) => {
    const h = r.history[i],
      state = h ? (h.won ? "won" : "lost") : i === r.step && r.phase !== "won" && r.phase !== "lost" ? "current" : "open";
    return `<li data-state="${state}" aria-label="Mission ${i + 1}: ${state}"><span>${i + 1}</span></li>`;
  }).join("");
  return `<section class="run-status" aria-label="This run"><div class="run-meta"><span>SEED <b>${seedText(r.seed)}</b></span><ol class="run-steps">${steps}</ol></div>${
    r.roster.length ? `<div class="run-carry"><h2>Roster</h2><ul class="run-chips">${r.roster.map(towerChip).join("")}</ul></div>` : ""
  }${r.relics.length ? `<div class="run-carry"><h2>Relics</h2><ul class="run-chips">${r.relics.map(relicChip).join("")}</ul></div>` : ""}</section>`;
}
function introHtml() {
  const record = runRecord();
  return `<div class="run-intro"><p>Five missions in a row on campaign maps, with waves generated from each map's enemies. You start with three towers; after every win you draft one more, and sometimes a relic that bends the rules for the rest of the run. Pick your route, and remember: one lost mission ends the run.</p>
<div class="run-start"><button class="primary" data-run="new">New Run <span>→</span></button><form id="run-seed-form" class="run-seed"><label for="run-seed">Seed</label><input id="run-seed" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="4F2K9Q"><button class="quiet">Play seed</button></form></div>
${record.runs ? `<p class="run-record">Runs played <b>${record.runs}</b> · Best <b>${record.best}/${RUN_LENGTH}</b> · Completed <b>${record.wins}</b></p>` : ""}</div>`;
}
function starterHtml(r: RunState) {
  return `<h2 class="run-step-title">Choose your starter pack</h2><div class="run-cards">${(r.offers.starters ?? [])
    .map(
      (pack, i) =>
        `<button class="choice-card run-card" data-run="starter:${i}"><span class="choice-index">PACK ${String(i + 1).padStart(2, "0")}</span><strong>${pack.map(towerName).join(" · ")}</strong><ul class="run-chips">${pack.map(towerChip).join("")}</ul></button>`,
    )
    .join("")}</div>`;
}
function routeHtml(r: RunState) {
  const cards = (r.offers.routes ?? []).map((node, i) => {
    const preview = { ...r, node },
      { mission } = runMission(preview, node, host.content),
      enemies = mission.focus.split(": ").slice(1).join(": ");
    return `<button class="choice-card run-card run-route" data-run="route:${i}" data-kind="${node.kind}"><span class="choice-index">${KIND_LABEL[node.kind].toUpperCase()}</span><div class="run-map" data-map="${i}">${mapPreviewSvg(mission.map)}<img alt=""></div><strong>${escape(mission.name)}</strong><span>${KIND_NOTE[node.kind]}</span><span class="run-facts">${mission.waves.length} waves · ◇ ${mission.startingCredits} · ⚡ ${mission.reactorEnergy}</span><span class="run-enemies">${escape(enemies)}</span></button>`;
  });
  return `<h2 class="run-step-title">Mission ${r.step + 1} of ${RUN_LENGTH}: choose your route</h2><div class="run-cards">${cards.join("")}</div>`;
}
function deployHtml(r: RunState) {
  const { mission } = runMission(r, r.node!, host.content),
    playing = host.playing() === mission.id,
    blocked = !host.canRun();
  return `<h2 class="run-step-title">Mission ${r.step + 1} of ${RUN_LENGTH}</h2><div class="run-deploy"><div class="run-map" data-map="deploy">${mapPreviewSvg(mission.map)}<img alt=""></div><div><p class="choice-index">${KIND_LABEL[r.node!.kind].toUpperCase()}</p><h3>${escape(mission.name)}</h3><p>${KIND_NOTE[r.node!.kind]}</p><p class="run-facts">${mission.waves.length} waves · ◇ ${mission.startingCredits} starting credits · ⚡ ${mission.reactorEnergy} reactor energy</p><p class="run-enemies">${escape(mission.focus.split(": ").slice(1).join(": "))}</p>${
    playing
      ? `<button class="primary" data-run="resume">Return to mission <span>→</span></button>`
      : `<button class="primary" data-run="deploy"${blocked ? " disabled" : ""}>Deploy <span>→</span></button>${blocked ? `<p class="run-note">Leave the multiplayer room to play a run.</p>` : ""}`
  }</div></div>`;
}
function rewardHtml(r: RunState) {
  const towers = r.offers.towers
    ? `<h2 class="run-step-title">Draft a tower</h2><div class="run-cards">${r.offers.towers
        .map((id) => {
          const d = host.content.towers[id];
          return `<button class="choice-card run-card" data-run="tower:${id}"><span class="choice-index">${TOWER_PAGES[pageOf(d)].name.toUpperCase()} · ◇ ${d.cost}</span><span class="run-icon">${towerIconHtml(d)}</span><strong>${escape(d.name)}</strong><span>${escape(d.role)}: ${escape(d.description)}</span></button>`;
        })
        .join("")}</div><button class="quiet run-skip" data-run="tower:">Skip the draft</button>`
    : "";
  const relics = r.offers.relics
    ? `<h2 class="run-step-title">Take a relic</h2><div class="run-cards">${r.offers.relics
        .map((id) => {
          const relic = relicOf(id);
          return `<button class="choice-card run-card run-relic-card" data-run="relic:${id}"><span class="choice-index">RELIC</span><span class="run-icon run-glyph" aria-hidden="true">${relic.icon}</span><strong>${escape(relic.name)}</strong><span>${escape(relic.description)}</span></button>`;
        })
        .join("")}</div><button class="quiet run-skip" data-run="relic:">Skip the relic</button>`
    : "";
  return `<p class="run-banner">Mission ${r.step + 1} cleared.</p>${towers}${relics}`;
}
function endHtml(r: RunState) {
  const won = r.phase === "won",
    depth = runDepth(r),
    record = runRecord(),
    lines = r.history
      .map((h, i) => `<li data-won="${h.won}"><span>${i + 1}</span>${escape(host.content.missions.find((m) => m.id === h.mission)?.map.name ?? h.mission)} <small>${KIND_LABEL[h.kind]}</small><b>${h.won ? "Cleared" : "Lost"}</b></li>`)
      .join("");
  return `<div class="run-end" data-won="${won}"><p class="eyebrow">${won ? "RUN COMPLETE" : "RUN OVER"}</p><h2>${won ? "Every line held." : `${depth} of ${RUN_LENGTH} missions cleared.`}</h2><ol class="run-history">${lines}</ol><p class="run-record">Best <b>${record.best}/${RUN_LENGTH}</b> · Completed <b>${record.wins}</b> · Runs <b>${record.runs}</b></p><div class="run-start"><button class="primary" data-run="new">New Run <span>→</span></button><button class="quiet" data-run="clear">Close</button></div></div>`;
}
function render() {
  const r = run,
    live = r && r.phase !== "won" && r.phase !== "lost",
    body = !r
      ? introHtml()
      : r.phase === "starter"
        ? starterHtml(r)
        : r.phase === "route"
          ? routeHtml(r)
          : r.phase === "mission"
            ? deployHtml(r)
            : r.phase === "reward"
              ? rewardHtml(r)
              : endHtml(r);
  root.innerHTML = `${r ? statusHtml(r) : ""}<div class="run-body">${body}</div>${
    live ? `<button class="quiet run-abandon" data-run="abandon">${abandonArmed ? "Click again to abandon the run" : "Abandon run"}</button>` : ""
  }`;
  // The real terrain fades in over the SVG placeholders once it is rendered.
  for (const frame of root.querySelectorAll<HTMLElement>("[data-map]")) {
    const img = frame.querySelector("img")!,
      node = frame.dataset.map === "deploy" ? r?.node : r?.offers.routes?.[Number(frame.dataset.map)],
      map = node && host.content.missions.find((m) => m.id === node.mission)?.map;
    if (map) fillImage(img, map, host.image);
  }
}
