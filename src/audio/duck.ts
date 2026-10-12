// Music ducking under big cues. Ducks are scheduled at their cue's future time, possibly out of order, so their spans
// are merged before the automation is written: one cue's recovery never cuts into another's duck.

export interface Span {
  start: number;
  end: number;
}
/** The pending and active duck spans after adding `next`, merged where they overlap; finished spans are dropped. */
export function addDuck(spans: readonly Span[], next: Span, now: number): Span[] {
  const out: Span[] = [];
  for (const s of [...spans.filter((s) => s.end > now), next].sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else out.push({ ...s });
  }
  return out;
}
