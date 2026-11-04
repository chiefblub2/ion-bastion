/**
 * The Run page (`/#run`): start a run (full, short or daily, at a threat level), pick the starter pack, walk each
 * act's map, deploy or resume missions, take rewards, visit camps, cross act transitions and read the summary.
 * Loaded on first entry like the editor; every decision is a pure transition of `run/run.ts`, stored after each step.
 */
import "./run.css";
import type { TowerId } from "../core/types";
import { DAILY_THREAT, dailyDate, dailySeed } from "../run/daily";
import { runMission } from "../run/generate";
import type { RelicId } from "../run/relics";
import { rewardSteps } from "../run/rewards";
import { parseSeed } from "../run/rng";
import { abandon, chooseNode, chooseStarter, continueRun, deploy, eventChoice, newRun, pickDoctrine, pickRelic, pickTower, repairChoice, retire, reroll, rosterCap, type RunState } from "../run/run";
import { buy, TARGETED } from "../run/shop";
import { loadRun, markDaily, recordRun, runRecord, saveRun, unlocks } from "../run/storage";
import { fillImage } from "./sector-atlas";
import { page, reset, type RunHost } from "./run/state";
import { abandonHtml, statusHtml } from "./run/pieces";
import { introHtml, starterHtml } from "./run/intro";
import { focusCard, mapHtml, openLane } from "./run/map";
import { rewardHtml } from "./run/decision";
import { campHtml, shopBlock } from "./run/camp";
import { actHtml } from "./run/act";
import { endHtml } from "./run/summary";
const randomSeed = () => Math.floor(Math.random() * 36 ** 6);
export function openRun(h: RunHost) {
  page.host = h;
  page.root = document.getElementById("run-root")!;
  if (!page.root.dataset.bound) {
    page.root.dataset.bound = "1";
    page.root.addEventListener("click", onClick);
    page.root.addEventListener("submit", onSubmit);
    page.root.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && page.root.querySelector(".run-decision")) {
        // Esc steps back: out of a replacement or the act's Doctrine, else clears the selection.
        if (page.replacing || page.targeting !== undefined) reset();
        else if (page.actDoctrine) page.actDoctrine = false;
        else page.selected = undefined;
        render();
        page.root.querySelector<HTMLElement>(".run-option")?.focus();
        return;
      }
      if (e.key !== "Escape" || !page.root.querySelector(".run-inspector")) return;
      const lane = openLane();
      page.focusLane = null;
      render();
      if (lane !== undefined) page.root.querySelector<HTMLElement>(`.run-node[data-run="focus:${lane}"]`)?.focus();
    });
    page.root.addEventListener("change", onChange);
    page.root.addEventListener("input", (e) => {
      if (e.target instanceof HTMLInputElement) e.target.setCustomValidity("");
    });
  }
  page.run = loadRun(page.host.content);
  page.threat = Math.min(page.threat, unlocks(runRecord()).threat);
  reset();
  render();
}
function update(next: RunState | undefined) {
  const ended = next && page.run && page.run.phase !== next.phase && (next.phase === "won" || next.phase === "lost");
  page.run = next;
  saveRun(page.run);
  if (ended) recordRun(next!);
  reset();
  render();
}
function start(seed: number, daily?: string) {
  const u = unlocks(runRecord()),
    options = daily
      ? { length: "short" as const, threat: DAILY_THREAT, daily }
      : { length: u.full ? page.length : ("short" as const), threat: page.threat, packs: u.packs, trapPack: u.trapPack };
  let next = newRun(seed, options, page.host.content);
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
  if (t.name === "run-threat") page.threat = Number(t.value);
  if (t.name === "run-length") page.length = t.value === "short" ? "short" : "full";
}
function onClick(e: Event) {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-run]");
  if (!b || b.disabled) return;
  const [action, a = "", c = ""] = b.dataset.run!.split(":"),
    content = page.host.content;
  if (action !== "abandon" && action !== "retire") page.armed = undefined;
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
      return page.run && update(chooseStarter(page.run, Number(a)));
    case "focus": {
      // A second tap on the open node, or the card's ✕, closes the card.
      const lane = a === "" ? null : Number(a);
      page.focusLane = lane !== null && lane === openLane() ? null : lane;
      render();
      return focusCard(lane === null ? undefined : lane);
    }
    case "travel":
      return page.run && update(chooseNode(page.run, Number(a), content));
    case "deploy": {
      // From the map card: choose the mission node and deploy it in one step.
      if (!page.run || !page.host.canRun()) return;
      const chosen = a === "" ? page.run : chooseNode(page.run, Number(a), content);
      if (chosen.phase !== "mission" || !chosen.node || chosen.deployed) return;
      const next = deploy(chosen);
      saveRun(next);
      page.run = next;
      reset();
      const { mission, content: pack } = runMission(next, next.node!, content);
      return page.host.launch(mission, pack);
    }
    case "resume": {
      if (!page.run?.node) return;
      if (page.host.playing()) return page.host.resume();
      const journal = page.host.journal(),
        { mission, content: pack } = runMission(page.run, page.run.node, content);
      if (journal && journal.missionId === mission.id) return page.host.launch(mission, pack, journal);
      return;
    }
    case "forfeit":
      // A deployed mission without a journal (storage cleared) cannot be resumed: it counts as lost.
      return page.run && update(abandon(page.run));
    case "pick":
      // Selects an option of the current decision; Take confirms it.
      page.selected = c ? `${a}:${c}` : a;
      render();
      return page.root.querySelector<HTMLElement>(`.run-option[data-run="${b.dataset.run}"]`)?.focus();
    case "take":
      return page.run && take(page.run);
    case "skip":
      return page.run && skip(page.run);
    case "act-back":
      page.actDoctrine = false;
      page.selected = "doctrine";
      return render();
    case "cancel": {
      // Back to the decision it came from, with the same option still selected.
      const back = page.targeting !== undefined ? String(page.targeting) : page.replacing ? (page.replacing.source === "shop" ? String(page.replacing.index) : page.replacing.tower) : undefined;
      reset();
      page.selected = back;
      return render();
    }
    case "reroll":
      return page.run && update(reroll(page.run, content));
    case "doctrine-tower":
      page.doctrineTower = a as TowerId;
      page.selected = undefined;
      return render();
    case "retire":
      if (!page.run) return;
      if (page.armed !== `retire:${a}`) {
        page.armed = `retire:${a}`;
        return render();
      }
      return update(retire(page.run, a as TowerId));
    case "continue":
      return page.run && update(continueRun(page.run, content));
    case "abandon":
      if (!page.run) return;
      if (page.armed !== "abandon") {
        page.armed = "abandon";
        return render();
      }
      return update(abandon(page.run));
    case "clear":
      return update(undefined);
  }
}
/** Confirms the selected option of the current decision. */
function take(r: RunState) {
  const content = page.host.content,
    pick = page.selected;
  if (!pick) return;
  if (page.replacing) {
    if (!r.roster.includes(pick as TowerId)) return;
    return update(page.replacing.source === "draft" ? pickTower(r, page.replacing.tower, pick as TowerId) : buy(r, page.replacing.index!, content, { tower: pick as TowerId }));
  }
  if (page.targeting !== undefined) {
    const [tower, path] = pick.split(":");
    return update(buy(r, page.targeting, content, { tower: tower as TowerId, path }));
  }
  const step = rewardSteps(r)[0];
  if (r.phase === "camp" && !(step && !r.offers.event)) return takeCamp(r, pick);
  if (step === "towers") {
    if (r.roster.length >= rosterCap(r)) {
      page.replacing = { tower: pick as TowerId, source: "draft" };
      page.selected = undefined;
      return render();
    }
    return update(pickTower(r, pick as TowerId));
  }
  if (step === "act" && pick === "doctrine") {
    page.actDoctrine = true;
    page.selected = undefined;
    return render();
  }
  if (step === "doctrine" || (step === "act" && page.actDoctrine)) {
    const [tower, path] = pick.split(":");
    return update(pickDoctrine(r, tower as TowerId, path, content));
  }
  if (step === "relics" || step === "prize" || step === "legendary" || step === "act") return update(pickRelic(r, step === "act" ? "legendary" : step, pick as RelicId));
}
/** Camp decisions: buy the selected item (asking for its target or the tower it replaces first), repair, or an event choice. */
function takeCamp(r: RunState, pick: string) {
  const content = page.host.content;
  if (r.offers.shop) {
    const i = Number(pick),
      item = r.offers.shop[i];
    if (!item || shopBlock(r, item)) return;
    if (TARGETED.has(item.kind)) {
      page.targeting = i;
      page.selected = undefined;
      return render();
    }
    if (item.kind === "tower" && r.roster.length >= rosterCap(r)) {
      page.replacing = { tower: item.tower!, source: "shop", index: i };
      page.selected = undefined;
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
    content = page.host.content;
  if (step === "towers") return update(pickTower(r, null));
  if (step === "doctrine") return update(pickDoctrine(r, null, undefined, content));
  if (step === "act") return update(pickDoctrine(pickRelic(r, "legendary", null), null, undefined, content));
  if (step) return update(pickRelic(r, step, null));
}
function render() {
  const r = page.run,
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
  page.root.innerHTML = `${r ? statusHtml(r) : ""}<div class="run-body"${onMap ? ' data-map-view=""' : ""}>${body}</div>${live && !onMap ? abandonHtml() : ""}`;
  // The real terrain fades in over the SVG placeholders once it is rendered.
  for (const frame of page.root.querySelectorAll<HTMLElement>("[data-map]")) {
    const img = frame.querySelector("img")!,
      map = page.host.content.missions.find((m) => m.id === frame.dataset.map)?.map;
    if (map) fillImage(img, map, page.host.image);
  }
}