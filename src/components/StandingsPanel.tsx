"use client";

import { useState } from "react";
import { Driver, Interval, Position, CarData, Stint, parseGapSeconds } from "@/lib/openf1";
import { COMPOUND_COLORS, COMPOUND_LABELS } from "@/lib/constants";

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
  favorites: number[];
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
  favorites,
  onSelectDriver,
}: StandingsPanelProps) {
  const [showLeader, setShowLeader] = useState(false);

  const sorted = [...positions.values()].sort((a, b) => a.position - b.position);
  const battleSet = new Set(battles.flatMap(b => [b.attacker, b.defender]));

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
            onClick={() => setShowLeader(v => !v)}
            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border transition-colors ${
              showLeader
                ? "border-f1-accent/60 text-f1-accent bg-f1-accent/10"
                : "border-f1-border text-f1-muted hover:text-white"
            }`}
          >
            {showLeader ? "LEAD" : "GAP"}
          </button>
        </div>
      </div>

      {/* Pit alert banner */}
      {pitAlert && (
        <div className="px-3 py-2 bg-orange-500/10 border-b border-orange-500/30 flex items-center gap-2 shrink-0 animate-fade-in">
          <span className="text-orange-400 text-[10px]">■</span>
          <span className="text-orange-400 text-[10px] font-mono font-bold">{pitAlert.message}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin">
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
              isFavorite={favorites.includes(pos.driver_number)}
              isFastestLap={fastestLapDriverNumber === pos.driver_number}
              showLeader={showLeader}
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
  isSelected, isBattling, isFavorite, isFastestLap,
  showLeader, currentLap, onSelect,
}: {
  pos: Position;
  driver: Driver | undefined;
  interval: Interval | undefined;
  car: CarData | undefined;
  stint: Stint | undefined;
  isSelected: boolean;
  isBattling: boolean;
  isFavorite: boolean;
  isFastestLap: boolean;
  showLeader: boolean;
  currentLap: number | undefined;
  onSelect: (n: number) => void;
}) {
  const teamColor = driver?.team_colour ? `#${driver.team_colour}` : "#888888";
  const gapSec = parseGapSeconds(interval?.interval);
  const isClose = gapSec !== null && gapSec < 1.0 && pos.position > 1;
  const compound = stint?.compound ?? "UNKNOWN";
  const compoundColor = COMPOUND_COLORS[compound] ?? "#666";
  const compoundLabel = COMPOUND_LABELS[compound] ?? "?";

  const tyreAge = stint && currentLap != null
    ? stint.tyre_age_at_start + Math.max(0, currentLap - stint.lap_start)
    : null;

  const gapDisplay = () => {
    if (pos.position === 1) return <span className="text-f1-muted text-[10px] font-mono">LEAD</span>;
    if (showLeader) {
      const raw = interval?.gap_to_leader;
      return (
        <span className="text-xs font-mono tabular-nums" style={{ color: "#888" }}>
          {raw ? formatGap(raw) : "—"}
        </span>
      );
    }
    return (
      <span className="text-xs font-mono tabular-nums" style={{ color: isClose ? "#fbbf24" : "#777" }}>
        {interval?.interval != null ? formatInterval(interval.interval) : "—"}
      </span>
    );
  };

  return (
    <button
      onClick={() => onSelect(pos.driver_number)}
      className={[
        "w-full text-left px-3 py-2 border-b border-f1-border/40",
        "flex items-center gap-3 transition-colors cursor-pointer",
        isSelected ? "bg-white/[0.06]"
          : isBattling ? "bg-yellow-500/[0.04] hover:bg-yellow-500/[0.07]"
          : "hover:bg-white/[0.03]",
        isFavorite && !isSelected ? "border-l-2 border-l-f1-accent/60" : "border-l-2 border-l-transparent",
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
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
          )}
        </div>
        <div className="text-f1-muted text-[10px] font-mono truncate mt-0.5">
          {driver?.team_name ?? "Loading…"}
        </div>
      </div>

      {/* Right: gap + tyre */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        {gapDisplay()}
        <div className="flex items-center gap-1.5">
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
          {tyreAge !== null && (
            <span className="text-f1-muted text-[10px] font-mono tabular-nums">{tyreAge}L</span>
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

function formatGap(val: string | null): string {
  if (!val) return "—";
  if (val.includes("LAP")) return val;
  const n = parseFloat(val.replace("+", ""));
  if (isNaN(n)) return "—";
  return `+${n.toFixed(3)}`;
}
