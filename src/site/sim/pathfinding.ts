import { NavGrid } from "./navGrid";
import { Vec } from "./vec";

const SQRT2 = Math.SQRT2;

const NEIGHBORS: readonly [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, SQRT2],
  [1, -1, SQRT2],
  [-1, 1, SQRT2],
  [-1, -1, SQRT2],
];

function octile(ax: number, ay: number, bx: number, by: number) {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
}

// Binary min-heap of tile indices keyed by f-score.
class Heap {
  private items: number[] = [];
  constructor(private readonly score: Float64Array) {}

  get size() {
    return this.items.length;
  }

  push(item: number) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.score[items[parent]] <= this.score[items[i]]) {
        break;
      }
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop(): number {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        const score = (i: number) => this.score[items[i]];
        if (l < items.length && score(l) < score(smallest)) {
          smallest = l;
        }
        if (r < items.length && score(r) < score(smallest)) {
          smallest = r;
        }
        if (smallest === i) {
          break;
        }
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

// A* over the grid's tiles (8 directions, no cutting corners), smoothed
// into straight segments a circle of the given radius can walk. Returns the
// waypoints to follow after `from`, ending at `to` (or the nearest open
// tile to it), or null if `to` can't be reached.
export function findPath(
  grid: NavGrid,
  from: Vec,
  to: Vec,
  radius: number
): Vec[] | null {
  const start = grid.tileOf(from);
  const goal = grid.isBlockedTile(grid.tileOf(to).tx, grid.tileOf(to).ty)
    ? grid.nearestOpenTile(to)
    : grid.tileOf(to);
  if (goal == null) {
    return null;
  }
  const goalPos = grid.isBlocked(to, radius)
    ? grid.tileCenter(goal.tx, goal.ty)
    : to;

  if (grid.lineOfSight(from, goalPos, radius)) {
    return [goalPos];
  }

  const w = grid.width;
  const n = grid.width * grid.height;
  const gScore = new Float64Array(n).fill(Infinity);
  const fScore = new Float64Array(n).fill(Infinity);
  const cameFrom = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const open = new Heap(fScore);

  const startIdx = start.ty * w + start.tx;
  const goalIdx = goal.ty * w + goal.tx;
  gScore[startIdx] = 0;
  fScore[startIdx] = octile(start.tx, start.ty, goal.tx, goal.ty);
  open.push(startIdx);

  while (open.size > 0) {
    const current = open.pop();
    if (current === goalIdx) {
      break;
    }
    if (closed[current]) {
      continue;
    }
    closed[current] = 1;
    const cx = current % w;
    const cy = (current - cx) / w;
    for (const [dx, dy, cost] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (grid.isBlockedTile(nx, ny)) {
        continue;
      }
      // no squeezing diagonally between two blocked tiles
      if (
        dx !== 0 &&
        dy !== 0 &&
        (grid.isBlockedTile(cx + dx, cy) || grid.isBlockedTile(cx, cy + dy))
      ) {
        continue;
      }
      const next = ny * w + nx;
      const g = gScore[current] + cost;
      if (g < gScore[next]) {
        gScore[next] = g;
        fScore[next] = g + octile(nx, ny, goal.tx, goal.ty);
        cameFrom[next] = current;
        open.push(next);
      }
    }
  }

  if (cameFrom[goalIdx] === -1 && goalIdx !== startIdx) {
    return null;
  }

  const tiles: Vec[] = [];
  for (let i = goalIdx; i !== startIdx && i !== -1; i = cameFrom[i]) {
    tiles.push(grid.tileCenter(i % w, Math.floor(i / w)));
  }
  tiles.reverse();
  tiles[tiles.length - 1] = goalPos;

  // string pulling: skip waypoints there's a clear line past
  const path: Vec[] = [];
  let anchor = from;
  let i = 0;
  while (i < tiles.length) {
    let furthest = i;
    for (let j = tiles.length - 1; j > i; j--) {
      if (grid.lineOfSight(anchor, tiles[j], radius)) {
        furthest = j;
        break;
      }
    }
    path.push(tiles[furthest]);
    anchor = tiles[furthest];
    i = furthest + 1;
  }
  return path;
}
