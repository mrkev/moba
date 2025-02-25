import { Vector } from "excalibur";

export function calculateAngle(point1: Vector, point2: Vector): number {
  // Calculate the difference in the x and y coordinates
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;

  // Calculate the angle using Math.atan2
  const angle = Math.atan2(dy, dx);

  return -angle;
}
