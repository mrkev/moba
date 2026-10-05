import { AttackStats, ChampionName, MinionType } from "./types";

export const TICK_RATE = 60; // ticks per second
export const TICK_MS = 1000 / TICK_RATE;

export function seconds(s: number): number {
  return Math.round(s * TICK_RATE);
}

// px/s -> px/tick
export function perTick(pxPerSecond: number): number {
  return pxPerSecond / TICK_RATE;
}

interface UnitStats {
  maxHp: number;
  armor: number;
  radius: number;
  attack: AttackStats;
}

interface MobileStats extends UnitStats {
  moveSpeed: number;
}

export interface ChampionStats {
  maxHp: number;
  maxMana: number;
  armor: number;
  attackDamage: number;
  // attacks per second
  attackSpeed: number;
  hpRegen: number; // per second
  manaRegen: number; // per second
}

export interface ChampionDef {
  radius: number;
  moveSpeed: number;
  attackRange: number;
  projectileSpeed: number | null;
  base: ChampionStats;
  // added per level past 1; attackSpeed is a fraction of the base
  perLevel: ChampionStats;
}

const CAVE_PERSON: ChampionDef = {
  radius: 6,
  moveSpeed: 60,
  attackRange: 48,
  projectileSpeed: 220,
  base: {
    maxHp: 600,
    maxMana: 300,
    armor: 20,
    attackDamage: 60,
    attackSpeed: 0.75,
    hpRegen: 1.5,
    manaRegen: 2,
  },
  perLevel: {
    maxHp: 90,
    maxMana: 40,
    armor: 3.5,
    attackDamage: 3.5,
    attackSpeed: 0.025,
    hpRegen: 0.1,
    manaRegen: 0.1,
  },
};

export const CHAMPIONS: Record<ChampionName, ChampionDef> = {
  cavegirl2: CAVE_PERSON,
  caveman2: CAVE_PERSON,
};

export const MAX_LEVEL = 18;

// xp needed to go from level to level + 1
export function xpToNextLevel(level: number): number {
  return 180 + 100 * level;
}

export function respawnTime(level: number): number {
  return seconds(4 + level * 1.5);
}

// champions on the killer's team within this range of a death share its xp
export const XP_RANGE = 120;

export function championKillXp(victimLevel: number): number {
  return 100 + 30 * (victimLevel - 1);
}

export const ECONOMY = {
  startingGold: 500,
  // passive income, starting with the first minion wave
  goldPerSecond: 2,
  championKill: 300,
  // to every champion on the team that took the structure down
  structureKill: 150,
};

// shopping (and selling) works this close to your own fountain, or while dead
export const SHOP_RADIUS = 64;
export const SELL_RATIO = 0.7;

export const RECALL_TIME = seconds(4);

export const MINIONS: Record<
  MinionType,
  MobileStats & { gold: number; xp: number }
> = {
  melee: {
    maxHp: 300,
    armor: 0,
    radius: 5,
    moveSpeed: 40,
    gold: 21,
    xp: 60,
    attack: {
      damage: 12,
      range: 6,
      interval: seconds(1.25),
      projectileSpeed: null,
    },
  },
  caster: {
    maxHp: 200,
    armor: 0,
    radius: 5,
    moveSpeed: 40,
    gold: 14,
    xp: 30,
    attack: {
      damage: 23,
      range: 48,
      interval: seconds(1.5),
      projectileSpeed: 150,
    },
  },
};

// how close enemies must be for a minion to go after them
export const MINION_AGGRO_RANGE = 80;
// minions drop targets that get further than this
export const MINION_LEASH_RANGE = 120;
// how close a minion must get to a lane waypoint before heading to the next
export const WAYPOINT_REACHED = 36;

export const TURRET: UnitStats = {
  maxHp: 1500,
  armor: 40,
  radius: 16,
  attack: {
    damage: 150,
    range: 64,
    interval: seconds(1),
    projectileSpeed: 260,
  },
};

export const NEXUS = {
  maxHp: 2500,
  armor: 0,
  radius: 16,
};

export const WAVES = {
  firstAt: seconds(5),
  interval: seconds(30),
  composition: [
    "melee",
    "melee",
    "melee",
    "caster",
    "caster",
    "caster",
  ] as MinionType[],
};

export const FOUNTAIN_RADIUS = 48;
// fraction of max hp and mana restored per second while in the fountain
export const FOUNTAIN_REGEN = 0.2;
// how long a champion that hit an enemy champion stays a priority target
export const CHAMPION_AGGRESSION_MEMORY = seconds(2);
// ticks between path recomputations while chasing a moving target
export const REPATH_INTERVAL = seconds(0.25);
