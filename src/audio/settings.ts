// The mixer settings the browser keeps between visits, next to the last mission id (`app/progress.ts`).
const KEY = "ion-bastion:sound";
export type Bus = "master" | "sfx" | "ui" | "music";
export const BUSES = ["master", "sfx", "ui", "music"] as const satisfies readonly Bus[];
export interface SoundSettings {
  muted: boolean;
  master: number;
  sfx: number;
  ui: number;
  music: number;
}
/** The soundtrack (pad and sequenced music) is off in the game until it is ready; effects, stingers and UI sounds still play. */
export const MUSIC_ENABLED = false;
export const DEFAULT_SETTINGS: Readonly<SoundSettings> = { muted: true, master: 0.8, sfx: 0.8, ui: 0.5, music: 0.5 };

export function parseSettings(raw: string | null): SoundSettings {
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  const o = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  const s: SoundSettings = { ...DEFAULT_SETTINGS, muted: typeof o.muted === "boolean" ? o.muted : DEFAULT_SETTINGS.muted };
  for (const bus of BUSES) {
    const v = o[bus];
    if (typeof v === "number" && Number.isFinite(v)) s[bus] = Math.min(1, Math.max(0, v));
  }
  return s;
}
/** Storage can be missing or throw (private mode, blocked site data); then the defaults apply. */
export function loadSettings(): SoundSettings {
  try {
    return parseSettings(localStorage.getItem(KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
export function saveSettings(s: SoundSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Not remembered; the next visit starts with the defaults.
  }
}
