import * as ex from "excalibur";
import { ChampionDef } from "./champions/ChampionDef";
import {
  cloneDirectionalAnim,
  DirectionalAnim,
} from "./champions/DirectionalAnim";
import { Team } from "./Team";

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

// exact diagonals resolve to left/right
export function dirFacing(radians: number): Dir {
  const mpi4 = Math.PI / 4;
  const tau = Math.PI * 2;
  const angle = ((radians % tau) + tau) % tau;
  if (angle > mpi4 * 1 && angle < mpi4 * 3) {
    return "up";
  } else if (angle >= mpi4 * 3 && angle <= mpi4 * 5) {
    return "left";
  } else if (angle > mpi4 * 5 && angle < mpi4 * 7) {
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

  static respawnTime = 5000; // ms
  public dead = false;
  public spawnPos: ex.Vector;
  private respawnTimeLeft = 0;

  // ms left to keep showing the attack pose
  private attackAnimTimeLeft = 0;

  private readonly anims: {
    walk: DirectionalAnim;
    idle: DirectionalAnim;
    attack: DirectionalAnim;
  };

  public readonly team: Team;

  constructor(
    { pos, team }: { pos: ex.Vector; team: Team },
    public readonly character: ChampionDef
  ) {
    super({
      pos: pos,
      width: 16, // for now we'll use a box so we can see the rotation
      height: 16, // later we'll use a circle collider
      color: ex.Color.Yellow,
      collisionType: ex.CollisionType.Active,
    });

    this.team = team;
    this.spawnPos = pos.clone();
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
    this.attackAnimTimeLeft = 250;
  }

  // dir is in screen space (y down); a zero vector stands still
  move(dir: ex.Vector) {
    if (this.dead) {
      return;
    }
    if (dir.x === 0 && dir.y === 0) {
      this.vel = ex.vec(0, 0);
      if (this.attackAnimTimeLeft <= 0) {
        this.animIdle();
      }
      return;
    }
    this.vel = dir.normalize().scale(this.movementSpeed);
    this.facing = Math.atan2(-dir.y, dir.x);
    this.animWalk();
  }

  override onPreUpdate(_engine: ex.Engine, delta: number): void {
    this.attackAnimTimeLeft -= delta;
    if (this.dead) {
      this.respawnTimeLeft -= delta;
      if (this.respawnTimeLeft <= 0) {
        this.respawn();
      }
    }
  }

  override onInitialize(engine: ex.Engine): void {
    this.animIdle();
  }

  takeDamage(damage: number) {
    if (this.dead) {
      return;
    }
    this.health = Math.max(0, this.health - damage);
    console.log("got shot!", this.health);
    if (this.health === 0) {
      this.die();
    }
  }

  die() {
    this.dead = true;
    this.respawnTimeLeft = Player.respawnTime;
    this.vel = ex.vec(0, 0);
    this.graphics.isVisible = false;
    this.body.collisionType = ex.CollisionType.PreventCollision;
  }

  respawn() {
    this.dead = false;
    this.health = this.character.stats.health;
    this.pos = this.spawnPos.clone();
    this.vel = ex.vec(0, 0);
    this.facing = facing("down");
    this.graphics.isVisible = true;
    this.body.collisionType = ex.CollisionType.Active;
    this.animIdle();
  }
}
