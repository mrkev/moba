import { ItemId } from "./types";

export interface ItemStats {
  attackDamage?: number;
  abilityPower?: number;
  armor?: number;
  maxHp?: number;
  maxMana?: number;
  // fraction of base attack speed
  attackSpeed?: number;
  // flat, px/s
  moveSpeed?: number;
}

export interface ItemDef {
  name: string;
  cost: number;
  stats: ItemStats;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  longSword: { name: "Long Sword", cost: 350, stats: { attackDamage: 10 } },
  amplifyingTome: {
    name: "Amplifying Tome",
    cost: 400,
    stats: { abilityPower: 20 },
  },
  clothArmor: { name: "Cloth Armor", cost: 300, stats: { armor: 15 } },
  rubyCrystal: { name: "Ruby Crystal", cost: 400, stats: { maxHp: 150 } },
  sapphireCrystal: {
    name: "Sapphire Crystal",
    cost: 350,
    stats: { maxMana: 250 },
  },
  dagger: { name: "Dagger", cost: 300, stats: { attackSpeed: 0.12 } },
  boots: { name: "Boots", cost: 300, stats: { moveSpeed: 8 } },
  bfSword: { name: "B. F. Sword", cost: 1300, stats: { attackDamage: 40 } },
  largeRod: {
    name: "Needlessly Large Rod",
    cost: 1250,
    stats: { abilityPower: 60 },
  },
  giantsBelt: { name: "Giant's Belt", cost: 900, stats: { maxHp: 350 } },
  chainVest: { name: "Chain Vest", cost: 800, stats: { armor: 40 } },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export function itemStats(items: (ItemId | null)[]): Required<ItemStats> {
  const total: Required<ItemStats> = {
    attackDamage: 0,
    abilityPower: 0,
    armor: 0,
    maxHp: 0,
    maxMana: 0,
    attackSpeed: 0,
    moveSpeed: 0,
  };
  for (const id of items) {
    if (id == null) {
      continue;
    }
    for (const [stat, value] of Object.entries(ITEMS[id].stats)) {
      total[stat as keyof ItemStats] += value;
    }
  }
  return total;
}
