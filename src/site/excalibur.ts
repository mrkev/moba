import * as ex from "excalibur";
import { Cavegirl2 } from "./champions/Cavegirl2";
import { riftTilemapResource } from "./MainLevel";
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

export const loader = new ex.Loader([
  riftTilemapResource,
  Cavegirl2.sprite,
  Turret.sprite,
]);
