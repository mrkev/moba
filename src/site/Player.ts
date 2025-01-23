import * as ex from "excalibur";
import { Pipe } from "./excalibur";
import { Ground } from "./Ground";
import { ChampionDef } from "./Cavegirl2";

type Dir = "left" | "right" | "up" | "down";

// radians
// - starts on x axis, counterclockwise
// - 2pi is a circle
export function facing(
  angle: number | "left" | "right" | "up" | "down"
): number {
  switch (angle) {
    case "right":
      return 0;
    case "up":
      return Math.PI / 2;
    case "left":
      return Math.PI;
    case "down":
      return (Math.PI * 3) / 2;
    default:
      return (angle * Math.PI) / 180;
  }
}

export function dirFacing(radians: number): Dir {
  const mpi4 = Math.PI / 4;
  if (radians > mpi4 * 1 && radians < mpi4 * 3) {
    return "up";
  } else if (radians > mpi4 * 3 && radians < mpi4 * 5) {
    return "left";
  } else if (radians > mpi4 * 5 && radians < mpi4 * 7) {
    return "down";
  } else {
    return "right";
  }
}

export class Player extends ex.Actor {
  public facing = facing("down");

  constructor(
    { pos }: { pos: ex.Vector },
    public readonly character: ChampionDef
  ) {
    super({
      pos: pos,
      width: 16, // for now we'll use a box so we can see the rotation
      height: 16, // later we'll use a circle collider
      color: ex.Color.Yellow,
      collisionType: ex.CollisionType.Active,
    });
  }

  animWalk() {
    this.graphics.use(this.character.animWalk[dirFacing(this.facing)]);
  }

  animIdle() {
    this.graphics.use(this.character.animIdle[dirFacing(this.facing)]);
  }

  animAttack() {
    this.graphics.use(this.character.animAttack[dirFacing(this.facing)]);
  }

  override onInitialize(engine: ex.Engine): void {
    this.graphics.use(this.character.animIdle.down);
  }

  override onCollisionStart(_self: ex.Collider, other: ex.Collider): void {
    if (other.owner instanceof Ground || other.owner instanceof Pipe) {
      this.stop();
    }
  }

  stop() {
    this.vel = ex.vec(0, 0);
    this.acc = ex.vec(0, 0);
  }

  jumping = false;
  private isInputActive(engine: ex.Engine) {
    // if the space bar or the first pointer was down
    return false;
    return (
      engine.input.keyboard.isHeld(ex.Keys.Space) ||
      engine.input.pointers.isDown(0)
    );
  }

  override onPostUpdate(engine: ex.Engine): void {
    if (!this.jumping && this.isInputActive(engine)) {
      this.vel.y += -800; // negative is UP
      this.jumping = true;
    }
    if (!this.isInputActive(engine)) {
      this.jumping = false;
    }
    // keep velocity from getting too big
    this.vel.y = ex.clamp(this.vel.y, -500, 500);
    // The "speed" the bird will move relative to pipes
    this.rotation = ex.vec(200, this.vel.y).toAngle();
  }
}
