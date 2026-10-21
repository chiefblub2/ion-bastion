/** Live effects at most; a crowded late wave drops old ones instead of growing the additive layers without bound. */
export const MAX_EFFECTS = 160;
/**
 * Makes room for a new effect of `type` in a list ordered oldest first: removes and returns the oldest effect of
 * the same type, else the oldest one without a label (income labels are feedback the player reads), else the oldest.
 * Returns undefined while the list is under `max`.
 */
export function evictFor<T extends { event: { type: string }; label?: unknown }>(effects: T[], type: string, max = MAX_EFFECTS): T | undefined {
  if (effects.length < max) return undefined;
  let at = effects.findIndex((f) => f.event.type === type);
  if (at < 0) at = effects.findIndex((f) => !f.label);
  return effects.splice(Math.max(0, at), 1)[0];
}
