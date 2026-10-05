import { abilityDef, canCast, canLevelAbility } from "../sim/abilities";
import { RECALL_TIME, TICK_RATE, xpToNextLevel } from "../sim/constants";
import { canShop } from "../sim/progression";
import {
  ABILITY_SLOTS,
  AbilitySlot,
  Champion,
  ChampionName,
  GameState,
  ItemId,
  PlayerId,
  Team,
} from "../sim/types";
import { championOf } from "../sim/world";

export interface AbilityHud {
  slot: AbilitySlot;
  name: string;
  description: string;
  rank: number;
  maxRank: number;
  // seconds until ready, 0 when it is
  cooldown: number;
  manaCost: number;
  canLevel: boolean;
  castable: boolean;
}

export interface ScoreHud {
  champion: ChampionName;
  team: Team;
  level: number;
  kills: number;
  deaths: number;
  creepScore: number;
  dead: boolean;
}

// What the React HUD shows, rounded so it only changes when the display does.
export interface HudState {
  champion: ChampionName;
  team: Team;
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  gold: number;
  stats: {
    attackDamage: number;
    abilityPower: number;
    armor: number;
    moveSpeed: number;
    // attacks per second
    attackSpeed: number;
  };
  abilityPoints: number;
  abilities: AbilityHud[];
  items: (ItemId | null)[];
  canShop: boolean;
  shopOpen: boolean;
  dead: boolean;
  // whole seconds
  respawnIn: number;
  // 0 to 1 while recalling
  recallProgress: number | null;
  scores: ScoreHud[];
  // whole seconds
  gameTime: number;
  winner: Team | null;
  debug: boolean;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function score(champ: Champion): ScoreHud {
  return {
    champion: champ.champion,
    team: champ.team,
    level: champ.level,
    kills: champ.kills,
    deaths: champ.deaths,
    creepScore: champ.creepScore,
    dead: champ.dead,
  };
}

export function computeHud(
  state: GameState,
  playerId: PlayerId,
  view: { debug: boolean; shopOpen: boolean }
): HudState | null {
  const champ = championOf(state, playerId);
  if (champ == null) {
    return null;
  }
  return {
    champion: champ.champion,
    team: champ.team,
    level: champ.level,
    xp: Math.floor(champ.xp),
    xpToNext: xpToNextLevel(champ.level),
    hp: Math.ceil(champ.hp),
    maxHp: Math.round(champ.maxHp),
    mana: Math.floor(champ.mana),
    maxMana: Math.round(champ.maxMana),
    gold: Math.floor(champ.gold),
    stats: {
      attackDamage: round1(champ.attack?.damage ?? 0),
      abilityPower: champ.abilityPower,
      armor: round1(champ.armor),
      moveSpeed: Math.round(champ.moveSpeed),
      attackSpeed: champ.attack
        ? Math.round((TICK_RATE / champ.attack.interval) * 100) / 100
        : 0,
    },
    abilityPoints: champ.abilityPoints,
    abilities: ABILITY_SLOTS.map((slot) => {
      const def = abilityDef(champ, slot);
      const { rank, cooldown } = champ.abilities[slot];
      return {
        slot,
        name: def.name,
        description: def.description,
        rank,
        maxRank: def.maxRank,
        cooldown: Math.ceil((cooldown / TICK_RATE) * 10) / 10,
        manaCost: def.manaCost[Math.max(0, rank - 1)],
        canLevel: canLevelAbility(champ, slot),
        castable: canCast(champ, slot),
      };
    }),
    items: [...champ.items],
    canShop: canShop(state, champ),
    shopOpen: view.shopOpen,
    dead: champ.dead,
    respawnIn: Math.ceil(champ.respawnIn / TICK_RATE),
    recallProgress:
      champ.recallLeft == null
        ? null
        : round1(1 - champ.recallLeft / RECALL_TIME),
    scores: state.units
      .filter((u): u is Champion => u.kind === "champion")
      .map(score),
    gameTime: Math.floor(state.tick / TICK_RATE),
    winner: state.winner,
    debug: view.debug,
  };
}

export function hudEqual(a: HudState | null, b: HudState | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
