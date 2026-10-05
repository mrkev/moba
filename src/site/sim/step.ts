import { MapData } from "./mapData";
import { separateUnits } from "./movement";
import { updateStats } from "./progression";
import {
  passiveIncome,
  resolveDeaths,
  spawnWaves,
  updateChampion,
  updateMinion,
  updateProjectiles,
  updateStructure,
  updateZones,
} from "./systems";
import { GameState, PlayerId, PlayerInput, SimEvent } from "./types";

const NO_INPUT: PlayerInput = { move: { x: 0, y: 0 }, commands: [] };

// Advances the game by one tick. Mutates state and returns what happened, for
// the view to react to.
export function step(
  state: GameState,
  map: MapData,
  inputs: Record<PlayerId, PlayerInput>
): SimEvent[] {
  const events: SimEvent[] = [];
  if (state.winner != null) {
    return events;
  }

  for (const unit of state.units) {
    unit.attackCooldown = Math.max(0, unit.attackCooldown - 1);
    if (unit.kind !== "structure") {
      unit.repathIn = Math.max(0, unit.repathIn - 1);
    }
    if (unit.kind === "champion") {
      for (const ability of Object.values(unit.abilities)) {
        ability.cooldown = Math.max(0, ability.cooldown - 1);
      }
    }
    if (unit.kind !== "structure") {
      updateStats(state, unit);
    }
  }

  passiveIncome(state);

  spawnWaves(state, map);

  for (const unit of state.units) {
    // killed earlier this tick
    if (unit.kind !== "champion" && unit.hp <= 0) {
      continue;
    }
    switch (unit.kind) {
      case "champion":
        updateChampion(
          state,
          map,
          unit,
          inputs[unit.playerId] ?? NO_INPUT,
          events
        );
        break;
      case "minion":
        updateMinion(state, map, unit, events);
        break;
      case "structure":
        updateStructure(state, unit, events);
        break;
    }
  }

  separateUnits(state, map);
  updateProjectiles(state);
  updateZones(state, events);
  resolveDeaths(state, events);
  state.tick++;
  return events;
}
