import { CHAMPIONS, MINIONS } from "./constants";
import {
  Champion,
  EntityId,
  GameState,
  Lane,
  Minion,
  MinionType,
  PlayerId,
  Structure,
  Team,
  Unit,
} from "./types";
import { distance, Vec } from "./vec";

export function getUnit(state: GameState, id: EntityId | null): Unit | null {
  if (id == null) {
    return null;
  }
  return state.units.find((u) => u.id === id) ?? null;
}

export function championOf(
  state: GameState,
  playerId: PlayerId
): Champion | null {
  return (
    state.units.find(
      (u): u is Champion => u.kind === "champion" && u.playerId === playerId
    ) ?? null
  );
}

export function isAlive(unit: Unit): boolean {
  return unit.hp > 0 && !(unit.kind === "champion" && unit.dead);
}

// distance between the edges of two units
export function edgeDistance(a: Unit, b: Unit): number {
  return distance(a.pos, b.pos) - a.radius - b.radius;
}

// Structures can only be damaged in order: a lane's outer turret, then its
// inner, then its base turret. Nexus turrets once any base turret is down,
// and the nexus once both nexus turrets are.
export function isVulnerable(state: GameState, s: Structure): boolean {
  const standing = (
    match: (other: Structure) => boolean
  ): Structure[] =>
    state.units.filter(
      (u): u is Structure =>
        u.kind === "structure" && u.team === s.team && u.hp > 0 && match(u)
    );

  if (s.structure === "nexus") {
    return standing((o) => o.tier === "nexus").length === 0;
  }
  switch (s.tier) {
    case "outer":
    case null:
      return true;
    case "inner":
      return standing((o) => o.lane === s.lane && o.tier === "outer")
        .length === 0;
    case "base":
      return standing((o) => o.lane === s.lane && o.tier === "inner")
        .length === 0;
    case "nexus":
      return standing((o) => o.tier === "base").length < 3;
  }
}

// whether `attacker` can currently attack `target`
export function canAttack(
  state: GameState,
  attacker: Unit,
  target: Unit
): boolean {
  return (
    target.team !== attacker.team &&
    isAlive(target) &&
    (target.kind !== "structure" || isVulnerable(state, target))
  );
}

// unit whose body covers pos, preferring the closest
export function unitAt(
  state: GameState,
  pos: Vec,
  slack: number
): Unit | null {
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const unit of state.units) {
    if (!isAlive(unit)) {
      continue;
    }
    const d = distance(unit.pos, pos);
    if (d <= unit.radius + slack && d < bestDist) {
      best = unit;
      bestDist = d;
    }
  }
  return best;
}

export function newId(state: GameState): EntityId {
  return state.nextId++;
}

export function spawnChampion(
  state: GameState,
  playerId: PlayerId,
  team: Team,
  champion: Champion["champion"]
): Champion {
  const stats = CHAMPIONS[champion];
  const unit: Champion = {
    kind: "champion",
    id: newId(state),
    champion,
    playerId,
    team,
    pos: { ...state.fountains[team] },
    radius: stats.radius,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    armor: stats.armor,
    attack: { ...stats.attack },
    attackCooldown: 0,
    targetId: null,
    moveSpeed: stats.moveSpeed,
    facing: { x: 0, y: 1 },
    moving: false,
    path: [],
    pathGoal: null,
    repathIn: 0,
    abilityPower: stats.abilityPower,
    order: { type: "idle" },
    abilityCooldown: 0,
    dead: false,
    respawnIn: 0,
    lastHitChampionTick: -Infinity,
  };
  state.units.push(unit);
  return unit;
}

export function spawnMinion(
  state: GameState,
  team: Team,
  lane: Lane,
  minion: MinionType,
  pos: Vec
): Minion {
  const stats = MINIONS[minion];
  const unit: Minion = {
    kind: "minion",
    id: newId(state),
    minion,
    team,
    lane,
    pos: { ...pos },
    radius: stats.radius,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    armor: stats.armor,
    attack: { ...stats.attack },
    attackCooldown: 0,
    targetId: null,
    moveSpeed: stats.moveSpeed,
    facing: { x: 0, y: 1 },
    moving: false,
    path: [],
    pathGoal: null,
    repathIn: 0,
    waypointIndex: 0,
  };
  state.units.push(unit);
  return unit;
}
