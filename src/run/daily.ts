import { fnv, stable } from "../core/hash";
/** The daily run: a short run at threat 3 on a seed every player shares for one UTC day. */
export const DAILY_THREAT = 3;
/** The UTC date of a moment, `YYYY-MM-DD`; the view passes the wall clock, the run never reads it. */
export const dailyDate = (now: Date) => now.toISOString().slice(0, 10);
export const dailySeed = (date: string) => fnv(stable(["daily", date])) % 36 ** 6;
