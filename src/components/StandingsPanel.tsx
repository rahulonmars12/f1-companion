"use client";

import { useState } from "react";
import { Driver, Interval, Lap, Position, CarData, Stint, parseGapSeconds } from "@/lib/openf1";
import { COMPOUND_COLORS, COMPOUND_LABELS } from "@/lib/constants";

interface PitAlert { driverNumber: number; message: string; }

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
  onToggleFavorite: (n: number) => void;
  // Qualifying-specific
  isQualifying?: boolean;
  qualiBestLaps?: Map<number, Lap>;
  qualiCompletedPhases?: number;
}

export default function StandingsPanel({
  drivers, positions, intervals, carData, stints,
  selectedDriver, battles, fastestLapDriverNumber, pitAlert, currentLap,
  favorites, onSelectDriver, onToggleFavorite,
  isQualifying, qualiBestLaps, qualiCompletedPhases,
}: StandingsPanelProps) {
  const [showLeader, setShowLeader] = useState(false);

  const sorted = [...positions.values()].sort((a, b) => a.position - b.position);
  const battleSet = new Set(battles.flatMap(b => [b.attacker, b.defender]));

  if (sorted.length === 0) {
    return (
      <aside className="w-full md:w-72 md:shrink-0 border-r border-f1-border bg-f1-panel flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-f1-border">
          <span className="text-xs font-mono font-bold tracking-widest text-f1-muted uppercase">
            {isQualifying ? "Qualifying" : "Race Order"}
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center text-f1-muted text-xs font-mono">
          Waiting for data…
        </div>
      </aside>
    );
  }

  // ── Qualifying view ─────────────────────────────────────────────────────────
  if (isQualifying && qualiBestLaps) {
    const phases = qualiCompletedPhases ?? 0;

    // Phase label for header
    const phaseLabel = phases >= 3 ? "FINAL" : phases === 2 ? "Q3" : phases === 1 ? "Q2" : "Q1";
    const phaseColor = phases >= 3 ? "#22c55e" : phases === 2 ? "#ffd700" : "#e8002d";

    // P1 best time (reference for deltas)
    const p1 = sorted.find(p => p.position === 1);
    const p1Best = p1 ? qualiBestLaps.get(p1.driver_number)?.lap_duration ?? null : null;

    // Groups
    const q3drivers  = sorted.filter(p => p.position <= 10);
    const q2outdrivers = sorted.filter(p => p.position >= 11 && p.position <= 15);
    const q1outdrivers = sorted.filter(p => p.position >= 16);

    const renderQRow = (pos: Position) => {
      const d = drivers.get(pos.driver_number);
      const best = qualiBestLaps.get(pos.driver_number);
      return (
        <QualifyingRow
          key={pos.driver_number}
          pos={pos}
          driver={d}
          bestLap={best}
          p1BestTime={p1Best}
          isSelected={selectedDriver === pos.driver_number}
          isFavorite={favorites.includes(pos.driver_number)}
          onSelect={onSelectDriver}
          onToggleFav={() => onToggleFavorite(pos.driver_number)}
        />
      );
    };

    return (
      <aside className="w-full md:w-72 md:shrink-0 border-r border-f1-border bg-f1-panel flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-f1-border flex items-center justify-between shrink-0">
          <span className="text-xs font-mono font-bold tracking-widest text-f1-muted uppercase">
            Qualifying
          </span>
          <span
            className="text-[9px] font-mono font-bold px-2 py-0.5 rounded border tabular-nums"
            style={{ color: phaseColor, borderColor: phaseColor + "60", backgroundColor: phaseColor + "15" }}
          >
            {phaseLabel}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {phases >= 2 ? (
            <>
              <QualySectionHeader label="Q3  ·  Top 10" color="#ffd700" />
              {q3drivers.map(renderQRow)}
              <QualySectionHeader label="Q2 Eliminated  ·  P11–15" color="#f97316" />
              {q2outdrivers.map(renderQRow)}
              <QualySectionHeader label="Q1 Eliminated  ·  P16–20" color="#6b7280" />
              {q1outdrivers.map(renderQRow)}
            </>
          ) : phases === 1 ? (
            <>
              {q3drivers.concat(q2outdrivers).map(renderQRow)}
              <QualySectionHeader label="Q1 Eliminated  ·  P16–20" color="#6b7280" />
              {q1outdrivers.map(renderQRow)}
            </>
          ) : (
            sorted.map(renderQRow)
          )}
        </div>
      </aside>
    );
  }

  // ── Race view (default) ─────────────────────────────────────────────────────
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
        <div className="px-3 py-2 bg-orange-500/10 border-b border-orange-500/30 flex items-center gap-2 shrink-0">
          <span className="text-orange-400 text-[10px]">■</span>
          <span className="text-orange-400 text-[10px] font-mono font-bold">{pitAlert.message}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {sorted.map(pos => (
          <DriverRow
            key={pos.driver_number}
            pos={pos}
            driver={drivers.get(pos.driver_number)}
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
            onToggleFav={() => onToggleFavorite(pos.driver_number)}
          />
        ))}
      </div>
    </aside>
  );
}

// ── Qualifying section header ────────────────────────────────────────────────

function QualySectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <div
      className="px-3 py-1.5 flex items-center gap-2 border-b border-t"
      style={{
        borderColor: color + "25",
        backgroundColor: color + "0a",
      }}
    >
      <span className="w-1 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[9px] font-mono font-bold uppercase tracking-widest" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

// ── Qualifying row ───────────────────────────────────────────────────────────

function QualifyingRow({
  pos, driver, bestLap, p1BestTime,
  isSelected, isFavorite, onSelect, onToggleFav,
}: {
  pos: Position;
  driver: Driver | undefined;
  bestLap: Lap | undefined;
  p1BestTime: number | null;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: (n: number) => void;
  onToggleFav: () => void;
}) {
  const teamColor = driver?.team_colour ? `#${driver.team_colour}` : "#888";
  const isP1 = pos.position === 1;

  const timeDisplay = (() => {
    if (!bestLap?.lap_duration) return "—";
    if (isP1 || !p1BestTime) return formatLapTime(bestLap.lap_duration);
    const delta = bestLap.lap_duration - p1BestTime;
    return `+${delta.toFixed(3)}`;
  })();

  const timeColor = !bestLap?.lap_duration
    ? "#444"
    : isP1
    ? "#ffd700"
    : "#888";

  return (
    <div
      className={[
        "w-full px-2 py-2 border-b border-f1-border/40 flex items-center gap-2 transition-colors",
        "border-l-2",
        isSelected
          ? "bg-white/[0.06] border-l-white/30"
          : isFavorite
          ? "border-l-f1-accent/70"
          : "border-l-transparent",
      ].join(" ")}
    >
      <button
        onClick={() => onSelect(pos.driver_number)}
        className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
      >
        {/* Position */}
        <span
          className="text-xs font-mono font-bold w-5 text-center shrink-0 tabular-nums"
          style={{ color: pos.position === 1 ? "#ffd700" : pos.position <= 3 ? "#fff" : "#666" }}
        >
          {pos.position}
        </span>

        {/* Team stripe */}
        <span className="w-0.5 h-7 rounded-full shrink-0" style={{ backgroundColor: teamColor }} />

        {/* Driver name */}
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-mono font-bold tracking-wide leading-none">
            {driver?.name_acronym ?? `#${pos.driver_number}`}
          </div>
          <div className="text-f1-muted text-[9px] font-mono mt-0.5 truncate">
            {driver?.team_name ?? ""}
          </div>
        </div>

        {/* Best lap time / delta */}
        <span
          className="text-xs font-mono font-bold tabular-nums shrink-0"
          style={{ color: timeColor }}
        >
          {timeDisplay}
        </span>
      </button>

      {/* Favourite star */}
      <button
        onClick={e => { e.stopPropagation(); onToggleFav(); }}
        className="shrink-0 w-6 h-6 flex items-center justify-center transition-colors"
        style={{ color: isFavorite ? "#ffd700" : "#2a2a2a" }}
      >
        ★
      </button>
    </div>
  );
}

// ── Race driver row ───────────────────────────────────────────────────────────

function DriverRow({
  pos, driver, interval, car, stint,
  isSelected, isBattling, isFavorite, isFastestLap,
  showLeader, currentLap, onSelect, onToggleFav,
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
  onToggleFav: () => void;
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
      return (
        <span className="text-xs font-mono tabular-nums" style={{ color: "#888" }}>
          {formatGap(interval?.gap_to_leader)}
        </span>
      );
    }
    return (
      <span className="text-xs font-mono tabular-nums" style={{ color: isClose ? "#fbbf24" : "#777" }}>
        {interval?.interval != null ? formatGap(interval.interval) : "—"}
      </span>
    );
  };

  return (
    <div
      className={[
        "w-full px-2 py-2 border-b border-f1-border/40",
        "flex items-center gap-2 transition-colors",
        isSelected ? "bg-white/[0.06]"
          : isBattling ? "bg-yellow-500/[0.04]"
          : "",
        isFavorite && !isSelected ? "border-l-2 border-l-f1-accent/70" : "border-l-2 border-l-transparent",
      ].join(" ")}
    >
      <button
        onClick={() => onSelect(pos.driver_number)}
        className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
      >
        <span
          className="text-xs font-mono font-bold w-5 text-center shrink-0"
          style={{ color: pos.position === 1 ? "#ffd700" : pos.position <= 3 ? "#fff" : "#666" }}
        >
          {pos.position}
        </span>
        <span className="w-0.5 h-7 rounded-full shrink-0" style={{ backgroundColor: teamColor }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-white text-sm font-mono font-bold tracking-wide leading-none">
              {driver?.name_acronym ?? `#${pos.driver_number}`}
            </span>
            {isFastestLap && <span className="text-[9px]" style={{ color: "#a855f7" }}>⬟</span>}
            {isBattling && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="text-[8px] font-mono font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: compoundColor + "20",
                color: compoundColor,
                border: `1px solid ${compoundColor}55`,
              }}
            >
              {compoundLabel}
            </span>
            {tyreAge !== null && (
              <span className="text-f1-border text-[9px] font-mono tabular-nums">{tyreAge}L</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end shrink-0">{gapDisplay()}</div>
      </button>

      <button
        onClick={e => { e.stopPropagation(); onToggleFav(); }}
        className="shrink-0 w-6 h-6 flex items-center justify-center transition-colors"
        style={{ color: isFavorite ? "#ffd700" : "#2a2a2a" }}
      >
        ★
      </button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatGap(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "number") return isNaN(val) ? "—" : `+${val.toFixed(3)}`;
  const s = String(val);
  if (s.includes("LAP")) return s;
  const n = parseFloat(s.replace("+", ""));
  return isNaN(n) ? "—" : `+${n.toFixed(3)}`;
}

function formatLapTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}
