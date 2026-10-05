import { TiledResource } from "@excaliburjs/plugin-tiled";
import * as ex from "excalibur";
import { GameState, PlayerId, Team } from "../sim/types";
import { isVulnerable } from "../sim/world";

const TEAM_COLORS: Record<Team, string> = {
  blue: "#4aa3ff",
  red: "#ff4a4a",
};
const INVULNERABLE_ALPHA = 0.55;

// Draws the map's tile layers into a canvas at full size, once, as the
// minimap's background.
export function renderMapImage(resource: TiledResource): HTMLCanvasElement {
  const { width, height, tilewidth, tileheight } = resource.map;
  const canvas = document.createElement("canvas");
  canvas.width = width * tilewidth;
  canvas.height = height * tileheight;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  for (const layer of resource.getTileLayers()) {
    if (!layer.visible) {
      continue;
    }
    for (const tile of layer.tilemap.tiles) {
      const offsets = tile.getGraphicsOffsets();
      tile.getGraphics().forEach((graphic, i) => {
        // animated tiles and the like are skipped; this is just a preview
        if (!(graphic instanceof ex.Sprite) || !graphic.image.isLoaded()) {
          return;
        }
        const { x, y, width: w, height: h } = graphic.sourceView;
        const dw = graphic.destSize.width;
        const dh = graphic.destSize.height;
        const offset = offsets[i] ?? ex.Vector.Zero;
        ctx.save();
        ctx.translate(
          tile.x * tilewidth + offset.x + dw / 2,
          tile.y * tileheight + offset.y + dh / 2
        );
        ctx.scale(
          graphic.flipHorizontal ? -1 : 1,
          graphic.flipVertical ? -1 : 1
        );
        const image = graphic.image.image;
        ctx.drawImage(image, x, y, w, h, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
      });
    }
  }
  return canvas;
}

// The minimap: the map, everything on it, and what the camera sees.
export class Minimap {
  constructor(
    private readonly background: HTMLCanvasElement,
    // world size, in px
    private readonly worldWidth: number,
    private readonly worldHeight: number
  ) {}

  // world position for a point on the minimap, given as fractions of its size
  toWorld(fx: number, fy: number): { x: number; y: number } {
    return { x: fx * this.worldWidth, y: fy * this.worldHeight };
  }

  draw(
    canvas: HTMLCanvasElement,
    state: GameState,
    playerId: PlayerId,
    viewport: ex.BoundingBox
  ) {
    const ctx = canvas.getContext("2d");
    if (ctx == null) {
      return;
    }
    const sx = canvas.width / this.worldWidth;
    const sy = canvas.height / this.worldHeight;
    const px = (x: number) => x * sx;
    const py = (y: number) => y * sy;

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.background, 0, 0, canvas.width, canvas.height);
    // darken it a bit so units stand out
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const zone of state.zones) {
      ctx.strokeStyle = TEAM_COLORS[zone.team];
      ctx.beginPath();
      ctx.arc(px(zone.pos.x), py(zone.pos.y), zone.radius * sx, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const unit of state.units) {
      if (unit.kind === "structure") {
        const size = unit.structure === "nexus" ? 9 : 6;
        ctx.globalAlpha = isVulnerable(state, unit) ? 1 : INVULNERABLE_ALPHA;
        ctx.fillStyle = TEAM_COLORS[unit.team];
        ctx.strokeStyle = "#111";
        ctx.fillRect(
          px(unit.pos.x) - size / 2,
          py(unit.pos.y) - size / 2,
          size,
          size
        );
        ctx.strokeRect(
          px(unit.pos.x) - size / 2,
          py(unit.pos.y) - size / 2,
          size,
          size
        );
        ctx.globalAlpha = 1;
      } else if (unit.kind === "minion") {
        ctx.fillStyle = TEAM_COLORS[unit.team];
        ctx.fillRect(px(unit.pos.x) - 1, py(unit.pos.y) - 1, 2, 2);
      }
    }

    // champions on top, yourself last
    const champions = state.units
      .filter((u) => u.kind === "champion" && !u.dead)
      .sort((a, b) =>
        a.kind === "champion" && a.playerId === playerId
          ? 1
          : b.kind === "champion" && b.playerId === playerId
            ? -1
            : 0
      );
    for (const champ of champions) {
      const self = champ.kind === "champion" && champ.playerId === playerId;
      ctx.fillStyle = TEAM_COLORS[champ.team];
      ctx.strokeStyle = self ? "#ffd84a" : "#111";
      ctx.lineWidth = self ? 2 : 1;
      ctx.beginPath();
      ctx.arc(px(champ.pos.x), py(champ.pos.y), 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.strokeRect(
      px(viewport.left),
      py(viewport.top),
      viewport.width * sx,
      viewport.height * sy
    );
  }
}
