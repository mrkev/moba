import { Vec } from "./vec";

export type Team = "blue" | "red";
export type Lane = "top" | "mid" | "bot";
export type TurretTier = "outer" | "inner" | "base" | "nexus";
export type ChampionName = "cavegirl2";
export type MinionType = "melee" | "caster";

export type EntityId = number;
export type PlayerId = number;

export const TEAMS: readonly Team[] = ["blue", "red"];
export const LANES: readonly Lane[] = ["top", "mid", "bot"];

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
}

interface MobileUnit extends UnitBase {
  moveSpeed: number; // px/s
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

export interface Champion extends MobileUnit {
  kind: "champion";
  champion: ChampionName;
  playerId: PlayerId;
  abilityPower: number;
  order: ChampionOrder;
  abilityCooldown: number;
  dead: boolean;
  respawnIn: number;
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
}

export type Projectile = HomingProjectile | Skillshot;

export interface GameState {
  tick: number;
  nextId: EntityId;
  units: Unit[];
  projectiles: Projectile[];
  nextWaveTick: number;
  // waypoints minions of a team walk through, per lane
  lanePaths: Record<Team, Record<Lane, Vec[]>>;
  fountains: Record<Team, Vec>;
  winner: Team | null;
}

export type Command =
  // move to a point, or attack the enemy unit there (right-click)
  | { type: "smartClick"; pos: Vec }
  | { type: "skillshot"; dir: Vec };

export interface PlayerInput {
  // held movement direction, e.g. from arrow keys; zero when none
  move: Vec;
  commands: Command[];
}

export type SimEvent =
  | { type: "attack"; sourceId: EntityId; targetId: EntityId }
  | { type: "cast"; sourceId: EntityId }
  | { type: "death"; unitId: EntityId }
  | { type: "victory"; team: Team };
