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
        ...(d.layer === "air" ? [{ kind: "air" as const, label: "AIR", title: "Flies: only towers that can target air can hit it" }] : []),
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
  armor: (t) => ({ label: `ARMOR ${number(t.reduction * 100)}%`, title: `Armor: blocks ${number(t.reduction * 100)}% of every hit` }),
  regen: (t) =>
    t.percent !== undefined
      ? { label: `REGEN ${number(t.percent * 100)}%/s`, title: `Regenerates ${number(t.percent * 100)}% of its max HP per second` }
      : { label: `REGEN ${number(t.perSecond ?? 0)}/s`, title: `Regenerates ${number(t.perSecond ?? 0)} HP per second` },
  splitOnDeath: (t, content) => ({
    label: `SPLITS ×${t.count}`,
    title: `Splits into ${t.count}× ${content.enemies[t.type as EnemyId]?.name ?? t.type}`,
  }),
  slowImmune: () => ({ label: "IMMUNE: SLOW", title: "Immune to slowing" }),
  shield: (t) => ({
    label: `SHIELD ${number(t.capacity * 100)}%`,
    title: `Shield worth ${number(t.capacity * 100)}% of HP; recharges after ${number(t.delay)} s without a hit`,
  }),
  sprint: (t) => ({
    label: "SPRINT",
    title: `Once below ${number(t.threshold * 100)}% HP: ${number((t.factor - 1) * 100)}% faster for ${number(t.duration)} s`,
  }),
  evade: (t) => ({ label: `EVADE 1/${t.every}`, title: `Dodges every ${t.every}th hit; burning always hits` }),
  burrow: (t) => ({
    label: "BURROWS",
    title: `Burrows for ${number(t.length)} cells every ${number(t.every)} cells: only traps and area damage hit`,
  }),
  harden: (t) => ({ label: "HARDENS", title: `Up to ${number(t.max * 100)}% damage reduction the more hurt it is` }),
  surge: (t) => ({
    label: "GUSTS",
    title: `Rushes for ${number(t.length)} cells every ${number(t.every)} cells with +${number((t.factor - 1) * 100)}% speed`,
  }),
  swarm: (t) => ({
    label: "SWARM",
    title: `${number(t.per * 100)}% less damage per same-type enemy within ${number(t.radius)} cells, at most ${number(t.max * 100)}%`,
  }),
  rage: (t) => ({ label: "RAGE", title: `Speeds up as HP drops: up to ${number(t.max * 100)}% faster near death` }),
  facet: (t) => ({
    label: "FACET",
    title: `For ${number(t.length)} s every ${number(t.every)} s: ${number(t.reduction * 100)}% less damage from hits, burning works in full`,
  }),
  leap: (t) => ({ label: "LEAP", title: `Switches layer (Ground ↔ Air) for ${number(t.length)} cells every ${number(t.every)} cells` }),
  dampen: (t) => ({ label: "DAMPENS", title: `It and enemies within ${number(t.radius)} cells are immune to slow, stun and pull` }),
  brood: (t, content) => ({
    label: "BROOD",
    title: `Lays a ${content.enemies[t.type as EnemyId]?.name ?? t.type} every ${number(t.every)} cells (max. ${t.max})`,
  }),
  overload: (t) => ({ label: "OVERLOAD", title: `On death, disables attack towers within ${number(t.radius)} cells for ${number(t.cycles)} firing cycles` }),
  refract: (t) => ({ label: "REFRACT", title: `Refraction: instant hits (Tesla, Lance, Focus, Quake, Gravitron, Jammer) ×${number(t.factor)}` }),
  blastproof: (t) => ({ label: "BLASTPROOF", title: `Blastproof: area damage −${number(t.reduction * 100)}%` }),
  insulated: () => ({ label: "INSULATED", title: "Insulated: Tesla chains break off" }),
  heatshield: () => ({ label: "HEATSHIELD", title: "Heat shield: immune to burning and bleeding" }),
  mirror: (t) => ({ label: "MIRROR", title: `Mirror plating: max. ${number(t.cap * 100)}% of HP per hit` }),
  link: (t) => ({ label: "LINK", title: `Link: splits damage within radius ${number(t.radius)}` }),
  taunt: (t) => ({ label: "TAUNT", title: `Taunt: towers within radius ${number(t.radius)} must target it` }),
  martyr: (t) => ({ label: "MARTYR", title: `Sacrifice: heals ${number(t.heal * 100)}% on death within radius ${number(t.radius)}` }),
  cloakField: (t) => ({ label: "CLOAK FIELD", title: `Cloak field: cloaks neighbors within radius ${number(t.radius)}` }),
  retaliate: (t) => ({ label: "RETALIATE", title: `Retaliation: towers within radius ${number(t.radius)} get +${number(t.cycles)} cycles of cooldown` }),
  pack: (t) => ({ label: "PACK", title: `Pack: +${number(t.perAlly * 100)}% speed per neighbor (max. +${number(t.max * 100)}%, radius ${number(t.radius)})` }),
  blink: (t) => ({ label: "BLINK", title: `Jump drive: jumps ${number(t.jump)} cells every ${number(t.every)} cells` }),
  tunnel: (t) => ({ label: "TUNNEL", title: `Tunneling: ${number(t.speed)}× faster underground` }),
  phase: (t) => ({ label: "PHASE", title: `Phase shift: ${number(t.air)} s of every ${number(t.period)} s in the air` }),
  blind: (t) => ({ label: "BLIND", title: `Glare: −${number(t.range * 100)}% range within radius ${number(t.radius)}` }),
  jam: (t) => ({ label: "JAM", title: `Jamming field: towers within radius ${number(t.radius)} fire ${number(t.slow * 100)}% slower` }),
  defuse: (t) => ({ label: "DEFUSE", title: `Defuser: traps within radius ${number(t.radius)} do not trigger` }),
  suppress: (t) => ({ label: "NULL", title: `Null field: support within radius ${number(t.radius)} is ineffective` }),
  molt: (t) => ({
    label: "MOLT",
    title: `Armored (${number(t.armor * 100)}% less damage) down to ${number(t.threshold * 100)}% HP, then ${number(t.speed)}× as fast`,
  }),
  momentum: (t) => ({
    label: "MOMENTUM",
    title: `Speeds up the longer it circles: up to +${number(t.max * 100)}% speed (+${number(t.per * 100)}% per cell)`,
  }),
  lap: (t) => ({
    label: "LAPS",
    title: `Tougher every lap: ${number(t.per * 100)}% less damage per completed lap, at most ${number(t.max * 100)}%`,
  }),
  healer: (t) => ({
    label: "HEALER",
    title: `Heals enemies within ${number(t.radius)} cells by ${number(t.percent * 100)}% of their HP per second`,
  }),
  leader: (t) => ({
    label: "LEADER",
    title: `Enemies within ${number(t.radius)} cells: +${number(t.speed * 100)}% speed, ${number(t.resist * 100)}% damage resistance`,
  }),
  stealth: () => ({ label: "STEALTH", title: "Stealth: can only be targeted within range of a Detector; area damage always hits" }),
  unstoppable: () => ({ label: "UNSTOPPABLE", title: "Cannot be slowed, frozen or stunned" }),
  swift: (t) => ({ label: "SWIFT", title: `${number(t.speed * 100)}% faster, but ${number(t.hp * 100)}% less HP` }),
};
export function traitTag(t: Trait, content: ContentPack): ForecastTag {
  const text = (TRAIT_TAGS[t.kind] as (t: Trait, content: ContentPack) => TagText)(t, content);
  return { kind: t.kind, ...text };
}

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
/** Small SVG of an enemy, in the same shape as on the battlefield. */
export function enemyIcon(visual: EnemyVisual, color: number): string {
  const r = 7.5,
    n2 = (v: number) => v.toFixed(2),
    at = (angle: number, radius: number) => `${n2(Math.cos(angle) * radius)},${n2(Math.sin(angle) * radius)}`,
    fill = hex(color),
    svg = (inner: string) => `<svg class="enemy-icon" viewBox="-10 -10 20 20" aria-hidden="true">${inner}</svg>`,
    poly = (pts: string[]) => `<polygon points="${pts.join(" ")}" fill="${fill}"/>`;
  switch (visual.shape) {
    case "glider":
      return svg(poly([at(0, r * 1.2), at(2.5, r * 1.1), at(Math.PI, r * 0.35), at(-2.5, r * 1.1)]));
    case "star":
      return svg(poly(Array.from({ length: visual.points * 2 }, (_, i) => at((i * Math.PI) / visual.points, i % 2 ? r * visual.inner : r))));
    case "orb": {
      const moons = Array.from({ length: visual.moons }, (_, i) => {
        const a = (i * Math.PI * 2) / visual.moons - Math.PI / 2;
        return `<circle cx="${n2(Math.cos(a) * 9)}" cy="${n2(Math.sin(a) * 9)}" r="1.1" fill="#fff" fill-opacity=".85"/>`;
      }).join("");
      return svg(`<circle r="${r * 0.9}" fill="${fill}" fill-opacity=".3"/><circle r="${r * 0.6}" fill="${fill}"/>${moons}`);
    }
    case "worm": {
      const k = visual.segments,
        step = 17 / k,
        circles = Array.from({ length: k }, (_, i) => {
          const rad = 3.6 * (1 - (i * 0.5) / k);
          return `<circle cx="${n2(-8 + (k - 1 - i) * step + rad * 0.3)}" cy="0" r="${n2(rad)}" fill="${fill}" stroke="#0c1417" stroke-width=".8"/>`;
        });
      return svg(circles.join(""));
    }
    default:
      return svg(poly(Array.from({ length: visual.sides }, (_, i) => at((visual.rotation ?? 0) + (i * Math.PI * 2) / visual.sides, r))));
  }
}

export const LAYER = { ground: "Ground", air: "Air" } as const;
function badges(w: ForecastWave) {
  return w.enemies
    .map((e) => {
      const title = [`${e.name} · ${LAYER[e.layer]} · ${number(e.hp)} HP`, ...e.tags.map((t) => t.title)].join("\n");
      const tags = e.tags
        .map((t) => `<em class="unit-tag ${t.kind === "air" ? "air" : `trait ${t.kind}`}">${escape(t.label)}</em>`)
        .join("");
      return `<li class="unit-badge ${e.layer}" title="${escape(title)}">${enemyIcon(e.visual, e.color)}<b>${e.count}×</b><span class="unit-name">${escape(e.name)}</span><span class="unit-hp">♡ ${number(e.hp)}</span>${tags}${e.isNew ? '<em class="unit-tag new">NEW</em>' : ""}</li>`;
    })
    .join("");
}
/** Compact strip for the field toolbar: label, size of the wave and one badge per enemy type. */
export function renderWaveForecast(w: ForecastWave): string {
  const label = `${w.last ? "FINAL WAVE" : "NEXT WAVE"} ${String(w.number).padStart(2, "0")}`;
  return `<section class="next-wave${w.hasAir ? " has-air" : ""}" aria-label="${w.last ? "Final" : "Next"} wave ${w.number}">
      <div class="next-wave-head"><span class="stat-label">${label}</span><small>${w.total} ${w.total === 1 ? "enemy" : "enemies"} · ≈ ${number(Math.round(w.totalHp / 100) * 100)} HP</small></div>
      <ul class="unit-badges">${badges(w)}</ul>
    </section>`;
}
