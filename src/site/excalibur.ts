import * as ex from "excalibur";
import { MainLevel, riftTilemapResource } from "./MainLevel";
import { Cavegirl2 } from "./champions/Cavegirl2";
import { Turret } from "./Turret";

export const Config = {
  BirdStartPos: ex.vec(200, 300),
  BirdAcceleration: 1200,
  BirdJumpVelocity: -800,
  BirdMinVelocity: -500,
  BirdMaxVelocity: 500,
  PipeSpeed: 200,
  PipeInterval: 1500,
  PipeGap: 150,
} as const;

export class Pipe extends ex.Actor {
  constructor(pos: ex.Vector, public type: "top" | "bottom") {
    super({
      pos,
      width: 32,
      height: 1000,
      anchor:
        type === "bottom"
          ? ex.vec(0, 0) // bottom anchor from top left
          : ex.vec(0, 1), // top anchor from the bottom left
      color: ex.Color.Green,
      vel: ex.vec(-200, 0),
      z: -1, // position the pipe under everything
    });
    this.on("exitviewport", () => this.kill());
  }
}

const loader = new ex.Loader([
  riftTilemapResource,
  Cavegirl2.sprite,
  Turret.sprite,
]);

export const game = new ex.Engine({
  width: 400,
  height: 500,
  backgroundColor: ex.Color.fromHex("#54C0CA"),
  pixelArt: true,
  antialiasing: false,
  // pixelRatio: 2,
  resolution: { width: 200, height: 250 },
  displayMode: ex.DisplayMode.FitScreen,
  scenes: { Level: new MainLevel() },
  pointerScope: ex.PointerScope.Canvas,
});

game.start(loader).then(async () => {
  await game.goToScene("Level");
});
