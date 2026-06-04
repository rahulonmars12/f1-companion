"use client";

import { useState } from "react";
import { Driver, Interval, Position, CarData, Stint, parseGapSeconds } from "@/lib/openf1";
import { COMPOUND_COLORS, COMPOUND_LABELS } from "@/lib/constants";

const FAVORITE_ACRONYMS = ["HAM", "SAI"];

// Expected pit window by compound (laps). Rough empirical ranges.
const PIT_WINDOW: Record<string, { min: number; max: number }> = {
  SOFT:         { min: 15, max: 28 },
  MEDIUM:       { min: 28, max: 42 },
  HARD:         { min: 38, max: 55 },
  INTERMEDIATE: { min: 3,  max: 18 },
  WET:          { min: 3,  max: 18 },
};

// Points per finishing position (F1 2024+ system)
const F1_POINTS: Record<number, number> = {
  1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
};

interface PitAlert {
  driverNumber: number;
  message: string;
}

interface StandingsPanelProps {
  drivers: Map<number, Driver>;
  positions: Map<number, Position>;
  intervals: Map<number, Interval>;
  carData: Map<number, CarData>;
  stints: Map<number, Stint>;
  selectedDriver: number | null;
  battles: Array<{ attacker: number; defender: number }>;
  fastestLapDriverNumber: number | null;
  pitAlert: PitAlert | null;
  currentLap: number | undefined;
  onSelectDriver: (n: number) => void;
}

export default function StandingsPanel({
  drivers,
  positions,
  intervals,
  carData,
  stints,
  selectedDriver,
  battles,
  fastestLapDriverNumber,
  pitAlert,
  currentLap,
  onSelectDriver,
}: StandingsPanelProps) {
  const [showPoints, setShowPoints] = useState(false);

  const sorted = [...positions.values()].sort((a, b) => a.position - b.position);
  const battleSet = new Set(battles.flatMap(b => [b.attacker, b.defender]));
  const favorites = sorted.filter(pos => {
    const d = drivers.get(pos.driver_number);
    return d && FAVORITE_ACRONYMS.includes(d.name_acronym);
  });

  if (sorted.length === 0) {
    return (
      <aside className="w-full md:w-72 md:shrink-0 border-r border-f1-border bg-f1-panel flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-f1-border">
          <span className="text-xs font-mono font-bold tracking-widest text-f1-muted uppercase">Race Order</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-f1-muted text-xs font-mono">
          Waiting for data…
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-full md:w-72 md:shrink-0 border-r border-f1-border bg-f1-panel flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-f1-border flex items-center justify-between shrink-0">
        <span className="text-xs font-mono font-bold tracking-widest text-f1-muted uppercase">
          Race Order
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-f1-muted">{sorted.length} drivers</span>
          <button
            onClick={() => setShowPoints(v => !v)}
            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border transition-colors ${
              showPoints
                ? "border-f1-accent/60 text-f1-accent bg-f1-accent/10"
                : "border-f1-border text-f1-muted hover:text-white"
            }`}
          >
            {showPoints ? "PTS" : "GAP"}
          </button>
        </div>
      </div>

      {/* Pit alert banner */}
      {pitAlert && (
        <div className="px-3 py-2 bg-orange-500/10 border-b border-orange-500/30 flex items-center gap-2 shrink-0 animate-fade-in">
          <span className="text-orange-400 text-[10px]">⬛</span>
          <span className="text-orange-400 text-[10px] font-mono font-bold">{pitAlert.message}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* YOUR PICKS */}
        {favorites.length > 0 && (
          <>
            <div className="px-3 py-1.5 flex items-center gap-2 bg-f1-accent/5 border-b border-f1-accent/20 sticky top-0 z-10 backdrop-blur-sm">
              <span className="text-f1-accent text-[11px]">★</span>
              <span className="text-[10px] font-mono font-bold text-f1-accent uppercase tracking-widest">
                Your Picks
              </span>
            </div>
            {favorites.map(pos => (
              <DriverRow
                key={`fav-${pos.driver_number}`}
                pos={pos}
                driver={drivers.get(pos.driver_number)}
                interval={intervals.get(pos.driver_number)}
                car={carData.get(pos.driver_number)}
                stint={stints.get(pos.driver_number)}
                isSelected={selectedDriver === pos.driver_number}
                isBattling={battleSet.has(pos.driver_number)}
                isAttacker={battles.some(b => b.attacker === pos.driver_number)}
                isFavorite
                isFastestLap={fastestLapDriverNumber === pos.driver_number}
                showPoints={showPoints}
                currentLap={currentLap}
                onSelect={onSelectDriver}
              />
            ))}
            <div className="h-px bg-f1-border/70 mx-3 my-1" />
          </>
        )}

        {/* Full grid */}
        {sorted.map(pos => {
          const d = drivers.get(pos.driver_number);
          return (
            <DriverRow
              key={pos.driver_number}
              pos={pos}
              driver={d}
              interval={intervals.get(pos.driver_number)}
              car={carData.get(pos.driver_number)}
              stint={stints.get(pos.driver_number)}
              isSelected={selectedDriver === pos.driver_number}
              isBattling={battleSet.has(pos.driver_number)}
              isAttacker={battles.some(b => b.attacker === pos.driver_number)}
              isFavorite={FAVORITE_ACRONYMS.includes(d?.name_acronym ?? "")}
              isFastestLap={fastestLapDriverNumber === pos.driver_number}
              showPoints={showPoints}
              currentLap={currentLap}
              onSelect={onSelectDriver}
            />
          );
        })}
      </div>
    </aside>
  );
}

function DriverRow({
  pos, driver, interval, car, stint,
  isSelected, isBattling, isAttacker, isFavorite, isFastestLap,
  showPoints, currentLap, onSelect,
}: {
  pos: Position;
  driver: Driver | undefined;
  interval: Interval | undefined;
  car: CarData | undefined;
  stint: Stint | undefined;
  isSelected: boolean;
  isBattling: boolean;
  isAttacker: boolean;
  isFavorite: boolean;
  isFastestLap: boolean;
  showPoints: boolean;
  currentLap: number | undefined;
  onSelect: (n: number) => void;
}) {
  const teamColor = driver?.team_colour ? `#${driver.team_colour}` : "#888888";
  const gapSec = parseGapSeconds(interval?.interval);
  const isClose = gapSec !== null && gapSec < 1.0 && pos.position > 1;
  const compound = stint?.compound ?? "UNKNOWN";
  const compoundColor = COMPOUND_COLORS[compound] ?? "#666";
  const compoundLabel = COMPOUND_LABELS[compound] ?? "?";

  // Pit window calculation
  const pitWindow = PIT_WINDOW[compound];
  const tyreAge = stint && currentLap != null
    ? stint.tyre_age_at_start + Math.max(0, currentLap - stint.lap_start)
    : null;
  const inWindow = pitWindow && tyreAge != null && tyreAge >= pitWindow.min;
  const overdue = pitWindow && tyreAge != null && tyreAge >= pitWindow.max;
  const windowPct = pitWindow && tyreAge != null
    ? Math.min(100, (tyreAge / pitWindow.max) * 100)
    : null;

  return (
    <button
      onClick={() => onSelect(pos.driver_number)}
      className={[
        "w-full text-left px-3 py-2 border-b border-f1-border/40",
        "flex items-center gap-3 transition-colors cursor-pointer",
        isSelected ? "bg-white/[0.06]"
          : isBattling ? "bg-yellow-500/[0.04] hover:bg-yellow-500/[0.07]"
          : "hover:bg-white/[0.03]",
        isFavorite && !isSelected ? "border-l-2 border-l-f1-accent/50" : "border-l-2 border-l-transparent",
      ].join(" ")}
    >
      {/* Position */}
      <span
        className="text-xs font-mono font-bold w-5 text-center shrink-0"
        style={{ color: pos.position === 1 ? "#ffd700" : pos.position <= 3 ? "#fff" : "#666" }}
      >
        {pos.position}
      </span>

      {/* Team stripe */}
      <span className="w-0.5 h-8 rounded-full shrink-0" style={{ backgroundColor: teamColor }} />

      {/* Driver info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white text-sm font-mono font-bold tracking-wide">
            {driver?.name_acronym ?? `#${pos.driver_number}`}
          </span>
          {isFavorite && <span className="text-f1-accent text-[10px]">★</span>}
          {isFastestLap && <span className="text-[9px]" style={{ color: "#a855f7" }}>⬟</span>}
          {isBattling && (
            <span className="text-[9px] font-mono font-bold text-yellow-400 bg-yellow-400/10 px-1 rounded">
              {isAttacker ? "▲" : "●"}
            </span>
          )}
        </div>
        <div className="text-f1-muted text-[10px] font-mono truncate mt-0.5">
          {driver?.team_name ?? "Loading…"}
        </div>
      </div>

      {/* Right: gap/pts + tyre */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        {showPoints ? (
          <span
            className="text-xs font-mono font-bold tabular-nums"
            style={{ color: F1_POINTS[pos.position] ? "#ffd700" : "#555" }}
          >
            {F1_POINTS[pos.position] ?? "—"}<span className="text-[9px] ml-0.5 font-normal">pts</span>
          </span>
        ) : pos.position === 1 ? (
          <span className="text-f1-muted text-[10px] font-mono">LEAD</span>
        ) : (
          <span className="text-xs font-mono tabular-nums" style={{ color: isClose ? "#fbbf24" : "#777" }}>
            {interval?.interval != null ? formatInterval(interval.interval) : "—"}
          </span>
        )}

        {/* Tyre badge + pit window bar */}
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1">
            <span
              className="text-[9px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: compoundColor + "20",
                color: compoundColor,
                border: `1px solid ${compoundColor}55`,
              }}
            >
              {compoundLabel}
            </span>
            {car && <span className="text-f1-muted text-[10px] font-mono tabular-nums">{car.speed}</span>}
          </div>
          {windowPct !== null && (
            <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${windowPct}%`,
                  backgroundColor: overdue ? "#ef4444" : inWindow ? "#fbbf24" : compoundColor + "99",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function formatInterval(val: string | number): string {
  if (typeof val === "number") return `+${val.toFixed(3)}`;
  if (val.includes("LAP")) return val;
  const n = parseFloat(val.replace("+", ""));
  if (isNaN(n)) return val;
  return `+${n.toFixed(3)}`;
}
