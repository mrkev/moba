import * as ex from "excalibur";
import { DirectionalAnim } from "./DirectionalAnim";

export interface ChampionDef {
  readonly spriteSheet: ex.SpriteSheet;

  // animations
  readonly animWalk: DirectionalAnim;
  readonly animIdle: DirectionalAnim;
  readonly animAttack: DirectionalAnim;

  // stats
  readonly stats: Readonly<{
    health: number;
    movementSpeed: number;
  }>;
}
