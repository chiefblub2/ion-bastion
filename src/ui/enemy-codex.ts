import type { ContentPack, EnemyDefinition, EnemyId, MissionDefinition, TraitKind } from "../core/types";
import { DISRUPTABLE, traitHpFactor } from "../systems/traits";
import { escape, number } from "./format";
import { enemyIcon, LAYER, traitTag, type ForecastTag } from "./wave-forecast";

/** Name and general rule of every trait for the codex; the per-enemy values come from `traitTag`. */
const TRAIT_INFO: { [K in TraitKind]: { name: string; text: string } } = {
  armor: { name: "Armor", text: "Blocks a fixed share of every hit." },
  regen: { name: "Regeneration", text: "Continuously heals itself, up to full HP at most." },
  splitOnDeath: { name: "Splitting", text: "Breaks into several smaller enemies on death." },
  slowImmune: { name: "Slow immunity", text: "Slowing effects have no effect." },
  shield: { name: "Shield", text: "A shield absorbs damage before HP and fully recharges after a pause without hits." },
  sprint: { name: "Sprint", text: "Dashes ahead once for a short time as soon as a hit pushes its HP below a threshold." },
  evade: { name: "Evasion", text: "Regularly dodges a hit. Burning always hits." },
  healer: { name: "Healer", text: "Heals other enemies nearby." },
  leader: { name: "Leader", text: "Makes nearby enemies faster and tougher. Multiple leaders do not stack." },
  stealth: {
    name: "Stealth",
    text: "Towers can only target it within range of a Detector. Area damage and traps still hit it.",
  },
  unstoppable: { name: "Unstoppable", text: "Cannot be slowed, stunned or pulled back." },
  swift: { name: "Swift", text: "Faster than its build suggests, but with less HP." },
  burrow: {
    name: "Burrowing",
    text: "Burrows at fixed intervals. Underground only traps and area damage hit it; even a Detector does not help.",
  },
  harden: { name: "Hardening", text: "Takes less damage the more hurt it is." },
  surge: { name: "Gusts", text: "Bursts into short speed boosts at fixed intervals." },
  swarm: { name: "Swarm", text: "Takes less damage the more of its kind are nearby." },
  rage: { name: "Rage", text: "Gets faster the more HP it is missing." },
  facet: {
    name: "Facet",
    text: "Deflects part of every hit in a rhythm shared by all. Burning and Caltrops work in full.",
  },
  leap: { name: "Leap", text: "Switches layer at fixed intervals: ground enemies briefly fly, flyers briefly walk. Traps do not trigger then." },
  dampen: { name: "Damper", text: "It and nearby enemies are immune to slow, stun and pull. A Jammer switches this off." },
  brood: { name: "Brood", text: "Lays eggs along the way from which more enemies hatch. A Jammer stops it." },
  overload: { name: "Overload", text: "On death, disables nearby attack towers for a few firing cycles. Support and traps are unaffected." },
  momentum: { name: "Momentum", text: "Gets faster the longer it travels. Pulling it back or slowing it takes the momentum away." },
  lap: { name: "Laps", text: "Takes less damage with every completed lap of the ring. No effect on missions with a reactor." },
  refract: { name: "Refraction", text: "Instant hits (Tesla, Lance, Focus, Quake, Gravitron, Jammer) deal only part of their damage." },
  blastproof: { name: "Blastproof", text: "Area damage (Nova, Mortar, Quake, Sticky Mine, Mine) is greatly reduced." },
  insulated: { name: "Insulated", text: "Tesla chains do not jump to it; as the first target, the chain stops at it." },
  heatshield: { name: "Heat shield", text: "Immune to burning and bleeding." },
  mirror: { name: "Mirror plating", text: "A single hit deals at most a small share of its max HP. Pitfall and execution ignore this." },
  link: { name: "Link", text: "Shares all damage evenly with nearby enemies of its kind. A Jammer breaks the link." },
  taunt: { name: "Taunt", text: "Nearby attack towers must target it. Traps ignore it. A Jammer cancels this." },
  martyr: { name: "Sacrifice", text: "Heals all nearby enemies on death. A Jammer prevents this." },
  cloakField: { name: "Cloak field", text: "Cloaks other nearby enemies until a Detector picks them up; it stays visible itself. Traps and area damage still hit." },
  retaliate: { name: "Retaliation", text: "Nearby attack towers that hit it reload more slowly. Traps and burning do not trigger this." },
  pack: { name: "Pack", text: "Gets faster the more of its kind run nearby. Splitting or slowing the pack takes the boost away." },
  blink: { name: "Jump drive", text: "Jumps ahead along the path at fixed intervals. It does not jump while being pulled back. A Jammer switches the drive off." },
  tunnel: { name: "Tunneling", text: "Digs in at fixed intervals and runs faster underground. Then only traps and area damage hit it; even a Detector does not help." },
  phase: { name: "Phase shift", text: "Alternates between air and ground with game time. Only towers that can hit the current layer target it; traps trigger only on the ground." },
  blind: { name: "Glare", text: "Nearby attack towers lose range. Support and traps are unaffected. A Jammer switches it off." },
  jam: { name: "Jamming field", text: "Nearby attack towers fire more slowly. Support and traps are unaffected. A Jammer switches it off." },
  defuse: { name: "Defuser", text: "Nearby traps do not trigger for anyone. A Jammer switches it off." },
  suppress: { name: "Null field", text: "Aura, Detector, Bounty Beacon and Tracker nearby are ineffective; the Repair Dock is not. A Jammer switches it off." },
  molt: { name: "Molt", text: "Armored as long as it has enough HP. Below that it sheds its armor and gets faster." },
};
const AIR_TAG: ForecastTag = { kind: "air", label: "AIR", title: "Flies: only towers that can target air can hit it" };
const AIR_INFO = { name: "Flyer", text: "Flies over the path. Only towers that can target air hit it; traps do not trigger." };

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
  /** The Jammer switches it off. */
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
      ["enemies", "Enemies", enemies.length],
      ["traits", "Traits", traits.length],
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
              since = e.firstMission ? `from Mission ${pad(e.firstMission.number)} · ${escape(e.firstMission.name)}` : "in no mission";
            const traitRows = e.tags.map((t) => `<li>${tagHtml(t)}<span>${escape(t.title)}</span></li>`).join("");
            return `<article class="codex-card ${d.layer}"><header>${enemyIcon(d.visual, d.color)}<span><strong>${escape(d.name)}</strong><small>${LAYER[d.layer]} · ${since}</small></span></header>
              <div class="codex-stats"><div><b>♡ ${number(e.hp)}</b><span>HP</span></div><div><b>${number(e.speed)}</b><span>Cells/s</span></div><div><b>◇ ${number(d.reward)}</b><span>Reward</span></div><div><b>${number(d.leak)}</b><span>Reactor damage</span></div></div>
              ${traitRows ? `<ul class="codex-traits">${traitRows}</ul>` : `<p class="codex-plain">No special traits.</p>`}</article>`;
          })
          .join("")
      : traits
          .map(
            (t) => `<article class="codex-card"><header><span><strong>${escape(t.name)}</strong></span></header><p>${escape(t.text)}${t.disruptable ? " The Jammer switches the trait off." : ""}</p>
              <ul class="codex-carriers">${t.enemies.map((e) => `<li title="${escape(e.tag.title)}">${enemyIcon(e.definition.visual, e.definition.color)}<span>${escape(e.definition.name)}</span>${tagHtml(e.tag)}</li>`).join("")}</ul></article>`,
          )
          .join("");
  return { tabs, list };
}
