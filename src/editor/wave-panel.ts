import type { EnemyDefinition, EnemyId, MissionDefinition, WaveDefinition } from "../core/types";
import { escape } from "../ui/format";
import type { WaveEdit } from "./draft";

/**
 * The editor's wave list: one card per wave with its group rows. Markup only; `waveInputEdit` and `waveClickEdit` turn an
 * input or a button click inside it into a `WaveEdit` for `editWaves`, so the view keeps the single draft.
 */
const num = (field: string, value: number | undefined, label: string, attrs: string, step = "any") =>
  `<label class="ed-num"><span>${label}</span><input type="number" inputmode="decimal" step="${step}" ${attrs} data-field="${field}" value="${value ?? ""}"></label>`;

const button = (action: string, label: string, text: string, disabled = false) =>
  `<button type="button" class="quiet" data-wave-action="${action}" aria-label="${label}"${disabled ? " disabled" : ""}>${text}</button>`;

export function wavesHtml(waves: readonly WaveDefinition[], enemies: readonly EnemyDefinition[], missions: readonly MissionDefinition[]): string {
  const options = (selected: EnemyId) =>
    enemies.map((e) => `<option value="${escape(e.id)}"${e.id === selected ? " selected" : ""}>${escape(e.name)}</option>`).join("");
  const known = new Set(enemies.map((e) => e.id));
  const cards = waves.map((w, i) => {
    const groups = w.groups
      .map(
        (g, j) =>
          `<div class="ed-group" data-group="${j}"><label class="ed-enemy"><span>Enemy</span><select data-field="type">${known.has(g.type) ? "" : `<option selected value="${escape(g.type)}">${escape(g.type)} (unknown)</option>`}${options(g.type)}</select></label>${num("count", g.count, "Count", 'min="1"', "1")}${num("interval", g.interval, "Interval s", 'min="0"')}${num("delay", g.delay, "Delay s", 'min="0"')}<button type="button" class="quiet ed-remove" data-wave-action="remove-group" aria-label="Remove group ${j + 1} of wave ${i + 1}">✕</button></div>`,
      )
      .join("");
    return `<li class="ed-wave" data-wave="${i}"><header class="ed-wave-head"><h3>Wave ${i + 1}</h3><div class="ed-wave-fields">${num("bonus", w.bonus, "Bonus", 'min="0"', "1")}${num("hpMultiplier", w.hpMultiplier, "HP ×", 'min="0" placeholder="auto"')}</div><div class="ed-wave-tools">${button("move-up", `Move wave ${i + 1} up`, "↑", i === 0)}${button("move-down", `Move wave ${i + 1} down`, "↓", i === waves.length - 1)}${button("duplicate-wave", `Duplicate wave ${i + 1}`, "Duplicate")}${button("remove-wave", `Remove wave ${i + 1}`, "Remove")}</div></header>${groups}${button("add-group", `Add a group to wave ${i + 1}`, "+ Group")}</li>`;
  });
  const copy = `<select id="ed-copy-waves" aria-label="Copy waves from mission"><option value="">Copy waves from mission…</option>${missions.map((m) => `<option value="${escape(m.id)}">${escape(m.name)}</option>`).join("")}</select>`;
  return `<header class="ed-waves-head"><h2>Waves <small>${waves.length}</small></h2>${copy}</header><ol class="ed-wave-list">${cards.join("")}</ol><button type="button" class="quiet" data-wave-action="add-wave">+ Wave</button>`;
}

/** The edit an input inside the panel stands for; undefined for anything else or a non-finite number. */
export function waveInputEdit(el: HTMLElement): WaveEdit | undefined {
  const field = el.dataset.field,
    card = el.closest<HTMLElement>("[data-wave]"),
    row = el.closest<HTMLElement>("[data-group]");
  if (!field || !card || !(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return undefined;
  const wave = Number(card.dataset.wave);
  if (field === "type" && row) return { kind: "set-group", wave, group: Number(row.dataset.group), patch: { type: el.value as EnemyId } };
  const raw = el.value.trim(),
    value = raw === "" ? undefined : Number(raw);
  if (value !== undefined && !Number.isFinite(value)) return undefined;
  if (field === "hpMultiplier") return { kind: "set-wave", wave, field, value };
  if (value === undefined) return undefined;
  if (field === "bonus") return { kind: "set-wave", wave, field, value };
  if (row && (field === "count" || field === "interval" || field === "delay"))
    return { kind: "set-group", wave, group: Number(row.dataset.group), patch: { [field]: value } };
  return undefined;
}

/** The edit a button of the panel stands for. */
export function waveClickEdit(b: HTMLElement): WaveEdit | undefined {
  const action = b.dataset.waveAction;
  if (action === "add-wave") return { kind: "add-wave" };
  const card = b.closest<HTMLElement>("[data-wave]");
  if (!action || !card) return undefined;
  const wave = Number(card.dataset.wave);
  switch (action) {
    case "move-up":
      return { kind: "move-wave", wave, by: -1 };
    case "move-down":
      return { kind: "move-wave", wave, by: 1 };
    case "duplicate-wave":
    case "remove-wave":
    case "add-group":
      return { kind: action, wave };
    case "remove-group":
      return { kind: "remove-group", wave, group: Number(b.closest<HTMLElement>("[data-group]")?.dataset.group) };
  }
  return undefined;
}
