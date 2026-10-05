import { seconds } from "./constants";
import { MapData } from "./mapData";
import { stopMoving } from "./movement";
import {
  AbilitySlot,
  Champion,
  ChampionName,
  Effect,
  GameState,
  Mobile,
  SimEvent,
} from "./types";
import { add, distance, isZero, normalize, scale, sub, Vec } from "./vec";
import { newId } from "./world";

export type Targeting = "direction" | "point" | "self";

export interface CastContext {
  state: GameState;
  map: MapData;
  champ: Champion;
  rank: number; // 1-based
  // normalized direction for "direction" abilities, a point within range for
  // "point" ones
  target: Vec;
  events: SimEvent[];
}

export interface AbilityDef {
  name: string;
  description: string;
  maxRank: number;
  // per rank
  cooldown: number[]; // seconds
  manaCost: number[];
  targeting: Targeting;
  // how far it reaches, in px
  range: number;
  cast(ctx: CastContext): void;
}

// levels at which the ultimate's ranks unlock
const ULTIMATE_LEVELS = [6, 11, 16];

// replaces any effect of the same kind
export function addEffect(unit: Mobile, effect: Effect) {
  unit.effects = unit.effects.filter((e) => e.kind !== effect.kind);
  unit.effects.push(effect);
}

const byRank = (values: number[], rank: number) => values[rank - 1];

const STONE_AGE_KIT: Record<AbilitySlot, AbilityDef> = {
  q: {
    name: "Rock Throw",
    description: "Hurl a rock that damages and slows the first enemy hit.",
    maxRank: 5,
    cooldown: [7, 6.5, 6, 5.5, 5],
    manaCost: [40, 45, 50, 55, 60],
    targeting: "direction",
    range: 160,
    cast({ state, champ, rank, target }) {
      state.projectiles.push({
        kind: "skillshot",
        id: newId(state),
        team: champ.team,
        sourceId: champ.id,
        pos: { ...champ.pos },
        speed: 180,
        damage:
          byRank([70, 110, 150, 190, 230], rank) + 0.8 * champ.abilityPower,
        dir: target,
        radius: 4,
        distanceLeft: 160,
        slow: { amount: 0.3, duration: seconds(1.5) },
      });
    },
  },
  w: {
    name: "War Cry",
    description: "Move faster and attack faster for a few seconds.",
    maxRank: 5,
    cooldown: [16, 15, 14, 13, 12],
    manaCost: [50, 50, 50, 50, 50],
    targeting: "self",
    range: 0,
    cast({ state, champ, rank }) {
      addEffect(champ, {
        kind: "haste",
        moveSpeed: 0.3,
        attackSpeed: byRank([0.2, 0.3, 0.4, 0.5, 0.6], rank),
        until: state.tick + seconds(4),
      });
    },
  },
  e: {
    name: "Leap",
    description: "Dash a short distance towards the cursor.",
    maxRank: 5,
    cooldown: [14, 13, 12, 11, 10],
    manaCost: [60, 60, 60, 60, 60],
    targeting: "point",
    range: 64,
    cast({ champ, target }) {
      stopMoving(champ);
      champ.order = { type: "idle" };
      champ.dash = { to: { ...target }, speed: 300 };
    },
  },
  r: {
    name: "Meteor",
    description:
      "Call down a meteor that lands after a second, " +
      "hitting every enemy in the area.",
    maxRank: 3,
    cooldown: [80, 65, 50],
    manaCost: [100, 100, 100],
    targeting: "point",
    range: 140,
    cast({ state, champ, rank, target }) {
      state.zones.push({
        id: newId(state),
        team: champ.team,
        sourceId: champ.id,
        pos: { ...target },
        radius: 32,
        damage: byRank([200, 320, 440], rank) + champ.abilityPower,
        createdTick: state.tick,
        detonateTick: state.tick + seconds(1),
      });
    },
  },
};

export const KITS: Record<ChampionName, Record<AbilitySlot, AbilityDef>> = {
  cavegirl2: STONE_AGE_KIT,
  caveman2: STONE_AGE_KIT,
};

export function abilityDef(champ: Champion, slot: AbilitySlot): AbilityDef {
  return KITS[champ.champion][slot];
}

export function canLevelAbility(champ: Champion, slot: AbilitySlot): boolean {
  const rank = champ.abilities[slot].rank;
  if (champ.abilityPoints <= 0 || rank >= abilityDef(champ, slot).maxRank) {
    return false;
  }
  return slot === "r"
    ? champ.level >= ULTIMATE_LEVELS[rank]
    : rank < Math.ceil(champ.level / 2);
}

export function levelAbility(champ: Champion, slot: AbilitySlot) {
  if (canLevelAbility(champ, slot)) {
    champ.abilities[slot].rank++;
    champ.abilityPoints--;
  }
}

export function canCast(champ: Champion, slot: AbilitySlot): boolean {
  const ability = champ.abilities[slot];
  return (
    !champ.dead &&
    champ.dash == null &&
    ability.rank > 0 &&
    ability.cooldown === 0 &&
    champ.mana >= abilityDef(champ, slot).manaCost[ability.rank - 1]
  );
}

export function castAbility(
  state: GameState,
  map: MapData,
  champ: Champion,
  slot: AbilitySlot,
  aim: Vec,
  events: SimEvent[]
) {
  if (!canCast(champ, slot)) {
    return;
  }
  const def = abilityDef(champ, slot);
  const ability = champ.abilities[slot];

  let target: Vec;
  switch (def.targeting) {
    case "direction": {
      const dir = sub(aim, champ.pos);
      target = isZero(dir) ? champ.facing : normalize(dir);
      champ.facing = target;
      break;
    }
    case "point": {
      const dist = distance(aim, champ.pos);
      target =
        dist <= def.range
          ? aim
          : add(champ.pos, scale(normalize(sub(aim, champ.pos)), def.range));
      if (dist > 0) {
        champ.facing = normalize(sub(aim, champ.pos));
      }
      break;
    }
    case "self":
      target = champ.pos;
      break;
  }

  champ.mana -= def.manaCost[ability.rank - 1];
  ability.cooldown = seconds(def.cooldown[ability.rank - 1]);
  champ.recallLeft = null;
  def.cast({ state, map, champ, rank: ability.rank, target, events });
  events.push({ type: "cast", sourceId: champ.id, slot });
}
