import * as ex from "excalibur";
import { Player } from "./Player";
import { Projectile } from "./Projectile";
import { Team } from "./Team";

export type TurretKind = "outer" | "inner" | "base" | "nexus";

// [column, row] in the towers sprite sheet
const turretSprites: Record<TurretKind, [number, number]> = {
  outer: [3, 2],
  inner: [3, 2],
  base: [6, 0],
  nexus: [6, 0],
};

export class Turret extends ex.Actor {
  static readonly sprite = new ex.ImageSource(
    "assets/rift/Tilesets/TilesetTowers.png"
  );

  static readonly spriteSheet = ex.SpriteSheet.fromImageSource({
    image: Turret.sprite,
    grid: {
      columns: 12,
      rows: 3,
      spriteHeight: 32,
      spriteWidth: 32,
    },
  });

  public magicPower = 10;
  public range = 50;
  // ms between shots
  public attackInterval = 1000;
  private cooldown = 0;

  constructor(
    readonly kind: TurretKind,
    pos: ex.Vector,
    readonly team: Team
  ) {
    super({
      pos: pos,
      width: 32,
      height: 32,
      color: ex.Color.Brown,
      collisionType: ex.CollisionType.Fixed,
    });

    this.graphics.use(Turret.spriteSheet.getSprite(...turretSprites[kind]));

    const rangeIndicator = new ex.Actor({ pos: ex.vec(0, 0) });
    rangeIndicator.graphics.use(
      new ex.Circle({
        radius: this.range,
        color: ex.Color.Transparent,
        strokeColor: ex.Color.Red,
        lineWidth: 1,
      })
    );
    this.addChild(rangeIndicator);
  }

  private findTarget(): Player | null {
    let target: Player | null = null;
    let targetDist = this.range;
    for (const actor of this.scene?.actors ?? []) {
      if (
        !(actor instanceof Player) ||
        actor.dead ||
        actor.team === this.team
      ) {
        continue;
      }
      const dist = actor.pos.distance(this.pos);
      if (dist <= targetDist) {
        target = actor;
        targetDist = dist;
      }
    }
    return target;
  }

  override onPostUpdate(_engine: ex.Engine, delta: number): void {
    this.cooldown = Math.max(0, this.cooldown - delta);
    if (this.cooldown > 0) {
      return;
    }
    const target = this.findTarget();
    if (target == null) {
      return;
    }
    Projectile.shoot(this, target.pos, {
      velocity: 100,
      damage: this.magicPower,
    });
    this.cooldown = this.attackInterval;
  }
}
