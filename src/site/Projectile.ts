import * as ex from "excalibur";
import { Player } from "./Player";
import { HasTeam } from "./Team";
import { calculateAngle } from "./utils";

export class Projectile extends ex.Actor {
  static velocity = 80;
  // how far a projectile travels before disappearing
  static maxDistance = 150;

  private readonly origin: ex.Vector;

  constructor(
    pos: ex.Vector,
    dir: number,
    velocity: number = Projectile.velocity,
    readonly damage: number,
    readonly shooter: ex.Actor & HasTeam
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
    this.origin = pos.clone();
  }

  static shoot(
    from: ex.Actor & HasTeam,
    to: ex.Vector,
    params: {
      velocity: number;
      damage: number;
    }
  ) {
    const dir = calculateAngle(from.pos, to);
    const projectile = new Projectile(
      from.pos,
      dir,
      params.velocity,
      params.damage,
      from
    );

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

    if (gotShot instanceof Player && gotShot.team !== this.shooter.team) {
      gotShot.takeDamage(this.damage);
      this.kill();
    }
  }

  override onPostUpdate(engine: ex.Engine, delta: number): void {
    super.onPostUpdate(engine, delta);
    if (this.pos.distance(this.origin) > Projectile.maxDistance) {
      this.kill();
    }
  }
}
