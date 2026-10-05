import { Lane, Team, TurretTier } from "./types";
import { Vec } from "./vec";

export interface StructurePlacement {
  team: Team;
  structure: "turret" | "nexus";
  tier: TurretTier | null;
  lane: Lane | null;
  pos: Vec; // center
}

// Static map description the simulation runs on, independent of how the map
// is authored or rendered.
export interface MapData {
  // in tiles
  width: number;
  height: number;
  tileSize: number;
  // row-major, width * height
  solid: boolean[];
  structures: StructurePlacement[];
  fountains: Record<Team, Vec>;
}
