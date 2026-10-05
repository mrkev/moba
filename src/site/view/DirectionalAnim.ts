import * as ex from "excalibur";

export type DirectionalAnim = {
  up: ex.Animation;
  down: ex.Animation;
  left: ex.Animation;
  right: ex.Animation;
};

export function directionalAnims(
  spriteSheet: ex.SpriteSheet,
  {
    down,
    up,
    left,
    right,
  }: { down: number[]; up: number[]; left: number[]; right: number[] }
) {
  return {
    down: ex.Animation.fromSpriteSheet(spriteSheet, down, 200),
    up: ex.Animation.fromSpriteSheet(spriteSheet, up, 200),
    left: ex.Animation.fromSpriteSheet(spriteSheet, left, 200),
    right: ex.Animation.fromSpriteSheet(spriteSheet, right, 200),
  };
}

// Animations hold playback state, so each actor needs its own copy
export function cloneDirectionalAnim(anim: DirectionalAnim): DirectionalAnim {
  return {
    down: anim.down.clone(),
    up: anim.up.clone(),
    left: anim.left.clone(),
    right: anim.right.clone(),
  };
}

export type Dir = keyof DirectionalAnim;

// Screen-space facing vector (y down) to the closest of the four directions;
// exact diagonals resolve to left/right.
export function dirOf(facing: { x: number; y: number }): Dir {
  if (Math.abs(facing.x) >= Math.abs(facing.y)) {
    return facing.x < 0 ? "left" : "right";
  }
  return facing.y < 0 ? "up" : "down";
}
