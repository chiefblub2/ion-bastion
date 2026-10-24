/**
 * Threat levels (ascension): each completed full run unlocks the next level, and every level keeps the rules of the
 * ones below it. Level 0 is the plain run.
 */
export const MAX_THREAT = 10;
export const THREAT_TEXT: readonly string[] = [
  "The plain run.",
  "Elites have 10% more HP.",
  "10% fewer starting credits.",
  "The reactor holds 25 at most.",
  "Shop prices rise 20%.",
  "The Final Stand carries two modifiers.",
  "Every mission is 5% tougher.",
  "The run starts with a cursed relic.",
  "Repairs heal half.",
  "No free Doctrine after mission 2.",
  "Enemies have 10% more HP everywhere.",
];
export interface ThreatRules {
  eliteHp: number;
  credits: number;
  reactorMax: number;
  prices: number;
  finalMods: number;
  depth: number;
  cursedStart: boolean;
  repair: number;
  freeDoctrine: boolean;
  hp: number;
}
export function threatRules(threat: number): ThreatRules {
  const at = (level: number) => threat >= level;
  return {
    eliteHp: at(1) ? 1.1 : 1,
    credits: at(2) ? 0.9 : 1,
    reactorMax: at(3) ? 25 : 30,
    prices: at(4) ? 1.2 : 1,
    finalMods: at(5) ? 2 : 1,
    depth: at(6) ? 0.05 : 0,
    cursedStart: at(7),
    repair: at(8) ? 0.5 : 1,
    freeDoctrine: !at(9),
    hp: at(10) ? 1.1 : 1,
  };
}
