import {
  applyDamage,
  inAttackRange,
  isChampionAggressor,
  pickTarget,
  tryAttack,
} from "./combat";
import { addEffect, castAbility, levelAbility } from "./abilities";
import {
  championKillXp,
  ECONOMY,
  FOUNTAIN_RADIUS,
  FOUNTAIN_REGEN,
  MINION_AGGRO_RANGE,
  MINION_LEASH_RANGE,
  MINIONS,
  perTick,
  RECALL_TIME,
  respawnTime,
  TICK_RATE,
  WAVES,
  WAYPOINT_REACHED,
  XP_RANGE,
} from "./constants";
import { nexusPos } from "./game";
import { MapData } from "./mapData";
import { moveInDirection, moveTowards, stopMoving } from "./movement";
import { navGrid } from "./navGrid";
import { buyItem, grantGold, grantXp, sellItem } from "./progression";
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
  Unit,
} from "./types";
import { add, distance, isZero, normalize, scale, sub } from "./vec";
import {
  canAttack,
  edgeDistance,
  getUnit,
  isAlive,
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
      champ.mana = champ.maxMana;
      champ.pos = { ...state.fountains[champ.team] };
      champ.facing = { x: 0, y: 1 };
      champ.order = { type: "idle" };
      champ.effects = [];
    }
    // the dead can still shop
    for (const command of input.commands) {
      if (command.type === "buy") buyItem(state, champ, command.item);
      if (command.type === "sell") sellItem(state, champ, command.slot);
      if (command.type === "levelAbility") levelAbility(champ, command.slot);
    }
    return;
  }

  const inFountain =
    distance(champ.pos, state.fountains[champ.team]) <= FOUNTAIN_RADIUS;
  const fountainRegen = inFountain ? FOUNTAIN_REGEN : 0;
  champ.hp = Math.min(
    champ.maxHp,
    champ.hp + (champ.hpRegen + champ.maxHp * fountainRegen) / TICK_RATE
  );
  champ.mana = Math.min(
    champ.maxMana,
    champ.mana + (champ.manaRegen + champ.maxMana * fountainRegen) / TICK_RATE
  );

  for (const command of input.commands) {
    switch (command.type) {
      case "smartClick": {
        champ.recallLeft = null;
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
      case "cast":
        castAbility(state, map, champ, command.slot, command.target, events);
        break;
      case "levelAbility":
        levelAbility(champ, command.slot);
        break;
      case "recall":
        if (champ.dash == null && champ.recallLeft == null) {
          champ.recallLeft = RECALL_TIME;
          champ.order = { type: "idle" };
          stopMoving(champ);
        }
        break;
      case "buy":
        buyItem(state, champ, command.item);
        break;
      case "sell":
        sellItem(state, champ, command.slot);
        break;
    }
  }

  if (champ.dash) {
    const dash = champ.dash;
    const grid = navGrid(state, map);
    const toGo = distance(champ.pos, dash.to);
    const step = Math.min(toGo, perTick(dash.speed));
    const next = grid.moveCircle(
      champ.pos,
      scale(normalize(sub(dash.to, champ.pos)), step),
      champ.radius
    );
    const moved = distance(next, champ.pos);
    champ.pos = next;
    champ.moving = moved > 0;
    // done once there, or when a wall stops it
    if (moved < step * 0.5 || distance(champ.pos, dash.to) < 0.5) {
      champ.dash = null;
    }
    return;
  }

  // direct movement overrides any order
  if (!isZero(input.move)) {
    champ.recallLeft = null;
    champ.order = { type: "idle" };
    moveInDirection(state, map, champ, input.move);
    return;
  }

  if (champ.recallLeft != null) {
    champ.recallLeft--;
    if (champ.recallLeft <= 0) {
      champ.recallLeft = null;
      champ.pos = { ...state.fountains[champ.team] };
      events.push({ type: "recalled", unitId: champ.id });
    }
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
    // drop everything for champions attacking allied champions
    (candidate &&
      isChampionAggressor(state, candidate) &&
      !isChampionAggressor(state, target)) ||
    // and go back to the minions once they stop
    (target.kind === "champion" &&
      !isChampionAggressor(state, target) &&
      candidate?.kind !== "champion")
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
  const source = (id: number) => getUnit(state, id);
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
      applyDamage(state, source(p.sourceId), hit, p.damage);
      if (p.slow) {
        addEffect(hit, {
          kind: "slow",
          amount: p.slow.amount,
          until: state.tick + p.slow.duration,
        });
      }
      return false;
    }
    return p.distanceLeft > 0;
  });
}

export function updateZones(state: GameState, events: SimEvent[]) {
  state.zones = state.zones.filter((zone) => {
    if (state.tick < zone.detonateTick) {
      return true;
    }
    const source = getUnit(state, zone.sourceId);
    for (const unit of state.units) {
      if (
        unit.team !== zone.team &&
        unit.kind !== "structure" &&
        isAlive(unit) &&
        distance(unit.pos, zone.pos) <= zone.radius + unit.radius
      ) {
        applyDamage(state, source, unit, zone.damage);
      }
    }
    events.push({
      type: "explosion",
      pos: { ...zone.pos },
      radius: zone.radius,
      team: zone.team,
    });
    return false;
  });
}

export function passiveIncome(state: GameState) {
  if (state.tick < WAVES.firstAt) {
    return;
  }
  for (const unit of state.units) {
    if (unit.kind === "champion") {
      unit.gold += ECONOMY.goldPerSecond / TICK_RATE;
    }
  }
}

// splits xp between the enemies of `dead` that are near it
function shareXp(
  state: GameState,
  dead: Unit,
  amount: number,
  events: SimEvent[],
  alwaysInclude: Champion | null
) {
  const earners = state.units.filter(
    (u): u is Champion =>
      u.kind === "champion" &&
      u.team !== dead.team &&
      !u.dead &&
      (u === alwaysInclude || distance(u.pos, dead.pos) <= XP_RANGE)
  );
  for (const champ of earners) {
    grantXp(state, champ, amount / earners.length, events);
  }
}

function rewardDeath(state: GameState, unit: Unit, events: SimEvent[]) {
  const killer = getUnit(state, unit.lastDamagedBy);
  const killerChamp = killer?.kind === "champion" ? killer : null;
  switch (unit.kind) {
    case "minion": {
      const stats = MINIONS[unit.minion];
      if (killerChamp) {
        killerChamp.creepScore++;
        grantGold(killerChamp, stats.gold, unit.pos, events);
      }
      shareXp(state, unit, stats.xp, events, null);
      break;
    }
    case "champion": {
      unit.deaths++;
      if (killerChamp) {
        killerChamp.kills++;
        grantGold(killerChamp, ECONOMY.championKill, unit.pos, events);
        events.push({
          type: "kill",
          killerId: killerChamp.id,
          victimId: unit.id,
        });
      }
      shareXp(state, unit, championKillXp(unit.level), events, killerChamp);
      break;
    }
    case "structure":
      for (const champ of state.units) {
        if (champ.kind === "champion" && champ.team !== unit.team) {
          grantGold(champ, ECONOMY.structureKill, unit.pos, events);
        }
      }
      break;
  }
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
        unit.respawnIn = respawnTime(unit.level);
        unit.order = { type: "idle" };
        unit.targetId = null;
        unit.dash = null;
        unit.recallLeft = null;
        stopMoving(unit);
        events.push({ type: "death", unitId: unit.id });
        rewardDeath(state, unit, events);
      }
      return true;
    }
    events.push({ type: "death", unitId: unit.id });
    rewardDeath(state, unit, events);
    if (unit.kind === "structure" && unit.structure === "nexus") {
      state.winner = enemyOf(unit.team);
      events.push({ type: "victory", team: state.winner });
    }
    return false;
  });
}
