import * as ex from "excalibur";
import { ChampionDef } from "./ChampionDef";
import { DirectionalAnim, directionalAnims } from "./DirectionalAnim";

export class Cavegirl2 implements ChampionDef {
  static sprite = new ex.ImageSource(
    "assets/rift/Actor/Characters/Cavegirl2/SpriteSheet.png"
  );

  readonly stats = { health: 100 };

  readonly spriteSheet = ex.SpriteSheet.fromImageSource({
    image: Cavegirl2.sprite,
    grid: {
      columns: 4,
      rows: 7,
      spriteHeight: 16,
      spriteWidth: 16,
    },
  });

  animAttack: DirectionalAnim = directionalAnims(this.spriteSheet, {
    down: [16],
    up: [17],
    left: [18],
    right: [19],
  });

  readonly animWalk = directionalAnims(this.spriteSheet, {
    down: [0, 4, 8, 12],
    up: [1, 5, 9, 13],
    left: [2, 6, 10, 14],
    right: [3, 7, 11, 15],
  });

  readonly animIdle = directionalAnims(this.spriteSheet, {
    down: [0],
    up: [1],
    left: [2],
    right: [3],
  });
}
