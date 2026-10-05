import { CHAMPION_AGGRESSION_MEMORY } from "./constants";
import { GameState, SimEvent, Unit } from "./types";
import { normalize, sub } from "./vec";
import { canAttack, edgeDistance, isAlive, isVulnerable, newId } from "./world";

export function applyDamage(
  state: GameState,
  source: Unit | null,
  target: Unit,
  amount: number
) {
  if (!isAlive(target)) {
    return;
  }
  if (target.kind === "structure" && !isVulnerable(state, target)) {
    return;
  }
  target.hp = Math.max(0, target.hp - (amount * 100) / (100 + target.armor));
  if (source) {
    target.lastDamagedBy = source.id;
  }
  if (target.kind === "champion") {
    // taking damage interrupts recalling
    target.recallLeft = null;
    if (source?.kind === "champion") {
      source.lastHitChampionTick = state.tick;
    }
  }
}

export function inAttackRange(unit: Unit, target: Unit): boolean {
  return unit.attack != null && edgeDistance(unit, target) <= unit.attack.range;
}

// Attacks target if it's in range and the attack is off cooldown. Ranged
// attacks fire a projectile that always hits.
export function tryAttack(
  state: GameState,
  unit: Unit,
  target: Unit,
  events: SimEvent[]
): boolean {
  const attack = unit.attack;
  if (
    attack == null ||
    unit.attackCooldown > 0 ||
    !inAttackRange(unit, target)
  ) {
    return false;
  }
  if (unit.kind !== "structure") {
    unit.facing = normalize(sub(target.pos, unit.pos));
  }
  unit.attackCooldown = attack.interval;
  events.push({ type: "attack", sourceId: unit.id, targetId: target.id });
  if (attack.projectileSpeed == null) {
    applyDamage(state, unit, target, attack.damage);
  } else {
    state.projectiles.push({
      kind: "homing",
      id: newId(state),
      team: unit.team,
      sourceId: unit.id,
      pos: { ...unit.pos },
      speed: attack.projectileSpeed,
      damage: attack.damage,
      targetId: target.id,
    });
  }
  return true;
}

// whether this champion recently hit one of the enemy team's champions
export function isChampionAggressor(state: GameState, unit: Unit): boolean {
  return (
    unit.kind === "champion" &&
    state.tick - unit.lastHitChampionTick <= CHAMPION_AGGRESSION_MEMORY
  );
}

// Picks the best enemy within range of unit, by priority then distance:
// champions attacking allied champions, minions, structures, champions.
export function pickTarget(
  state: GameState,
  unit: Unit,
  range: number
): Unit | null {
  const priority = (target: Unit) => {
    if (isChampionAggressor(state, target)) return 0;
    switch (target.kind) {
      case "minion":
        return 1;
      case "structure":
        return 2;
      case "champion":
        return 3;
    }
  };
  let best: Unit | null = null;
  let bestKey: [number, number] = [Infinity, Infinity];
  for (const target of state.units) {
    // cheap checks first; this runs for every unit, every tick
    if (target.team === unit.team) {
      continue;
    }
    const dist = edgeDistance(unit, target);
    if (dist > range || !canAttack(state, unit, target)) {
      continue;
    }
    const key: [number, number] = [priority(target), dist];
    if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
      best = target;
      bestKey = key;
    }
  }
  return best;
}
