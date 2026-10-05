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

export const CHAMPIONS: Record<
  ChampionName,
  MobileStats & { abilityPower: number }
> = {
  cavegirl2: {
    maxHp: 600,
    armor: 20,
    radius: 6,
    moveSpeed: 60,
    abilityPower: 40,
    attack: {
      damage: 60,
      range: 48,
      interval: seconds(0.8),
      projectileSpeed: 220,
    },
  },
};

export const SKILLSHOT = {
  baseDamage: 80,
  // damage per point of ability power
  apRatio: 1,
  speed: 160,
  range: 150,
  radius: 3,
  cooldown: seconds(1),
};

export const MINIONS: Record<MinionType, MobileStats> = {
  melee: {
    maxHp: 300,
    armor: 0,
    radius: 5,
    moveSpeed: 40,
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

export const RESPAWN_TIME = seconds(5);
export const FOUNTAIN_RADIUS = 48;
// fraction of max hp healed per second while in the fountain
export const FOUNTAIN_REGEN = 0.2;
// how long a champion that hit an enemy champion stays a priority target
export const CHAMPION_AGGRESSION_MEMORY = seconds(2);
// ticks between path recomputations while chasing a moving target
export const REPATH_INTERVAL = seconds(0.25);
