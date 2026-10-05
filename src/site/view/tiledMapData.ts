import { TiledObject, TiledResource } from "@excaliburjs/plugin-tiled";
import { MapData, StructurePlacement } from "../sim/mapData";
import { Lane, Team, TurretTier } from "../sim/types";
import { Vec } from "../sim/vec";

// Map object classes the simulation reads; the view draws these itself
// rather than letting the Tiled plugin create actors for them. (The plugin
// then leaves them out of ObjectLayer.objects, so this reads the raw parsed
// objects instead.)
export const SIM_OBJECT_CLASSES = ["turret", "nexus", "fountain"];

function pointInPolygon(p: Vec, polygon: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function stringProp(object: TiledObject, name: string): string | null {
  const prop = object.properties?.find((p) => p.name === name);
  return typeof prop?.value === "string" ? prop.value : null;
}

function requiredStringProp(object: TiledObject, name: string): string {
  const value = stringProp(object, name);
  if (value == null) {
    throw new Error(`map object ${object.id} is missing property "${name}"`);
  }
  return value;
}

// Tile objects are positioned by their bottom-left corner in Tiled.
function centerOf(object: TiledObject): Vec {
  const x = object.x ?? 0;
  const y = object.y ?? 0;
  if (object.gid != null) {
    return {
      x: x + (object.width ?? 0) / 2,
      y: y - (object.height ?? 0) / 2,
    };
  }
  return { x, y };
}

// Reads what the simulation needs out of a loaded Tiled map: solid tiles
// (from layers with a "solid" property) and the structure and fountain
// objects.
export function tiledMapData(resource: TiledResource): MapData {
  const { width, height, tilewidth: tileSize } = resource.map;
  const solid = new Array<boolean>(width * height).fill(false);

  for (const layer of resource.getTileLayers()) {
    if (layer.properties.get("solid") !== true) {
      continue;
    }
    layer.data.forEach((gid, i) => {
      if (gid !== 0) {
        solid[i] = true;
      }
    });
  }

  const structures: StructurePlacement[] = [];
  const fountains: Partial<Record<Team, Vec>> = {};
  for (const layer of resource.getObjectLayers()) {
    const solidLayer = layer.properties.get("solid") === true;
    for (const object of layer.tiledObjectLayer.objects) {
      if (solidLayer && object.polygon) {
        const points = object.polygon.map((p) => ({
          x: p.x + (object.x ?? 0),
          y: p.y + (object.y ?? 0),
        }));
        for (let ty = 0; ty < height; ty++) {
          for (let tx = 0; tx < width; tx++) {
            const center = {
              x: (tx + 0.5) * tileSize,
              y: (ty + 0.5) * tileSize,
            };
            if (pointInPolygon(center, points)) {
              solid[ty * width + tx] = true;
            }
          }
        }
      }

      switch (object.type) {
        case "turret":
        case "nexus":
          structures.push({
            team: requiredStringProp(object, "team") as Team,
            structure: object.type,
            tier:
              object.type === "turret"
                ? (requiredStringProp(object, "tier") as TurretTier)
                : null,
            lane: stringProp(object, "lane") as Lane | null,
            pos: centerOf(object),
          });
          break;
        case "fountain":
          fountains[requiredStringProp(object, "team") as Team] =
            centerOf(object);
          break;
      }
    }
  }

  if (!fountains.blue || !fountains.red) {
    throw new Error("map needs a fountain for each team");
  }
  return {
    width,
    height,
    tileSize,
    solid,
    structures,
    fountains: { blue: fountains.blue, red: fountains.red },
  };
}
