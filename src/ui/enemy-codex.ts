import type { ContentPack, EnemyDefinition, EnemyId, MissionDefinition, TraitKind } from "../core/types";
import { DISRUPTABLE, traitHpFactor } from "../systems/traits";
import { escape, number } from "./format";
import { enemyIcon, LAYER, traitTag, type ForecastTag } from "./wave-forecast";

/** Name and general rule of every trait for the codex; the per-enemy values come from `traitTag`. */
const TRAIT_INFO: { [K in TraitKind]: { name: string; text: string } } = {
  armor: { name: "Rüstung", text: "Blockt einen festen Anteil jedes Treffers." },
  regen: { name: "Regeneration", text: "Heilt sich laufend selbst, höchstens bis zur vollen HP." },
  splitOnDeath: { name: "Teilung", text: "Zerfällt beim Tod in mehrere kleinere Gegner." },
  slowImmune: { name: "Immun gegen Verlangsamung", text: "Verlangsamende Effekte wirken nicht." },
  shield: { name: "Schild", text: "Ein Schild fängt Schaden vor den HP ab und lädt sich nach einer Pause ohne Treffer wieder voll auf." },
  sprint: { name: "Spurt", text: "Rennt einmalig für kurze Zeit los, sobald ein Treffer seine HP unter eine Schwelle drückt." },
  evade: { name: "Ausweichen", text: "Weicht regelmäßig einem Treffer aus. Brand trifft immer." },
  healer: { name: "Heiler", text: "Heilt andere Gegner in seiner Nähe." },
  leader: { name: "Anführer", text: "Macht Gegner in seiner Nähe schneller und widerstandsfähiger. Mehrere Anführer addieren sich nicht." },
  stealth: {
    name: "Tarnung",
    text: "Türme können ihn nur im Bereich eines Detektors anvisieren. Flächenschaden und Fallen treffen ihn trotzdem.",
  },
  unstoppable: { name: "Unaufhaltsam", text: "Kann weder verlangsamt noch betäubt noch zurückgezogen werden." },
  swift: { name: "Flink", text: "Schneller als seine Bauart, dafür mit weniger HP." },
  burrow: {
    name: "Graben",
    text: "Taucht in festen Abständen ab. Unter der Erde treffen ihn nur Fallen und Flächenschaden, auch ein Detektor hilft nicht.",
  },
  harden: { name: "Verhärtung", text: "Nimmt weniger Schaden, je verletzter er ist." },
  surge: { name: "Böen", text: "Legt in festen Abständen kurze Tempostöße ein." },
  swarm: { name: "Schwarm", text: "Nimmt weniger Schaden, je mehr Artgenossen in seiner Nähe sind." },
  rage: { name: "Wut", text: "Wird schneller, je mehr HP ihm fehlen." },
  facet: {
    name: "Facette",
    text: "Wehrt in einem für alle gleichen Takt einen Teil jedes Treffers ab. Brand und Krähenfüße wirken voll.",
  },
  leap: { name: "Sprung", text: "Wechselt in festen Abständen die Ebene: Bodengegner fliegen kurz, Flieger laufen kurz am Boden. Fallen lösen dann nicht aus." },
  dampen: { name: "Dämpfer", text: "Er und Gegner in seiner Nähe sind immun gegen Verlangsamung, Betäubung und Sog. Ein Störsender schaltet das ab." },
  brood: { name: "Brut", text: "Legt unterwegs Eier ab, aus denen weitere Gegner schlüpfen. Ein Störsender hält ihn davon ab." },
  overload: { name: "Überlast", text: "Legt beim Tod nahe Angriffstürme für einige Schusszyklen lahm. Unterstützung und Fallen bleiben unberührt." },
  momentum: { name: "Schwung", text: "Wird schneller, je länger er unterwegs ist. Wer ihn zurückzieht oder bremst, nimmt ihm den Schwung." },
  lap: { name: "Runden", text: "Nimmt mit jeder vollendeten Runde auf dem Ring weniger Schaden. Auf Missionen mit Reaktor ohne Wirkung." },
  refract: { name: "Brechung", text: "Sofort-Treffer (Tesla, Lanze, Fokus, Beben, Gravitron, Störsender) richten nur einen Teil ihres Schadens an." },
  blastproof: { name: "Druckfest", text: "Flächenschaden (Nova, Mörser, Beben, Haftmine, Mine) wird stark gemindert." },
  insulated: { name: "Isoliert", text: "Tesla-Ketten springen nicht auf ihn über; als erstes Ziel bricht die Kette bei ihm ab." },
  heatshield: { name: "Hitzeschild", text: "Immun gegen Brand und Blutung." },
  mirror: { name: "Spiegelpanzer", text: "Ein einzelner Treffer richtet höchstens einen kleinen Anteil seiner maximalen HP an. Fallgrube und Hinrichtung ignorieren das." },
  link: { name: "Verbund", text: "Teilt jeden Schaden gleichmäßig mit Artgenossen in seiner Nähe. Ein Störsender löst den Verbund." },
  taunt: { name: "Köder", text: "Angriffstürme in seiner Nähe müssen ihn anvisieren. Fallen ignorieren ihn. Ein Störsender hebt das auf." },
  martyr: { name: "Opfergabe", text: "Heilt beim Tod alle Gegner in seiner Nähe. Ein Störsender verhindert das." },
  cloakField: { name: "Tarnfeld", text: "Tarnt andere Gegner in seiner Nähe, bis ein Detektor sie erfasst; er selbst bleibt sichtbar. Fallen und Flächenschaden treffen trotzdem." },
  retaliate: { name: "Vergeltung", text: "Angriffstürme in seiner Nähe, die ihn treffen, laden langsamer nach. Fallen und Brand lösen das nicht aus." },
  pack: { name: "Rudel", text: "Wird schneller, je mehr Artgenossen in seiner Nähe laufen. Wer das Rudel trennt oder bremst, nimmt ihm den Schub." },
  blink: { name: "Sprungantrieb", text: "Springt in festen Abständen ein Stück auf dem Pfad voraus. Wird er zurückgezogen, springt er nicht. Ein Störsender schaltet den Antrieb ab." },
  tunnel: { name: "Tunnelgang", text: "Gräbt sich in festen Abständen ein und läuft unter der Erde schneller. Nur Fallen und Flächenschaden treffen ihn dann, auch ein Detektor hilft nicht." },
  phase: { name: "Phasenwechsel", text: "Wechselt im Takt der Spielzeit zwischen Luft und Boden. Nur Türme, die die aktuelle Ebene treffen, erfassen ihn; Fallen lösen nur am Boden aus." },
  blind: { name: "Blendlicht", text: "Angriffstürme in seiner Nähe verlieren Reichweite. Unterstützung und Fallen bleiben unberührt. Ein Störsender schaltet es ab." },
  jam: { name: "Störfeld", text: "Angriffstürme in seiner Nähe feuern langsamer. Unterstützung und Fallen bleiben unberührt. Ein Störsender schaltet es ab." },
  defuse: { name: "Entschärfer", text: "Fallen in seiner Nähe lösen für niemanden aus. Ein Störsender schaltet es ab." },
  suppress: { name: "Nullfeld", text: "Aura, Detektor, Prämienbake und Peilsender in seiner Nähe sind wirkungslos; das Reparaturdock nicht. Ein Störsender schaltet es ab." },
  molt: { name: "Häutung", text: "Gepanzert, solange er genug HP hat. Darunter wirft er den Panzer ab und wird schneller." },
};
const AIR_TAG: ForecastTag = { kind: "air", label: "LUFT", title: "Fliegt – nur Türme mit Luftziel treffen" };
const AIR_INFO = { name: "Flieger", text: "Fliegt über den Pfad. Nur Türme mit Luftziel treffen ihn, Fallen lösen nicht aus." };

export interface CodexEnemy {
  definition: EnemyDefinition;
  /** Spawn HP and speed before wave scaling, with `swift` applied. */
  hp: number;
  speed: number;
  /** First mission that sends it, directly or as a split fragment. */
  firstMission?: { number: number; name: string };
  tags: ForecastTag[];
}
export interface CodexTrait {
  kind: "air" | TraitKind;
  name: string;
  text: string;
  /** The Störsender switches it off. */
  disruptable: boolean;
  enemies: { definition: EnemyDefinition; tag: ForecastTag }[];
}

/** Enemy types a mission meets: its wave groups plus everything they split into. */
function missionEnemies(mission: MissionDefinition, content: ContentPack) {
  const found = new Set<EnemyId>(),
    queue: EnemyId[] = mission.waves.flatMap((w) => w.groups.map((g) => g.type));
  while (queue.length) {
    const type = queue.shift()!;
    if (found.has(type) || !content.enemies[type]) continue;
    found.add(type);
    for (const t of content.enemies[type].traits ?? []) if (t.kind === "splitOnDeath") queue.push(t.type as EnemyId);
  }
  return found;
}

/** Every enemy of the pack, in the order the campaign introduces them; unused types come last. */
export function codexEnemies(content: ContentPack): CodexEnemy[] {
  const first = new Map<EnemyId, CodexEnemy["firstMission"]>();
  content.missions.forEach((m, i) => {
    for (const type of missionEnemies(m, content)) if (!first.has(type)) first.set(type, { number: i + 1, name: m.name });
  });
  const order = (type: EnemyId) => first.get(type)?.number ?? Infinity;
  return (Object.keys(content.enemies) as EnemyId[])
    .map((type, index) => ({ type, index }))
    .sort((a, b) => order(a.type) - order(b.type) || a.index - b.index)
    .map(({ type }) => {
      const d = content.enemies[type],
        swift = d.traits?.find((t) => t.kind === "swift");
      return {
        definition: d,
        hp: Math.round(d.hp * traitHpFactor(content, type)),
        speed: d.speed * (swift ? 1 + swift.speed : 1),
        firstMission: first.get(type),
        tags: [...(d.layer === "air" ? [AIR_TAG] : []), ...(d.traits ?? []).map((t) => traitTag(t, content))],
      };
    });
}

/** Air layer and every trait that at least one enemy carries, with those enemies in codex order. */
export function codexTraits(content: ContentPack): CodexTrait[] {
  const enemies = codexEnemies(content),
    kinds: ("air" | TraitKind)[] = ["air", ...(Object.keys(TRAIT_INFO) as TraitKind[])];
  return kinds
    .map((kind) => ({
      kind,
      ...(kind === "air" ? AIR_INFO : TRAIT_INFO[kind]),
      disruptable: kind !== "air" && DISRUPTABLE.has(kind),
      enemies: enemies.flatMap((e) => e.tags.filter((t) => t.kind === kind).map((tag) => ({ definition: e.definition, tag }))),
    }))
    .filter((t) => t.enemies.length);
}

export type CodexTab = "enemies" | "traits";
const pad = (n: number) => String(n).padStart(2, "0");
const tagHtml = (t: ForecastTag) => `<em class="unit-tag ${t.kind === "air" ? "air" : `trait ${t.kind}`}">${escape(t.label)}</em>`;

/** Tab bar and list of the enemy codex dialog. */
export function renderEnemyCodex(content: ContentPack, tab: CodexTab) {
  const enemies = codexEnemies(content),
    traits = codexTraits(content);
  const tabs = (
    [
      ["enemies", "Gegner", enemies.length],
      ["traits", "Eigenschaften", traits.length],
    ] as const
  )
    .map(([id, label, count]) => {
      const active = id === tab;
      return `<button class="codex-tab" role="tab" id="codex-tab-${id}" data-codex-tab="${id}" aria-controls="codex-list" aria-selected="${active}" tabindex="${active ? 0 : -1}">${label} <small>${count}</small></button>`;
    })
    .join("");
  const list =
    tab === "enemies"
      ? enemies
          .map((e) => {
            const d = e.definition,
              since = e.firstMission ? `ab Mission ${pad(e.firstMission.number)} · ${escape(e.firstMission.name)}` : "in keiner Mission";
            const traitRows = e.tags.map((t) => `<li>${tagHtml(t)}<span>${escape(t.title)}</span></li>`).join("");
            return `<article class="codex-card ${d.layer}"><header>${enemyIcon(d.visual, d.color)}<span><strong>${escape(d.name)}</strong><small>${LAYER[d.layer]} · ${since}</small></span></header>
              <div class="codex-stats"><div><b>♡ ${number(e.hp)}</b><span>HP</span></div><div><b>${number(e.speed)}</b><span>Felder/s</span></div><div><b>◇ ${number(d.reward)}</b><span>Belohnung</span></div><div><b>${number(d.leak)}</b><span>Reaktorschaden</span></div></div>
              ${traitRows ? `<ul class="codex-traits">${traitRows}</ul>` : `<p class="codex-plain">Keine besonderen Eigenschaften.</p>`}</article>`;
          })
          .join("")
      : traits
          .map(
            (t) => `<article class="codex-card"><header><span><strong>${escape(t.name)}</strong></span></header><p>${escape(t.text)}${t.disruptable ? " Der Störsender schaltet die Eigenschaft ab." : ""}</p>
              <ul class="codex-carriers">${t.enemies.map((e) => `<li title="${escape(e.tag.title)}">${enemyIcon(e.definition.visual, e.definition.color)}<span>${escape(e.definition.name)}</span>${tagHtml(e.tag)}</li>`).join("")}</ul></article>`,
          )
          .join("");
  return { tabs, list };
}
