import { Vec } from "./vec";

export type Team = "blue" | "red";
export type Lane = "top" | "mid" | "bot";
export type TurretTier = "outer" | "inner" | "base" | "nexus";
export type ChampionName = "cavegirl2" | "caveman2";
export type MinionType = "melee" | "caster";
export type AbilitySlot = "q" | "w" | "e" | "r";
export type ItemId =
  | "longSword"
  | "amplifyingTome"
  | "clothArmor"
  | "rubyCrystal"
  | "sapphireCrystal"
  | "dagger"
  | "boots"
  | "bfSword"
  | "largeRod"
  | "giantsBelt"
  | "chainVest";

export type EntityId = number;
export type PlayerId = number;

export const TEAMS: readonly Team[] = ["blue", "red"];
export const LANES: readonly Lane[] = ["top", "mid", "bot"];
export const ABILITY_SLOTS: readonly AbilitySlot[] = ["q", "w", "e", "r"];
export const INVENTORY_SIZE = 6;

export function enemyOf(team: Team): Team {
  return team === "blue" ? "red" : "blue";
}

export interface AttackStats {
  damage: number;
  // edge to edge, in px
  range: number;
  // ticks between attacks
  interval: number;
  // px/s; null attacks land instantly (melee)
  projectileSpeed: number | null;
}

export type Effect =
  | { kind: "slow"; amount: number; until: number }
  | { kind: "haste"; moveSpeed: number; attackSpeed: number; until: number };

interface UnitBase {
  id: EntityId;
  team: Team;
  pos: Vec;
  radius: number;
  hp: number;
  maxHp: number;
  armor: number;
  attack: AttackStats | null;
  // ticks until this unit can attack again
  attackCooldown: number;
  targetId: EntityId | null;
  // who dealt the last damage, for kill credit
  lastDamagedBy: EntityId | null;
}

interface MobileUnit extends UnitBase {
  // before effects
  baseMoveSpeed: number; // px/s
  moveSpeed: number; // px/s
  effects: Effect[];
  // unit vector, the direction the unit last moved or attacked in
  facing: Vec;
  moving: boolean;
  path: Vec[];
  // where path leads to
  pathGoal: Vec | null;
  // ticks until the path may be recomputed
  repathIn: number;
}

export type ChampionOrder =
  | { type: "idle" }
  | { type: "move"; to: Vec }
  | { type: "attack"; targetId: EntityId };

export interface AbilityState {
  rank: number; // 0 = not learned
  cooldown: number; // ticks
}

export interface Champion extends MobileUnit {
  kind: "champion";
  champion: ChampionName;
  playerId: PlayerId;
  order: ChampionOrder;

  level: number;
  xp: number; // towards the next level
  abilityPoints: number;
  abilities: Record<AbilitySlot, AbilityState>;
  mana: number;
  maxMana: number;
  abilityPower: number;
  hpRegen: number; // per second
  manaRegen: number; // per second
  gold: number;
  items: (ItemId | null)[];

  // ticks left on a dash, moving towards dashTo
  dash: { to: Vec; speed: number } | null;
  // ticks left channeling a recall, null when not recalling
  recallLeft: number | null;

  dead: boolean;
  respawnIn: number;
  kills: number;
  deaths: number;
  creepScore: number;
  // last tick this champion damaged an enemy champion; turrets and minions
  // prioritize champions that attack their allies
  lastHitChampionTick: number;
}

export interface Minion extends MobileUnit {
  kind: "minion";
  minion: MinionType;
  lane: Lane;
  waypointIndex: number;
}

export interface Structure extends UnitBase {
  kind: "structure";
  structure: "turret" | "nexus";
  tier: TurretTier | null;
  lane: Lane | null;
}

export type Unit = Champion | Minion | Structure;
export type Mobile = Champion | Minion;

interface ProjectileBase {
  id: EntityId;
  team: Team;
  sourceId: EntityId;
  pos: Vec;
  speed: number; // px/s
  damage: number;
}

export interface HomingProjectile extends ProjectileBase {
  kind: "homing";
  targetId: EntityId;
}

export interface Skillshot extends ProjectileBase {
  kind: "skillshot";
  dir: Vec;
  radius: number;
  distanceLeft: number;
  // slows whoever it hits
  slow: { amount: number; duration: number } | null;
}

export type Projectile = HomingProjectile | Skillshot;

// a delayed area of effect, like a meteor about to land
export interface Zone {
  id: EntityId;
  team: Team;
  sourceId: EntityId;
  pos: Vec;
  radius: number;
  damage: number;
  createdTick: number;
  detonateTick: number;
}

export interface GameState {
  tick: number;
  nextId: EntityId;
  units: Unit[];
  projectiles: Projectile[];
  zones: Zone[];
  nextWaveTick: number;
  // waypoints minions of a team walk through, per lane
  lanePaths: Record<Team, Record<Lane, Vec[]>>;
  fountains: Record<Team, Vec>;
  winner: Team | null;
}

export type Command =
  // move to a point, or attack the enemy unit there (right-click)
  | { type: "smartClick"; pos: Vec }
  // cast an ability aimed at a point (ignored by self-cast abilities)
  | { type: "cast"; slot: AbilitySlot; target: Vec }
  | { type: "levelAbility"; slot: AbilitySlot }
  | { type: "recall" }
  | { type: "buy"; item: ItemId }
  | { type: "sell"; slot: number };

export interface PlayerInput {
  // held movement direction, e.g. from arrow keys; zero when none
  move: Vec;
  commands: Command[];
}

export type SimEvent =
  | { type: "attack"; sourceId: EntityId; targetId: EntityId }
  | { type: "cast"; sourceId: EntityId; slot: AbilitySlot }
  | { type: "death"; unitId: EntityId }
  | { type: "kill"; killerId: EntityId; victimId: EntityId }
  | { type: "gold"; unitId: EntityId; amount: number; pos: Vec }
  | { type: "levelUp"; unitId: EntityId; level: number }
  | { type: "explosion"; pos: Vec; radius: number; team: Team }
  | { type: "recalled"; unitId: EntityId }
  | { type: "victory"; team: Team };
