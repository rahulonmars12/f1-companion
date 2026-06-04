"use client";

import { Driver, Position, RaceControl, Lap } from "@/lib/openf1";
import LapChart from "./LapChart";

interface IntelPanelProps {
  drivers: Map<number, Driver>;
  allPositions: Position[];
  allLaps: Lap[];
  raceControl: RaceControl[];
  currentTime?: string | null;
}

export default function IntelPanel({
  drivers,
  allPositions,
  allLaps,
  raceControl,
  currentTime,
}: IntelPanelProps) {
  // Fastest lap
  const fastestLap = allLaps.reduce<Lap | null>((best, lap) => {
    if (!lap.lap_duration) return best;
    if (!best?.lap_duration || lap.lap_duration < best.lap_duration) return lap;
    return best;
  }, null);

  const fastestDriver = fastestLap ? drivers.get(fastestLap.driver_number) : null;
  const fastestColor = fastestDriver?.team_colour ? `#${fastestDriver.team_colour}` : "#8b5cf6";

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-f1-dark scrollbar-thin">

      {/* Fastest lap card */}
      {fastestLap && fastestDriver && (
        <div className="mx-3 mt-3 rounded-lg p-3 flex items-center gap-3 border border-f1-border"
          style={{ background: fastestColor + "0d" }}>
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#8b5cf6" }} />
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-mono text-f1-muted uppercase tracking-widest">Fastest Lap</div>
            <div className="font-mono font-black text-sm" style={{ color: fastestColor }}>
              {fastestDriver.name_acronym}
              <span className="text-f1-muted font-normal text-xs ml-2">{formatLap(fastestLap.lap_duration)}</span>
            </div>
          </div>
          <div className="text-f1-muted text-[10px] font-mono shrink-0">L{fastestLap.lap_number}</div>
        </div>
      )}

      {/* Lap chart */}
      <div className="mt-3 border-t border-f1-border/50">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold tracking-widest text-f1-muted uppercase">
            Lap Chart
          </span>
          <span className="text-[9px] font-mono text-f1-muted">Tap driver to highlight</span>
        </div>
        <LapChart
          allPositions={allPositions}
          raceControl={raceControl}
          drivers={drivers}
          currentTime={currentTime}
        />
      </div>

      {/* Coming in Update 2 */}
      <div className="mx-3 my-4 rounded-lg border border-f1-border/30 p-4 text-center">
        <div className="text-f1-muted text-[10px] font-mono uppercase tracking-widest mb-1">Coming Next</div>
        <div className="text-f1-muted text-xs font-mono opacity-60">
          Head-to-head telemetry · Tyre strategy map
        </div>
      </div>
    </div>
  );
}

function formatLap(secs: number | null | undefined): string {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}
