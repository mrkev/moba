import * as ex from "excalibur";
import { Player } from "./Player";
import { Projectile } from "./Projectile";

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

  constructor(readonly kind: "outer", pos: ex.Vector) {
    super({
      pos: pos,
      width: 32,
      height: 32,
      color: ex.Color.Brown,
      collisionType: ex.CollisionType.Fixed,
    });

    switch (kind) {
      case "outer":
        this.graphics.use(Turret.spriteSheet.getSprite(3, 2));
    }

    const actorWithCircleCollider = new ex.Actor({
      pos: ex.vec(0, 0),
      radius: 50,
      color: ex.Color.Red,
      collisionType: ex.CollisionType.Passive,
    });

    actorWithCircleCollider.on("collisionstart", (e) => {
      const actor = e.other.owner;
      if (actor instanceof Player) {
        console.log("HERE");
        Projectile.shoot(this, actor.pos, {
          velocity: 100,
          damage: this.magicPower,
        });
      } else {
        console.log(e.other.owner);
      }
    });

    this.addChild(actorWithCircleCollider);
  }
}
