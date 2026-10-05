import { perTick, REPATH_INTERVAL } from "./constants";
import { MapData } from "./mapData";
import { navGrid } from "./navGrid";
import { findPath } from "./pathfinding";
import { GameState, Mobile } from "./types";
import { distance, isZero, normalize, scale, sub, Vec } from "./vec";
import { isAlive } from "./world";

export function stopMoving(unit: Mobile) {
  unit.moving = false;
  unit.path = [];
  unit.pathGoal = null;
}

// Moves in a direction, sliding along obstacles (e.g. arrow keys).
export function moveInDirection(
  state: GameState,
  map: MapData,
  unit: Mobile,
  dir: Vec
) {
  stopMoving(unit);
  if (isZero(dir)) {
    return;
  }
  const grid = navGrid(state, map);
  const delta = scale(normalize(dir), perTick(unit.moveSpeed));
  unit.pos = grid.moveCircle(unit.pos, delta, unit.radius);
  unit.facing = normalize(dir);
  unit.moving = true;
}

// Walks towards goal along a path, recomputing it as the goal moves. Returns
// true once within stopWithin of the goal, or as close as it can get when the
// goal itself can't be stood on or reached.
export function moveTowards(
  state: GameState,
  map: MapData,
  unit: Mobile,
  goal: Vec,
  stopWithin: number
): boolean {
  if (distance(unit.pos, goal) <= stopWithin) {
    stopMoving(unit);
    return true;
  }

  const grid = navGrid(state, map);
  const needsPath = unit.path.length === 0 || goalMovedSincePath(unit, goal);
  if (needsPath && grid.lineOfSight(unit.pos, goal, unit.radius)) {
    // straight shot, no need to wait to pathfind
    unit.path = [{ ...goal }];
    unit.pathGoal = { ...goal };
  } else if (needsPath && unit.repathIn <= 0) {
    const path = findPath(grid, unit.pos, goal, unit.radius);
    unit.repathIn = REPATH_INTERVAL;
    if (path == null) {
      stopMoving(unit);
      return true;
    }
    unit.path = path;
    unit.pathGoal = { ...goal };
  }

  let budget = perTick(unit.moveSpeed);
  const start = unit.pos;
  while (budget > 0 && unit.path.length > 0) {
    const next = unit.path[0];
    const toNext = sub(next, unit.pos);
    const d = distance(unit.pos, next);
    const stepLen = Math.min(d, budget);
    if (d > 0) {
      unit.facing = normalize(toNext);
    }
    unit.pos = grid.moveCircle(
      unit.pos,
      scale(normalize(toNext), stepLen),
      unit.radius
    );
    budget -= stepLen;
    if (distance(unit.pos, next) < 0.5) {
      unit.path.shift();
      if (unit.path.length === 0 && !goalMovedSincePath(unit, goal)) {
        // end of the path is as close as we can get
        unit.moving = true;
        unit.pathGoal = null;
        return true;
      }
    } else {
      break;
    }
  }

  unit.moving = distance(start, unit.pos) > 0;
  if (!unit.moving) {
    // stuck or out of path; look for a new one when allowed
    unit.path = [];
  }
  return distance(unit.pos, goal) <= stopWithin;
}

function goalMovedSincePath(unit: Mobile, goal: Vec): boolean {
  return unit.pathGoal == null || distance(unit.pathGoal, goal) > 8;
}

// Pushes overlapping mobile units apart so they don't stack up.
export function separateUnits(state: GameState, map: MapData) {
  const grid = navGrid(state, map);
  const mobiles = state.units.filter(
    (u): u is Mobile => u.kind !== "structure" && isAlive(u)
  );
  for (let i = 0; i < mobiles.length; i++) {
    for (let j = i + 1; j < mobiles.length; j++) {
      const a = mobiles[i];
      const b = mobiles[j];
      const minDist = a.radius + b.radius;
      const d = distance(a.pos, b.pos);
      if (d >= minDist) {
        continue;
      }
      // perfectly stacked units get pushed apart along x
      const normal = d === 0 ? { x: 1, y: 0 } : normalize(sub(b.pos, a.pos));
      // gently, so crowds settle over a few ticks
      const push = Math.min((minDist - d) / 2, 0.5);
      a.pos = grid.moveCircle(a.pos, scale(normal, -push), a.radius);
      b.pos = grid.moveCircle(b.pos, scale(normal, push), b.radius);
    }
  }
}
