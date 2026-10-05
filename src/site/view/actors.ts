import * as ex from "excalibur";
import { Mobile, Projectile, Structure, Team } from "../sim/types";
import {
  cloneDirectionalAnim,
  DirectionalAnim,
  dirOf,
} from "./DirectionalAnim";
import { CharacterSprites, structureSprite } from "./sprites";

export type Relation = "self" | "ally" | "enemy";

const HEALTH_COLORS: Record<Relation, ex.Color> = {
  self: ex.Color.fromHex("#5ad65a"),
  ally: ex.Color.fromHex("#4aa3ff"),
  enemy: ex.Color.fromHex("#ff4a4a"),
};
const HEALTH_BG = ex.Color.fromHex("#1b1e23");
const INVULNERABLE = ex.Color.fromHex("#9a9a9a");

// Draws a health bar centered above the actor, in its local space.
function drawHealthBar(
  ctx: ex.ExcaliburGraphicsContext,
  width: number,
  y: number,
  fraction: number,
  color: ex.Color
) {
  const left = -width / 2;
  ctx.drawRectangle(ex.vec(left - 1, y - 1), width + 2, 4, HEALTH_BG);
  ctx.drawRectangle(ex.vec(left, y), width * fraction, 2, color);
}

// How long the attack pose shows after an attack, in ms
const ATTACK_POSE_TIME = 250;

// A champion or minion.
export class UnitActor extends ex.Actor {
  private readonly anims: {
    walk: DirectionalAnim;
    idle: DirectionalAnim;
    attack: DirectionalAnim;
  };
  private attackPoseLeft = 0;
  private healthFraction = 1;

  constructor(
    unit: Mobile,
    sprites: CharacterSprites,
    private readonly relation: Relation
  ) {
    super({
      pos: ex.vec(unit.pos.x, unit.pos.y),
      collisionType: ex.CollisionType.PreventCollision,
      z: 10,
    });
    this.anims = {
      walk: cloneDirectionalAnim(sprites.animWalk),
      idle: cloneDirectionalAnim(sprites.animIdle),
      attack: cloneDirectionalAnim(sprites.animAttack),
    };
    if (unit.kind === "minion") {
      this.scale = ex.vec(0.75, 0.75);
    }
    const barWidth = unit.kind === "champion" ? 16 : 12;
    this.graphics.onPostDraw = (ctx) => {
      // drawn in scaled local space, so undo the actor's scale
      ctx.save();
      ctx.scale(1 / this.scale.x, 1 / this.scale.y);
      drawHealthBar(
        ctx,
        barWidth,
        -14,
        this.healthFraction,
        HEALTH_COLORS[this.relation]
      );
      ctx.restore();
    };
  }

  playAttack() {
    this.attackPoseLeft = ATTACK_POSE_TIME;
  }

  sync(unit: Mobile, elapsed: number) {
    this.pos = ex.vec(unit.pos.x, unit.pos.y);
    this.healthFraction = unit.hp / unit.maxHp;
    this.graphics.isVisible = !(unit.kind === "champion" && unit.dead);
    this.attackPoseLeft -= elapsed;

    const dir = dirOf(unit.facing);
    if (this.attackPoseLeft > 0) {
      this.graphics.use(this.anims.attack[dir]);
    } else if (unit.moving) {
      this.graphics.use(this.anims.walk[dir]);
    } else {
      this.graphics.use(this.anims.idle[dir]);
    }
  }
}

export class StructureActor extends ex.Actor {
  private healthFraction = 1;
  private vulnerable = true;

  constructor(
    structure: Structure,
    private readonly relation: Relation
  ) {
    super({
      pos: ex.vec(structure.pos.x, structure.pos.y),
      collisionType: ex.CollisionType.PreventCollision,
      z: 5,
    });
    this.graphics.use(structureSprite(structure.team, structure.tier));

    if (structure.attack) {
      const rangeIndicator = new ex.Actor({ pos: ex.vec(0, 0) });
      rangeIndicator.graphics.use(
        new ex.Circle({
          radius: structure.attack.range + structure.radius,
          color: ex.Color.Transparent,
          strokeColor: HEALTH_COLORS[relation].clone().darken(0.2),
          lineWidth: 1,
        })
      );
      rangeIndicator.graphics.opacity = 0.5;
      this.addChild(rangeIndicator);
    }

    this.graphics.onPostDraw = (ctx) => {
      drawHealthBar(
        ctx,
        24,
        -22,
        this.healthFraction,
        this.vulnerable ? HEALTH_COLORS[this.relation] : INVULNERABLE
      );
    };
  }

  sync(structure: Structure, vulnerable: boolean) {
    this.healthFraction = structure.hp / structure.maxHp;
    this.vulnerable = vulnerable;
  }
}

const PROJECTILE_COLORS: Record<Team, ex.Color> = {
  blue: ex.Color.fromHex("#bfe3ff"),
  red: ex.Color.fromHex("#ffd0a0"),
};

export class ProjectileActor extends ex.Actor {
  constructor(projectile: Projectile) {
    const size = projectile.kind === "skillshot" ? 4 : 2;
    super({
      pos: ex.vec(projectile.pos.x, projectile.pos.y),
      width: size,
      height: size,
      color:
        projectile.kind === "skillshot"
          ? ex.Color.Yellow
          : PROJECTILE_COLORS[projectile.team],
      collisionType: ex.CollisionType.PreventCollision,
      z: 20,
    });
  }

  sync(projectile: Projectile) {
    this.pos = ex.vec(projectile.pos.x, projectile.pos.y);
  }
}
