import { createGame } from "./game";
import { MapData, StructurePlacement } from "./mapData";
import { step } from "./step";
import {
  Champion,
  GameState,
  Lane,
  PlayerId,
  PlayerInput,
  Structure,
  Team,
  TurretTier,
} from "./types";
import { Vec } from "./vec";
import { championOf } from "./world";

// Helpers for simulation tests.

// Same layout as the rift: blue base bottom-left, red base top-right.
export function testMap(solidTiles: [number, number][] = []): MapData {
  const width = 64;
  const height = 64;
  const solid = new Array<boolean>(width * height).fill(false);
  for (const [tx, ty] of solidTiles) {
    solid[ty * width + tx] = true;
  }
  const turret = (
    team: Team,
    tier: TurretTier,
    lane: Lane | null,
    x: number,
    y: number
  ): StructurePlacement => ({
    team,
    structure: "turret",
    tier,
    lane,
    pos: { x, y },
  });
  const nexus = (team: Team, x: number, y: number): StructurePlacement => ({
    team,
    structure: "nexus",
    tier: null,
    lane: null,
    pos: { x, y },
  });
  return {
    width,
    height,
    tileSize: 16,
    solid,
    fountains: { blue: { x: 48, y: 984 }, red: { x: 976, y: 40 } },
    structures: [
      turret("red", "outer", "top", 304, 80),
      turret("red", "outer", "mid", 608, 432),
      turret("red", "outer", "bot", 944, 736),
      turret("red", "inner", "top", 544, 96),
      turret("red", "inner", "mid", 672, 336),
      turret("red", "inner", "bot", 928, 464),
      turret("red", "base", "top", 720, 80),
      turret("red", "base", "mid", 768, 256),
      turret("red", "base", "bot", 944, 304),
      turret("red", "nexus", null, 912, 144),
      turret("red", "nexus", null, 880, 112),
      nexus("red", 928, 96),
      turret("blue", "outer", "top", 64, 304),
      turret("blue", "outer", "mid", 400, 576),
      turret("blue", "outer", "bot", 736, 944),
      turret("blue", "inner", "top", 96, 576),
      turret("blue", "inner", "mid", 352, 688),
      turret("blue", "inner", "bot", 464, 928),
      turret("blue", "base", "top", 80, 720),
      turret("blue", "base", "mid", 256, 768),
      turret("blue", "base", "bot", 304, 944),
      turret("blue", "nexus", null, 112, 880),
      turret("blue", "nexus", null, 144, 912),
      nexus("blue", 96, 928),
    ],
  };
}

export function newGame(map = testMap()) {
  const state = createGame(map, [
    { playerId: 0, team: "blue", champion: "cavegirl2" },
  ]);
  // no minion waves unless a test asks for them
  state.nextWaveTick = Infinity;
  return { state, map, champ: championOf(state, 0)! };
}

export function run(
  state: GameState,
  map: MapData,
  ticks: number,
  input: Partial<PlayerInput> = {},
  others: (state: GameState) => Record<PlayerId, PlayerInput> = () => ({})
) {
  for (let i = 0; i < ticks; i++) {
    step(state, map, {
      ...others(state),
      0: {
        move: input.move ?? { x: 0, y: 0 },
        // commands only go in on the first tick
        commands: i === 0 ? (input.commands ?? []) : [],
      },
    });
  }
}

export function structureAt(
  state: GameState,
  team: Team,
  tier: TurretTier,
  lane: Lane | null
) {
  return state.units.find(
    (u): u is Structure =>
      u.kind === "structure" &&
      u.team === team &&
      u.tier === tier &&
      u.lane === lane
  )!;
}

export function placeChampion(champ: Champion, pos: Vec) {
  champ.pos = { ...pos };
}
