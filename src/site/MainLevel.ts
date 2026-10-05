import { TiledResource } from "@excaliburjs/plugin-tiled";
import * as ex from "excalibur";
import { abilityDef } from "./sim/abilities";
import { botInput } from "./sim/bot";
import { TICK_MS } from "./sim/constants";
import { createGame } from "./sim/game";
import { MapData } from "./sim/mapData";
import { step } from "./sim/step";
import {
  AbilitySlot,
  Command,
  EntityId,
  GameState,
  ItemId,
  PlayerId,
  SimEvent,
  Team,
  Unit,
} from "./sim/types";
import { add, scale } from "./sim/vec";
import { championOf, getUnit, isVulnerable } from "./sim/world";
import {
  ExplosionActor,
  FloatingText,
  ProjectileActor,
  Relation,
  StructureActor,
  UnitActor,
  ZoneActor,
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

const ABILITY_KEYS: Partial<Record<ex.Keys, AbilitySlot>> = {
  [ex.Keys.Q]: "q",
  [ex.Keys.W]: "w",
  [ex.Keys.E]: "e",
  [ex.Keys.R]: "r",
};

const GOLD_TEXT = ex.Color.fromHex("#ffd84a");
const LEVEL_TEXT = ex.Color.fromHex("#9ee7ff");

// Runs the simulation on a fixed tick and renders its state.
export class MainLevel extends ex.Scene {
  private readonly playerId: PlayerId = 0;
  private readonly team: Team = "blue";
  private readonly botPlayerId: PlayerId = 1;
  private map!: MapData;
  private state!: GameState;
  private accumulator = 0;
  // input events since the last tick
  private commands: Command[] = [];
  private shopOpen = false;

  private readonly unitActors = new Map<
    EntityId,
    UnitActor | StructureActor
  >();
  private readonly projectileActors = new Map<EntityId, ProjectileActor>();
  private readonly zoneActors = new Map<EntityId, ZoneActor>();
  private hud: HudState | null = null;
  private readonly hudListeners = new Set<() => void>();

  override onInitialize(game: ex.Engine): void {
    // read before adding to the scene, which drops the sim's objects
    this.map = tiledMapData(riftTilemapResource);
    riftTilemapResource.addToScene(this);
    this.newGame();

    if (import.meta.env.DEV) {
      // for poking at the game from the devtools console
      (globalThis as { moba?: MainLevel }).moba = this;
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
      const slot = ABILITY_KEYS[e.key];
      if (slot) {
        // ctrl+key levels the ability up, like in League
        if (e.originalEvent?.ctrlKey) {
          this.levelAbility(slot);
        } else {
          const cursor = game.input.pointers.primary.lastWorldPos;
          this.commands.push({
            type: "cast",
            slot,
            target: { x: cursor.x, y: cursor.y },
          });
        }
        return;
      }
      switch (e.key) {
        case ex.Keys.B:
          this.recall();
          break;
        case ex.Keys.P:
          this.toggleShop();
          break;
        case ex.Keys.Backquote:
          this.toggleDebug();
          break;
      }
    });

    game.input.pointers.on("down", (e) => {
      if (e.button === ex.PointerButton.Right) {
        this.commands.push({
          type: "smartClick",
          pos: { x: e.worldPos.x, y: e.worldPos.y },
        });
      }
    });
  }

  private newGame() {
    for (const actor of [
      ...this.unitActors.values(),
      ...this.projectileActors.values(),
      ...this.zoneActors.values(),
    ]) {
      actor.kill();
    }
    this.unitActors.clear();
    this.projectileActors.clear();
    this.zoneActors.clear();
    this.commands = [];
    this.accumulator = 0;
    this.shopOpen = false;

    this.state = createGame(this.map, [
      { playerId: this.playerId, team: this.team, champion: "cavegirl2" },
      { playerId: this.botPlayerId, team: "red", champion: "caveman2" },
    ]);
    this.syncView([], 0);
    const champion = this.ownChampionActor();
    if (champion) {
      this.camera.strategy.lockToActor(champion);
    }
    this.updateHud();
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
          [this.botPlayerId]: botInput(this.state, this.botPlayerId),
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

  // Actions for the HUD.

  // casts an ability where the champion is facing (there's no cursor on
  // the map when clicking the HUD)
  cast(slot: AbilitySlot) {
    const champion = championOf(this.state, this.playerId);
    if (champion) {
      const reach = Math.max(abilityDef(champion, slot).range, 1);
      this.commands.push({
        type: "cast",
        slot,
        target: add(champion.pos, scale(champion.facing, reach)),
      });
    }
  }

  levelAbility(slot: AbilitySlot) {
    this.commands.push({ type: "levelAbility", slot });
  }

  recall() {
    this.commands.push({ type: "recall" });
  }

  buy(item: ItemId) {
    this.commands.push({ type: "buy", item });
  }

  sell(slot: number) {
    this.commands.push({ type: "sell", slot });
  }

  toggleShop() {
    this.shopOpen = !this.shopOpen;
    this.updateHud();
  }

  // shows hitboxes and other simulation internals
  toggleDebug() {
    this.engine.toggleDebug();
    this.updateHud();
  }

  restart() {
    this.newGame();
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
    if (this.state == null) {
      return;
    }
    const hud = computeHud(this.state, this.playerId, {
      debug: this.engine?.isDebug ?? false,
      shopOpen: this.shopOpen,
    });
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

  // Keeps one actor per sim entity: creates, updates and removes them.
  private syncActors<T extends { id: EntityId }, A extends ex.Actor>(
    entities: T[],
    actors: Map<EntityId, A>,
    create: (entity: T) => A,
    update: (actor: A, entity: T) => void
  ) {
    const seen = new Set<EntityId>();
    for (const entity of entities) {
      seen.add(entity.id);
      let actor = actors.get(entity.id);
      if (actor == null) {
        actor = create(entity);
        actors.set(entity.id, actor);
        this.add(actor);
      }
      update(actor, entity);
    }
    for (const [id, actor] of actors) {
      if (!seen.has(id)) {
        actor.kill();
        actors.delete(id);
      }
    }
  }

  private syncView(events: SimEvent[], elapsed: number) {
    const state = this.state;

    this.syncActors(
      state.units,
      this.unitActors,
      (unit) =>
        unit.kind === "structure"
          ? new StructureActor(unit, this.relationTo(unit))
          : new UnitActor(
              unit,
              unit.kind === "champion"
                ? CHAMPION_SPRITES[unit.champion]
                : MINION_SPRITES[unit.team][unit.minion],
              this.relationTo(unit)
            ),
      (actor, unit) => {
        if (unit.kind === "structure" && actor instanceof StructureActor) {
          actor.sync(unit, isVulnerable(state, unit));
        } else if (unit.kind !== "structure" && actor instanceof UnitActor) {
          actor.sync(unit, elapsed);
        }
      }
    );
    this.syncActors(
      state.projectiles,
      this.projectileActors,
      (projectile) => new ProjectileActor(projectile),
      (actor, projectile) => actor.sync(projectile)
    );
    this.syncActors(
      state.zones,
      this.zoneActors,
      (zone) => new ZoneActor(zone),
      (actor, zone) => actor.sync(zone, state.tick)
    );

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
            this.camera.shake(2, 2, 100);
          }
          break;
        }
        case "explosion":
          this.add(new ExplosionActor(event.pos, event.radius, event.team));
          this.camera.shake(3, 3, 150);
          break;
        case "gold":
          if (event.unitId === own?.id) {
            this.add(
              new FloatingText(event.pos, `+${event.amount}`, GOLD_TEXT)
            );
          }
          break;
        case "levelUp": {
          const unit = getUnit(state, event.unitId);
          if (unit && event.unitId === own?.id) {
            this.add(new FloatingText(unit.pos, "Level up!", LEVEL_TEXT));
          }
          break;
        }
      }
    }
  }
}
