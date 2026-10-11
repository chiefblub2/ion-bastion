import type { EnemyId, GameEvent } from "../core/types";
import { bodyLift, STATUS_COLORS, TRAIT_COLORS, type EnemyDrawContext } from "./enemies";
import { disc, hash01, ring, type Ink } from "./shapes";
/**
 * Render-only hit feedback per enemy id: hit flashes from `damage` events and shield ripples from a falling shield.
 * Times are on the scene's effect clock (`fxClock`: real time, stopped while paused), so a flash holds through a
 * pause and lasts the same at every game speed. Nothing here reaches the simulation, the state hash or the network.
 */
export const FLASH = {
  /** Lifetime of a flash: a tiny hit flashes `min` seconds, a hit of `full` of the max HP or more `max` seconds. */
  min: 0.06,
  max: 0.12,
  full: 0.2,
  /** After a flash ends, the next hit flashes only after this gap, so damage over time never keeps a unit white. */
  gap: 0.16,
  /** A flash starting within this time of the last one is a repeat: `min` seconds and at most half strength. */
  repeat: 0.5,
} as const;
export const SHIELD_RIPPLE = {
  life: 0.28,
  /** Shortest time between two ripples; hits in between merge into the running one. */
  gap: 0.12,
} as const;
interface Feedback {
  /** Set by the first draw; a state for another type on the same id is dropped. */
  type?: EnemyId;
  hitAt: number;
  /** HP damage summed over the current flash. */
  hit: number;
  /** The current flash followed another closely (sustained fire, damage over time). */
  repeat: boolean;
  /** Shield share at the last draw; NaN until the first one. */
  shield: number;
  shieldAt: number;
}
const fresh = (): Feedback => ({ hitAt: -Infinity, hit: 0, repeat: false, shield: NaN, shieldAt: -Infinity });
export class EnemyFeedback {
  private states = new Map<number, Feedback>();
  private alive = new Set<number>();
  /** Reads the damage events of a drained batch; other events and the batch itself stay untouched. */
  consume(events: readonly GameEvent[], now: number) {
    for (const e of events) if (e.type === "damage") this.recordDamage(e.enemy, e.amount, now);
  }
  /** A positive, finite HP loss starts a flash, or adds to a running one; zero, negative or non-finite amounts do nothing. */
  recordDamage(id: number, amount: number, now: number) {
    if (!(amount > 0) || !Number.isFinite(amount)) return;
    let st = this.states.get(id);
    if (!st) this.states.set(id, (st = fresh()));
    if (now < st.hitAt + FLASH.max) st.hit += amount;
    else if (now >= st.hitAt + FLASH.max + FLASH.gap) {
      st.repeat = now < st.hitAt + FLASH.repeat;
      st.hitAt = now;
      st.hit = amount;
    }
  }
  /**
   * Matches the states to this frame's enemies: drops those of enemies that left (also those of a lethal hit, which
   * never get drawn) and of an id now used by another type, and starts a shield ripple where the shield fell.
   * A disrupted shield reads 0 without losing anything, so a disruption never ripples.
   */
  observe(units: readonly EnemyDrawContext[], now: number) {
    this.alive.clear();
    for (const c of units) {
      const id = c.enemy.id;
      this.alive.add(id);
      let st = this.states.get(id);
      if (st && st.type !== undefined && st.type !== c.enemy.type) st = undefined;
      if (!st) {
        // Units without a shield need a state only once they are hit.
        if (c.traits.shield <= 0) {
          this.states.delete(id);
          continue;
        }
        this.states.set(id, (st = fresh()));
      }
      st.type = c.enemy.type;
      const shield = c.traits.shield;
      if (shield < st.shield - 1e-6 && !c.status.disrupted && now >= st.shieldAt + SHIELD_RIPPLE.gap) st.shieldAt = now;
      st.shield = shield;
    }
    for (const id of this.states.keys()) if (!this.alive.has(id)) this.states.delete(id);
  }
  /** Current flash strength of an enemy, 0 (none) to 1 (a hit of `FLASH.full` of its max HP or more). */
  flash(id: number, now: number, maxHp: number) {
    const st = this.states.get(id);
    if (!st) return 0;
    const k = Math.min(st.repeat ? 0.5 : 1, st.hit / (maxHp * FLASH.full)),
      life = st.repeat ? FLASH.min : FLASH.min + (FLASH.max - FLASH.min) * k,
      age = now - st.hitAt;
    return age >= 0 && age < life ? Math.max(k, 0.01) : 0;
  }
  /** Progress of a running shield ripple, 0..1, or undefined. */
  shieldRipple(id: number, now: number) {
    const st = this.states.get(id),
      age = st ? now - st.shieldAt : Infinity;
    return age >= 0 && age < SHIELD_RIPPLE.life ? age / SHIELD_RIPPLE.life : undefined;
  }
  /** Number of enemies with feedback state; bounded by the enemies on the field after each `observe`. */
  get size() {
    return this.states.size;
  }
  /** Forgets everything: a new game state, a scene shutdown. */
  reset() {
    this.states.clear();
  }
}
/** Status accents drawn on the overlay, strongest first; at most `MAX_ACCENTS` per unit so dense waves stay legible. */
const ACCENTS = ["stunned", "burning", "disrupted", "slowed"] as const;
const MAX_ACCENTS = 2;
/**
 * Short-lived accents on the overlay layer, under the unit's markers and HP bar: the hit highlight of a procedural
 * body (`painted`: a tinted sprite, which flashes through its tint instead), the shield ripple and small status accents (flames,
 * arcs, interference, frost). Hidden and burrowed units get none, so nothing reveals them.
 */
export function drawEnemyAccents(g: Ink, c: EnemyDrawContext, feedback: EnemyFeedback, now: number, painted: boolean) {
  if (c.hidden || c.traits.burrowed) return;
  const { x, r, enemy: e } = c,
    y = c.y - bodyLift(c);
  const flash = feedback.flash(e.id, now, e.maxHp);
  if (flash > 0 && !painted) disc(g, x, y, r * 0.95, 0xffffff, 0.35 + 0.3 * flash);
  const ripple = feedback.shieldRipple(e.id, now);
  // Brightens the bubble and sends one ring outwards; the bubble itself stays the overlay's.
  if (ripple !== undefined) {
    disc(g, x, c.y, r + 6, TRAIT_COLORS.shield, 0.18 * (1 - ripple));
    ring(g, x, c.y, r + 6 + 5 * ripple, 2 - ripple, 0xbfe4ff, 0.85 * (1 - ripple));
  }
  let drawn = 0;
  for (const kind of ACCENTS) {
    if (drawn >= MAX_ACCENTS) break;
    if (!c.status[kind]) continue;
    ACCENT[kind](g, x, y, r, e.id, now);
    drawn++;
  }
}
const ACCENT: Record<(typeof ACCENTS)[number], (g: Ink, x: number, y: number, r: number, id: number, now: number) => void> = {
  // Two flickering flame tongues on the upper rim and one ember rising off the body.
  burning: (g, x, y, r, id, now) => {
    for (const side of [-1, 1]) {
      const bx = x + side * r * 0.45,
        by = y - r * 0.35,
        h = r * (0.45 + 0.2 * Math.sin(now * 13 + side * 2.1 + id)),
        w = r * 0.18;
      g.fillStyle(STATUS_COLORS.burning, 0.75);
      g.fillTriangle(bx - w, by, bx + w, by, bx + side * w * 0.3, by - h);
      g.fillStyle(0xffd27a, 0.85);
      g.fillTriangle(bx - w * 0.45, by, bx + w * 0.45, by, bx, by - h * 0.55);
    }
    const k = (now * 1.6 + id * 0.37) % 1;
    disc(g, x + Math.sin(now * 3 + id) * r * 0.3, y - r * (0.6 + 0.9 * k), 1.3, 0xffb347, 1 - k);
  },
  // Two short electric arcs that jump to new places a dozen times a second.
  stunned: (g, x, y, r, id, now) => {
    const step = Math.floor(now * 12);
    g.lineStyle(1.3, 0xd8fbff, 0.9);
    for (let i = 0; i < 2; i++) {
      const a = hash01(id, step, i) * Math.PI * 2,
        bend = (hash01(id, step, i + 7) - 0.5) * 0.6,
        p = (d: number, off: number) => ({ x: x + Math.cos(a + off) * d, y: y + Math.sin(a + off) * d });
      const p0 = p(r * 0.55, 0),
        p1 = p(r * 0.85, bend),
        p2 = p(r + 5, -bend * 0.5);
      g.lineBetween(p0.x, p0.y, p1.x, p1.y);
      g.lineBetween(p1.x, p1.y, p2.x, p2.y);
    }
  },
  // Interference: two offset bars across the body on some frame steps, violet and cyan.
  disrupted: (g, x, y, r, id, now) => {
    const step = Math.floor(now * 9);
    if (hash01(id, step) < 0.45) return;
    const o = (hash01(id, step, 3) - 0.5) * r * 1.2;
    g.fillStyle(STATUS_COLORS.disrupted, 0.45);
    g.fillRect(x - r * 0.75 + 2, y + o - 1, r * 1.5, 2);
    g.fillStyle(0x7ff4ff, 0.45);
    g.fillRect(x - r * 0.75 - 2, y - o * 0.6 - 1, r * 1.5, 1.5);
  },
  // Frost: three small ice crystals on the rim.
  slowed: (g, x, y, r) => {
    g.lineStyle(1, 0xe2f2ff, 0.75);
    for (let i = 0; i < 3; i++) {
      const a = 0.6 + i * 2.1,
        cx = x + Math.cos(a) * r * 0.8,
        cy = y + Math.sin(a) * r * 0.8,
        s = Math.max(1.5, r * 0.18);
      g.lineBetween(cx - s, cy, cx + s, cy);
      g.lineBetween(cx - s * 0.5, cy - s * 0.87, cx + s * 0.5, cy + s * 0.87);
      g.lineBetween(cx - s * 0.5, cy + s * 0.87, cx + s * 0.5, cy - s * 0.87);
    }
  },
};
