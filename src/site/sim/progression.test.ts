import { describe, expect, it } from "vitest";
import { canLevelAbility } from "./abilities";
import { botInput } from "./bot";
import {
  CHAMPIONS,
  ECONOMY,
  MINIONS,
  RECALL_TIME,
  SHOP_RADIUS,
  seconds,
  xpToNextLevel,
} from "./constants";
import { createGame } from "./game";
import { ITEMS } from "./items";
import { grantXp } from "./progression";
import { step } from "./step";
import { newGame, placeChampion, run, structureAt, testMap } from "./testing";
import { Champion } from "./types";
import { distance } from "./vec";
import { championOf, spawnChampion, spawnMinion } from "./world";

const LANE_SPOT = { x: 500, y: 500 };

// an enemy champion that stands still and doesn't fight back
function dummyEnemy(state: ReturnType<typeof newGame>["state"]) {
  const enemy = spawnChampion(state, 9, "red", "caveman2");
  enemy.pos = { x: LANE_SPOT.x, y: LANE_SPOT.y + 40 };
  enemy.baseMoveSpeed = 0;
  return enemy;
}

describe("experience", () => {
  it("is shared by nearby champions when minions die", () => {
    const { state, map, champ } = newGame();
    placeChampion(champ, LANE_SPOT);
    const minion = spawnMinion(state, "red", "mid", "caster", {
      x: LANE_SPOT.x + 30,
      y: LANE_SPOT.y,
    });
    minion.hp = 0;
    run(state, map, 1);
    expect(champ.xp).toBe(MINIONS.caster.xp);
  });

  it("levels up, growing stats and granting ability points", () => {
    const { state, champ } = newGame();
    const hp = champ.maxHp;
    grantXp(state, champ, xpToNextLevel(1), []);
    expect(champ.level).toBe(2);
    expect(champ.abilityPoints).toBe(2);
    expect(champ.maxHp).toBe(hp + CHAMPIONS.cavegirl2.perLevel.maxHp);
  });

  it("gates ability ranks by level", () => {
    const { state, champ } = newGame();
    expect(canLevelAbility(champ, "q")).toBe(true);
    expect(canLevelAbility(champ, "r")).toBe(false);
    champ.abilities.q.rank = 1;
    champ.abilityPoints = 1;
    // a basic ability's rank can't exceed half the champion's level
    expect(canLevelAbility(champ, "q")).toBe(false);
    for (let level = 1; level < 6; level++) {
      grantXp(state, champ, xpToNextLevel(level), []);
    }
    expect(champ.level).toBe(6);
    expect(canLevelAbility(champ, "r")).toBe(true);
  });
});

describe("gold", () => {
  it("rewards last hits", () => {
    const { state, map, champ } = newGame();
    placeChampion(champ, LANE_SPOT);
    const minion = spawnMinion(state, "red", "mid", "melee", {
      x: LANE_SPOT.x,
      y: LANE_SPOT.y + 30,
    });
    minion.hp = 1;
    minion.attack = null;
    minion.baseMoveSpeed = 0;
    const gold = champ.gold;
    run(state, map, seconds(1), {
      commands: [{ type: "smartClick", pos: minion.pos }],
    });
    expect(champ.creepScore).toBe(1);
    expect(champ.gold).toBeCloseTo(gold + MINIONS.melee.gold, 5);
  });

  it("rewards champion kills", () => {
    const { state, map, champ } = newGame();
    placeChampion(champ, LANE_SPOT);
    const enemy = dummyEnemy(state);
    enemy.hp = 1;
    const gold = champ.gold;
    run(state, map, seconds(1), {
      commands: [{ type: "smartClick", pos: enemy.pos }],
    });
    expect(enemy.dead).toBe(true);
    expect(enemy.deaths).toBe(1);
    expect(champ.kills).toBe(1);
    expect(champ.gold).toBeCloseTo(gold + ECONOMY.championKill, 5);
  });

  it("trickles in once minions spawn", () => {
    const { state, map, champ } = newGame();
    state.nextWaveTick = Infinity;
    run(state, map, seconds(10) + 1);
    expect(champ.gold).toBeGreaterThan(ECONOMY.startingGold);
  });
});

describe("abilities", () => {
  function ready(champ: Champion) {
    for (const ability of Object.values(champ.abilities)) {
      ability.rank = 1;
    }
  }

  it("Q damages and slows the first enemy hit, costing mana", () => {
    const { state, map, champ } = newGame();
    placeChampion(champ, LANE_SPOT);
    ready(champ);
    const enemy = dummyEnemy(state);
    const mana = champ.mana;
    run(state, map, seconds(0.5), {
      commands: [{ type: "cast", slot: "q", target: enemy.pos }],
    });
    expect(enemy.hp).toBeLessThan(enemy.maxHp);
    expect(enemy.effects.some((e) => e.kind === "slow")).toBe(true);
    expect(champ.mana).toBeLessThan(mana);
    expect(champ.abilities.q.cooldown).toBeGreaterThan(0);
  });

  it("can't be cast before being learned or while on cooldown", () => {
    const { state, map, champ } = newGame();
    placeChampion(champ, LANE_SPOT);
    run(state, map, 1, {
      commands: [{ type: "cast", slot: "q", target: { x: 0, y: 0 } }],
    });
    expect(state.projectiles).toHaveLength(0);
    champ.abilities.q.rank = 1;
    champ.abilities.q.cooldown = 100;
    run(state, map, 1, {
      commands: [{ type: "cast", slot: "q", target: { x: 0, y: 0 } }],
    });
    expect(state.projectiles).toHaveLength(0);
  });

  it("W speeds the champion up for a while", () => {
    const { state, map, champ } = newGame();
    ready(champ);
    const speed = champ.moveSpeed;
    run(state, map, 2, {
      commands: [{ type: "cast", slot: "w", target: champ.pos }],
    });
    expect(champ.moveSpeed).toBeGreaterThan(speed);
    run(state, map, seconds(5));
    expect(champ.moveSpeed).toBeCloseTo(speed, 5);
  });

  it("E dashes towards the target, up to its range", () => {
    const { state, map, champ } = newGame();
    placeChampion(champ, LANE_SPOT);
    ready(champ);
    run(state, map, seconds(1), {
      commands: [{ type: "cast", slot: "e", target: { x: 1000, y: 500 } }],
    });
    expect(champ.pos.x).toBeCloseTo(LANE_SPOT.x + 64, 0);
  });

  it("R lands after a delay and hits everyone in the area", () => {
    const { state, map, champ } = newGame();
    placeChampion(champ, LANE_SPOT);
    ready(champ);
    const enemy = dummyEnemy(state);
    const minion = spawnMinion(state, "red", "mid", "melee", {
      x: enemy.pos.x + 10,
      y: enemy.pos.y,
    });
    minion.baseMoveSpeed = 0;
    minion.attack = null;
    champ.attack = null;
    run(state, map, 1, {
      commands: [{ type: "cast", slot: "r", target: enemy.pos }],
    });
    expect(state.zones).toHaveLength(1);
    const enemyHp = enemy.hp;
    run(state, map, seconds(1));
    expect(state.zones).toHaveLength(0);
    expect(enemy.hp).toBeLessThan(enemyHp - 100);
    expect(minion.hp).toBeLessThan(minion.maxHp);
  });
});

describe("recall", () => {
  it("returns to the fountain after channeling", () => {
    const { state, map, champ } = newGame();
    placeChampion(champ, LANE_SPOT);
    run(state, map, RECALL_TIME + 2, { commands: [{ type: "recall" }] });
    expect(champ.pos).toEqual(state.fountains.blue);
  });

  it("is interrupted by moving", () => {
    const { state, map, champ } = newGame();
    placeChampion(champ, LANE_SPOT);
    run(state, map, 10, { commands: [{ type: "recall" }] });
    run(state, map, 1, { move: { x: 1, y: 0 } });
    run(state, map, RECALL_TIME);
    expect(champ.recallLeft).toBeNull();
    expect(distance(champ.pos, LANE_SPOT)).toBeLessThan(10);
  });
});

describe("shop", () => {
  it("sells items at the fountain, which add stats", () => {
    const { state, map, champ } = newGame();
    const ad = champ.attack!.damage;
    run(state, map, 1, { commands: [{ type: "buy", item: "longSword" }] });
    expect(champ.items[0]).toBe("longSword");
    expect(champ.gold).toBeCloseTo(
      ECONOMY.startingGold - ITEMS.longSword.cost,
      5
    );
    expect(champ.attack!.damage).toBe(ad + 10);

    run(state, map, 1, { commands: [{ type: "sell", slot: 0 }] });
    expect(champ.items[0]).toBeNull();
    expect(champ.attack!.damage).toBe(ad);
  });

  it("only works near the fountain", () => {
    const { state, map, champ } = newGame();
    placeChampion(champ, {
      x: state.fountains.blue.x + SHOP_RADIUS + 20,
      y: state.fountains.blue.y - SHOP_RADIUS - 20,
    });
    run(state, map, 1, { commands: [{ type: "buy", item: "longSword" }] });
    expect(champ.items[0]).toBeNull();
  });

  it("refuses what you can't afford", () => {
    const { state, map, champ } = newGame();
    run(state, map, 1, { commands: [{ type: "buy", item: "bfSword" }] });
    expect(champ.items[0]).toBeNull();
    expect(champ.gold).toBe(ECONOMY.startingGold);
  });
});

describe("bots", () => {
  function botGame() {
    const map = testMap();
    const state = createGame(map, [
      { playerId: 0, team: "blue", champion: "cavegirl2" },
      { playerId: 1, team: "red", champion: "caveman2" },
    ]);
    return { state, map };
  }

  it("play a full game against each other", () => {
    const { state, map } = botGame();
    for (let i = 0; i < seconds(600) && state.winner == null; i++) {
      step(state, map, { 0: botInput(state, 0), 1: botInput(state, 1) });
    }
    for (const playerId of [0, 1]) {
      const bot = championOf(state, playerId)!;
      expect(bot.level).toBeGreaterThan(3);
      expect(bot.creepScore).toBeGreaterThan(10);
      expect(bot.items.some((i) => i != null)).toBe(true);
      expect(bot.abilities.q.rank).toBeGreaterThan(0);
    }
    const damaged = state.units.filter(
      (u) => u.kind === "structure" && u.hp < u.maxHp
    );
    expect(damaged.length).toBeGreaterThan(0);
  }, 60000);

  it("are deterministic", () => {
    const play = () => {
      const { state, map } = botGame();
      for (let i = 0; i < seconds(120); i++) {
        step(state, map, { 0: botInput(state, 0), 1: botInput(state, 1) });
      }
      return JSON.stringify(state);
    };
    expect(play()).toEqual(play());
  }, 30000);

  it("stay out of an enemy turret's range when it's free to shoot them", () => {
    const { state, map } = botGame();
    const bot = championOf(state, 1)!;
    const turret = structureAt(state, "blue", "outer", "mid");
    let ticksInRange = 0;
    for (let i = 0; i < seconds(120); i++) {
      step(state, map, { 1: botInput(state, 1) });
      if (turret.targetId === bot.id) {
        ticksInRange++;
      }
    }
    // it might get caught for a moment, but shouldn't tank the turret
    expect(ticksInRange).toBeLessThan(seconds(5));
  });
});
