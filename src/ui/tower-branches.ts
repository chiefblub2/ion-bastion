import type { TowerDefinition } from "../core/types";
// A tower's specialization paths and Aura tracks with their tiers, grouped from its upgrades.

export interface TowerBranch {
  id: string;
  kind: "path" | "track";
  name: string;
  role?: string;
  color: number | string;
  tiers: { id: string; label: string; cost: number; description: string }[];
}

export function towerBranches(d: TowerDefinition): { paths: TowerBranch[]; tracks: TowerBranch[] } {
  const build = (kind: "path" | "track") => {
    const groups = new Map<string, TowerBranch["tiers"]>();
    for (const u of d.upgrades) {
      const key = u[kind];
      if (key) groups.set(key, [...(groups.get(key) ?? []), { id: u.id, label: u.label, cost: u.cost, description: u.description }]);
    }
    const looks = kind === "path" ? d.visual.paths : d.visual.tracks;
    return [...groups].map(([id, tiers]): TowerBranch => {
      const visual = looks?.[id];
      return { id, kind, name: visual?.name ?? tiers[0].label, role: visual?.role, color: visual?.color ?? d.color, tiers };
    });
  };
  return { paths: build("path"), tracks: build("track") };
}
