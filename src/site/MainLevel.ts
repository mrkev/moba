import { FactoryProps, TiledResource } from "@excaliburjs/plugin-tiled";
import * as ex from "excalibur";
import { Bird } from "./Bird";

export const tiledMap = new TiledResource("./assets/rift/rift.tmx", {
  useTilemapCameraStrategy: true,
  entityClassNameFactories: {
    "player-start": (props: FactoryProps) => {
      return new Bird({
        pos: props.worldPos,
      });
    },
  },
});

export class MainLevel extends ex.Scene {
  bird: Bird = new Bird({ pos: ex.vec(200, 300) });

  override onInitialize(): void {
    tiledMap.addToScene(this);

    this.add(this.bird);

    // game.input.keyboard.on("hold", (e) => {
    //   switch (e.key) {
    //     case ex.Keys.Left:
    //       this.bird.vel.x = -10;
    //       break;
    //     case ex.Keys.Right:
    //       this.bird.vel.x = 10;
    //       break;
    //     case ex.Keys.Up:
    //       this.bird.vel.y = -10;
    //       break;
    //     case ex.Keys.Down:
    //       this.bird.vel.y = 10;
    //       break;
    //     // case 189: // -
    //     //   camStrat.target.right -= 10;
    //     //   break;
    //     // case 187: // =
    //     //   camStrat.target.right += 10;
    //     //   break;
    //     default:
    //       console.log("Pressed", e.key);
    //   }
    // });
    // game.input.keyboard.on("release", () => {
    //   this.bird.vel.x = 0;
    //   this.bird.vel.y = 0;
    // });

    // this.ground = new Ground(ex.vec(0, engine.screen.drawHeight - 64));
    // this.add(this.ground);
    // const topPipe = new Pipe(ex.vec(engine.screen.drawWidth, 150), "top");
    // this.add(topPipe);
    // const bottomPipe = new Pipe(ex.vec(engine.screen.drawWidth, 300), "bottom");
    // this.add(bottomPipe);
  }
}
