/**
 * The battlefield's interface colours in the Deep Ion palette of the HUD (`--ion-*` in style.css): coverage,
 * placement hints, the coach highlight, HP bars and dark frames. World objects (terrain, gates, towers, enemies) keep
 * their own theme and identity colours.
 */
export const UI = {
  accent: 0x5fe3d3,
  second: 0x9a86ff,
  warn: 0xf2b84b,
  danger: 0xff5f6d,
  /** Healthy HP: a yellow-green, apart from the teal accent. */
  ok: 0x8fdc7a,
  /** Frames and backing plates under small marks (the HUD's `--ion-bg`). */
  shade: 0x07090d,
} as const;
