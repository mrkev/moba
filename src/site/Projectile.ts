import * as ex from "excalibur";
import { Player } from "./Player";
import { calculateAngle } from "./utils";

export class Projectile extends ex.Actor {
  static velocity = 80;

  constructor(
    pos: ex.Vector,
    dir: number,
    velocity: number = Projectile.velocity,
    readonly shooter?: ex.Actor
  ) {
    const vx = velocity * Math.cos(dir);
    const vy = velocity * Math.sin(dir);

    super({
      pos,
      vel: ex.vec(vx, -vy), // y is flipped, negative y is up
      width: 3,
      height: 3,
      color: ex.Color.Yellow,
    }); // x, y, width, height
  }

  static shoot(from: ex.Actor, to: ex.Vector, params: { velocity: number }) {
    const dir = calculateAngle(from.pos, to);
    const projectile = new Projectile(from.pos, dir, params.velocity, from);

    // todo: nullthrows?
    from.scene?.add(projectile);
  }

  override onCollisionStart(
    self: ex.Collider,
    other: ex.Collider,
    side: ex.Side,
    contact: ex.CollisionContact
  ): void {
    const gotShot = other.owner;

    if (gotShot === this.shooter) {
      return;
    }
    console.log(other.owner, this.shooter);
    if (gotShot instanceof Player) {
      gotShot.recieveShot();
      this.kill();
    }
  }

  // Update method to move the projectile
  override onPostUpdate(engine: ex.Engine, delta: number): void {
    super.onPostUpdate(engine, delta);

    // todo: doesn't work, but should still add failsafe
    // // If the projectile goes off-screen, we can remove it or destroy it
    // if (
    //   this.pos.x < 0 ||
    //   this.pos.x > engine.drawWidth ||
    //   this.pos.y < 0 ||
    //   this.pos.y > engine.drawHeight
    // ) {
    //   this.kill(); // This will remove the projectile from the scene
    // }
  }
}
