import {
  CHAMPIONS,
  MAX_LEVEL,
  SELL_RATIO,
  SHOP_RADIUS,
  TICK_RATE,
  xpToNextLevel,
} from "./constants";
import { ITEMS, itemStats } from "./items";
import { Champion, GameState, ItemId, Mobile, SimEvent } from "./types";
import { distance, Vec } from "./vec";

// Drops expired effects and applies the rest to a unit's speed. Champions get
// their other stats recomputed too.
export function updateStats(state: GameState, unit: Mobile) {
  unit.effects = unit.effects.filter((e) => e.until > state.tick);
  let hasteMove = 0;
  let hasteAttack = 0;
  let slow = 0;
  for (const effect of unit.effects) {
    switch (effect.kind) {
      case "haste":
        hasteMove += effect.moveSpeed;
        hasteAttack += effect.attackSpeed;
        break;
      case "slow":
        slow = Math.max(slow, effect.amount);
        break;
    }
  }

  if (unit.kind === "champion") {
    const def = CHAMPIONS[unit.champion];
    const items = itemStats(unit.items);
    const growth = unit.level - 1;
    const stat = (key: keyof typeof def.base) =>
      def.base[key] + def.perLevel[key] * growth;

    const maxHp = stat("maxHp") + items.maxHp;
    const maxMana = stat("maxMana") + items.maxMana;
    // gaining max hp or mana also fills it by as much
    unit.hp = Math.max(0, unit.hp + maxHp - unit.maxHp);
    unit.mana = Math.max(0, unit.mana + maxMana - unit.maxMana);
    unit.maxHp = maxHp;
    unit.maxMana = maxMana;
    unit.hp = Math.min(unit.hp, unit.maxHp);
    unit.mana = Math.min(unit.mana, unit.maxMana);
    unit.armor = stat("armor") + items.armor;
    unit.abilityPower = items.abilityPower;
    unit.hpRegen = stat("hpRegen");
    unit.manaRegen = stat("manaRegen");
    unit.baseMoveSpeed = def.moveSpeed + items.moveSpeed;

    const attacksPerSecond =
      def.base.attackSpeed *
      (1 + def.perLevel.attackSpeed * growth + items.attackSpeed + hasteAttack);
    unit.attack = {
      damage: stat("attackDamage") + items.attackDamage,
      range: def.attackRange,
      interval: Math.max(1, Math.round(TICK_RATE / attacksPerSecond)),
      projectileSpeed: def.projectileSpeed,
    };
  }

  unit.moveSpeed = unit.baseMoveSpeed * (1 + hasteMove) * (1 - slow);
}

export function grantXp(
  state: GameState,
  champ: Champion,
  amount: number,
  events: SimEvent[]
) {
  if (champ.level >= MAX_LEVEL) {
    return;
  }
  champ.xp += amount;
  while (champ.level < MAX_LEVEL && champ.xp >= xpToNextLevel(champ.level)) {
    champ.xp -= xpToNextLevel(champ.level);
    champ.level++;
    champ.abilityPoints++;
    events.push({ type: "levelUp", unitId: champ.id, level: champ.level });
  }
  if (champ.level >= MAX_LEVEL) {
    champ.xp = 0;
  }
  updateStats(state, champ);
}

export function grantGold(
  champ: Champion,
  amount: number,
  pos: Vec,
  events: SimEvent[]
) {
  champ.gold += amount;
  events.push({ type: "gold", unitId: champ.id, amount, pos: { ...pos } });
}

export function canShop(state: GameState, champ: Champion): boolean {
  return (
    champ.dead ||
    distance(champ.pos, state.fountains[champ.team]) <= SHOP_RADIUS
  );
}

export function buyItem(state: GameState, champ: Champion, item: ItemId) {
  const cost = ITEMS[item].cost;
  const slot = champ.items.indexOf(null);
  if (!canShop(state, champ) || champ.gold < cost || slot === -1) {
    return;
  }
  champ.gold -= cost;
  champ.items[slot] = item;
  updateStats(state, champ);
}

export function sellItem(state: GameState, champ: Champion, slot: number) {
  const item = champ.items[slot];
  if (item == null || !canShop(state, champ)) {
    return;
  }
  champ.gold += Math.floor(ITEMS[item].cost * SELL_RATIO);
  champ.items[slot] = null;
  updateStats(state, champ);
}
