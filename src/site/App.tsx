import * as ex from "excalibur";
import "./App.css";
import { loader } from "./excalibur.ts";
import { MainLevel } from "./MainLevel.ts";
import { useEffect, useMemo, useRef } from "react";
import { PlayerHUD } from "./PlayerHUD.tsx";

export function App() {
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) {
      return;
    }
    const game = new ex.Engine({
      width: 400,
      height: 500,
      backgroundColor: ex.Color.fromHex("#54C0CA"),
      pixelArt: true,
      antialiasing: false,
      // pixelRatio: 2,
      resolution: { width: 200, height: 250 },
      displayMode: ex.DisplayMode.FitScreen,
      scenes: { Level: new MainLevel() },
      pointerScope: ex.PointerScope.Canvas,
    });

    game.start(loader).then(async () => {
      await game.goToScene("Level");
    });
    initRef.current = true;
  }, []);

  return (
    <>
      <PlayerHUD />
    </>
  );
}
