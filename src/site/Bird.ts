import * as ex from "excalibur";
import { Pipe } from "./excalibur";
import { Ground } from "./Ground";

export class Bird extends ex.Actor {
  constructor({ pos }: { pos: ex.Vector }) {
    super({
      pos: pos,
      width: 16, // for now we'll use a box so we can see the rotation
      height: 16, // later we'll use a circle collider
      color: ex.Color.Yellow,
    });
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
