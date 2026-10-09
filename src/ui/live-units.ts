import type { Game } from "../core/game";
import type { EnemyId, EnemyVisual, UnitLayer } from "../core/types";
import { enemyIcon } from "./wave-forecast";
import { escape } from "./format";

export interface LiveUnit {
  type: EnemyId;
  name: string;
  layer: UnitLayer;
  color: number;
  visual: EnemyVisual;
  /** On the field now. */
  alive: number;
  /** Still waiting in the spawn queue. */
  queued: number;
}
export interface LiveUnits {
  alive: number;
  queued: number;
  units: LiveUnit[];
}

/** Enemies of the running wave, grouped by type; null between waves. */
export function liveUnits(game: Game): LiveUnits | null {
  const s = game.state,
    { enemies } = game.content;
  if (s.status !== "wave") return null;
  const units = new Map<EnemyId, LiveUnit>(),
    unit = (type: EnemyId) => {
      let u = units.get(type);
      if (!u) {
        const d = enemies[type];
        u = { type, name: d.name, layer: d.layer, color: d.color, visual: d.visual, alive: 0, queued: 0 };
        units.set(type, u);
      }
      return u;
    };
  for (const e of s.enemies) unit(e.type).alive++;
  for (const spawn of s.queue) unit(spawn.type).queued++;
  return {
    alive: s.enemies.length,
    queued: s.queue.length,
    units: [...units.values()].sort((a, b) => b.alive - a.alive || b.queued - a.queued),
  };
}

const row = (u: LiveUnit) =>
  `<li class="live-unit ${u.layer}${u.alive ? "" : " pending"}">${enemyIcon(u.visual, u.color)}<span class="unit-name">${escape(u.name)}</span><b class="live-count">${u.alive}</b><small class="live-queued">${u.queued ? `+${u.queued}` : ""}</small></li>`;
/** Sidebar panel while a wave runs. */
export function renderLiveUnits(live: LiveUnits, wave: number): string {
  return `<div class="selection-heading"><span>IM FELD · WELLE ${String(wave).padStart(2, "0")}</span><b>${live.alive} aktiv${live.queued ? ` · ${live.queued} folgen` : ""}</b></div>
    ${live.units.length ? `<ul class="live-list">${live.units.map(row).join("")}</ul>` : '<p class="live-empty">Feld frei.</p>'}`;
}
