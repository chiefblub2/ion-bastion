import { loadArsenal, saveArsenal } from "../app/arsenal-store";
import { type Arsenal, canForge, canResearch, forge, markOf, owns, research, researchPrice, veterancy } from "../campaign/arsenal";
import { CATALOGUE, CORE_KIT, GEAR_PRICE, MAX_MARK, SIGNATURES, VETERANCY_XP } from "../content/arsenal";
import { bountyMission } from "../app/arsenal-store";
import { pageOf } from "../core/tower-pages";
import type { ContentPack, MissionDefinition, TowerId } from "../core/types";
import { escape } from "./format";
// The Arsenal page (`/#arsenal`): research towers with Salvage and forge gear marks for towers with veterancy.
const BRANCHES = ["Attack", "Control", "Traps", "Support"] as const;
const ROMAN = ["", "I", "II", "III", "IV", "V"];
const bountyLine = (content: ContentPack) => {
  const id = bountyMission();
  const m = id ? content.missions.find((x) => x.id === id) : undefined;
  return m ? ` · Today's bounty: <b>${m.name}</b> pays double Salvage` : "";
};

function card(a: Arsenal, id: TowerId, content: ContentPack) {
  const name = content.towers[id].name;
  if (!owns(a, id)) {
    const price = researchPrice(id)!;
    return `<li class="arsenal-card locked"><strong>${name}</strong><span>${price} Salvage</span><button data-research="${id}" ${canResearch(a, id) ? "" : "disabled"}>Research</button></li>`;
  }
  const xp = a.xp[id] ?? 0,
    rank = veterancy(xp),
    mark = markOf(a, id),
    next = VETERANCY_XP[rank],
    forgeText = mark >= MAX_MARK ? "Mk V" : `Forge Mk ${ROMAN[mark + 1]} · ${GEAR_PRICE[mark]}`;
  return `<li class="arsenal-card owned"><strong>${name}${CORE_KIT.includes(id) ? " <em>core</em>" : ""}</strong><span>Rank ${rank} · ${xp}${next ? `/${next}` : ""} XP · Gear ${mark ? `Mk ${ROMAN[mark]}` : "—"}</span><button data-forge="${id}" ${canForge(a, id) ? "" : "disabled"}>${forgeText}</button></li>`;
}

/** The Codex line: core, researched (with its gear mark) or the research price; Mk V names the signature mod. */
export function arsenalStatus(id: TowerId, a = loadArsenal()) {
  if (!owns(a, id)) return researchPrice(id) === undefined ? "—" : `Locked · ${researchPrice(id)} Salvage`;
  const mark = markOf(a, id);
  return `${CORE_KIT.includes(id) ? "Core" : "Researched"}${mark ? ` · Mk ${ROMAN[mark]}${mark >= MAX_MARK && SIGNATURES[id] ? ` (${SIGNATURES[id]!.name})` : ""}` : ""}`;
}

/** `next`: the campaign mission to go on with from here (started through the app's `data-mission` click). */
export function renderArsenal(root: HTMLElement, content: ContentPack, next?: MissionDefinition) {
  const a = loadArsenal(),
    ids = [...CORE_KIT, ...(Object.keys(CATALOGUE) as TowerId[])].filter((id) => id in content.towers),
    byPrice = (x: TowerId, y: TowerId) => (researchPrice(x) ?? 0) - (researchPrice(y) ?? 0);
  root.innerHTML =
    `<p class="arsenal-salvage"><b>${a.salvage}</b> Salvage · ${a.researched.length}/${Object.keys(CATALOGUE).length} researched${bountyLine(content)}</p>` +
    (next ? `<p class="arsenal-next"><button class="primary" data-mission="${next.id}">Next mission: ${escape(next.name)} <span aria-hidden="true">▶</span></button></p>` : "") +
    `<div class="arsenal-branches">${BRANCHES.map(
      (b, page) =>
        `<section class="arsenal-branch"><h3>${b}</h3><ul>${ids
          .filter((id) => pageOf(content.towers[id]) === page)
          .sort(byPrice)
          .map((id) => card(a, id, content))
          .join("")}</ul></section>`,
    ).join("")}</div>`;
  root.onclick = (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    const now = loadArsenal(),
      after = b.dataset.research ? research(now, b.dataset.research as TowerId) : b.dataset.forge ? forge(now, b.dataset.forge as TowerId) : now;
    if (after !== now) saveArsenal(after), renderArsenal(root, content, next);
  };
}
