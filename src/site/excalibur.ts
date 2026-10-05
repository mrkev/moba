import * as ex from "excalibur";
import { riftTilemapResource } from "./MainLevel";
import { images } from "./view/sprites";

export const loader = new ex.Loader([riftTilemapResource, ...images]);
