import type { Game } from "../core/game";
import type { ContentPack, EnemyId, EnemyVisual, Trait, TraitKind, UnitLayer } from "../core/types";
import { waveHpScale } from "../systems/spawn";
import { traitHpFactor } from "../systems/traits";
import { escape, number } from "./format";

export interface ForecastEnemy {
  type: EnemyId;
  name: string;
  count: number;
  layer: UnitLayer;
  color: number;
  visual: EnemyVisual;
  /** HP of one enemy in this wave. */
  hp: number;
  /** First appearance in this mission. */
  isNew: boolean;
  /** Properties the player must plan for: air layer and traits. */
  tags: ForecastTag[];
}
export interface ForecastTag {
  kind: "air" | TraitKind;
  label: string;
  title: string;
}
export interface ForecastWave {
  number: number;
  last: boolean;
  hasAir: boolean;
  /** Enemies and their summed HP in the whole wave. */
  total: number;
  totalHp: number;
  enemies: ForecastEnemy[];
}

/** The wave the next start command launches; null if none is left or the mission is over. */
export function waveForecast(game: Game): ForecastWave | null {
  const s = game.state,
    { enemies } = game.content,
    waves = game.waves,
    n = s.wave + 1;
  if (s.status === "won" || s.status === "lost" || n > waves.length) return null;
  const wave = waves[n - 1],
    earlier = new Set(waves.slice(0, n - 1).flatMap((w) => w.groups.map((g) => g.type))),
    counts = new Map<EnemyId, number>();
  for (const g of wave.groups) counts.set(g.type, (counts.get(g.type) ?? 0) + g.count);
  const list = [...counts].map(([type, amount]): ForecastEnemy => {
    const d = enemies[type];
    return {
      type,
      name: d.name,
      count: amount,
      layer: d.layer,
      color: d.color,
      visual: d.visual,
      hp: Math.round(d.hp * waveHpScale(game.mission, n) * traitHpFactor(game.content, type)),
      isNew: !earlier.has(type),
      tags: [
        ...(d.layer === "air" ? [{ kind: "air" as const, label: "LUFT", title: "Fliegt – nur Türme mit Luftziel treffen" }] : []),
        ...(d.traits ?? []).map((t) => traitTag(t, game.content)),
      ],
    };
  });
  return {
    number: n,
    last: n === waves.length,
    hasAir: list.some((e) => e.layer === "air"),
    total: list.reduce((sum, e) => sum + e.count, 0),
    totalHp: list.reduce((sum, e) => sum + e.count * e.hp, 0),
    enemies: list,
  };
}
type TagText = Omit<ForecastTag, "kind">;
const TRAIT_TAGS: { [K in TraitKind]: (t: Extract<Trait, { kind: K }>, content: ContentPack) => TagText } = {
  armor: (t) => ({ label: `RÜSTUNG ${number(t.reduction * 100)} %`, title: `Rüstung: blockt ${number(t.reduction * 100)} % jedes Treffers` }),
  regen: (t) =>
    t.percent !== undefined
      ? { label: `REGEN ${number(t.percent * 100)} %/s`, title: `Regeneriert ${number(t.percent * 100)} % seiner maximalen HP pro Sekunde` }
      : { label: `REGEN ${number(t.perSecond ?? 0)}/s`, title: `Regeneriert ${number(t.perSecond ?? 0)} HP pro Sekunde` },
  splitOnDeath: (t, content) => ({
    label: `TEILT ×${t.count}`,
    title: `Zerfällt beim Tod in ${t.count}× ${content.enemies[t.type as EnemyId]?.name ?? t.type}`,
  }),
  slowImmune: () => ({ label: "IMMUN: SLOW", title: "Immun gegen Verlangsamung" }),
  shield: (t) => ({
    label: `SCHILD ${number(t.capacity * 100)} %`,
    title: `Schild über ${number(t.capacity * 100)} % der HP; lädt nach ${number(t.delay)} s ohne Treffer wieder auf`,
  }),
  sprint: (t) => ({
    label: "SPURT",
    title: `Unter ${number(t.threshold * 100)} % HP einmalig ${number(t.duration)} s lang ${number((t.factor - 1) * 100)} % schneller`,
  }),
  evade: (t) => ({ label: `AUSWEICHEN 1/${t.every}`, title: `Weicht jedem ${t.every}. Treffer aus; Brand trifft immer` }),
  burrow: (t) => ({
    label: "GRÄBT SICH EIN",
    title: `Taucht alle ${number(t.every)} Felder für ${number(t.length)} Felder ab: nur Fallen und Flächenschaden treffen`,
  }),
  harden: (t) => ({ label: "VERHÄRTET", title: `Bis zu ${number(t.max * 100)} % Schadensreduktion, je verletzter er ist` }),
  surge: (t) => ({
    label: "BÖEN",
    title: `Rast alle ${number(t.every)} Felder für ${number(t.length)} Felder mit +${number((t.factor - 1) * 100)} % Tempo`,
  }),
  swarm: (t) => ({
    label: "SCHWARM",
    title: `Pro Artgenosse in ${number(t.radius)} Feldern ${number(t.per * 100)} % weniger Schaden, höchstens ${number(t.max * 100)} %`,
  }),
  rage: (t) => ({ label: "WUT", title: `Wird schneller, je mehr HP fehlen: bis zu ${number(t.max * 100)} % schneller kurz vor dem Tod` }),
  facet: (t) => ({
    label: "FACETTE",
    title: `Alle ${number(t.every)} s für ${number(t.length)} s ${number(t.reduction * 100)} % weniger Schaden durch Treffer, Brand wirkt voll`,
  }),
  healer: (t) => ({
    label: "HEILER",
    title: `Heilt Gegner in ${number(t.radius)} Feldern um ${number(t.percent * 100)} % ihrer HP pro Sekunde`,
  }),
  leader: (t) => ({
    label: "ANFÜHRER",
    title: `Gegner in ${number(t.radius)} Feldern: +${number(t.speed * 100)} % Tempo, ${number(t.resist * 100)} % Schadensresistenz`,
  }),
  stealth: () => ({ label: "GETARNT", title: "Getarnt: nur im Bereich eines Detektors anvisierbar; Flächenschaden trifft immer" }),
  unstoppable: () => ({ label: "UNAUFHALTSAM", title: "Kann nicht verlangsamt, eingefroren oder betäubt werden" }),
  swift: (t) => ({ label: "FLINK", title: `${number(t.speed * 100)} % schneller, dafür ${number(t.hp * 100)} % weniger HP` }),
};
export function traitTag(t: Trait, content: ContentPack): ForecastTag {
  const text = (TRAIT_TAGS[t.kind] as (t: Trait, content: ContentPack) => TagText)(t, content);
  return { kind: t.kind, ...text };
}

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
/** Small SVG of an enemy, in the same shape as on the battlefield. */
export function enemyIcon(visual: EnemyVisual, color: number): string {
  const r = 7.5,
    at = (angle: number, radius: number) => `${(Math.cos(angle) * radius).toFixed(2)},${(Math.sin(angle) * radius).toFixed(2)}`;
  const points =
    visual.shape === "glider"
      ? [at(0, r * 1.2), at(2.5, r * 1.1), at(Math.PI, r * 0.35), at(-2.5, r * 1.1)]
      : Array.from({ length: visual.sides }, (_, i) => at((visual.rotation ?? 0) + (i * Math.PI * 2) / visual.sides, r));
  return `<svg class="enemy-icon" viewBox="-10 -10 20 20" aria-hidden="true"><polygon points="${points.join(" ")}" fill="${hex(color)}"/></svg>`;
}

export const LAYER = { ground: "Boden", air: "Luft" } as const;
function badges(w: ForecastWave) {
  return w.enemies
    .map((e) => {
      const title = [`${e.name} · ${LAYER[e.layer]} · ${number(e.hp)} HP`, ...e.tags.map((t) => t.title)].join("\n");
      const tags = e.tags
        .map((t) => `<em class="unit-tag ${t.kind === "air" ? "air" : `trait ${t.kind}`}">${escape(t.label)}</em>`)
        .join("");
      return `<li class="unit-badge ${e.layer}" title="${escape(title)}">${enemyIcon(e.visual, e.color)}<b>${e.count}×</b><span class="unit-name">${escape(e.name)}</span><span class="unit-hp">♡ ${number(e.hp)}</span>${tags}${e.isNew ? '<em class="unit-tag new">NEU</em>' : ""}</li>`;
    })
    .join("");
}
/** Compact strip for the field toolbar: label, size of the wave and one badge per enemy type. */
export function renderWaveForecast(w: ForecastWave): string {
  const label = `${w.last ? "LETZTE WELLE" : "NÄCHSTE WELLE"} ${String(w.number).padStart(2, "0")}`;
  return `<section class="next-wave${w.hasAir ? " has-air" : ""}" aria-label="${w.last ? "Letzte" : "Nächste"} Welle ${w.number}">
      <div class="next-wave-head"><span class="stat-label">${label}</span><small>${w.total} Gegner · ≈ ${number(Math.round(w.totalHp / 100) * 100)} HP</small></div>
      <ul class="unit-badges">${badges(w)}</ul>
    </section>`;
}
