"use client";

import { useRef, useState } from "react";
import {
  Driver,
  CarData,
  TeamRadio,
  Stint,
  Lap,
  Interval,
  Position,
} from "@/lib/openf1";
import { COMPOUND_COLORS, COMPOUND_LABELS } from "@/lib/constants";
import { useLaps } from "@/hooks/useRaceData";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PanelMode =
  | { type: "idle" }
  | { type: "driver"; driverNumber: number }
  | { type: "battle"; attacker: number; defender: number };

interface ContextPanelProps {
  mode: PanelMode;
  drivers: Map<number, Driver>;
  positions: Map<number, Position>;
  intervals: Map<number, Interval>;
  carData: Map<number, CarData>;
  stints: Map<number, Stint>;
  radios: TeamRadio[];
  sessionKey: number | null;
  gapHistory: Map<string, number[]>;
  onClose: () => void;
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ContextPanel({
  mode,
  drivers,
  positions,
  intervals,
  carData,
  stints,
  radios,
  sessionKey,
  gapHistory,
  onClose,
}: ContextPanelProps) {
  return (
    <aside className="w-80 shrink-0 border-l border-f1-border bg-f1-panel flex flex-col overflow-hidden">
      {mode.type === "idle" && <IdlePanel />}
      {mode.type === "driver" && (
        <DriverPanel
          driverNumber={mode.driverNumber}
          drivers={drivers}
          positions={positions}
          intervals={intervals}
          carData={carData}
          stints={stints}
          radios={radios}
          sessionKey={sessionKey}
          onClose={onClose}
        />
      )}
      {mode.type === "battle" && (
        <BattlePanel
          attacker={mode.attacker}
          defender={mode.defender}
          drivers={drivers}
          positions={positions}
          intervals={intervals}
          carData={carData}
          stints={stints}
          gapHistory={gapHistory}
          sessionKey={sessionKey}
          onClose={onClose}
        />
      )}
    </aside>
  );
}

// ─── Idle ────────────────────────────────────────────────────────────────────

function IdlePanel() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="w-12 h-12 rounded-full border border-f1-border flex items-center justify-center">
        <span className="text-f1-muted text-xl">⚑</span>
      </div>
      <div>
        <p className="text-white/60 text-sm font-mono">Select a driver</p>
        <p className="text-f1-muted text-xs font-mono mt-1">
          or wait for a battle to begin
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-2 text-left w-full">
        <div className="flex items-center gap-2 text-f1-muted text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
          Battle mode activates when gap &lt; 1s
        </div>
        <div className="flex items-center gap-2 text-f1-muted text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
          Click any driver for stats &amp; radio
        </div>
      </div>
    </div>
  );
}

// ─── Driver Panel ─────────────────────────────────────────────────────────────

interface DriverPanelProps {
  driverNumber: number;
  drivers: Map<number, Driver>;
  positions: Map<number, Position>;
  intervals: Map<number, Interval>;
  carData: Map<number, CarData>;
  stints: Map<number, Stint>;
  radios: TeamRadio[];
  sessionKey: number | null;
  onClose: () => void;
}

function DriverPanel({
  driverNumber,
  drivers,
  positions,
  intervals,
  carData,
  stints,
  radios,
  sessionKey,
  onClose,
}: DriverPanelProps) {
  const driver = drivers.get(driverNumber);
  const pos = positions.get(driverNumber);
  const interval = intervals.get(driverNumber);
  const car = carData.get(driverNumber);
  const stint = stints.get(driverNumber);
  const laps = useLaps(sessionKey, driverNumber);
  const teamColor = driver?.team_colour ? `#${driver.team_colour}` : "#888";

  const bestLap = laps.reduce<Lap | null>((best, lap) => {
    if (!lap.lap_duration) return best;
    if (!best?.lap_duration || lap.lap_duration < best.lap_duration) return lap;
    return best;
  }, null);

  if (!driver) {
    return (
      <div className="flex-1 flex items-center justify-center text-f1-muted text-xs font-mono">
        Driver not found
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-f1-border flex items-center justify-between">
        <span className="text-xs font-mono font-bold tracking-widest text-f1-muted uppercase">
          Driver Info
        </span>
        <button
          onClick={onClose}
          className="text-f1-muted hover:text-white text-xs font-mono transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Driver hero */}
        <div
          className="px-4 py-5 flex gap-4 items-start relative overflow-hidden"
          style={{ borderBottom: `1px solid ${teamColor}33` }}
        >
          <div
            className="absolute inset-0 opacity-5 pointer-events-none"
            style={{
              background: `linear-gradient(135deg, ${teamColor} 0%, transparent 60%)`,
            }}
          />
          {driver.headshot_url ? (
            <img
              src={driver.headshot_url}
              alt={driver.full_name}
              className="w-16 h-16 rounded object-cover object-top shrink-0"
              style={{ border: `2px solid ${teamColor}` }}
            />
          ) : (
            <div
              className="w-16 h-16 rounded flex items-center justify-center shrink-0"
              style={{ border: `2px solid ${teamColor}`, background: teamColor + "22" }}
            >
              <span className="text-2xl font-mono font-bold" style={{ color: teamColor }}>
                {driver.name_acronym}
              </span>
            </div>
          )}
          <div>
            <div
              className="text-2xl font-mono font-black tracking-wider"
              style={{ color: teamColor }}
            >
              {driver.name_acronym}
            </div>
            <div className="text-white/80 text-sm font-mono">{driver.full_name}</div>
            <div className="text-f1-muted text-xs font-mono mt-0.5">{driver.team_name}</div>
            <div className="flex items-center gap-2 mt-1.5">
              <span
                className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                style={{ backgroundColor: teamColor + "22", color: teamColor }}
              >
                #{driver.driver_number}
              </span>
              {driver.country_code && (
                <span className="text-f1-muted text-xs font-mono">{driver.country_code}</span>
              )}
            </div>
          </div>
        </div>

        {/* Live stats grid */}
        <div className="px-4 py-4 grid grid-cols-3 gap-3 border-b border-f1-border">
          <StatBox label="POS" value={pos ? `P${pos.position}` : "—"} />
          <StatBox
            label="GAP"
            value={
              pos?.position === 1
                ? "LEAD"
                : interval?.interval
                ? formatInterval(interval.interval)
                : "—"
            }
          />
          <StatBox label="SPEED" value={car ? `${car.speed}` : "—"} unit="km/h" />
          <StatBox label="GEAR" value={car ? String(car.n_gear) : "—"} />
          <StatBox label="THROTTLE" value={car ? `${car.throttle}` : "—"} unit="%" />
          <StatBox
            label="DRS"
            value={car ? (car.drs >= 8 ? "ON" : "OFF") : "—"}
            highlight={!!car && car.drs >= 8}
          />
        </div>

        {/* Stint info */}
        {stint && (
          <div className="px-4 py-3 border-b border-f1-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold"
                style={{
                  backgroundColor: (COMPOUND_COLORS[stint.compound] ?? "#666") + "22",
                  color: COMPOUND_COLORS[stint.compound] ?? "#666",
                  border: `1px solid ${COMPOUND_COLORS[stint.compound] ?? "#666"}`,
                }}
              >
                {COMPOUND_LABELS[stint.compound] ?? "?"}
              </span>
              <span className="text-white/70 text-xs font-mono">{stint.compound}</span>
            </div>
            <span className="text-f1-muted text-xs font-mono">
              Stint {stint.stint_number} · Age {stint.tyre_age_at_start + (stint.lap_start ?? 0)}
            </span>
          </div>
        )}

        {/* Best lap */}
        {bestLap && (
          <div className="px-4 py-3 border-b border-f1-border">
            <div className="text-f1-muted text-[10px] font-mono uppercase tracking-widest mb-2">
              Best Lap
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white font-mono text-sm">
                {formatLapTime(bestLap.lap_duration)}
              </span>
              <span className="text-f1-muted text-xs font-mono">Lap {bestLap.lap_number}</span>
            </div>
            {(bestLap.duration_sector_1 || bestLap.duration_sector_2 || bestLap.duration_sector_3) && (
              <div className="flex gap-2 mt-2">
                {[bestLap.duration_sector_1, bestLap.duration_sector_2, bestLap.duration_sector_3].map(
                  (s, i) => (
                    <div key={i} className="flex-1 bg-white/5 rounded px-2 py-1 text-center">
                      <div className="text-f1-muted text-[9px] font-mono">S{i + 1}</div>
                      <div className="text-white/70 text-[10px] font-mono">
                        {s ? s.toFixed(3) : "—"}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}

        {/* Team Radio */}
        <div className="px-4 py-3">
          <div className="text-f1-muted text-[10px] font-mono uppercase tracking-widest mb-3">
            Team Radio
          </div>
          {radios.length === 0 ? (
            <p className="text-f1-muted text-xs font-mono">No radio messages yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {radios.slice(0, 8).map((r, i) => (
                <RadioMessage key={i} radio={r} teamColor={teamColor} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Battle Panel ─────────────────────────────────────────────────────────────

interface BattlePanelProps {
  attacker: number;
  defender: number;
  drivers: Map<number, Driver>;
  positions: Map<number, Position>;
  intervals: Map<number, Interval>;
  carData: Map<number, CarData>;
  stints: Map<number, Stint>;
  gapHistory: Map<string, number[]>;
  sessionKey: number | null;
  onClose: () => void;
}

function BattlePanel({
  attacker,
  defender,
  drivers,
  positions,
  intervals,
  carData,
  stints,
  gapHistory,
  onClose,
}: BattlePanelProps) {
  const attackerDriver = drivers.get(attacker);
  const defenderDriver = drivers.get(defender);
  const attackerPos = positions.get(attacker);
  const defenderPos = positions.get(defender);
  const attackerCar = carData.get(attacker);
  const defenderCar = carData.get(defender);
  const attackerStint = stints.get(attacker);
  const defenderStint = stints.get(defender);
  const interval = intervals.get(attacker);

  const rawGap = interval?.interval ?? 0;
  const gapSec = typeof rawGap === "number" ? rawGap : parseFloat((rawGap as string).replace("+", ""));
  const history = gapHistory.get(String(attacker)) ?? [];
  const trend =
    history.length >= 3
      ? history[history.length - 1] - history[history.length - 3]
      : 0;

  const attackerColor = attackerDriver?.team_colour
    ? `#${attackerDriver.team_colour}`
    : "#888";
  const defenderColor = defenderDriver?.team_colour
    ? `#${defenderDriver.team_colour}`
    : "#888";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-f1-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-xs font-mono font-bold tracking-widest text-yellow-400 uppercase">
            Battle
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-f1-muted hover:text-white text-xs font-mono transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Gap display */}
        <div className="bg-white/5 rounded-lg p-4 text-center border border-f1-border">
          <div className="text-f1-muted text-[10px] font-mono uppercase tracking-widest mb-1">
            Gap
          </div>
          <div className="text-white font-mono text-4xl font-black tracking-tight">
            {!isNaN(gapSec) ? gapSec.toFixed(3) : "—"}
            <span className="text-lg text-f1-muted">s</span>
          </div>
          <div
            className="text-sm font-mono mt-1 font-bold"
            style={{
              color: trend < -0.05 ? "#ef4444" : trend > 0.05 ? "#22c55e" : "#888",
            }}
          >
            {trend < -0.05
              ? `▼ Closing ${Math.abs(trend).toFixed(3)}s`
              : trend > 0.05
              ? `▲ Opening ${trend.toFixed(3)}s`
              : "— Stable"}
          </div>
        </div>

        {/* Gap sparkline */}
        {history.length > 1 && (
          <GapSparkline history={history} />
        )}

        {/* Driver comparison */}
        <div className="grid grid-cols-2 gap-2">
          <DriverCard
            label="ATTACKING"
            driver={attackerDriver}
            pos={attackerPos}
            car={attackerCar}
            stint={attackerStint}
            color={attackerColor}
            isAttacker
          />
          <DriverCard
            label="DEFENDING"
            driver={defenderDriver}
            pos={defenderPos}
            car={defenderCar}
            stint={defenderStint}
            color={defenderColor}
            isAttacker={false}
          />
        </div>

        {/* Head-to-head stats */}
        <div className="flex flex-col gap-1">
          <div className="text-f1-muted text-[10px] font-mono uppercase tracking-widest mb-1">
            Live Comparison
          </div>
          {attackerCar && defenderCar && (
            <>
              <CompareRow
                label="Speed"
                a={attackerCar.speed}
                b={defenderCar.speed}
                aColor={attackerColor}
                bColor={defenderColor}
                unit="km/h"
              />
              <CompareRow
                label="Throttle"
                a={attackerCar.throttle}
                b={defenderCar.throttle}
                aColor={attackerColor}
                bColor={defenderColor}
                unit="%"
                max={100}
              />
              <CompareRow
                label="Gear"
                a={attackerCar.n_gear}
                b={defenderCar.n_gear}
                aColor={attackerColor}
                bColor={defenderColor}
              />
            </>
          )}
          {attackerStint && defenderStint && (
            <div className="flex justify-between mt-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                  style={{
                    color: COMPOUND_COLORS[attackerStint.compound] ?? "#666",
                    border: `1px solid ${COMPOUND_COLORS[attackerStint.compound] ?? "#666"}`,
                  }}
                >
                  {COMPOUND_LABELS[attackerStint.compound] ?? "?"}
                </span>
                <span style={{ color: attackerColor }}>{attackerStint.compound}</span>
              </div>
              <span className="text-f1-muted text-[10px]">Tyres</span>
              <div className="flex items-center gap-2">
                <span style={{ color: defenderColor }}>{defenderStint.compound}</span>
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                  style={{
                    color: COMPOUND_COLORS[defenderStint.compound] ?? "#666",
                    border: `1px solid ${COMPOUND_COLORS[defenderStint.compound] ?? "#666"}`,
                  }}
                >
                  {COMPOUND_LABELS[defenderStint.compound] ?? "?"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white/5 rounded p-2 text-center">
      <div className="text-f1-muted text-[9px] font-mono uppercase tracking-wider mb-1">
        {label}
      </div>
      <div
        className="text-sm font-mono font-bold"
        style={{ color: highlight ? "#22c55e" : "#fff" }}
      >
        {value}
        {unit && <span className="text-f1-muted text-[10px] ml-0.5">{unit}</span>}
      </div>
    </div>
  );
}

function RadioMessage({ radio, teamColor }: { radio: TeamRadio; teamColor: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play();
      setPlaying(true);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-white/[0.03] rounded p-2">
      <button
        onClick={toggle}
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
        style={{
          backgroundColor: playing ? teamColor + "44" : "transparent",
          border: `1px solid ${teamColor}55`,
        }}
      >
        <span style={{ color: teamColor }} className="text-xs">
          {playing ? "■" : "▶"}
        </span>
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-white/60 text-[10px] font-mono">
          {new Date(radio.date).toLocaleTimeString()}
        </div>
      </div>
      <audio
        ref={audioRef}
        src={radio.recording_url}
        onEnded={() => setPlaying(false)}
        preload="none"
      />
    </div>
  );
}

function DriverCard({
  label,
  driver,
  pos,
  car,
  stint,
  color,
  isAttacker,
}: {
  label: string;
  driver: Driver | undefined;
  pos: Position | undefined;
  car: CarData | undefined;
  stint: Stint | undefined;
  color: string;
  isAttacker: boolean;
}) {
  return (
    <div
      className="rounded-lg p-3 flex flex-col gap-2"
      style={{ backgroundColor: color + "0d", border: `1px solid ${color}33` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-f1-muted uppercase tracking-wider">
          {label}
        </span>
        {pos && (
          <span className="text-[10px] font-mono font-bold" style={{ color }}>
            P{pos.position}
          </span>
        )}
      </div>
      <div className="font-mono font-black text-lg" style={{ color }}>
        {driver?.name_acronym ?? "—"}
      </div>
      <div className="text-f1-muted text-[10px] font-mono leading-tight">
        {driver?.team_name ?? "—"}
      </div>
      {car && (
        <div className="text-white/70 text-xs font-mono">{car.speed} km/h</div>
      )}
      {stint && (
        <div className="flex items-center gap-1">
          <span
            className="text-[9px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center"
            style={{
              color: COMPOUND_COLORS[stint.compound] ?? "#666",
              border: `1px solid ${COMPOUND_COLORS[stint.compound] ?? "#666"}`,
            }}
          >
            {COMPOUND_LABELS[stint.compound] ?? "?"}
          </span>
          <span className="text-f1-muted text-[10px] font-mono">{stint.compound}</span>
        </div>
      )}
    </div>
  );
}

function CompareRow({
  label,
  a,
  b,
  aColor,
  bColor,
  unit,
  max,
}: {
  label: string;
  a: number;
  b: number;
  aColor: string;
  bColor: string;
  unit?: string;
  max?: number;
}) {
  const maxVal = max ?? Math.max(a, b, 1);
  const aWidth = (a / maxVal) * 100;
  const bWidth = (b / maxVal) * 100;

  return (
    <div className="mb-2">
      <div className="flex justify-between text-[9px] font-mono text-f1-muted mb-1">
        <span style={{ color: aColor }}>{a}{unit}</span>
        <span className="text-f1-muted uppercase tracking-wider">{label}</span>
        <span style={{ color: bColor }}>{b}{unit}</span>
      </div>
      <div className="flex gap-0.5 h-1.5 items-center">
        <div className="flex-1 flex justify-end">
          <div
            className="h-full rounded-full"
            style={{ width: `${aWidth}%`, backgroundColor: aColor }}
          />
        </div>
        <div className="w-px h-2 bg-f1-border shrink-0" />
        <div className="flex-1">
          <div
            className="h-full rounded-full"
            style={{ width: `${bWidth}%`, backgroundColor: bColor }}
          />
        </div>
      </div>
    </div>
  );
}

function GapSparkline({ history }: { history: number[] }) {
  const w = 240;
  const h = 40;
  const pad = 4;
  const min = Math.min(...history);
  const max = Math.max(...history, min + 0.1);
  const points = history.map((v, i) => {
    const x = pad + (i / (history.length - 1)) * (w - 2 * pad);
    const y = pad + ((v - min) / (max - min)) * (h - 2 * pad);
    return `${x},${y}`;
  });
  const closing = history[history.length - 1] < history[0];

  return (
    <div className="bg-white/5 rounded p-3 border border-f1-border">
      <div className="text-f1-muted text-[10px] font-mono uppercase tracking-widest mb-2">
        Gap Trend
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={closing ? "#ef4444" : "#22c55e"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatInterval(val: string | number): string {
  if (typeof val === "number") return `+${val.toFixed(3)}`;
  if (val.includes("LAP")) return val;
  const n = parseFloat(val.replace("+", ""));
  if (isNaN(n)) return val;
  return `+${n.toFixed(3)}`;
}

function formatLapTime(secs: number | null | undefined): string {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}
