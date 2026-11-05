import { loadArsenal, saveArsenal } from "../app/arsenal-store";
import { type Arsenal, canForge, canResearch, forge, markOf, owns, research, researchPrice, veterancy } from "../campaign/arsenal";
import { CATALOGUE, CORE_KIT, GEAR_PRICE, MAX_MARK, VETERANCY_XP } from "../content/arsenal";
import { pageOf } from "../core/tower-pages";
import type { ContentPack, TowerId } from "../core/types";
// The Arsenal page (`/#arsenal`): research towers with Salvage and forge gear marks for towers with veterancy.
const BRANCHES = ["Attack", "Control", "Traps", "Support"] as const;
const ROMAN = ["", "I", "II", "III", "IV", "V"];

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

export function renderArsenal(root: HTMLElement, content: ContentPack) {
  const a = loadArsenal(),
    ids = [...CORE_KIT, ...(Object.keys(CATALOGUE) as TowerId[])].filter((id) => id in content.towers),
    byPrice = (x: TowerId, y: TowerId) => (researchPrice(x) ?? 0) - (researchPrice(y) ?? 0);
  root.innerHTML =
    `<p class="arsenal-salvage"><b>${a.salvage}</b> Salvage · ${a.researched.length}/${Object.keys(CATALOGUE).length} researched · Gear takes effect in a coming update</p>` +
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
      next = b.dataset.research ? research(now, b.dataset.research as TowerId) : b.dataset.forge ? forge(now, b.dataset.forge as TowerId) : now;
    if (next !== now) saveArsenal(next), renderArsenal(root, content);
  };
}
