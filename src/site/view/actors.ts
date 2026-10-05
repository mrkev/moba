import * as ex from "excalibur";
import { RECALL_TIME } from "../sim/constants";
import { Mobile, Projectile, Structure, Team, Zone } from "../sim/types";
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
const HASTE = ex.Color.fromHex("#ffd84a");
const SLOW = ex.Color.fromHex("#7fc8ff");
const SLOW_FILL = ex.Color.fromRGB(127, 200, 255, 0.35);
const RECALL = ex.Color.fromRGB(120, 160, 255, 0.8);
const RECALL_FILL = ex.Color.fromRGB(120, 160, 255, 0.2);
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
  private hasted = false;
  private slowed = false;
  // 0 to 1 while recalling
  private recall: number | null = null;

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
    // status rings, under the sprite
    this.graphics.onPreDraw = (ctx) => {
      ctx.save();
      ctx.scale(1 / this.scale.x, 1 / this.scale.y);
      const feet = ex.vec(0, 6);
      if (this.hasted) {
        ctx.drawCircle(feet, 7, ex.Color.Transparent, HASTE, 1);
      }
      if (this.slowed) {
        ctx.drawCircle(feet, 6, SLOW_FILL, SLOW, 1);
      }
      if (this.recall != null) {
        ctx.drawCircle(feet, 10, RECALL_FILL, RECALL, 1);
        ctx.drawCircle(feet, 10 * this.recall, RECALL, ex.Color.Transparent, 0);
      }
      ctx.restore();
    };
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
    this.hasted = unit.effects.some((e) => e.kind === "haste");
    this.slowed = unit.effects.some((e) => e.kind === "slow");
    this.recall =
      unit.kind === "champion" && unit.recallLeft != null
        ? 1 - unit.recallLeft / RECALL_TIME
        : null;
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

const ZONE_COLORS: Record<Team, ex.Color> = {
  blue: ex.Color.fromHex("#4aa3ff"),
  red: ex.Color.fromHex("#ff6a3a"),
};

// A telegraphed area about to go off: an outline that fills as it nears.
export class ZoneActor extends ex.Actor {
  private progress = 0;

  constructor(zone: Zone) {
    super({
      pos: ex.vec(zone.pos.x, zone.pos.y),
      collisionType: ex.CollisionType.PreventCollision,
      z: 4,
    });
    const color = ZONE_COLORS[zone.team];
    const fill = color.clone();
    fill.a = 0.25;
    this.graphics.onPostDraw = (ctx) => {
      ctx.drawCircle(ex.vec(0, 0), zone.radius, ex.Color.Transparent, color, 1);
      ctx.drawCircle(
        ex.vec(0, 0),
        zone.radius * this.progress,
        fill,
        ex.Color.Transparent,
        0
      );
    };
  }

  sync(zone: Zone, tick: number) {
    this.progress = Math.min(
      1,
      (tick - zone.createdTick) / (zone.detonateTick - zone.createdTick)
    );
  }

  // keeps onPostDraw running even though there's no graphic to show
  override onInitialize() {
    this.graphics.use(
      new ex.Circle({ radius: 1, color: ex.Color.Transparent })
    );
  }
}

// A quick flash where something exploded.
export class ExplosionActor extends ex.Actor {
  private life = 0;

  constructor(
    pos: { x: number; y: number },
    private readonly radius: number,
    team: Team
  ) {
    super({
      pos: ex.vec(pos.x, pos.y),
      collisionType: ex.CollisionType.PreventCollision,
      z: 30,
    });
    const color = ZONE_COLORS[team].clone();
    this.graphics.use(
      new ex.Circle({ radius, color, strokeColor: ex.Color.White })
    );
  }

  override onPreUpdate(_engine: ex.Engine, elapsed: number) {
    this.life += elapsed;
    const t = this.life / 400;
    this.graphics.opacity = Math.max(0, 0.8 * (1 - t));
    this.scale = ex.vec(1 + t * 0.3, 1 + t * 0.3);
    if (t >= 1) {
      this.kill();
    }
  }
}

// Text that drifts up and fades, like "+21" gold.
export class FloatingText extends ex.Actor {
  private life = 0;

  constructor(pos: { x: number; y: number }, text: string, color: ex.Color) {
    super({
      pos: ex.vec(pos.x, pos.y - 10),
      collisionType: ex.CollisionType.PreventCollision,
      z: 40,
    });
    this.graphics.use(
      new ex.Text({
        text,
        font: new ex.Font({
          size: 8,
          unit: ex.FontUnit.Px,
          color,
          textAlign: ex.TextAlign.Center,
          shadow: { offset: ex.vec(0.5, 0.5), color: ex.Color.Black },
          quality: 4,
        }),
      })
    );
  }

  override onPreUpdate(_engine: ex.Engine, elapsed: number) {
    this.life += elapsed;
    this.pos = this.pos.add(ex.vec(0, (-12 * elapsed) / 1000));
    this.graphics.opacity = Math.max(0, 1 - this.life / 1000);
    if (this.life >= 1000) {
      this.kill();
    }
  }
}
