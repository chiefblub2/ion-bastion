// The graphics settings the browser keeps between visits, next to the sound settings (`audio/settings.ts`).
const KEY = "ion-bastion:graphics";
export interface GraphicsSettings {
  /** Bloom on the light layers, the reactor-hit flash and the strike shake (`render/screen-fx.ts`). */
  glow: boolean;
}
/** Phones and tablets (a coarse pointer) start without the full-screen filter passes. */
export const defaultGraphics = (coarse: boolean): GraphicsSettings => ({ glow: !coarse });
export function parseGraphics(raw: string | null, coarse: boolean): GraphicsSettings {
  const s = defaultGraphics(coarse);
  try {
    const o: unknown = raw ? JSON.parse(raw) : null;
    if (typeof o === "object" && o !== null && typeof (o as { glow?: unknown }).glow === "boolean") s.glow = (o as { glow: boolean }).glow;
  } catch {
    // Unreadable: the defaults apply.
  }
  return s;
}
/** Storage can be missing or throw (private mode, blocked site data); then the defaults apply. */
export function loadGraphics(): GraphicsSettings {
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  try {
    return parseGraphics(localStorage.getItem(KEY), coarse);
  } catch {
    return defaultGraphics(coarse);
  }
}
export function saveGraphics(s: GraphicsSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Not remembered; the next visit starts with the defaults.
  }
}
