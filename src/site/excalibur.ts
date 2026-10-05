import * as ex from "excalibur";
import { Cavegirl2 } from "./champions/Cavegirl2";
import { riftTilemapResource } from "./MainLevel";
import { Turret } from "./Turret";

export const loader = new ex.Loader([
  riftTilemapResource,
  Cavegirl2.sprite,
  Turret.sprite,
]);
