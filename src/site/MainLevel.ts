import { FactoryProps, TiledResource } from "@excaliburjs/plugin-tiled";
import * as ex from "excalibur";
import { facing, Player } from "./Player";
import { Cavegirl2 } from "./Cavegirl2";
import { Turret } from "./Turret";
import { calculateAngle } from "./utils";

const cavegirl2Def = new Cavegirl2();

export const riftTilemapResource = new TiledResource("./assets/rift/rift.tmx", {
  useTilemapCameraStrategy: true,
  entityClassNameFactories: {
    "player-start": (props: FactoryProps) => {
      return new Player(
        {
          pos: props.worldPos,
        },
        cavegirl2Def
      );
    },
    "turret-outer": (props: FactoryProps) => {
      console.log(props.object);
      return new Turret("outer", props.worldPos);
    },
  },
});

export class SwordAttack extends ex.Actor {
  constructor() {
    super({
      pos: ex.vec(0, 0),
      color: ex.Color.Red,
      width: 2,
      height: 10,
    });
  }

  override onInitialize(engine: ex.Engine): void {
    const animation = new ex.Animation({
      strategy: ex.AnimationStrategy.End,
      frames: [
        {
          graphic: new ex.Rectangle({
            color: ex.Color.Red,
            width: 2,
            height: 10,
          }),
          duration: 500,
        },
      ],
    });
    this.graphics.use(animation);
  }
}

export class MainLevel extends ex.Scene {
  mainPlayer: Player = new Player({ pos: ex.vec(120, 120) }, cavegirl2Def);

  override onInitialize(game: ex.Engine): void {
    riftTilemapResource.addToScene(this);
    this.add(this.mainPlayer);

    // this.mainPlayer.addChild(new SwordAttack());

    game.currentScene.camera.strategy.lockToActor(this.mainPlayer);
    const firstLayer = riftTilemapResource.getTileLayers()[0];
    if (firstLayer) {
      const mapBounds = ex.BoundingBox.fromDimension(
        riftTilemapResource.map.width * riftTilemapResource.map.tilewidth,
        riftTilemapResource.map.height * riftTilemapResource.map.tileheight,
        ex.Vector.Zero,
        firstLayer.tilemap.pos
      );
      game.currentScene.camera.strategy.limitCameraBounds(mapBounds);
    }

    game.input.pointers.primary.on("wheel", (wheelEvent) => {
      // wheel up
      if (wheelEvent.deltaY < 0) {
        game.currentScene.camera.zoom *= 1.01;
      } else {
        game.currentScene.camera.zoom /= 1.01;
      }
    });

    game.input.keyboard.on("press", (e) => {
      switch (e.key) {
        case ex.Keys.Q:
        case ex.Keys.W:
        case ex.Keys.E:
        case ex.Keys.R: {
          const projectile = new Projectile(
            this.mainPlayer.pos,
            this.mainPlayer.facing
          );

          this.add(projectile);
          this.mainPlayer.animAttack();
          game.currentScene.camera.shake(3, 3, 100);
        }
        // default:
        //   console.log()
        //
      }
    });

    game.input.pointers.on("down", (e) => {
      if (e.button === ex.PointerButton.Right) {
        // this.mainPlayer
        console.log("move to", e.coordinates.worldPos);
      }
      if (e.button === ex.PointerButton.Left) {
        // this.mainPlayer
        console.log("move to", e.coordinates.worldPos);
        Projectile.shoot(this.mainPlayer, e.worldPos, { velocity: 30 });
      }
    });

    game.input.keyboard.on("hold", (e) => {
      const char = this.mainPlayer.character;
      switch (e.key) {
        case ex.Keys.Left:
          this.mainPlayer.vel.x = -50;
          this.mainPlayer.facing = facing("left");
          this.mainPlayer.graphics.use(char.animWalk.left);
          break;
        case ex.Keys.Right:
          this.mainPlayer.vel.x = 50;
          this.mainPlayer.facing = facing("right");
          this.mainPlayer.graphics.use(char.animWalk.right);

          break;
        case ex.Keys.Up:
          this.mainPlayer.vel.y = -50;
          this.mainPlayer.facing = facing("up");
          this.mainPlayer.graphics.use(char.animWalk.up);
          break;
        case ex.Keys.Down:
          this.mainPlayer.vel.y = 50;
          this.mainPlayer.facing = facing("down");
          this.mainPlayer.graphics.use(char.animWalk.down);
          break;
        // case 189: // -
        //   camStrat.target.right -= 10;
        //   break;
        // case 187: // =
        //   camStrat.target.right += 10;
        //   break;
        default:
        // console.log("Pressed", e.key);
      }
    });

    game.input.keyboard.on("release", () => {
      this.mainPlayer.vel.x = 0;
      this.mainPlayer.vel.y = 0;
      this.mainPlayer.animIdle();
    });

    // this.ground = new Ground(ex.vec(0, engine.screen.drawHeight - 64));
    // this.add(this.ground);
    // const topPipe = new Pipe(ex.vec(engine.screen.drawWidth, 150), "top");
    // this.add(topPipe);
    // const bottomPipe = new Pipe(ex.vec(engine.screen.drawWidth, 300), "bottom");
    // this.add(bottomPipe);
  }
}

class Projectile extends ex.Actor {
  static velocity = 80;

  constructor(
    pos: ex.Vector,
    dir: number,
    velocity: number = Projectile.velocity,
    readonly shooter?: ex.Actor
  ) {
    const vx = velocity * Math.cos(dir);
    const vy = velocity * Math.sin(dir);

    console.log("dir", dir, { vx, vy });

    super({
      pos,
      vel: ex.vec(vx, -vy), // y is flipped, negative y is up
      width: 10,
      height: 10,
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

    // If the projectile goes off-screen, we can remove it or destroy it
    if (
      this.pos.x < 0 ||
      this.pos.x > engine.drawWidth ||
      this.pos.y < 0 ||
      this.pos.y > engine.drawHeight
    ) {
      this.kill(); // This will remove the projectile from the scene
    }
  }
}
