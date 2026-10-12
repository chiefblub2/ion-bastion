// Browsers keep an AudioContext silent until a user gesture. Touch grants activation only at the end of a tap, and
// Safari only resumes inside the handler, so the start is retried on every such gesture until the context runs
// (the same approach as Howler.js's unlock).
export const UNLOCK_EVENTS = ["pointerup", "touchend", "click", "keydown"] as const;
const CAPTURE = { capture: true };

/** Calls `start` on every gesture until it reports a running context, then stops listening. */
export function unlockOnGesture(target: EventTarget, start: () => Promise<boolean>) {
  const go = () => {
    start().then(
      (running) => {
        if (running) for (const e of UNLOCK_EVENTS) target.removeEventListener(e, go, CAPTURE);
      },
      () => undefined,
    );
  };
  for (const e of UNLOCK_EVENTS) target.addEventListener(e, go, CAPTURE);
}
