// The act map: the route of nodes and the card of the node in focus (`nodeCard`) with its one action.
import { bossModOf } from "../../run/boss";
import { runMission } from "../../run/generate";
import { isMissionKind, LANES, type RunNode } from "../../run/map";
import { relicFit } from "../../run/relic-fit";
import { relicOf, signatureOf } from "../../run/relics";
import { actMapOf, actName, mapChoices, type RunState } from "../../run/run";
import { threatsOf } from "../../run/threats";
import { escape } from "../format";
import { mapPreviewSvg } from "../mission-brief";
import { KIND, page } from "./state";
import { abandonHtml, towerName } from "./pieces";
/** Threat chips of a generated mission, with what answers each. */
function threatChips(r: RunState, node: RunNode) {
  const { mission, content, suppressed } = runMission(r, node, page.host.content),
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
              relicFit(r!, loot, page.host.content).fits ? "" : " (needs " + escape(relicOf(loot).wantsText ?? "a fitting tower") + ")"
            }</li>`
          : ""
      }</ul>`
    : "";
}
function missionFacts(r: RunState, node: RunNode) {
  const { mission } = runMission(r, node, page.host.content);
  return `<p class="run-facts">${mission.waves.length} waves · ◇ ${mission.startingCredits} starting credits · ⚡ ${mission.reactorEnergy} reactor energy</p>`;
}
/**
 * The card of a node, opened on the map beside it: what waits there and the one action, Deploy for a mission (it
 * chooses the node and starts the mission in one step), Go for a camp, Resume for a deployed mission.
 */
function nodeCard(r: RunState, node: RunNode) {
  const k = KIND[node.kind],
    blocked = !page.host.canRun(),
    close = `<button class="quiet run-inspector-close" data-run="focus:" aria-label="Close">✕</button>`,
    head = (title: string) => `<p class="choice-index">${k.label.toUpperCase()}</p><h3>${title}</h3>`;
  if (!isMissionKind(node.kind))
    return { body: `${switcher(r, node)}${head(`${k.icon} ${k.label}`)}<p>${k.note}</p>`, action: `<button class="primary" data-run="travel:${node.lane}">Go to the ${k.label.toLowerCase()} <span>→</span></button>`, close };
  const { mission } = runMission(r, node, page.host.content),
    source = page.host.content.missions.find((m) => m.id === node.mission)!,
    chosen = r.phase === "mission" && r.node?.column === node.column && r.node.lane === node.lane,
    playing = chosen && page.host.playing() === mission.id,
    journal = page.host.journal(),
    resumable = chosen && r.deployed && journal?.missionId === mission.id;
  const action = playing
    ? `<button class="primary" data-run="resume">Return to mission <span>→</span></button>`
    : resumable
      ? `<button class="primary" data-run="resume"${blocked ? " disabled" : ""}>Resume mission (wave ${Math.max(1, journal!.wave ?? 1)}) <span>→</span></button><p class="run-note">It continues where you left it and cannot be restarted.</p>`
      : chosen && r.deployed
        ? `<p class="run-note">This mission was interrupted and its record is gone. It counts as lost.</p><button class="primary" data-run="forfeit">End the run</button>`
        : `<button class="primary" data-run="deploy:${node.lane}"${blocked ? " disabled" : ""}>Deploy <span>→</span></button><p class="run-note">${blocked ? "Leave the multiplayer room to play a run." : "Once deployed, it can be resumed but never restarted."}</p>`;
  return {
    body: `<div class="run-map" data-map="${node.mission}">${mapPreviewSvg(source.map)}<img alt=""></div><div class="run-inspector-text">${switcher(r, node)}${head(escape(source.map.name))}<p>${k.note}</p>${modsHtml(node, r)}${missionFacts(r, node)}${threatChips(r, node)}</div>`,
    action,
    // A deployed mission cannot be swapped for another, so its card stays open.
    close: chosen && r.deployed ? "" : close,
  };
}
/**
 * The other nodes the player may walk to, as small buttons inside the card. Phones open the card over the whole route
 * map (run.css), which hides them; elsewhere the nodes stay in view and this row is hidden.
 */
function switcher(r: RunState, node: RunNode) {
  const others = mapChoices(r, page.host.content).filter((n) => n.lane !== node.lane);
  if (!others.length || (r.phase === "mission" && r.deployed)) return "";
  return `<p class="run-inspector-switch">Also: ${others
    .map((n) => {
      const name = n.mission ? page.host.content.missions.find((m) => m.id === n.mission)?.map.name : KIND[n.kind].label;
      return `<button class="quiet run-mini" data-run="focus:${n.lane}"><i aria-hidden="true">${KIND[n.kind].icon}</i> ${escape(name ?? "")}</button>`;
    })
    .join("")}</p>`;
}
/** The lane whose card is open: the player's pick, else the only choice or the chosen mission. */
export function openLane(): number | undefined {
  if (!page.run || (page.run.phase !== "map" && page.run.phase !== "mission")) return undefined;
  if (page.run.phase === "mission" && page.run.deployed) return page.run.node!.lane;
  if (page.focusLane === null) return undefined;
  if (page.focusLane !== undefined) return page.focusLane;
  if (page.run.phase === "mission") return page.run.node!.lane;
  const choices = mapChoices(page.run, page.host.content);
  return choices.length === 1 ? choices[0].lane : undefined;
}
/** After the card opens, its action takes the focus (keyboard play). */
export function focusCard(lane: number | undefined) {
  if (lane !== undefined) page.root.querySelector<HTMLElement>(".run-inspector-action :is(button, a)")?.focus({ preventScroll: true });
}
export function mapHtml(r: RunState) {
  const columns = actMapOf(r, page.host.content),
    choices = mapChoices(r, page.host.content),
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
        name = n.mission ? page.host.content.missions.find((m) => m.id === n.mission)?.map.name : "";
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
  const act = actName(r, page.host.content);
  return `<div class="run-map-head"><h2 class="run-step-title">${r.act >= 3 ? "The Final Stand" : `Act ${["I", "II", "III"][r.act]}: ${escape(act)}`}</h2>${abandonHtml()}</div><p class="run-note run-map-note">${
    locked ? "Your deployed mission waits." : choices.length ? "Pick where to go next. Missions, camps and the act boss lie ahead; lines show the roads." : ""
  }${focus || locked ? "" : " Select a highlighted node to see what waits there."}</p><div class="run-routemap" data-act="${r.act}"${focus ? " data-open" : ""}>${svg(false)}${svg(true)}${nodes}${card}</div>`;
}
