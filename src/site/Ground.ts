import * as ex from "excalibur";

export class Ground extends ex.Actor {
  moving = false;
  constructor(pos: ex.Vector) {
    super({
      pos,
      anchor: ex.vec(0, 0),
      height: 64,
      width: 400,
      color: ex.Color.fromHex("#bd9853"),
      z: 1, // position the ground above everything
    });
  }

  start() {
    this.moving = true;
  }
  stop() {
    this.moving = false;
  }
}
