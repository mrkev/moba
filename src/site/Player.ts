import * as ex from "excalibur";
import { ChampionDef } from "./champions/ChampionDef";
import {
  cloneDirectionalAnim,
  DirectionalAnim,
} from "./champions/DirectionalAnim";

type Dir = "left" | "right" | "up" | "down";

// radians
// - starts on x axis, counterclockwise
// - 2pi is a circle
export function facing(
  angle: number | "left" | "right" | "up" | "down"
): number {
  switch (angle) {
    case "right":
      return 0;
    case "up":
      return Math.PI / 2;
    case "left":
      return Math.PI;
    case "down":
      return (Math.PI * 3) / 2;
    default:
      return (angle * Math.PI) / 180;
  }
}

export function dirFacing(radians: number): Dir {
  const mpi4 = Math.PI / 4;
  if (radians > mpi4 * 1 && radians < mpi4 * 3) {
    return "up";
  } else if (radians > mpi4 * 3 && radians < mpi4 * 5) {
    return "left";
  } else if (radians > mpi4 * 5 && radians < mpi4 * 7) {
    return "down";
  } else {
    return "right";
  }
}

export class Player extends ex.Actor {
  public facing = facing("down");

  // stats, move to championdef? here only getters that add stats?
  public attackPower = 10;
  public magicPower = 10;
  public health: number;
  public defence = 10;
  public abilityHaste = 10;
  public movementSpeed: number;

  public level = 0;

  private readonly anims: {
    walk: DirectionalAnim;
    idle: DirectionalAnim;
    attack: DirectionalAnim;
  };

  constructor(
    { pos }: { pos: ex.Vector },
    public readonly character: ChampionDef
  ) {
    super({
      pos: pos,
      width: 16, // for now we'll use a box so we can see the rotation
      height: 16, // later we'll use a circle collider
      color: ex.Color.Yellow,
      collisionType: ex.CollisionType.Active,
    });

    this.health = character.stats.health;
    this.movementSpeed = character.stats.movementSpeed;
    this.anims = {
      walk: cloneDirectionalAnim(character.animWalk),
      idle: cloneDirectionalAnim(character.animIdle),
      attack: cloneDirectionalAnim(character.animAttack),
    };
  }

  animWalk() {
    this.graphics.use(this.anims.walk[dirFacing(this.facing)]);
  }

  animIdle() {
    this.graphics.use(this.anims.idle[dirFacing(this.facing)]);
  }

  animAttack() {
    this.graphics.use(this.anims.attack[dirFacing(this.facing)]);
  }

  override onInitialize(engine: ex.Engine): void {
    this.animIdle();
  }

  takeDamage(damage: number) {
    this.health -= damage;
    console.log("got shot!", this.health);
  }
}
