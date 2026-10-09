export type Point = { x: number; y: number };
export type TowerId = keyof typeof import("../content/towers").TOWER_CONTENT;
export type EnemyId = keyof typeof import("../content/enemies").ENEMY_CONTENT;
export type UnitLayer = "ground" | "air";
export type AuraStat = "damage" | "speed" | "range";
export type AuraBonuses = Record<AuraStat, number>;
export interface TowerStats { damage: number; range: number; interval: number }

/**
 * Attack mechanics. Each kind has a module in `systems/attacks/`; its numeric
 * parameters can be changed by upgrades through `effects.attack`.
 */
export interface DirectAttack { kind: "direct" }
export interface SplashAttack { kind: "splash"; /** Explosion radius in cells. */ radius: number }
export interface SlowAttack {
  kind: "slow";
  /** Speed factor while slowed; lower is slower. */
  factor: number;
  duration: number;
}
export interface ChainAttack {
  kind: "chain";
  /** Extra targets, jump distance in cells, damage factor per jump. */
  jumps: number;
  range: number;
  falloff: number;
}
export interface AuraAttack { kind: "aura"; /** Bonuses before any upgrade. */ base: AuraBonuses }
export interface PierceAttack {
  kind: "pierce";
  /** Half width of the line in cells; damage factor per further enemy hit. */
  width: number;
  falloff: number;
}
export interface BurnAttack {
  kind: "burn";
  /** Total burn damage as a multiple of the hit, spread over `duration` seconds. */
  ratio: number;
  duration: number;
}
export interface StunAttack {
  kind: "stun";
  radius: number;
  duration: number;
  /** Seconds after a stun in which the enemy cannot be stunned again. */
  recovery: number;
}
export interface CorrodeAttack {
  kind: "corrode";
  radius: number;
  /** Extra damage taken, e.g. 0.25 for +25 %. */
  amount: number;
  duration: number;
}
export interface DecayAttack { kind: "decay"; /** Extra damage as a fraction of the target's max HP. */ percent: number }
export interface IncomeAttack { kind: "income"; /** Credits paid after every completed wave. */ amount: number }
/** Detector: reveals stealthed enemies within its range; no attack of its own. */
export interface DetectAttack { kind: "detect" }
export type AttackSpec =
  | DirectAttack
  | SplashAttack
  | SlowAttack
  | ChainAttack
  | AuraAttack
  | PierceAttack
  | BurnAttack
  | StunAttack
  | CorrodeAttack
  | DecayAttack
  | IncomeAttack
  | DetectAttack;
export type AttackKind = AttackSpec["kind"];

export interface UpgradeDefinition {
  id: string;
  label: string;
  description: string;
  cost: number;
  requires: readonly string[];
  /** Upgrades with different paths exclude each other on one tower. */
  path?: string;
  effects: {
    stats?: Partial<TowerStats>;
    aura?: Partial<AuraBonuses>;
    /** Overrides numeric parameters of the tower's attack, e.g. `{ factor: 0.45 }`. */
    attack?: Readonly<Record<string, number>>;
    level?: number;
  };
}

export type TurretStyle =
  | "barrel"
  | "heavy"
  | "twin"
  | "coil"
  | "crystal"
  | "aura"
  | "rail"
  | "flame"
  | "emitter"
  | "vat"
  | "prism"
  | "refinery"
  | "radar";
export type ProjectileStyle = "tracer" | "shell" | "crystal" | "twin" | "ember" | "glob" | "orb";
export type PathMotif = "blades" | "vortex" | "rings";
export interface PathVisual { color: number; motif: PathMotif }
export interface TowerVisual {
  /** Symbol on the build card. */
  icon: string;
  turret: TurretStyle;
  projectile?: ProjectileStyle;
  /** Instant attacks: a lightning bolt from the tower instead of a muzzle flash. */
  muzzle?: "flash" | "bolt";
  impact?: "spark" | "burst";
  /** Look per upgrade path, once a tower has chosen one. */
  paths?: Readonly<Record<string, PathVisual>>;
}
export interface TowerDefinition {
  id: string;
  name: string;
  role: string;
  description: string;
  cost: number;
  damage: number;
  /** Attack range; aura radius for support towers; 0 for towers without an area. */
  range: number;
  interval: number;
  color: number;
  attack: AttackSpec;
  /** Unit layers this tower can attack; empty for support towers. */
  targets: readonly UnitLayer[];
  /** Flying projectile; absent means the hit lands instantly (lightning). */
  projectile?: { speed: number };
  visual: TowerVisual;
  upgrades: readonly UpgradeDefinition[];
}

/** Enemy abilities; each kind has a module in `systems/traits.ts`. */
export type Trait =
  | { kind: "armor"; /** Fraction of every hit that is absorbed. */ reduction: number }
  | {
      kind: "regen";
      /** Flat HP per second, up to max HP. */
      perSecond?: number;
      /** Share of max HP per second; set either this or `perSecond`. */
      percent?: number;
    }
  | { kind: "splitOnDeath"; type: string; count: number }
  | { kind: "slowImmune" }
  | {
      kind: "shield";
      /** Shield points as a share of max HP; absorbed before HP. */
      capacity: number;
      /** Seconds without a hit until the shield is full again. */
      delay: number;
    }
  | {
      kind: "sprint";
      /** Once, when a hit drops HP below this share, run at `factor` for `duration` seconds. */
      threshold: number;
      factor: number;
      duration: number;
    }
  | { kind: "evade"; /** Every n-th hit misses; burning does not count. */ every: number }
  | { kind: "healer"; radius: number; /** Share of max HP per second healed on other enemies in the radius. */ percent: number }
  | {
      kind: "leader";
      radius: number;
      /** Bonuses for other enemies in the radius; several leaders do not stack. */
      speed: number;
      resist: number;
    }
  | { kind: "stealth" }
  | { kind: "unstoppable" }
  | { kind: "swift"; /** Extra speed and HP penalty, e.g. 0.5 and 0.2. */ speed: number; hp: number };
export type TraitKind = Trait["kind"];
export type EnemyVisual =
  | { shape: "polygon"; sides: number; rotation?: number }
  | { shape: "glider" };
export interface EnemyDefinition {
  id: string;
  name: string;
  hp: number;
  speed: number;
  reward: number;
  leak: number;
  color: number;
  size: number;
  layer: UnitLayer;
  traits?: readonly Trait[];
  visual: EnemyVisual;
}
/** Terrain look, drawn by `render/terrain.ts`. */
export type MapTheme = "outpost" | "lock" | "shard" | "ember" | "core" | "frost" | "toxic" | "orbit" | "ruin" | "rift";
export interface MapDefinition {
  id: string;
  name: string;
  columns: number;
  rows: number;
  path: readonly Point[];
  blocked: readonly Point[];
  /** Defaults to "outpost". */
  theme?: MapTheme;
}
export interface WaveGroup {
  type: EnemyId;
  count: number;
  interval: number;
  delay: number;
}
export interface WaveDefinition {
  groups: readonly WaveGroup[];
  bonus: number;
  /** HP factor for this wave; replaces the mission's linear `hpGrowth`. */
  hpMultiplier?: number;
}
export interface MissionDefinition {
  id: string;
  name: string;
  /** Taktischer Schwerpunkt der Mission. */
  focus: string;
  map: MapDefinition;
  waves: readonly WaveDefinition[];
  startingCredits: number;
  reactorEnergy: number;
  /** HP-Zuwachs pro Welle; Standard 0,14 (+14 %). */
  hpGrowth?: number;
  /** Buildable towers; all towers when absent. */
  availableTowers?: readonly TowerId[];
}
/** A group of consecutive missions, shown as one tab in the mission dialog. */
export interface MissionSector {
  id: string;
  name: string;
  missions: readonly MissionDefinition[];
}
export interface ContentPack {
  towers: Readonly<Record<TowerId, Readonly<TowerDefinition>>>;
  enemies: Readonly<Record<EnemyId, Readonly<EnemyDefinition>>>;
  missions: readonly MissionDefinition[];
  /** Optional grouping; together the sectors list exactly `missions`, in order. */
  sectors?: readonly MissionSector[];
}

/** Who dealt the damage; the tower itself may already be sold. */
export interface DamageSource {
  tower: number;
  type: TowerId;
}
/** Effects on an enemy; each kind has merge and tick rules in `systems/status.ts`. Expires at `until`. */
export type StatusEffect =
  | { kind: "slow"; factor: number; until: number }
  /** Frozen until `release`; immune to further stuns until `until`. */
  | { kind: "stun"; release: number; until: number }
  /** Damage per second, dealt in steps; `next` is the time of the next step. */
  | { kind: "burn"; dps: number; next: number; until: number; source: DamageSource }
  | { kind: "vulnerable"; amount: number; until: number };
export type StatusKind = StatusEffect["kind"];
export interface Enemy extends Point {
  id: number;
  type: EnemyId;
  hp: number;
  maxHp: number;
  distance: number;
  status: StatusEffect[];
  /** Runtime state of traits; absent on enemies without them. */
  shield?: number;
  lastHit?: number;
  hits?: number;
  sprintUntil?: number;
  sprinted?: boolean;
  /** Stealthed and inside a detector's range this tick. */
  revealed?: boolean;
  /** Versus: player who sent this enemy; it pays no kill reward. */
  sentBy?: number;
}
export interface Tower extends Point {
  id: number;
  type: TowerId;
  /** The single source of truth for all purchased upgrade IDs. */
  upgrades: string[];
  /** Remaining fraction of an attack cycle, from 0 (ready) to 1. */
  cooldown: number;
  spent: number;
  angle: number;
  kills: number;
  /** Player who built the tower; 0 in single-player. */
  owner: number;
  /** Whom the tower aims at; absent means "first". */
  priority?: TargetPriority;
}
/** Target selection of an attack tower; ties fall back to path progress, then id. */
export type TargetPriority = "first" | "last" | "strong" | "weak" | "close";
export interface Projectile extends Point {
  id: number;
  /** Firing tower; it may already be sold when the projectile lands. */
  tower: number;
  type: TowerId;
  /** Homing: enemy id. Shells fly to a fixed point and use null. */
  target: number | null;
  tx: number;
  ty: number;
  /** Snapshot at fire time, aura bonuses included. */
  damage: number;
  /** Attack parameters of the firing tower's upgrades, snapshotted at fire time. */
  attack: AttackSpec;
}
export interface Spawn {
  at: number;
  type: EnemyId;
  /** Versus: player who sent this enemy. */
  sentBy?: number;
}
export type GameEvent =
  | { type: "shot"; tower: TowerId; from: Point; to: Point; color: number }
  | { type: "chain"; from: Point; to: Point; color: number }
  | { type: "beam"; from: Point; to: Point; color: number }
  | { type: "pulse"; at: Point; radius: number; color: number }
  | { type: "income"; at: Point; amount: number; color: number }
  | { type: "impact"; tower: TowerId; at: Point; color: number }
  | { type: "damage"; at: Point; amount: number; enemy: number }
  | { type: "kill"; at: Point; color: number; reward: number }
  | { type: "evade"; at: Point }
  | { type: "leak"; at: Point; amount: number }
  | { type: "spawn"; at: Point; enemy: number }
  | { type: "build" | "sell" | "upgrade"; at: Point; tower: TowerId; color: number }
  | { type: "waveStart"; wave: number }
  | { type: "waveEnd"; wave: number; bonus: number }
  | { type: "end"; result: "won" | "lost" };
export type GameStatus = "ready" | "wave" | "won" | "lost";
export interface GameState {
  status: GameStatus;
  paused: boolean;
  time: number;
  waveTime: number;
  wave: number;
  /** Credits per player; a single entry in single-player. */
  wallets: number[];
  /** Player who receives the next indivisible remainder of a shared reward. */
  splitCursor: number;
  lives: number;
  kills: number;
  towers: Tower[];
  enemies: Enemy[];
  projectiles: Projectile[];
  queue: Spawn[];
  events: GameEvent[];
  nextId: number;
}
/** Everything a simulation system needs; `Game` implements it. */
export interface Sim {
  state: GameState;
  mission: MissionDefinition;
  content: ContentPack;
}
/** `player`: issuing player in co-op, 0 when absent. */
export type Command = (
  | { type: "build"; tower: TowerId; x: number; y: number }
  | { type: "upgrade"; id: number; upgrade: string }
  | { type: "sell"; id: number }
  | { type: "target"; id: number; priority: TargetPriority }
  | { type: "start" }
  | { type: "pause" }
  | { type: "restart" }
  | { type: "mission"; id: string }
) & { player?: number };
/** Language-neutral result; `ui/messages.ts` turns it into text. */
export type MessageCode =
  | "restarted"
  | "mission-loaded"
  | "mission-unknown"
  | "mission-over"
  | "paused"
  | "resumed"
  | "pause-unavailable"
  | "wave-running"
  | "wave-started"
  | "tower-unknown"
  | "tower-unavailable"
  | "cell-blocked"
  | "credits-missing"
  | "tower-built"
  | "tower-missing"
  | "tower-sold"
  | "upgrade-purchased"
  | "upgrade-unknown"
  | "upgrade-purchased-already"
  | "upgrade-locked"
  | "upgrade-excluded"
  | "upgrade-unaffordable"
  | "tower-foreign"
  | "host-only"
  | "command-sent"
  | "pause-versus"
  | "ready-set"
  | "enemy-sent"
  | "send-unavailable"
  | "send-locked"
  | "target-set"
  | "priority-unknown";
export interface CommandResult {
  ok: boolean;
  code: MessageCode;
  params?: Readonly<Record<string, string | number>>;
  id?: number;
}
