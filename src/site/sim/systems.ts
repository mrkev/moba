import {
  applyDamage,
  inAttackRange,
  isChampionAggressor,
  pickTarget,
  tryAttack,
} from "./combat";
import {
  FOUNTAIN_RADIUS,
  FOUNTAIN_REGEN,
  MINION_AGGRO_RANGE,
  MINION_LEASH_RANGE,
  perTick,
  RESPAWN_TIME,
  SKILLSHOT,
  TICK_RATE,
  WAVES,
  WAYPOINT_REACHED,
} from "./constants";
import { nexusPos } from "./game";
import { MapData } from "./mapData";
import { moveInDirection, moveTowards, stopMoving } from "./movement";
import { navGrid } from "./navGrid";
import {
  Champion,
  enemyOf,
  GameState,
  LANES,
  Minion,
  PlayerInput,
  SimEvent,
  Structure,
  TEAMS,
} from "./types";
import { add, distance, isZero, normalize, scale, sub } from "./vec";
import {
  canAttack,
  edgeDistance,
  getUnit,
  isAlive,
  newId,
  spawnMinion,
  unitAt,
} from "./world";

export function updateChampion(
  state: GameState,
  map: MapData,
  champ: Champion,
  input: PlayerInput,
  events: SimEvent[]
) {
  if (champ.dead) {
    champ.respawnIn--;
    if (champ.respawnIn <= 0) {
      champ.dead = false;
      champ.hp = champ.maxHp;
      champ.pos = { ...state.fountains[champ.team] };
      champ.facing = { x: 0, y: 1 };
      champ.order = { type: "idle" };
    }
    return;
  }

  if (distance(champ.pos, state.fountains[champ.team]) <= FOUNTAIN_RADIUS) {
    champ.hp = Math.min(
      champ.maxHp,
      champ.hp + (champ.maxHp * FOUNTAIN_REGEN) / TICK_RATE
    );
  }

  for (const command of input.commands) {
    switch (command.type) {
      case "smartClick": {
        const target = unitAt(state, command.pos, 4);
        if (target && target.team !== champ.team) {
          champ.order = { type: "attack", targetId: target.id };
        } else {
          champ.order = { type: "move", to: { ...command.pos } };
        }
        // head for the new destination right away
        champ.repathIn = 0;
        champ.path = [];
        break;
      }
      case "skillshot": {
        if (champ.abilityCooldown > 0 || isZero(command.dir)) {
          break;
        }
        const dir = normalize(command.dir);
        champ.abilityCooldown = SKILLSHOT.cooldown;
        champ.facing = dir;
        state.projectiles.push({
          kind: "skillshot",
          id: newId(state),
          team: champ.team,
          sourceId: champ.id,
          pos: { ...champ.pos },
          speed: SKILLSHOT.speed,
          damage: SKILLSHOT.baseDamage + SKILLSHOT.apRatio * champ.abilityPower,
          dir,
          radius: SKILLSHOT.radius,
          distanceLeft: SKILLSHOT.range,
        });
        events.push({ type: "cast", sourceId: champ.id });
        break;
      }
    }
  }

  // direct movement overrides any order
  if (!isZero(input.move)) {
    champ.order = { type: "idle" };
    moveInDirection(state, map, champ, input.move);
    return;
  }

  const order = champ.order;
  switch (order.type) {
    case "move": {
      if (moveTowards(state, map, champ, order.to, 1)) {
        champ.order = { type: "idle" };
      }
      break;
    }
    case "attack": {
      const target = getUnit(state, order.targetId);
      if (target == null || !isAlive(target) || target.team === champ.team) {
        champ.order = { type: "idle" };
        stopMoving(champ);
        break;
      }
      if (inAttackRange(champ, target)) {
        stopMoving(champ);
        tryAttack(state, champ, target, events);
      } else {
        moveTowards(state, map, champ, target.pos, 0);
      }
      break;
    }
    case "idle": {
      stopMoving(champ);
      // auto-attack whatever wanders into range
      const target = champ.attack
        ? pickTarget(state, champ, champ.attack.range)
        : null;
      if (target) {
        tryAttack(state, champ, target, events);
      }
      break;
    }
  }
}

export function updateMinion(
  state: GameState,
  map: MapData,
  minion: Minion,
  events: SimEvent[]
) {
  let target = getUnit(state, minion.targetId);
  if (
    target &&
    (!canAttack(state, minion, target) ||
      edgeDistance(minion, target) > MINION_LEASH_RANGE)
  ) {
    target = null;
  }
  const candidate = pickTarget(state, minion, MINION_AGGRO_RANGE);
  if (
    target == null ||
    (candidate &&
      isChampionAggressor(state, candidate) &&
      !isChampionAggressor(state, target))
  ) {
    target = candidate;
  }
  minion.targetId = target?.id ?? null;

  if (target) {
    if (inAttackRange(minion, target)) {
      stopMoving(minion);
      tryAttack(state, minion, target, events);
    } else {
      moveTowards(state, map, minion, target.pos, 0);
    }
    return;
  }

  // walk the lane
  const waypoints = state.lanePaths[minion.team][minion.lane];
  while (
    minion.waypointIndex < waypoints.length &&
    distance(minion.pos, waypoints[minion.waypointIndex]) <= WAYPOINT_REACHED
  ) {
    minion.waypointIndex++;
  }
  const waypoint = waypoints[minion.waypointIndex];
  if (waypoint == null) {
    stopMoving(minion);
    return;
  }
  moveTowards(state, map, minion, waypoint, WAYPOINT_REACHED);
}

export function updateStructure(
  state: GameState,
  structure: Structure,
  events: SimEvent[]
) {
  if (structure.attack == null) {
    return;
  }
  let target = getUnit(state, structure.targetId);
  if (
    target &&
    (!canAttack(state, structure, target) || !inAttackRange(structure, target))
  ) {
    target = null;
  }
  // stick with the current target unless a champion attacks an ally
  const candidate = pickTarget(state, structure, structure.attack.range);
  if (
    target == null ||
    (candidate &&
      isChampionAggressor(state, candidate) &&
      !isChampionAggressor(state, target))
  ) {
    target = candidate;
  }
  structure.targetId = target?.id ?? null;
  if (target) {
    tryAttack(state, structure, target, events);
  }
}

export function updateProjectiles(state: GameState) {
  state.projectiles = state.projectiles.filter((p) => {
    const step = perTick(p.speed);
    if (p.kind === "homing") {
      const target = getUnit(state, p.targetId);
      if (target == null || !isAlive(target)) {
        return false;
      }
      const d = distance(p.pos, target.pos);
      if (d <= step + target.radius) {
        applyDamage(state, getUnit(state, p.sourceId), target, p.damage);
        return false;
      }
      p.pos = add(p.pos, scale(normalize(sub(target.pos, p.pos)), step));
      return true;
    }

    p.pos = add(p.pos, scale(p.dir, step));
    p.distanceLeft -= step;
    let hit = null;
    let hitDist = Infinity;
    for (const unit of state.units) {
      if (unit.team === p.team || unit.kind === "structure" || !isAlive(unit)) {
        continue;
      }
      const d = distance(unit.pos, p.pos);
      if (d <= unit.radius + p.radius && d < hitDist) {
        hit = unit;
        hitDist = d;
      }
    }
    if (hit) {
      applyDamage(state, getUnit(state, p.sourceId), hit, p.damage);
      return false;
    }
    return p.distanceLeft > 0;
  });
}

export function spawnWaves(state: GameState, map: MapData) {
  if (state.tick < state.nextWaveTick) {
    return;
  }
  state.nextWaveTick += WAVES.interval;
  const grid = navGrid(state, map);
  for (const team of TEAMS) {
    const nexus = nexusPos(map, team);
    for (const lane of LANES) {
      const first = state.lanePaths[team][lane][0];
      const dir = normalize(sub(first, nexus));
      WAVES.composition.forEach((minionType, i) => {
        // a column heading out of the nexus towards the lane
        let pos = add(nexus, scale(dir, 28 + i * 10));
        if (grid.isBlocked(pos, 5)) {
          const open = grid.nearestOpenTile(pos);
          if (open) {
            pos = grid.tileCenter(open.tx, open.ty);
          }
        }
        spawnMinion(state, team, lane, minionType, pos);
      });
    }
  }
}

// Handles units that dropped to 0 hp this tick.
export function resolveDeaths(state: GameState, events: SimEvent[]) {
  state.units = state.units.filter((unit) => {
    if (unit.hp > 0) {
      return true;
    }
    if (unit.kind === "champion") {
      if (!unit.dead) {
        unit.dead = true;
        unit.respawnIn = RESPAWN_TIME;
        unit.order = { type: "idle" };
        unit.targetId = null;
        stopMoving(unit);
        events.push({ type: "death", unitId: unit.id });
      }
      return true;
    }
    events.push({ type: "death", unitId: unit.id });
    if (unit.kind === "structure" && unit.structure === "nexus") {
      state.winner = enemyOf(unit.team);
      events.push({ type: "victory", team: state.winner });
    }
    return false;
  });
}
