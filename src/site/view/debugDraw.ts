import * as ex from "excalibur";
import { FOUNTAIN_RADIUS } from "../sim/constants";
import { MapData } from "../sim/mapData";
import { navGrid } from "../sim/navGrid";
import { GameState, Team, TEAMS } from "../sim/types";
import { getUnit, isAlive } from "../sim/world";

const TEAM_COLORS: Record<Team, ex.Color> = {
  blue: ex.Color.fromHex("#4aa3ff"),
  red: ex.Color.fromHex("#ff4a4a"),
};
const BLOCKED = ex.Color.fromRGB(255, 0, 255, 0.25);
const PATH = ex.Color.fromRGB(255, 255, 255, 0.7);
const RANGE_ALPHA = 0.35;

const v = (p: { x: number; y: number }) => ex.vec(p.x, p.y);

// Draws what the simulation sees, in world space: blocked tiles, unit
// hitboxes, attack ranges, paths and targets. Only shows while the engine's
// debug mode is on.
export function drawSimDebug(state: GameState, map: MapData) {
  const grid = navGrid(state, map);
  ex.Debug.draw((ctx) => {
    const ts = grid.tileSize;
    for (let ty = 0; ty < grid.height; ty++) {
      for (let tx = 0; tx < grid.width; tx++) {
        if (grid.isBlockedTile(tx, ty)) {
          ctx.drawRectangle(ex.vec(tx * ts, ty * ts), ts, ts, BLOCKED);
        }
      }
    }

    for (const team of TEAMS) {
      ctx.drawCircle(
        v(state.fountains[team]),
        FOUNTAIN_RADIUS,
        ex.Color.Transparent,
        TEAM_COLORS[team].clone().lighten(0.5),
        1
      );
    }

    for (const unit of state.units) {
      if (!isAlive(unit)) {
        continue;
      }
      const color = TEAM_COLORS[unit.team];
      const pos = v(unit.pos);

      if (unit.kind !== "structure" && unit.path.length > 0) {
        let from = pos;
        for (const point of unit.path) {
          ctx.drawLine(from, v(point), PATH, 1);
          from = v(point);
        }
      }

      const target =
        unit.kind === "champion" && unit.order.type === "attack"
          ? getUnit(state, unit.order.targetId)
          : getUnit(state, unit.targetId);
      if (target) {
        ctx.drawLine(pos, v(target.pos), color, 1);
      }

      // attack range is edge to edge, so it reaches out from the hitbox
      if (unit.attack && unit.kind !== "minion") {
        const rangeColor = color.clone();
        rangeColor.a = RANGE_ALPHA;
        ctx.drawCircle(
          pos,
          unit.radius + unit.attack.range,
          ex.Color.Transparent,
          rangeColor,
          1
        );
      }
      ctx.drawCircle(pos, unit.radius, ex.Color.Transparent, color, 1);
    }

    for (const projectile of state.projectiles) {
      const radius = projectile.kind === "skillshot" ? projectile.radius : 1;
      ctx.drawCircle(
        v(projectile.pos),
        radius,
        ex.Color.Transparent,
        ex.Color.Yellow,
        1
      );
    }
  });
}
