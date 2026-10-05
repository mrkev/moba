import { useSyncExternalStore } from "react";
import type { MainLevel } from "./MainLevel";
import { CHAMPION_FACESETS } from "./view/sprites";

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// keeps HUD buttons from taking focus, so Space/Enter don't re-press them
function preventFocus(e: React.MouseEvent) {
  e.preventDefault();
}

export function PlayerHUD({ level }: { level: MainLevel }) {
  const hud = useSyncExternalStore(level.subscribe, level.getHud);
  if (hud == null) {
    return null;
  }

  const abilityReady = hud.abilityCooldown === 0 && !hud.dead;

  return (
    <div style={{ display: "flex", flexDirection: "row", gap: 4 }}>
      {/* stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 2fr" }}>
        <i className="ri-sword-fill" title="Attack damage"></i>{" "}
        {hud.attackDamage}
        <i className="ri-fire-fill" title="Ability power"></i>{" "}
        {hud.abilityPower}
        <i className="ri-shield-fill" title="Armor"></i> {hud.armor}
        <i className="ri-run-fill" title="Move speed"></i> {hud.moveSpeed}
        <i className="ri-timer-flash-line" title="Attacks per second"></i>{" "}
        {hud.attackSpeed}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div>
          {["Q", "W", "E", "R"].map((key) => (
            <button
              key={key}
              disabled={!abilityReady}
              onMouseDown={preventFocus}
              onClick={() => level.castSkillshot()}
              title={`Skillshot (${hud.abilityCooldownMax}s cooldown)`}
            >
              {hud.abilityCooldown > 0 ? hud.abilityCooldown.toFixed(1) : key}
            </button>
          ))}
        </div>
        <progress
          max={hud.maxHp}
          value={hud.hp}
          title={`${hud.hp} / ${hud.maxHp}`}
        >
          {hud.hp} / {hud.maxHp}
        </progress>
        <div style={{ fontSize: 12 }}>
          <i className="ri-heart-fill"></i> {hud.hp} / {hud.maxHp}
          {" · "}
          {formatTime(hud.gameTime)}
          {hud.dead && ` · respawning in ${hud.respawnIn}s`}
        </div>
      </div>
      <img
        src={CHAMPION_FACESETS[hud.champion]}
        width={64}
        height={64}
        style={{
          imageRendering: "pixelated",
          filter: hud.dead ? "grayscale(1)" : undefined,
        }}
      />
      <label style={{ fontSize: 12, alignSelf: "flex-start" }}>
        <input
          type="checkbox"
          checked={hud.debug}
          onMouseDown={preventFocus}
          onChange={() => level.toggleDebug()}
        />{" "}
        Debug (`)
      </label>
    </div>
  );
}
