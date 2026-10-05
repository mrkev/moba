import * as ex from "excalibur";
import { ChampionName, MinionType, Team, TurretTier } from "../sim/types";
import { DirectionalAnim, directionalAnims } from "./DirectionalAnim";

// A character from the asset pack: a 4x7 sheet of 16px frames
export class CharacterSprites {
  readonly image: ex.ImageSource;
  readonly animWalk: DirectionalAnim;
  readonly animIdle: DirectionalAnim;
  readonly animAttack: DirectionalAnim;

  constructor(name: string) {
    this.image = new ex.ImageSource(
      `assets/rift/Actor/Characters/${name}/SpriteSheet.png`
    );
    const spriteSheet = ex.SpriteSheet.fromImageSource({
      image: this.image,
      grid: {
        columns: 4,
        rows: 7,
        spriteHeight: 16,
        spriteWidth: 16,
      },
    });
    this.animWalk = directionalAnims(spriteSheet, {
      down: [0, 4, 8, 12],
      up: [1, 5, 9, 13],
      left: [2, 6, 10, 14],
      right: [3, 7, 11, 15],
    });
    this.animIdle = directionalAnims(spriteSheet, {
      down: [0],
      up: [1],
      left: [2],
      right: [3],
    });
    this.animAttack = directionalAnims(spriteSheet, {
      down: [16],
      up: [17],
      left: [18],
      right: [19],
    });
  }
}

export const CHAMPION_SPRITES: Record<ChampionName, CharacterSprites> = {
  cavegirl2: new CharacterSprites("Cavegirl2"),
};

// portraits for the HUD
export const CHAMPION_FACESETS: Record<ChampionName, string> = {
  cavegirl2: "assets/rift/Actor/Characters/Cavegirl2/Faceset.png",
};

export const MINION_SPRITES: Record<
  Team,
  Record<MinionType, CharacterSprites>
> = {
  blue: {
    melee: new CharacterSprites("NinjaBlue"),
    caster: new CharacterSprites("NinjaBlue2"),
  },
  red: {
    melee: new CharacterSprites("NinjaRed"),
    caster: new CharacterSprites("NinjaRed2"),
  },
};

const towersImage = new ex.ImageSource(
  "assets/rift/Tilesets/TilesetTowers.png"
);

const towersSheet = ex.SpriteSheet.fromImageSource({
  image: towersImage,
  grid: {
    columns: 12,
    rows: 3,
    spriteHeight: 32,
    spriteWidth: 32,
  },
});

// [column, row] in the towers sheet, matching what the map uses
const TURRET_SPRITES: Record<Team, Record<TurretTier, [number, number]>> = {
  red: { outer: [3, 2], inner: [3, 2], base: [6, 0], nexus: [6, 0] },
  blue: { outer: [6, 1], inner: [6, 1], base: [9, 0], nexus: [9, 0] },
};
const NEXUS_SPRITE: [number, number] = [9, 2];

export function structureSprite(
  team: Team,
  tier: TurretTier | null
): ex.Sprite {
  const [col, row] = tier ? TURRET_SPRITES[team][tier] : NEXUS_SPRITE;
  return towersSheet.getSprite(col, row);
}

export const images: ex.ImageSource[] = [
  towersImage,
  ...Object.values(CHAMPION_SPRITES).map((s) => s.image),
  ...Object.values(MINION_SPRITES).flatMap((byType) =>
    Object.values(byType).map((s) => s.image)
  ),
];
