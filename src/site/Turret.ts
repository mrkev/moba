import * as ex from "excalibur";

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

    actorWithCircleCollider.on("collisionstart", console.log);

    this.addChild(actorWithCircleCollider);
  }
}
