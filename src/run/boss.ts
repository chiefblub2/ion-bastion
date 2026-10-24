import type { WaveDefinition } from "../core/types";
import { g } from "../content/waves";
import { mapEnemies, type PackFn } from "./transform";
/**
 * Boss modifiers: an act boss carries one, the Final Stand one or two (two from threat 5), an elite one. They are
 * shown on the map from the start of the act, and each is plain data for the generator: a pack transform, a wave
 * transform or a bias for the remix.
 */
export interface BossMod {
  id: string;
  name: string;
  icon: string;
  description: string;
  content?: PackFn;
  waves?: (waves: WaveDefinition[]) => WaveDefinition[];
  /** Share of ground groups the remix turns into flyers (when the pool has any). */
  airBias?: number;
  /** Stealth types weigh this much more in the pool when the roster has a Detector; otherwise the waves get 20% more HP. */
  stealth?: number;
}
const MAX_GROUP = 40;
const hp = (w: WaveDefinition, f: number): WaveDefinition => ({ ...w, hpMultiplier: Math.round((w.hpMultiplier ?? 1) * f * 1000) / 1000 });
export const BOSS_MODS = [
  {
    id: "iron",
    name: "Iron Vanguard",
    icon: "⛨",
    description: "Ground enemies wear armor (+15% absorbed, at least 20%).",
    content: mapEnemies((e) => {
      if (e.layer !== "ground" || e.id === "boss") return e;
      const armor = e.traits?.find((t) => t.kind === "armor");
      return armor && armor.kind === "armor"
        ? { ...e, traits: e.traits!.map((t) => (t === armor ? { ...armor, reduction: Math.min(0.6, Math.round((armor.reduction + 0.15) * 100) / 100) } : t)) }
        : { ...e, traits: [...(e.traits ?? []), { kind: "armor", reduction: 0.2 }] };
    }),
  },
  {
    id: "swarm",
    name: "Swarm Tide",
    icon: "⁙",
    description: "Half again as many enemies, each 30% weaker.",
    waves: (waves) =>
      waves.map((w) =>
        hp(
          {
            ...w,
            groups: w.groups.map((x) =>
              x.type === "boss" ? x : { ...x, count: Math.min(MAX_GROUP, Math.round(x.count * 1.5)), interval: Math.max(0.2, Math.round(x.interval * 67) / 100) },
            ),
          },
          0.7,
        ),
      ),
  },
  { id: "air", name: "Air Superiority", icon: "✈", description: "Many ground groups take to the air.", airBias: 0.4 },
  {
    id: "titan",
    name: "Titan Escort",
    icon: "♜",
    description: "A Titan joins each of the last three waves.",
    waves: (waves) =>
      waves.map((w, i) => {
        if (i < waves.length - 3) return w;
        const end = Math.max(4, ...w.groups.map((x) => x.delay + (x.count - 1) * x.interval));
        return { ...w, groups: [...w.groups, g("boss", 1, 1, Math.round(end * 5) / 10)] };
      }),
  },
  { id: "blackout", name: "Blackout", icon: "◐", description: "Stealth units crowd the waves, or the enemies grow 20% tougher.", stealth: 4 },
] as const satisfies readonly BossMod[];
export type BossModId = (typeof BOSS_MODS)[number]["id"];
export const BOSS_MOD_IDS: readonly BossModId[] = BOSS_MODS.map((m) => m.id);
export const bossModOf = (id: BossModId): BossMod => BOSS_MODS.find((m) => m.id === id)!;
export const isBossMod = (id: unknown): id is BossModId => BOSS_MOD_IDS.includes(id as BossModId);
export const harden = (waves: WaveDefinition[], f: number) => waves.map((w) => hp(w, f));
