// Plain-data 2D vectors, so game state stays serializable. Screen space: y
// grows downwards.
export interface Vec {
  x: number;
  y: number;
}

export function vec(x: number, y: number): Vec {
  return { x, y };
}

export function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Vec, s: number): Vec {
  return { x: a.x * s, y: a.y * s };
}

// (Math.hypot is much slower, and this runs a lot)
export function length(a: Vec): number {
  return Math.sqrt(a.x * a.x + a.y * a.y);
}

export function distance(a: Vec, b: Vec): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function normalize(a: Vec): Vec {
  const len = length(a);
  return len === 0 ? { x: 0, y: 0 } : { x: a.x / len, y: a.y / len };
}

export function isZero(a: Vec): boolean {
  return a.x === 0 && a.y === 0;
}
