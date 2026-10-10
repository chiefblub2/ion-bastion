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
  leap: (t) => ({ label: "SPRUNG", title: `Wechselt alle ${number(t.every)} Felder für ${number(t.length)} Felder die Ebene (Boden ↔ Luft)` }),
  dampen: (t) => ({ label: "DÄMPFT", title: `Er und Gegner im Umkreis von ${number(t.radius)} Feldern sind immun gegen Verlangsamung, Betäubung und Sog` }),
  brood: (t, content) => ({
    label: "BRUT",
    title: `Legt alle ${number(t.every)} Felder einen ${content.enemies[t.type as EnemyId]?.name ?? t.type} ab (max. ${t.max})`,
  }),
  overload: (t) => ({ label: "ÜBERLAST", title: `Legt beim Tod Angriffstürme im Umkreis von ${number(t.radius)} Feldern für ${number(t.cycles)} Schusszyklen lahm` }),
  refract: (t) => ({ label: "BRECH", title: `Brechung: Sofort-Treffer (Tesla, Lanze, Fokus, Beben, Gravitron, Störsender) ×${number(t.factor)}` }),
  blastproof: (t) => ({ label: "DRUCK", title: `Druckfest: Flächenschaden −${number(t.reduction * 100)} %` }),
  insulated: () => ({ label: "ISO", title: "Isoliert: Tesla-Ketten brechen ab" }),
  heatshield: () => ({ label: "HITZE", title: "Hitzeschild: immun gegen Brand und Blutung" }),
  mirror: (t) => ({ label: "SPIEGEL", title: `Spiegelpanzer: max. ${number(t.cap * 100)} % der HP pro Treffer` }),
  link: (t) => ({ label: "VERBUND", title: `Verbund: teilt Schaden im Radius ${number(t.radius)}` }),
  taunt: (t) => ({ label: "KÖDER", title: `Köder: Türme im Radius ${number(t.radius)} müssen ihn anvisieren` }),
  martyr: (t) => ({ label: "OPFER", title: `Opfergabe: heilt beim Tod ${number(t.heal * 100)} % im Radius ${number(t.radius)}` }),
  cloakField: (t) => ({ label: "TARNFELD", title: `Tarnfeld: tarnt Nachbarn im Radius ${number(t.radius)}` }),
  retaliate: (t) => ({ label: "VERGELT", title: `Vergeltung: Türme im Radius ${number(t.radius)} +${number(t.cycles)} Zyklen Abklingzeit` }),
  pack: (t) => ({ label: "RUDEL", title: `Rudel: +${number(t.perAlly * 100)} % Tempo je Nachbar (max. +${number(t.max * 100)} %, Radius ${number(t.radius)})` }),
  blink: (t) => ({ label: "WARP", title: `Sprungantrieb: alle ${number(t.every)} Felder ${number(t.jump)} Felder weit` }),
  tunnel: (t) => ({ label: "TUNNEL", title: `Tunnelgang: unter der Erde ${number(t.speed)}× schneller` }),
  phase: (t) => ({ label: "PHASE", title: `Phasenwechsel: ${number(t.air)} s von ${number(t.period)} s in der Luft` }),
  blind: (t) => ({ label: "BLEND", title: `Blendlicht: −${number(t.range * 100)} % Reichweite im Radius ${number(t.radius)}` }),
  jam: (t) => ({ label: "STÖR", title: `Störfeld: Türme im Radius ${number(t.radius)} feuern ${number(t.slow * 100)} % langsamer` }),
  defuse: (t) => ({ label: "ENTSCH", title: `Entschärfer: Fallen im Radius ${number(t.radius)} lösen nicht aus` }),
  suppress: (t) => ({ label: "NULL", title: `Nullfeld: Unterstützung im Radius ${number(t.radius)} wirkungslos` }),
  molt: (t) => ({
    label: "HÄUTUNG",
    title: `Gepanzert (${number(t.armor * 100)} % weniger Schaden) bis ${number(t.threshold * 100)} % HP, danach ${number(t.speed)}× so schnell`,
  }),
  momentum: (t) => ({
    label: "SCHWUNG",
    title: `Wird schneller, je länger er kreist: bis zu +${number(t.max * 100)} % Tempo (+${number(t.per * 100)} % pro Feld)`,
  }),
  lap: (t) => ({
    label: "RUNDEN",
    title: `Härter mit jeder Runde: ${number(t.per * 100)} % weniger Schaden pro vollendeter Runde, höchstens ${number(t.max * 100)} %`,
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
