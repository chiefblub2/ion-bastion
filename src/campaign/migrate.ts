import { RANK_BONUS } from "../content/arsenal";
import { isCircleSector } from "../content/missions";
import type { MissionSector, TowerId } from "../core/types";
import { type Arsenal, veterancy } from "./arsenal";
import { cachePay, isFinale } from "./finale";
import { starPay } from "./pay";
import type { CampaignRecord } from "./record";
// Stored Arsenal migrations. Pure: the same stored data and record always give the same result, so a save that fails
// simply runs the migration again on the next load.

/** The stored v1 Arsenal: no last loadout and no bounty pick. */
export type ArsenalV1 = Omit<Arsenal, "loadout" | "bounty">;

/**
 * Back pay for progress made before v2's rules: `starPay` for every star the campaign record holds, `cachePay` for
 * every finale already won, and `RANK_BONUS` for every veterancy rank a tower already holds. Circuit missions pay
 * nothing (the Arsenal is campaign only).
 */
export function backPayOf(a: Pick<Arsenal, "xp">, record: CampaignRecord, sectors: readonly MissionSector[]): number {
  let pay = 0;
  sectors.forEach((sector, i) => {
    if (isCircleSector(sector)) return;
    for (const m of sector.missions) {
      const stars = record[m.id] ?? 0;
      pay += stars * starPay(i + 1);
      if (stars && isFinale(m, sectors)) pay += cachePay(i + 1);
    }
  });
  for (const xp of Object.values(a.xp) as number[]) pay += RANK_BONUS.slice(0, veterancy(xp)).reduce((n, b) => n + b, 0);
  return pay;
}

/** v1 → v2: every v1 field kept, an empty last loadout, no bounty pick, and the back pay added to the Salvage. */
export function migrateV1(a: ArsenalV1, record: CampaignRecord, sectors: readonly MissionSector[]): { arsenal: Arsenal; backPay: number } {
  const backPay = backPayOf(a, record, sectors);
  return {
    arsenal: { ...a, salvage: a.salvage + backPay, loadout: [] as TowerId[], bounty: null },
    backPay,
  };
}
