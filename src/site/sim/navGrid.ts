import { MapData } from "./mapData";
import { GameState } from "./types";
import { add, distance, length, normalize, scale, sub, Vec } from "./vec";

// Walkability grid: the map's solid tiles plus tiles covered by standing
// structures.
export class NavGrid {
  constructor(
    readonly width: number,
    readonly height: number,
    readonly tileSize: number,
    readonly blocked: Uint8Array
  ) {}

  isBlockedTile(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) {
      return true;
    }
    return this.blocked[ty * this.width + tx] === 1;
  }

  tileOf(pos: Vec): { tx: number; ty: number } {
    return {
      tx: Math.floor(pos.x / this.tileSize),
      ty: Math.floor(pos.y / this.tileSize),
    };
  }

  tileCenter(tx: number, ty: number): Vec {
    return {
      x: (tx + 0.5) * this.tileSize,
      y: (ty + 0.5) * this.tileSize,
    };
  }

  // whether a circle at pos overlaps any blocked tile
  isBlocked(pos: Vec, radius: number): boolean {
    const ts = this.tileSize;
    const minTx = Math.floor((pos.x - radius) / ts);
    const maxTx = Math.floor((pos.x + radius) / ts);
    const minTy = Math.floor((pos.y - radius) / ts);
    const maxTy = Math.floor((pos.y + radius) / ts);
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (!this.isBlockedTile(tx, ty)) {
          continue;
        }
        // closest point of the tile to the circle's center
        const cx = Math.max(tx * ts, Math.min(pos.x, (tx + 1) * ts));
        const cy = Math.max(ty * ts, Math.min(pos.y, (ty + 1) * ts));
        if ((cx - pos.x) ** 2 + (cy - pos.y) ** 2 < radius * radius) {
          return true;
        }
      }
    }
    return false;
  }

  // Moves a circle by delta, sliding along blocked tiles. Returns the new
  // position.
  moveCircle(pos: Vec, delta: Vec, radius: number): Vec {
    const full = add(pos, delta);
    if (!this.isBlocked(full, radius)) {
      return full;
    }
    const xOnly = { x: pos.x + delta.x, y: pos.y };
    if (delta.x !== 0 && !this.isBlocked(xOnly, radius)) {
      return xOnly;
    }
    const yOnly = { x: pos.x, y: pos.y + delta.y };
    if (delta.y !== 0 && !this.isBlocked(yOnly, radius)) {
      return yOnly;
    }
    return pos;
  }

  // whether a circle can travel in a straight line from a to b
  lineOfSight(a: Vec, b: Vec, radius: number): boolean {
    const dist = distance(a, b);
    const steps = Math.ceil(dist / 4);
    const dir = normalize(sub(b, a));
    for (let i = 1; i <= steps; i++) {
      const p = add(a, scale(dir, Math.min(dist, i * 4)));
      if (this.isBlocked(p, radius)) {
        return false;
      }
    }
    return true;
  }

  // nearest unblocked tile to pos, searching outwards in rings
  nearestOpenTile(pos: Vec): { tx: number; ty: number } | null {
    const { tx, ty } = this.tileOf(pos);
    const maxRing = Math.max(this.width, this.height);
    for (let ring = 0; ring < maxRing; ring++) {
      let best: { tx: number; ty: number } | null = null;
      let bestDist = Infinity;
      for (let y = ty - ring; y <= ty + ring; y++) {
        for (let x = tx - ring; x <= tx + ring; x++) {
          const onRing =
            Math.abs(x - tx) === ring || Math.abs(y - ty) === ring;
          if (!onRing || this.isBlockedTile(x, y)) {
            continue;
          }
          const d = length(sub(this.tileCenter(x, y), pos));
          if (d < bestDist) {
            best = { tx: x, ty: y };
            bestDist = d;
          }
        }
      }
      if (best) {
        return best;
      }
    }
    return null;
  }
}

// Derived from state, so it isn't part of it; rebuilt when structures fall.
// Structures are never added mid-game, so their count tells when that is.
const cache = new WeakMap<
  GameState,
  { map: MapData; structureCount: number; grid: NavGrid }
>();

export function navGrid(state: GameState, map: MapData): NavGrid {
  let structureCount = 0;
  for (const unit of state.units) {
    if (unit.kind === "structure") structureCount++;
  }
  const cached = cache.get(state);
  if (
    cached &&
    cached.map === map &&
    cached.structureCount === structureCount
  ) {
    return cached.grid;
  }
  const structures = state.units.filter((u) => u.kind === "structure");

  const blocked = new Uint8Array(map.width * map.height);
  map.solid.forEach((solid, i) => (blocked[i] = solid ? 1 : 0));
  const ts = map.tileSize;
  for (const s of structures) {
    // tiles whose center falls inside the structure's footprint
    const minTx = Math.ceil((s.pos.x - s.radius) / ts - 0.5);
    const maxTx = Math.floor((s.pos.x + s.radius) / ts - 0.5);
    const minTy = Math.ceil((s.pos.y - s.radius) / ts - 0.5);
    const maxTy = Math.floor((s.pos.y + s.radius) / ts - 0.5);
    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (tx >= 0 && ty >= 0 && tx < map.width && ty < map.height) {
          blocked[ty * map.width + tx] = 1;
        }
      }
    }
  }

  const grid = new NavGrid(map.width, map.height, ts, blocked);
  cache.set(state, { map, structureCount, grid });
  return grid;
}
