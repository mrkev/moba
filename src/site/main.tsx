import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./excalibur.ts";
import "remixicon/fonts/remixicon.css";

ReactDOM.createRoot(document.getElementById("reactRoot")!).render(
  <React.StrictMode>
    <PlayerHUD />
  </React.StrictMode>
);

function PlayerHUD() {
  return (
    <div style={{ display: "flex", flexDirection: "row" }}>
      {/* stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 2fr" }}>
        {/* AD */}
        <i className="ri-sword-fill"></i> 10
        {/* HP */}
        <i className="ri-heart-fill"></i> 10
        {/* AP */}
        <i className="ri-fire-fill"></i> 10
        {/* DEF */}
        <i className="ri-shield-fill"></i> 10
        {/* SPEED */}
        <i className="ri-run-fill"></i> 10
        {/* Haste */}
        <i className="ri-timer-flash-line"></i> 10
        {/* <i className="ri-thunderstorms-fill"></i>
    <i className="ri-bubble-chart-fill"></i>
    <i className="ri-edit-circle-line"></i>
    <i className="ri-dislike-fill"></i>
    <i className="ri-mastercard-line"></i>
    <i className="ri-bell-fill"></i> */}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div>
          <button>Q</button>
          <button>W</button>
          <button>E</button>
          <button>R</button>
        </div>
        <progress max="100" value="70">
          70%
        </progress>
        <progress max="100" value="70">
          70%
        </progress>
      </div>
      <img
        src="assets/rift/Actor/Characters/Cavegirl2/Faceset.png"
        width={64}
        height={64}
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
