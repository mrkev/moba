import { useEffect, useRef, useSyncExternalStore } from "react";
import "./hud.css";
import type { MainLevel } from "./MainLevel";
import { ITEM_IDS, ITEMS, ItemStats } from "./sim/items";
import { AbilitySlot, ItemId } from "./sim/types";
import { AbilityHud, HudState } from "./view/hud";
import { CHAMPION_FACESETS } from "./view/sprites";

// placeholder icons until there's art for these
const ABILITY_ICONS: Record<AbilitySlot, string> = {
  q: "ri-focus-3-line",
  w: "ri-megaphone-line",
  e: "ri-run-line",
  r: "ri-meteor-line",
};

const ITEM_ICONS: Record<ItemId, string> = {
  longSword: "ri-sword-line",
  amplifyingTome: "ri-book-2-line",
  clothArmor: "ri-shirt-line",
  rubyCrystal: "ri-heart-fill",
  sapphireCrystal: "ri-drop-fill",
  dagger: "ri-knife-line",
  boots: "ri-footprint-line",
  bfSword: "ri-sword-fill",
  largeRod: "ri-magic-line",
  giantsBelt: "ri-heart-add-line",
  chainVest: "ri-shield-line",
};

const STAT_LABELS: Record<keyof ItemStats, (n: number) => string> = {
  attackDamage: (n) => `+${n} attack damage`,
  abilityPower: (n) => `+${n} ability power`,
  armor: (n) => `+${n} armor`,
  maxHp: (n) => `+${n} health`,
  maxMana: (n) => `+${n} mana`,
  attackSpeed: (n) => `+${Math.round(n * 100)}% attack speed`,
  moveSpeed: (n) => `+${n} move speed`,
};

function describeItem(id: ItemId) {
  return Object.entries(ITEMS[id].stats)
    .map(([stat, n]) => STAT_LABELS[stat as keyof ItemStats](n))
    .join(", ");
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// keeps HUD buttons from taking focus, so Space/Enter don't re-press them
function preventFocus(e: React.MouseEvent) {
  e.preventDefault();
}

function Meter({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label?: string;
}) {
  return (
    <div className="hud-meter">
      <div
        className="fill"
        style={{
          width: `${max > 0 ? (value / max) * 100 : 0}%`,
          background: color,
        }}
      />
      {label && <div className="label">{label}</div>}
    </div>
  );
}

function AbilityButton({
  ability,
  level,
}: {
  ability: AbilityHud;
  level: MainLevel;
}) {
  const key = ability.slot.toUpperCase();
  const classes = ["hud-ability"];
  if (ability.rank === 0) classes.push("unlearned");
  else if (!ability.castable && ability.cooldown === 0) classes.push("no-mana");
  return (
    <div style={{ position: "relative" }}>
      {ability.canLevel && (
        <button
          className="hud-level-up"
          onMouseDown={preventFocus}
          onClick={() => level.levelAbility(ability.slot)}
          title={`Level up ${ability.name} (Ctrl+${key})`}
        >
          +
        </button>
      )}
      <button
        className={classes.join(" ")}
        disabled={!ability.castable}
        onMouseDown={preventFocus}
        onClick={() => level.cast(ability.slot)}
        title={`${ability.name} (${key}): ${ability.description}${
          ability.rank > 0 ? ` Costs ${ability.manaCost} mana.` : ""
        }`}
      >
        <i className={ABILITY_ICONS[ability.slot]}></i>
        <span className="key">{key}</span>
        {ability.rank > 0 && <span className="cost">{ability.manaCost}</span>}
        {ability.cooldown > 0 && (
          <span className="cooldown">{ability.cooldown.toFixed(1)}</span>
        )}
      </button>
      <div className="hud-pips">
        {Array.from({ length: ability.maxRank }, (_, i) => (
          <span key={i} className={i < ability.rank ? "on" : ""} />
        ))}
      </div>
    </div>
  );
}

function Shop({ hud, level }: { hud: HudState; level: MainLevel }) {
  const full = !hud.items.includes(null);
  return (
    <div className="hud-panel hud-shop">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <b>Shop</b>
        <span className="hud-dim">
          {hud.canShop ? "" : "Go back to base to buy · "}
          <button onMouseDown={preventFocus} onClick={() => level.toggleShop()}>
            Close (P)
          </button>
        </span>
      </div>
      {ITEM_IDS.map((id) => (
        <div className="hud-shop-row" key={id}>
          <i className={ITEM_ICONS[id]}></i>
          <div>
            <div>{ITEMS[id].name}</div>
            <div className="hud-dim">{describeItem(id)}</div>
          </div>
          <span className="hud-gold">{ITEMS[id].cost}</span>
          <button
            disabled={!hud.canShop || full || hud.gold < ITEMS[id].cost}
            onMouseDown={preventFocus}
            onClick={() => level.buy(id)}
          >
            Buy
          </button>
        </div>
      ))}
    </div>
  );
}

const MINIMAP_SIZE = 176;

// The scene draws into the canvas every frame; this handles the clicks.
// Left-click (or drag) looks there, right-click moves there.
function Minimap({ level }: { level: MainLevel }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    level.attachMinimap(canvasRef.current);
    return () => level.attachMinimap(null);
  }, [level]);
  const fractions = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    return [
      clamp((e.clientX - rect.left) / rect.width),
      clamp((e.clientY - rect.top) / rect.height),
    ] as const;
  };
  return (
    <canvas
      ref={canvasRef}
      className="hud-panel hud-minimap"
      width={MINIMAP_SIZE}
      height={MINIMAP_SIZE}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (e.button === 0) {
          e.currentTarget.setPointerCapture(e.pointerId);
          level.minimapPeek(...fractions(e));
        } else if (e.button === 2) {
          level.minimapMove(...fractions(e));
        }
      }}
      onPointerMove={(e) => {
        if (e.buttons & 1) {
          level.minimapPeek(...fractions(e));
        }
      }}
      onPointerUp={(e) => {
        if (e.button === 0) {
          level.minimapRelease();
        }
      }}
    />
  );
}

function EndScreen({ hud, level }: { hud: HudState; level: MainLevel }) {
  const won = hud.winner === hud.team;
  return (
    <div className="hud-overlay">
      <div className="hud-panel hud-end">
        <h1 className={won ? "victory" : "defeat"}>
          {won ? "Victory" : "Defeat"}
        </h1>
        <div>Game length {formatTime(hud.gameTime)}</div>
        {hud.scores.map((s) => (
          <div key={s.champion + s.team}>
            {s.team} · level {s.level} · {s.kills}/{s.deaths} ·{" "}
            {s.creepScore} cs
          </div>
        ))}
        <button onClick={() => level.restart()}>Play again</button>
      </div>
    </div>
  );
}

export function PlayerHUD({ level }: { level: MainLevel }) {
  const hud = useSyncExternalStore(level.subscribe, level.getHud);
  if (hud == null) {
    return null;
  }

  return (
    <div className="hud">
      <div className="hud-panel hud-stats">
        <span title="Attack damage">
          <i className="ri-sword-fill"></i> {hud.stats.attackDamage}
        </span>
        <span title="Ability power">
          <i className="ri-fire-fill"></i> {hud.stats.abilityPower}
        </span>
        <span title="Armor">
          <i className="ri-shield-fill"></i> {hud.stats.armor}
        </span>
        <span title="Move speed">
          <i className="ri-run-fill"></i> {hud.stats.moveSpeed}
        </span>
        <span title="Attacks per second">
          <i className="ri-timer-flash-line"></i> {hud.stats.attackSpeed}
        </span>
      </div>

      <div className="hud-panel hud-score">
        <div className="hud-score-row">
          <b>{formatTime(hud.gameTime)}</b>
          <label className="hud-debug" style={{ marginLeft: "auto" }}>
            <input
              type="checkbox"
              checked={hud.debug}
              onMouseDown={preventFocus}
              onChange={() => level.toggleDebug()}
            />
            Debug (`)
          </label>
        </div>
        {hud.scores.map((s) => (
          <div className="hud-score-row" key={s.champion + s.team}>
            <img
              src={CHAMPION_FACESETS[s.champion]}
              width={16}
              height={16}
              style={{
                imageRendering: "pixelated",
                filter: s.dead ? "grayscale(1)" : undefined,
              }}
            />
            <span className={`team-${s.team}`}>lvl {s.level}</span>
            <span>
              {s.kills}/{s.deaths}
            </span>
            <span className="hud-dim">{s.creepScore} cs</span>
          </div>
        ))}
      </div>

      <div className="hud-panel hud-bar">
        <div>
          <div className="hud-portrait">
            <img
              src={CHAMPION_FACESETS[hud.champion]}
              style={{ filter: hud.dead ? "grayscale(1)" : undefined }}
            />
            {hud.dead && <div className="hud-respawn">{hud.respawnIn}</div>}
            <span className="hud-level">{hud.level}</span>
          </div>
          <div style={{ marginTop: 6 }}>
            <Meter
              value={hud.xp}
              max={hud.xpToNext}
              color="var(--xp)"
              label={hud.abilityPoints > 0 ? `${hud.abilityPoints} pts` : ""}
            />
          </div>
        </div>

        <div className="hud-center">
          <div className="hud-abilities">
            {hud.abilities.map((ability) => (
              <AbilityButton
                key={ability.slot}
                ability={ability}
                level={level}
              />
            ))}
          </div>
          <Meter
            value={hud.hp}
            max={hud.maxHp}
            color="var(--hp)"
            label={`${hud.hp} / ${hud.maxHp}`}
          />
          <Meter
            value={hud.mana}
            max={hud.maxMana}
            color="var(--mana)"
            label={`${hud.mana} / ${hud.maxMana}`}
          />
          {hud.recallProgress != null && (
            <Meter
              value={hud.recallProgress}
              max={1}
              color="#7fa0ff"
              label="Recalling"
            />
          )}
        </div>

        <div className="hud-right">
          <div className="hud-items">
            {hud.items.map((item, slot) => (
              <button
                key={slot}
                className="hud-item"
                disabled={item == null || !hud.canShop}
                onMouseDown={preventFocus}
                onClick={() => level.sell(slot)}
                title={
                  item
                    ? `${ITEMS[item].name}: ${describeItem(item)}${
                        hud.canShop ? " (click to sell)" : ""
                      }`
                    : undefined
                }
              >
                {item && <i className={ITEM_ICONS[item]}></i>}
              </button>
            ))}
          </div>
          <span className="hud-gold">
            <i className="ri-copper-coin-fill"></i> {hud.gold}
          </span>
          <div className="hud-small-buttons">
            <button
              onMouseDown={preventFocus}
              onClick={() => level.toggleShop()}
            >
              Shop (P)
            </button>
            <button onMouseDown={preventFocus} onClick={() => level.recall()}>
              Recall (B)
            </button>
          </div>
        </div>
      </div>

      <Minimap level={level} />
      {hud.shopOpen && <Shop hud={hud} level={level} />}
      {hud.winner && <EndScreen hud={hud} level={level} />}
    </div>
  );
}
