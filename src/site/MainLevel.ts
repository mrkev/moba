import { FactoryProps, TiledResource } from "@excaliburjs/plugin-tiled";
import * as ex from "excalibur";
import { Player } from "./Player";
import { Cavegirl2 } from "./champions/Cavegirl2";
import { Turret } from "./Turret";
import { Projectile } from "./Projectile";

const cavegirl2Def = new Cavegirl2();

// set from the map's "player-start" object when the map is added to a scene
let playerSpawn = ex.vec(120, 120);

export const riftTilemapResource = new TiledResource("./assets/rift/rift.tmx", {
  useTilemapCameraStrategy: true,
  entityClassNameFactories: {
    "player-start": (props: FactoryProps) => {
      playerSpawn = props.worldPos;
      return undefined;
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
  mainPlayer: Player = new Player({ pos: ex.vec(0, 0) }, cavegirl2Def);

  override onInitialize(game: ex.Engine): void {
    riftTilemapResource.addToScene(this);
    this.mainPlayer.pos = playerSpawn.clone();
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
            this.mainPlayer.facing,
            Projectile.velocity,
            10,
            this.mainPlayer
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
        Projectile.shoot(this.mainPlayer, e.worldPos, {
          velocity: 30,
          damage: this.mainPlayer.magicPower,
        });
      }
    });
  }

  override onPreUpdate(game: ex.Engine): void {
    const keyboard = game.input.keyboard;
    const dir = ex.vec(0, 0);
    if (keyboard.isHeld(ex.Keys.Left)) dir.x -= 1;
    if (keyboard.isHeld(ex.Keys.Right)) dir.x += 1;
    if (keyboard.isHeld(ex.Keys.Up)) dir.y -= 1;
    if (keyboard.isHeld(ex.Keys.Down)) dir.y += 1;
    this.mainPlayer.move(dir);
  }
}
