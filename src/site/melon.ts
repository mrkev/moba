/* eslint-disable @typescript-eslint/no-explicit-any */
import { TiledInflatePlugin } from "@melonjs/tiled-inflate-plugin";
import * as me from "melonjs";
import { device } from "melonjs";
import { nullthrows } from "./nullthrows";

/**
 *
 * a basic Tiled loader
 */

export default function onload() {
  // init the video
  if (!me.video.init(1024, 786, { parent: "screen", scaleMethod: "flex" })) {
    alert("Your browser does not support HTML5 canvas.");
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  me.plugin.register(TiledInflatePlugin as any);

  // set all ressources to be loaded
  me.loader.preload(resources, () => {
    // subscribe to key down and mouse scroll event to move the map
    me.event.on(me.event.KEYDOWN, (e: any) => {
      (keyPressed as any)(e);
    });
    me.input.registerPointerEvent("wheel", me.game.viewport, (e) => {
      onScroll(e);
    });

    // load selected level on change event
    nullthrows(document.getElementById("level_name")).addEventListener(
      "change",
      () => {
        levelSelector();
      }
    );

    // load default level
    levelSelector();
  });
}

/**
 * pointermove function
 */
function onScroll(event: any) {
  if (event.deltaX !== 0) {
    keyPressed(null, event.deltaX < 0 ? me.input.KEY.LEFT : me.input.KEY.RIGHT);
  }
  if (event.deltaY !== 0) {
    keyPressed(null, event.deltaY < 0 ? me.input.KEY.UP : me.input.KEY.DOWN);
  }
}

/**
 * update function
 */
function keyPressed(action: any, keyCode: any) {
  // navigate the map :)
  if (keyCode === me.input.KEY.LEFT) {
    me.game.viewport.move(-(me.level.getCurrentLevel().tilewidth / 2), 0);
  }
  if (keyCode === me.input.KEY.RIGHT) {
    me.game.viewport.move(me.level.getCurrentLevel().tilewidth / 2, 0);
  }
  if (keyCode === me.input.KEY.UP) {
    me.game.viewport.move(0, -(me.level.getCurrentLevel().tileheight / 2));
  }
  if (keyCode === me.input.KEY.DOWN) {
    me.game.viewport.move(0, me.level.getCurrentLevel().tileheight / 2);
  }

  // shake it
  if (keyCode === me.input.KEY.ENTER) {
    me.game.viewport.shake(16, 500);
  }

  //zoom in/out
  if (keyCode === me.input.KEY.MINUS) {
    console.log("zoom out");
  }
  if (keyCode === me.input.KEY.PLUS) {
    console.log("zoom in");
  }

  // force redraw
  me.game.repaint();
}

/**
 *
 * change the current level
 * using the listbox current value in the HTML file
 */
function levelSelector() {
  let level = "rift";

  switch (nullthrows(document.getElementById("level_name")).value || 1) {
    case "0":
      level = "rift";
      break;
    case "1":
      level = "village";
      break;
    case "2":
      level = "desert";
      break;
    case "3":
      level = "sewers";
      break;
    case "4":
      level = "isometric";
      break;
    case "5":
      level = "orthogonal";
      break;
    case "6":
      level = "perspective";
      break;
    case "7":
      level = "hexagonal-mini";
      break;
    case "8":
      level = "rpg";
      break;
    case "9":
      level = "MagicLand";
      break;
    case "10":
      level = "jb-32";
      break;
    case "11":
      level = "gameart2d-desert";
      break;
    case "12":
      level = "level25";
      break;
    case "13":
      level = "island-rotated-tiles";
      break;
    case "14":
      level = "desert-infinite";
      break;
    case "15":
      level = "lunar";
      break;
    default:
      level = "village";
      break;
  }

  // load the new level
  me.level.load(level, {
    container: me.game.world,
    onLoaded: () => {
      // set the background to black
      me.game.world.backgroundColor.setColor(0, 0, 0);

      me.game.viewport.currentTransform.scale(4);
      // force redraw
      me.game.repaint();
    },
  });
}

device.onReady(function onReady() {
  onload();
});

const resources = [
  { name: "rift", type: "tmx", src: "/assets/rift/rift.tmx" },
  { name: "TilesetFloor", type: "tsx", src: "/assets/rift/TilesetFloor.tsx" },
  {
    // name: "Tilesets/TilesetFloor.png",
    name: "TilesetFloor",
    type: "image",
    src: "/assets/rift/Tilesets/TilesetFloor.png",
  },
  { name: "TilesetNature", type: "tsx", src: "/assets/rift/TilesetNature.tsx" },
  {
    // name: "Tilesets/TilesetNature.png",
    name: "TilesetNature",
    type: "image",
    src: "/assets/rift/Tilesets/TilesetNature.png",
  },
  { name: "TilesetTowers", type: "tsx", src: "/assets/rift/TilesetTowers.tsx" },
  {
    // name: "Tilesets/TilesetTowers.png",
    name: "TilesetTowers",
    type: "image",
    src: "/assets/rift/Tilesets/TilesetTowers.png",
  },
  {
    name: "fgrxon2d9km71",
    type: "image",
    src: "/assets/fgrxon2d9km71.jpg",
  },

  // // village example
  // { name: "village", type: "tmx", src: "data/map/village.tmx" },
  // {
  //   name: "free_tileset_version_10",
  //   type: "image",
  //   src: "data/map/free_tileset_version_10.png",
  // },
  // // desert example
  // { name: "desert", type: "tmx", src: "data/map/desert.tmx" },
  // { name: "desert-infinite", type: "tmx", src: "data/map/desert-infinite.tmx" },
  // { name: "desert", type: "tsx", src: "data/map/desert.tsj" },
  // {
  //   name: "tmw_desert_spacing",
  //   type: "image",
  //   src: "data/map/tmw_desert_spacing.png",
  // },
  // // sewer
  // { name: "sewer_tileset", type: "image", src: "data/map/sewer_tileset.png" },
  // { name: "sewers", type: "tmx", src: "data/map/sewers.tmx" },

  // // isometric
  // {
  //   name: "isometric",
  //   type: "tmx",
  //   src: "data/map/isometric_grass_and_water.tmx",
  // },
  // {
  //   name: "isometric_grass_and_water",
  //   type: "image",
  //   src: "data/map/isometric_grass_and_water.png",
  // },
  // {
  //   name: "perspective_walls",
  //   type: "image",
  //   src: "data/map/perspective_walls.png",
  // },

  // //orthogonal
  // { name: "orthogonal", type: "tmx", src: "data/map/orthogonal-outside.tmx" },
  // { name: "buch-outdoor", type: "image", src: "data/map/buch-outdoor.png" },

  // // perspective
  // { name: "perspective", type: "tmx", src: "data/map/perspective_walls.tmx" },
  // {
  //   name: "perspective_walls",
  //   type: "tsx",
  //   src: "data/map/perspective_walls.tsx",
  // },

  // // hexagonal mini
  // { name: "hexagonal-mini", type: "tmx", src: "data/map/hexagonal-mini.tmx" },
  // { name: "hexmini", type: "image", src: "data/map/hexmini.png" },

  // // rpg
  // { name: "rpg", type: "tmx", src: "data/map/rpg/island.tmx" },
  // { name: "beach_tileset", type: "tsx", src: "data/map/rpg/beach_tileset.tsx" },
  // {
  //   name: "beach_tileset",
  //   type: "image",
  //   src: "data/map/rpg/beach_tileset.png",
  // },

  // // Magicland Dizzy
  // { name: "MagicLand", type: "tmx", src: "data/map/jamesbowman/MagicLand.tmx" },
  // {
  //   name: "magiclanddizzy_tiles",
  //   type: "image",
  //   src: "data/map/jamesbowman/magiclanddizzy_tiles.gif",
  // },

  // // JB 32
  // { name: "jb-32", type: "tmx", src: "data/map/jamesbowman/jb-32.tmx" },
  // {
  //   name: "jb-32-Tileset",
  //   type: "image",
  //   src: "data/map/jamesbowman/jb-32-Tileset.png",
  // },

  // // gameart2d desert
  // {
  //   name: "gameart2d-desert",
  //   type: "tmx",
  //   src: "data/map/jamesbowman/gameart2d-desert.tmx",
  // },
  // {
  //   name: "gameart2d-desert",
  //   type: "image",
  //   src: "data/map/jamesbowman/gameart2d-desert.png",
  // },

  // // level 25
  // { name: "level25", type: "tmx", src: "data/map/jamesbowman/level25.tmx" },
  // {
  //   name: "level25-Tileset",
  //   type: "image",
  //   src: "data/map/jamesbowman/level25-Tileset.png",
  // },

  // // island-rotated-tiles
  // { name: "island-rotated-tiles", type: "tmx", src: "data/map/island-1.json" },
  // { name: "sprites", type: "tsx", src: "data/map/sprites.json" },
  // {
  //   name: "sprites-table-16-16",
  //   type: "image",
  //   src: "data/map/sprites-table-16-16.png",
  // },

  // // Lunar 1Bit
  // { name: "lunar", type: "tmx", src: "data/map/lunar1b/lunar.tmx" },
  // {
  //   name: "lunar1b_tileset_visual",
  //   type: "tsx",
  //   src: "data/map/lunar1b/lunar1b_tileset_visual.tsx",
  // },
  // {
  //   name: "lunar1b_tileset_visual",
  //   type: "image",
  //   src: "data/map/lunar1b/lunar1b_tileset_visual.png",
  // },
];
