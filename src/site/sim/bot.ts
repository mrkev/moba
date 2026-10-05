import { canCast, canLevelAbility, abilityDef } from "./abilities";
import { FOUNTAIN_RADIUS } from "./constants";
import { ITEMS } from "./items";
import { canShop } from "./progression";
import {
  AbilitySlot,
  Champion,
  Command,
  GameState,
  ItemId,
  Lane,
  PlayerId,
  PlayerInput,
  Structure,
  Team,
  Unit,
} from "./types";
import { add, distance, normalize, scale, sub, Vec } from "./vec";
import { championOf, edgeDistance, isAlive, isVulnerable } from "./world";

const LEVEL_ORDER: AbilitySlot[] = ["r", "q", "e", "w"];
const BUILD: ItemId[] = [
  "longSword",
  "dagger",
  "clothArmor",
  "bfSword",
  "rubyCrystal",
  "chainVest",
];
// decide this often, in ticks
const THINK_INTERVAL = 6;

const NO_INPUT = (): PlayerInput => ({ move: { x: 0, y: 0 }, commands: [] });

function enemyTurrets(state: GameState, team: Team): Structure[] {
  return state.units.filter(
    (u): u is Structure =>
      u.kind === "structure" &&
      u.structure === "turret" &&
      u.team !== team &&
      isAlive(u)
  );
}

// whether standing at pos would get us shot by an enemy turret that isn't
// busy shooting minions
function dangerous(state: GameState, champ: Champion, pos: Vec): boolean {
  return enemyTurrets(state, champ.team).some((turret) => {
    const reach = turret.attack!.range + turret.radius + champ.radius + 8;
    if (distance(pos, turret.pos) > reach) {
      return false;
    }
    const target = state.units.find((u) => u.id === turret.targetId);
    return target?.kind !== "minion" || champ.hp < champ.maxHp * 0.5;
  });
}

// the first spot from `from` towards our fountain that no turret covers
function safeSpot(state: GameState, champ: Champion, from: Vec): Vec {
  const home = state.fountains[champ.team];
  const dir = normalize(sub(home, from));
  const steps = Math.ceil(distance(from, home) / 16);
  for (let i = 0; i <= steps; i++) {
    const spot = add(from, scale(dir, i * 16));
    if (!dangerous(state, champ, spot)) {
      return spot;
    }
  }
  return home;
}

// where we'd stand to attack target
function attackSpot(champ: Champion, target: Unit): Vec {
  const range = champ.attack!.range + champ.radius + target.radius;
  if (distance(champ.pos, target.pos) <= range) {
    return champ.pos;
  }
  return add(target.pos, scale(normalize(sub(champ.pos, target.pos)), range));
}

// the furthest-forward allied minion in the lane, or our furthest turret
function laneFront(state: GameState, champ: Champion, lane: Lane): Vec {
  const path = state.lanePaths[champ.team][lane];
  const enemyNexus = path[path.length - 1];
  let front: Vec | null = null;
  for (const unit of state.units) {
    if (
      unit.kind === "minion" &&
      unit.team === champ.team &&
      unit.lane === lane &&
      (front == null ||
        distance(unit.pos, enemyNexus) < distance(front, enemyNexus))
    ) {
      front = unit.pos;
    }
  }
  if (front == null) {
    // the lane's own turrets come first in the path, base to outer
    const turrets = state.units.filter(
      (u): u is Structure =>
        u.kind === "structure" &&
        u.team === champ.team &&
        u.lane === lane &&
        isAlive(u)
    );
    const outermost = turrets.sort(
      (a, b) => distance(a.pos, enemyNexus) - distance(b.pos, enemyNexus)
    )[0];
    front = outermost?.pos ?? state.fountains[champ.team];
  }
  // hang back a little behind the wave
  const home = state.fountains[champ.team];
  return add(front, scale(normalize(sub(home, front)), 20));
}

function moveCommand(champ: Champion, to: Vec): Command | null {
  const order = champ.order;
  if (order.type === "move" && distance(order.to, to) < 16) {
    return null;
  }
  if (order.type === "idle" && distance(champ.pos, to) < 8) {
    return null;
  }
  return { type: "smartClick", pos: to };
}

function attackCommand(champ: Champion, target: Unit): Command | null {
  const order = champ.order;
  if (order.type === "attack" && order.targetId === target.id) {
    return null;
  }
  return { type: "smartClick", pos: target.pos };
}

// Plays a champion: farms and fights in a lane, respects turrets, retreats
// when hurt, levels abilities and shops. Produces the same input a player
// would, so it's deterministic and runs in step like any other player.
export function botInput(
  state: GameState,
  playerId: PlayerId,
  lane: Lane = "mid"
): PlayerInput {
  const input = NO_INPUT();
  const champ = championOf(state, playerId);
  if (champ == null || (state.tick + playerId) % THINK_INTERVAL !== 0) {
    return input;
  }
  const commands = input.commands;

  const toLevel = LEVEL_ORDER.find((slot) => canLevelAbility(champ, slot));
  if (toLevel) {
    commands.push({ type: "levelAbility", slot: toLevel });
  }

  if (canShop(state, champ) && champ.items.includes(null)) {
    const owned = champ.items.filter((i) => i != null);
    const next = BUILD.find(
      (item) =>
        owned.filter((i) => i === item).length <
          BUILD.filter((i) => i === item).length &&
        ITEMS[item].cost <= champ.gold
    );
    if (next) {
      commands.push({ type: "buy", item: next });
    }
  }

  if (champ.dead || champ.recallLeft != null || champ.dash != null) {
    return input;
  }

  const fountain = state.fountains[champ.team];
  const atFountain = distance(champ.pos, fountain) <= FOUNTAIN_RADIUS;
  const enemies = state.units.filter(
    (u) => u.team !== champ.team && isAlive(u)
  );
  const nearbyEnemyChampion = enemies.find(
    (u) => u.kind === "champion" && distance(u.pos, champ.pos) < 100
  );

  // heal up before heading back out
  if (atFountain && champ.hp < champ.maxHp * 0.9) {
    const stay = moveCommand(champ, champ.pos);
    if (stay) commands.push(stay);
    return input;
  }
  if (champ.hp < champ.maxHp * 0.3) {
    if (nearbyEnemyChampion == null && !dangerous(state, champ, champ.pos)) {
      commands.push({ type: "recall" });
    } else {
      const flee = moveCommand(champ, fountain);
      if (flee) commands.push(flee);
    }
    return input;
  }

  const minionsOnUs = enemies.filter(
    (u) => u.kind === "minion" && u.targetId === champ.id
  ).length;
  // a turret is free to shoot us here, or a wave is on us: back off
  if (dangerous(state, champ, champ.pos)) {
    const away = moveCommand(champ, safeSpot(state, champ, champ.pos));
    if (away) commands.push(away);
    return input;
  }
  if (minionsOnUs >= 2) {
    const home = state.fountains[champ.team];
    const back = add(champ.pos, scale(normalize(sub(home, champ.pos)), 48));
    const away = moveCommand(champ, safeSpot(state, champ, back));
    if (away) commands.push(away);
    return input;
  }

  const cast = (slot: AbilitySlot, target: Vec) => {
    if (canCast(champ, slot)) {
      commands.push({ type: "cast", slot, target });
    }
  };

  // Fight champions that wander close, unless it means diving a turret or
  // pulling a wave of minions onto us (worth it for a likely kill).
  const enemyMinionsNear = (pos: Vec) =>
    enemies.filter((u) => u.kind === "minion" && distance(u.pos, pos) < 70)
      .length;
  const enemyChampion = enemies.find(
    (u): u is Champion =>
      u.kind === "champion" &&
      edgeDistance(champ, u) <= champ.attack!.range + 40 &&
      !dangerous(state, champ, attackSpot(champ, u)) &&
      (enemyMinionsNear(attackSpot(champ, u)) <= 2 || u.hp < u.maxHp * 0.3)
  );
  if (enemyChampion) {
    const dist = distance(champ.pos, enemyChampion.pos);
    if (dist <= abilityDef(champ, "q").range) cast("q", enemyChampion.pos);
    if (dist <= abilityDef(champ, "r").range) cast("r", enemyChampion.pos);
    cast("w", champ.pos);
    const attack = attackCommand(champ, enemyChampion);
    if (attack) commands.push(attack);
    return input;
  }

  // farm: lowest health minion first, then structures our minions are on
  const reachable = (u: Unit) =>
    edgeDistance(champ, u) <= champ.attack!.range + 60 &&
    !dangerous(state, champ, attackSpot(champ, u));
  const minion = enemies
    .filter((u) => u.kind === "minion" && reachable(u))
    .sort((a, b) => a.hp - b.hp)[0];
  const structure = enemies.find(
    (u): u is Structure =>
      u.kind === "structure" && isVulnerable(state, u) && reachable(u)
  );
  const target = minion ?? structure;
  if (target) {
    const attack = attackCommand(champ, target);
    if (attack) commands.push(attack);
    return input;
  }

  const front = safeSpot(state, champ, laneFront(state, champ, lane));
  const move = moveCommand(champ, front);
  if (move) commands.push(move);
  return input;
}
