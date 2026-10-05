import { NEXUS, TURRET, WAVES } from "./constants";
import { MapData, StructurePlacement } from "./mapData";
import {
  ChampionName,
  GameState,
  Lane,
  LANES,
  PlayerId,
  Structure,
  Team,
  TEAMS,
  TurretTier,
  enemyOf,
} from "./types";
import { spawnChampion } from "./world";
import { Vec } from "./vec";

export interface PlayerSetup {
  playerId: PlayerId;
  team: Team;
  champion: ChampionName;
}

function findStructure(
  map: MapData,
  team: Team,
  tier: TurretTier | "nexus-building",
  lane: Lane | null
): StructurePlacement {
  const found = map.structures.find((s) =>
    tier === "nexus-building"
      ? s.team === team && s.structure === "nexus"
      : s.team === team && s.tier === tier && s.lane === lane
  );
  if (!found) {
    throw new Error(`map has no ${team} ${tier} structure (lane ${lane})`);
  }
  return found;
}

// own lane turrets from the base outwards, then the enemy's inwards, ending
// at the enemy nexus
function lanePath(map: MapData, team: Team, lane: Lane): Vec[] {
  const enemy = enemyOf(team);
  const tiers: TurretTier[] = ["base", "inner", "outer"];
  return [
    ...tiers.map((tier) => findStructure(map, team, tier, lane).pos),
    ...tiers
      .slice()
      .reverse()
      .map((tier) => findStructure(map, enemy, tier, lane).pos),
    findStructure(map, enemy, "nexus-building", null).pos,
  ];
}

export function nexusPos(map: MapData, team: Team): Vec {
  return findStructure(map, team, "nexus-building", null).pos;
}

export function createGame(map: MapData, players: PlayerSetup[]): GameState {
  const lanePaths = {} as GameState["lanePaths"];
  for (const team of TEAMS) {
    lanePaths[team] = {} as Record<Lane, Vec[]>;
    for (const lane of LANES) {
      lanePaths[team][lane] = lanePath(map, team, lane);
    }
  }

  const state: GameState = {
    tick: 0,
    nextId: 1,
    units: [],
    projectiles: [],
    nextWaveTick: WAVES.firstAt,
    lanePaths,
    fountains: {
      blue: { ...map.fountains.blue },
      red: { ...map.fountains.red },
    },
    winner: null,
  };

  for (const placement of map.structures) {
    const stats = placement.structure === "nexus" ? NEXUS : TURRET;
    const structure: Structure = {
      kind: "structure",
      id: state.nextId++,
      structure: placement.structure,
      tier: placement.tier,
      lane: placement.lane,
      team: placement.team,
      pos: { ...placement.pos },
      radius: stats.radius,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      armor: stats.armor,
      attack: placement.structure === "turret" ? { ...TURRET.attack } : null,
      attackCooldown: 0,
      targetId: null,
    };
    state.units.push(structure);
  }

  for (const player of players) {
    spawnChampion(state, player.playerId, player.team, player.champion);
  }

  return state;
}
