import { TiledResource } from "@excaliburjs/plugin-tiled";
import * as ex from "excalibur";
import { TICK_MS } from "./sim/constants";
import { createGame } from "./sim/game";
import { MapData } from "./sim/mapData";
import { step } from "./sim/step";
import {
  Command,
  EntityId,
  GameState,
  PlayerId,
  SimEvent,
  Team,
  Unit,
} from "./sim/types";
import { championOf, isVulnerable } from "./sim/world";
import {
  ProjectileActor,
  Relation,
  StructureActor,
  UnitActor,
} from "./view/actors";
import { drawSimDebug } from "./view/debugDraw";
import { computeHud, hudEqual, HudState } from "./view/hud";
import { CHAMPION_SPRITES, MINION_SPRITES } from "./view/sprites";
import { SIM_OBJECT_CLASSES, tiledMapData } from "./view/tiledMapData";

export const riftTilemapResource = new TiledResource("./assets/rift/rift.tmx", {
  useTilemapCameraStrategy: true,
  // the simulation owns these; returning nothing keeps the plugin from
  // drawing them
  entityClassNameFactories: Object.fromEntries(
    SIM_OBJECT_CLASSES.map((name) => [name, () => undefined])
  ),
});

// never simulate more than this much time in one frame, e.g. after the tab
// was in the background
const MAX_FRAME_MS = 250;

// Runs the simulation on a fixed tick and renders its state.
export class MainLevel extends ex.Scene {
  private readonly playerId: PlayerId = 0;
  private readonly team: Team = "blue";
  private map!: MapData;
  private state!: GameState;
  private accumulator = 0;
  // input events since the last tick
  private commands: Command[] = [];

  private readonly unitActors = new Map<
    EntityId,
    UnitActor | StructureActor
  >();
  private readonly projectileActors = new Map<EntityId, ProjectileActor>();
  private hud: HudState | null = null;
  private readonly hudListeners = new Set<() => void>();
  private readonly gameOverLabel = new ex.Label({
    text: "",
    pos: ex.vec(100, 110),
    font: new ex.Font({
      size: 24,
      unit: ex.FontUnit.Px,
      color: ex.Color.White,
      textAlign: ex.TextAlign.Center,
      shadow: { offset: ex.vec(1, 1), color: ex.Color.Black },
    }),
    coordPlane: ex.CoordPlane.Screen,
    z: 100,
  });

  override onInitialize(game: ex.Engine): void {
    // read before adding to the scene, which drops the sim's objects
    this.map = tiledMapData(riftTilemapResource);
    riftTilemapResource.addToScene(this);
    this.state = createGame(this.map, [
      { playerId: this.playerId, team: this.team, champion: "cavegirl2" },
    ]);
    this.syncView([], 0);
    this.add(this.gameOverLabel);

    if (import.meta.env.DEV) {
      // for poking at the game from the devtools console
      (globalThis as { moba?: MainLevel }).moba = this;
    }

    const champion = this.ownChampionActor();
    if (champion) {
      this.camera.strategy.lockToActor(champion);
    }
    const firstLayer = riftTilemapResource.getTileLayers()[0];
    if (firstLayer) {
      const mapBounds = ex.BoundingBox.fromDimension(
        riftTilemapResource.map.width * riftTilemapResource.map.tilewidth,
        riftTilemapResource.map.height * riftTilemapResource.map.tileheight,
        ex.Vector.Zero,
        firstLayer.tilemap.pos
      );
      this.camera.strategy.limitCameraBounds(mapBounds);
    }

    // Excalibur's own collider drawing shows the Tiled plugin's colliders,
    // which nothing uses; drawSimDebug shows what the simulation collides with
    game.debug.collider.showGeometry = false;
    game.debug.tilemap.showColliderGeometry = false;

    // right-click is for moving, not the browser's menu
    game.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    game.input.pointers.primary.on("wheel", (wheelEvent) => {
      // wheel up
      if (wheelEvent.deltaY < 0) {
        this.camera.zoom *= 1.01;
      } else {
        this.camera.zoom /= 1.01;
      }
    });

    game.input.keyboard.on("press", (e) => {
      switch (e.key) {
        case ex.Keys.Q:
        case ex.Keys.W:
        case ex.Keys.E:
        case ex.Keys.R:
          this.castSkillshot();
          break;
        case ex.Keys.Backquote:
          this.toggleDebug();
          break;
      }
    });

    game.input.pointers.on("down", (e) => {
      const pos = { x: e.worldPos.x, y: e.worldPos.y };
      if (e.button === ex.PointerButton.Right) {
        this.commands.push({ type: "smartClick", pos });
      }
      if (e.button === ex.PointerButton.Left) {
        const champion = championOf(this.state, this.playerId);
        if (champion) {
          this.commands.push({
            type: "skillshot",
            dir: { x: pos.x - champion.pos.x, y: pos.y - champion.pos.y },
          });
        }
      }
    });
  }

  override onPreUpdate(game: ex.Engine, elapsed: number): void {
    const keyboard = game.input.keyboard;
    const move = { x: 0, y: 0 };
    if (keyboard.isHeld(ex.Keys.Left)) move.x -= 1;
    if (keyboard.isHeld(ex.Keys.Right)) move.x += 1;
    if (keyboard.isHeld(ex.Keys.Up)) move.y -= 1;
    if (keyboard.isHeld(ex.Keys.Down)) move.y += 1;

    const events: SimEvent[] = [];
    this.accumulator += Math.min(elapsed, MAX_FRAME_MS);
    while (this.accumulator >= TICK_MS) {
      events.push(
        ...step(this.state, this.map, {
          [this.playerId]: { move, commands: this.commands },
        })
      );
      this.commands = [];
      this.accumulator -= TICK_MS;
    }
    this.syncView(events, elapsed);
    if (game.isDebug) {
      drawSimDebug(this.state, this.map);
    }
    this.updateHud();
  }

  // casts the skillshot in the direction the champion faces
  castSkillshot() {
    const champion = championOf(this.state, this.playerId);
    if (champion) {
      this.commands.push({ type: "skillshot", dir: champion.facing });
    }
  }

  // shows hitboxes and other simulation internals
  toggleDebug() {
    this.engine.toggleDebug();
    this.updateHud();
  }

  // For the React HUD, via useSyncExternalStore
  readonly subscribe = (listener: () => void) => {
    this.hudListeners.add(listener);
    return () => {
      this.hudListeners.delete(listener);
    };
  };

  readonly getHud = (): HudState | null => this.hud;

  private updateHud() {
    const hud = computeHud(this.state, this.playerId, this.engine.isDebug);
    if (!hudEqual(hud, this.hud)) {
      this.hud = hud;
      this.hudListeners.forEach((listener) => listener());
    }
  }

  private relationTo(unit: Unit): Relation {
    if (unit.kind === "champion" && unit.playerId === this.playerId) {
      return "self";
    }
    return unit.team === this.team ? "ally" : "enemy";
  }

  private ownChampionActor(): UnitActor | null {
    const champion = championOf(this.state, this.playerId);
    const actor = champion && this.unitActors.get(champion.id);
    return actor instanceof UnitActor ? actor : null;
  }

  private syncView(events: SimEvent[], elapsed: number) {
    const state = this.state;

    const seenUnits = new Set<EntityId>();
    for (const unit of state.units) {
      seenUnits.add(unit.id);
      let actor = this.unitActors.get(unit.id);
      if (actor == null) {
        actor =
          unit.kind === "structure"
            ? new StructureActor(unit, this.relationTo(unit))
            : new UnitActor(
                unit,
                unit.kind === "champion"
                  ? CHAMPION_SPRITES[unit.champion]
                  : MINION_SPRITES[unit.team][unit.minion],
                this.relationTo(unit)
              );
        this.unitActors.set(unit.id, actor);
        this.add(actor);
      }
      if (unit.kind === "structure" && actor instanceof StructureActor) {
        actor.sync(unit, isVulnerable(state, unit));
      } else if (unit.kind !== "structure" && actor instanceof UnitActor) {
        actor.sync(unit, elapsed);
      }
    }
    for (const [id, actor] of this.unitActors) {
      if (!seenUnits.has(id)) {
        actor.kill();
        this.unitActors.delete(id);
      }
    }

    const seenProjectiles = new Set<EntityId>();
    for (const projectile of state.projectiles) {
      seenProjectiles.add(projectile.id);
      let actor = this.projectileActors.get(projectile.id);
      if (actor == null) {
        actor = new ProjectileActor(projectile);
        this.projectileActors.set(projectile.id, actor);
        this.add(actor);
      }
      actor.sync(projectile);
    }
    for (const [id, actor] of this.projectileActors) {
      if (!seenProjectiles.has(id)) {
        actor.kill();
        this.projectileActors.delete(id);
      }
    }

    const own = championOf(state, this.playerId);
    for (const event of events) {
      switch (event.type) {
        case "attack":
        case "cast": {
          const actor = this.unitActors.get(event.sourceId);
          if (actor instanceof UnitActor) {
            actor.playAttack();
          }
          if (event.type === "cast" && event.sourceId === own?.id) {
            this.camera.shake(3, 3, 100);
          }
          break;
        }
        case "victory":
          this.gameOverLabel.text =
            event.team === this.team ? "Victory" : "Defeat";
          break;
      }
    }
  }
}
