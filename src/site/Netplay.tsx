import { DefaultInput, Game, NetplayPlayer, RollbackWrapper } from "netplayjs";
import { useEffect, useRef } from "react";
import { nullthrows } from "./nullthrows";

type NPoint = { x: number; y: number };

class SimpleGame extends Game {
  aPos: NPoint;
  bPos: NPoint;

  // In the constructor, we initialize the state of our game.
  constructor() {
    super();
    // Initialize our player positions.
    this.aPos = { x: 100, y: 150 };
    this.bPos = { x: 500, y: 150 };
  }

  // The tick function takes a map of Player -> Input and
  // simulates the game forward. Think of it like making
  // a local multiplayer game with multiple controllers.
  tick(playerInputs: Map<NetplayPlayer, DefaultInput>) {
    for (const [player, input] of playerInputs.entries()) {
      // Generate player velocity from input keys.
      const vel = input.arrowKeys();

      // Apply the velocity to the appropriate player.
      if (player.getID() == 0) {
        this.aPos.x += vel.x * 5;
        this.aPos.y -= vel.y * 5;
      } else if (player.getID() == 1) {
        this.bPos.x += vel.x * 5;
        this.bPos.y -= vel.y * 5;
      }
    }
  }

  // Normally, we have to implement a serialize / deserialize function
  // for our state. However, there is an autoserializer that can handle
  // simple states for us. We don't need to do anything here!
  // serialize() {}
  // deserialize(value) {}

  // Draw the state of our game onto a canvas.
  draw(canvas: HTMLCanvasElement) {
    const ctx = nullthrows(canvas.getContext("2d"));

    // Fill with black.
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw squares for the players.
    ctx.fillStyle = "red";
    ctx.fillRect(this.aPos.x - 5, this.aPos.y - 5, 10, 10);
    ctx.fillStyle = "blue";
    ctx.fillRect(this.bPos.x - 5, this.bPos.y - 5, 10, 10);
  }

  static timestep = 1000 / 60;
  static canvasSize = { width: 600, height: 300 };
}

export function useInit(initFn: () => void) {
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) {
      return;
    } else {
      initFn();
      initRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function Netplay() {
  useInit(() => {
    SimpleGame.timestep = 1000 / 60; // Our game runs at 60 FPS
    SimpleGame.canvasSize = { width: 600, height: 300 };

    // Because our game can be easily rewound, we will use Rollback netcode
    // If your game cannot be rewound, you should use LockstepWrapper instead.
    new RollbackWrapper(SimpleGame).start();
  });

  return "netplay";
}
