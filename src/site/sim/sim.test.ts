import { describe, expect, it } from "vitest";
import { seconds, TURRET, WAVES } from "./constants";
import { createGame } from "./game";
import { MapData, StructurePlacement } from "./mapData";
import { navGrid } from "./navGrid";
import { findPath } from "./pathfinding";
import { step } from "./step";
import {
  Champion,
  GameState,
  Lane,
  PlayerInput,
  Structure,
  Team,
  TurretTier,
} from "./types";
import { distance, Vec } from "./vec";
import { championOf, isVulnerable, spawnMinion } from "./world";

// Same layout as the rift: blue base bottom-left, red base top-right.
function testMap(solidTiles: [number, number][] = []): MapData {
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

function newGame(map = testMap()) {
  const state = createGame(map, [
    { playerId: 0, team: "blue", champion: "cavegirl2" },
  ]);
  // no minion waves unless a test asks for them
  state.nextWaveTick = Infinity;
  return { state, map, champ: championOf(state, 0)! };
}

function run(
  state: GameState,
  map: MapData,
  ticks: number,
  input: Partial<PlayerInput> = {}
) {
  for (let i = 0; i < ticks; i++) {
    step(state, map, {
      0: {
        move: input.move ?? { x: 0, y: 0 },
        // commands only go in on the first tick
        commands: i === 0 ? (input.commands ?? []) : [],
      },
    });
  }
}

function structureAt(
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

function placeChampion(champ: Champion, pos: Vec) {
  champ.pos = { ...pos };
}

describe("pathfinding", () => {
  it("routes around walls", () => {
    // vertical wall at x = 10, from y = 0 to 20
    const wall: [number, number][] = [];
    for (let ty = 0; ty <= 20; ty++) wall.push([10, ty]);
    const { state, map } = newGame(testMap(wall));
    const grid = navGrid(state, map);

    const from = { x: 5 * 16, y: 5 * 16 };
    const to = { x: 15 * 16, y: 5 * 16 };
    expect(grid.lineOfSight(from, to, 6)).toBe(false);

    const path = findPath(grid, from, to, 6)!;
    expect(path).not.toBeNull();
    expect(path[path.length - 1]).toEqual(to);
    let prev = from;
    for (const point of path) {
      expect(grid.lineOfSight(prev, point, 6)).toBe(true);
      prev = point;
    }
  });

  it("treats standing structures as obstacles", () => {
    const { state, map } = newGame();
    const turret = structureAt(state, "red", "outer", "mid");
    expect(navGrid(state, map).isBlocked(turret.pos, 1)).toBe(true);
    turret.hp = 0;
    run(state, map, 1);
    expect(navGrid(state, map).isBlocked(turret.pos, 1)).toBe(false);
  });
});

describe("champion", () => {
  it("moves in the held direction at its move speed, also diagonally", () => {
    const { state, map, champ } = newGame();
    placeChampion(champ, { x: 500, y: 500 });
    run(state, map, 60, { move: { x: 1, y: -1 } });
    const moved = distance(champ.pos, { x: 500, y: 500 });
    expect(moved).toBeCloseTo(champ.moveSpeed, 5);
  });

  it("can't walk through solid tiles", () => {
    const wall: [number, number][] = [];
    for (let ty = 0; ty < 64; ty++) wall.push([33, ty]);
    const { state, map, champ } = newGame(testMap(wall));
    placeChampion(champ, { x: 500, y: 500 });
    run(state, map, 120, { move: { x: 1, y: 0 } });
    expect(champ.pos.x + champ.radius).toBeLessThanOrEqual(33 * 16);
  });

  it("walks to a right-clicked point", () => {
    const { state, map, champ } = newGame();
    placeChampion(champ, { x: 500, y: 500 });
    const to = { x: 540, y: 620 };
    run(state, map, seconds(4), {
      commands: [{ type: "smartClick", pos: to }],
    });
    expect(distance(champ.pos, to)).toBeLessThanOrEqual(1);
    expect(champ.order.type).toBe("idle");
  });

  it("stops when the clicked point is inside a structure", () => {
    const { state, map, champ } = newGame();
    const nexus = state.units.find(
      (u) => u.kind === "structure" && u.team === "blue" && !u.tier
    )!;
    // just inside the nexus's footprint, so it can't be stood on
    const to = { x: nexus.pos.x - 8, y: nexus.pos.y + 16 };
    run(state, map, seconds(4), {
      commands: [{ type: "smartClick", pos: to }],
    });
    expect(champ.order.type).toBe("idle");
    expect(distance(champ.pos, to)).toBeLessThan(16);
  });

  it("attacks a right-clicked enemy until it dies", () => {
    const { state, map, champ } = newGame();
    placeChampion(champ, { x: 500, y: 500 });
    const minion = spawnMinion(state, "red", "mid", "melee", {
      x: 500,
      y: 600,
    });
    minion.attack = null; // keep it still and harmless
    minion.moveSpeed = 0;
    run(state, map, seconds(10), {
      commands: [{ type: "smartClick", pos: minion.pos }],
    });
    expect(state.units).not.toContain(minion);
    expect(champ.order.type).toBe("idle");
  });

  it("dies and respawns at the fountain", () => {
    const { state, map, champ } = newGame();
    placeChampion(champ, { x: 500, y: 500 });
    champ.hp = 1;
    spawnMinion(state, "red", "mid", "caster", { x: 500, y: 540 });
    run(state, map, seconds(3));
    expect(champ.dead).toBe(true);
    run(state, map, seconds(5));
    expect(champ.dead).toBe(false);
    expect(champ.hp).toBe(champ.maxHp);
    expect(champ.pos).toEqual(state.fountains.blue);
  });
});

describe("structures", () => {
  it("go down in lane order", () => {
    const { state } = newGame();
    const outer = structureAt(state, "red", "outer", "top");
    const inner = structureAt(state, "red", "inner", "top");
    const nexusTurret = structureAt(state, "red", "nexus", null);
    expect(isVulnerable(state, outer)).toBe(true);
    expect(isVulnerable(state, inner)).toBe(false);
    expect(isVulnerable(state, nexusTurret)).toBe(false);
    outer.hp = 0;
    expect(isVulnerable(state, inner)).toBe(true);
  });

  it("turrets prefer minions, except champions hitting champions", () => {
    const { state, map, champ } = newGame();
    const turret = structureAt(state, "red", "outer", "mid");
    placeChampion(champ, { x: turret.pos.x, y: turret.pos.y + 50 });
    const minion = spawnMinion(state, "blue", "mid", "melee", {
      x: turret.pos.x + 40,
      y: turret.pos.y,
    });
    minion.moveSpeed = 0;
    minion.attack = null;
    run(state, map, 1);
    expect(turret.targetId).toBe(minion.id);

    champ.lastHitChampionTick = state.tick;
    run(state, map, 1);
    expect(turret.targetId).toBe(champ.id);
  });

  it("deal damage on a cooldown", () => {
    const { state, map, champ } = newGame();
    const turret = structureAt(state, "red", "outer", "mid");
    placeChampion(champ, { x: turret.pos.x, y: turret.pos.y + 50 });
    champ.attack = null;
    run(state, map, seconds(2.5));
    // shots fired at 0s, 1s and 2s; the last one still in flight is fine
    const perHit = (TURRET.attack.damage * 100) / (100 + champ.armor);
    const hits = (champ.maxHp - champ.hp) / perHit;
    expect(Math.round(hits)).toBeGreaterThanOrEqual(2);
    expect(Math.round(hits)).toBeLessThanOrEqual(3);
  });

  it("losing the nexus ends the game", () => {
    const { state, map } = newGame();
    for (const unit of state.units) {
      if (unit.kind === "structure" && unit.team === "red" && unit.tier) {
        unit.hp = 0;
      }
    }
    run(state, map, 1);
    const nexus = state.units.find(
      (u): u is Structure =>
        u.kind === "structure" && u.team === "red" && u.structure === "nexus"
    )!;
    expect(isVulnerable(state, nexus)).toBe(true);
    nexus.hp = 0;
    run(state, map, 1);
    expect(state.winner).toBe("blue");
    const tick = state.tick;
    run(state, map, 10);
    expect(state.tick).toBe(tick);
  });
});

describe("minion waves", () => {
  it("spawn for every lane of both teams on schedule", () => {
    const { state, map } = newGame();
    state.nextWaveTick = WAVES.firstAt;
    run(state, map, WAVES.firstAt + 1);
    const minions = state.units.filter((u) => u.kind === "minion");
    expect(minions).toHaveLength(2 * 3 * WAVES.composition.length);
  });

  it("march down their lane", () => {
    const { state, map } = newGame();
    state.nextWaveTick = 0;
    run(state, map, 1);
    const minion = state.units.find(
      (u) => u.kind === "minion" && u.team === "blue" && u.lane === "mid"
    )!;
    const enemyOuter = structureAt(state, "red", "outer", "mid");
    const before = distance(minion.pos, enemyOuter.pos);
    run(state, map, seconds(5));
    expect(distance(minion.pos, enemyOuter.pos)).toBeLessThan(before - 100);
  });
});

describe("simulation", () => {
  it("is deterministic", () => {
    const play = () => {
      const { state, map } = newGame();
      state.nextWaveTick = 0;
      run(state, map, seconds(90), {
        commands: [{ type: "smartClick", pos: { x: 400, y: 600 } }],
      });
      return JSON.stringify(state);
    };
    expect(play()).toEqual(play());
  });

  it("lets waves fight it out for a few minutes", () => {
    const { state, map } = newGame();
    state.nextWaveTick = 0;
    run(state, map, seconds(180));
    const alive = state.units.length + state.projectiles.length;
    const deaths = state.nextId - 1 - alive;
    expect(deaths).toBeGreaterThan(0);
    // minions stay within the map
    for (const unit of state.units) {
      expect(unit.pos.x).toBeGreaterThanOrEqual(0);
      expect(unit.pos.y).toBeGreaterThanOrEqual(0);
      expect(unit.pos.x).toBeLessThanOrEqual(1024);
      expect(unit.pos.y).toBeLessThanOrEqual(1024);
    }
  });
});
