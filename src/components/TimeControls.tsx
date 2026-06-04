"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Session, RaceControl } from "@/lib/openf1";

interface TimeControlsProps {
  session: Session;
  currentTime: string | null;
  isPlaying: boolean;
  speed: 1 | 2 | 5 | 10 | 30;
  raceControl: RaceControl[];
  onTimeChange: (iso: string) => void;
  onPlayPause: () => void;
  onSpeedChange: (s: 1 | 2 | 5 | 10 | 30) => void;
  onGoLive: () => void;
}

const SPEEDS: Array<1 | 2 | 5 | 10 | 30> = [1, 2, 5, 10, 30];

export default function TimeControls({
  session,
  currentTime,
  isPlaying,
  speed,
  raceControl,
  onTimeChange,
  onPlayPause,
  onSpeedChange,
  onGoLive,
}: TimeControlsProps) {
  const isLive = currentTime === null;
  const sessionStart = useMemo(() => new Date(session.date_start).getTime(), [session.date_start]);
  const sessionEnd = useMemo(
    () => (session.date_end ? new Date(session.date_end).getTime() : Date.now()),
    [session.date_end]
  );

  const totalSecs = Math.max(1, Math.floor((sessionEnd - sessionStart) / 1000));
  const elapsed = isLive
    ? totalSecs
    : Math.max(0, Math.floor((new Date(currentTime!).getTime() - sessionStart) / 1000));

  const currentLap = useMemo(() => {
    const filtered = raceControl.filter((m) => m.lap_number != null);
    if (filtered.length === 0) return null;
    return filtered.reduce((max, m) => Math.max(max, m.lap_number!), 0);
  }, [raceControl]);

  const lapMarkers = useMemo(() => {
    const seen = new Set<number>();
    const markers: Array<{ pct: number; lap: number }> = [];
    for (const m of [...raceControl].sort((a, b) => a.date.localeCompare(b.date))) {
      if (m.lap_number && !seen.has(m.lap_number)) {
        seen.add(m.lap_number);
        const t = new Date(m.date).getTime();
        const pct = ((t - sessionStart) / (sessionEnd - sessionStart)) * 100;
        if (pct >= 0 && pct <= 100) markers.push({ pct, lap: m.lap_number });
      }
    }
    return markers;
  }, [raceControl, sessionStart, sessionEnd]);

  const totalLaps = lapMarkers.length > 0 ? Math.max(...lapMarkers.map((m) => m.lap)) : null;

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const secs = parseInt(e.target.value, 10);
      onTimeChange(new Date(sessionStart + secs * 1000).toISOString());
    },
    [sessionStart, onTimeChange]
  );

  const playRef = useRef({ isPlaying, speed, onTimeChange, elapsed, totalSecs, sessionStart });
  playRef.current = { isPlaying, speed, onTimeChange, elapsed, totalSecs, sessionStart };

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const { speed, elapsed, totalSecs, sessionStart, onTimeChange } = playRef.current;
      const next = Math.min(elapsed + speed, totalSecs);
      onTimeChange(new Date(sessionStart + next * 1000).toISOString());
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const progressPct = (elapsed / totalSecs) * 100;

  return (
    <div className="shrink-0 border-t border-f1-border bg-f1-panel select-none">
      {/* Scrubber row — full width, large touch target on mobile */}
      <div className="relative h-8 md:h-5 px-3 md:px-4 flex items-center">
        {/* Lap markers */}
        {lapMarkers.map(({ pct, lap }) => (
          <div
            key={lap}
            className="absolute top-0 bottom-0 w-px bg-white/10 pointer-events-none"
            style={{ left: `calc(${pct}% * (100% - 24px) / 100% + 12px)` }}
          />
        ))}
        {/* Track */}
        <div className="relative w-full h-1.5 bg-white/10 rounded-full">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-f1-red/70 pointer-events-none"
            style={{ width: `${progressPct}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 w-3 h-3 rounded-full bg-white shadow -translate-y-1/2 -translate-x-1/2 pointer-events-none"
            style={{ left: `${progressPct}%` }}
          />
        </div>
        {/* Invisible input over full area for touch */}
        <input
          type="range"
          min={0}
          max={totalSecs}
          value={elapsed}
          onChange={handleScrub}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          style={{ height: "100%" }}
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-2 md:gap-4 px-3 md:px-4 pb-2 md:pb-2.5">
        {/* Play / Live */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!isLive && (
            <button
              onClick={onPlayPause}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white text-xs"
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
          )}
          <button
            onClick={onGoLive}
            className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold tracking-wider transition-colors ${
              isLive ? "bg-f1-red text-white" : "bg-white/10 text-f1-muted hover:text-white"
            }`}
          >
            {isLive ? "● LIVE" : "LIVE"}
          </button>
        </div>

        {/* Time + lap */}
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-white font-mono text-sm font-bold tabular-nums">
            {formatElapsed(elapsed)}
          </span>
          {(currentLap || totalLaps) && (
            <span className="text-f1-muted text-[10px] font-mono shrink-0">
              {currentLap && totalLaps
                ? `L${currentLap}/${totalLaps}`
                : currentLap
                ? `L${currentLap}`
                : ""}
            </span>
          )}
        </div>

        {/* Speed buttons — hidden on mobile when live */}
        {!isLive && (
          <div className="flex gap-0.5 ml-auto shrink-0">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                  speed === s ? "bg-white/20 text-white" : "text-f1-muted hover:text-white"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatElapsed(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
