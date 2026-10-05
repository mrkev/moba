import { SKILLSHOT, TICK_RATE } from "../sim/constants";
import { ChampionName, GameState, PlayerId, Team } from "../sim/types";
import { championOf } from "../sim/world";

// What the React HUD shows, rounded so it only changes when the display does.
export interface HudState {
  champion: ChampionName;
  team: Team;
  hp: number;
  maxHp: number;
  attackDamage: number;
  abilityPower: number;
  armor: number;
  moveSpeed: number;
  // attacks per second
  attackSpeed: number;
  // seconds until the skillshot is ready, 0 when it is
  abilityCooldown: number;
  abilityCooldownMax: number;
  dead: boolean;
  // whole seconds
  respawnIn: number;
  gameTime: number;
  winner: Team | null;
  debug: boolean;
}

export function computeHud(
  state: GameState,
  playerId: PlayerId,
  debug: boolean
): HudState | null {
  const champ = championOf(state, playerId);
  if (champ == null) {
    return null;
  }
  return {
    champion: champ.champion,
    team: champ.team,
    hp: Math.ceil(champ.hp),
    maxHp: champ.maxHp,
    attackDamage: champ.attack?.damage ?? 0,
    abilityPower: champ.abilityPower,
    armor: champ.armor,
    moveSpeed: champ.moveSpeed,
    attackSpeed: champ.attack
      ? Math.round((TICK_RATE / champ.attack.interval) * 100) / 100
      : 0,
    abilityCooldown: Math.ceil((champ.abilityCooldown / TICK_RATE) * 10) / 10,
    abilityCooldownMax: SKILLSHOT.cooldown / TICK_RATE,
    dead: champ.dead,
    respawnIn: Math.ceil(champ.respawnIn / TICK_RATE),
    gameTime: Math.floor(state.tick / TICK_RATE),
    winner: state.winner,
    debug,
  };
}

export function hudEqual(a: HudState | null, b: HudState | null): boolean {
  if (a == null || b == null) {
    return a === b;
  }
  return (Object.keys(a) as (keyof HudState)[]).every((k) => a[k] === b[k]);
}
