"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Session, RaceControl } from "@/lib/openf1";

interface TimeControlsProps {
  session: Session;
  currentTime: string | null;   // null = live
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
  const sessionEnd = useMemo(() => {
    return session.date_end ? new Date(session.date_end).getTime() : Date.now();
  }, [session.date_end]);

  const totalSecs = Math.max(1, Math.floor((sessionEnd - sessionStart) / 1000));
  const elapsed = isLive
    ? totalSecs
    : Math.max(0, Math.floor((new Date(currentTime!).getTime() - sessionStart) / 1000));

  // Derive current lap from raceControl
  const currentLap = useMemo(() => {
    const filtered = raceControl.filter((m) => m.lap_number != null);
    if (filtered.length === 0) return null;
    return filtered.reduce((max, m) => Math.max(max, m.lap_number!), 0);
  }, [raceControl]);

  // Lap markers along the timeline (from messages where lap_number changes)
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
      const ts = new Date(sessionStart + secs * 1000).toISOString();
      onTimeChange(ts);
    },
    [sessionStart, onTimeChange]
  );

  // Auto-advance playback
  const playRef = useRef({ isPlaying, speed, onTimeChange, elapsed, totalSecs, sessionStart });
  playRef.current = { isPlaying, speed, onTimeChange, elapsed, totalSecs, sessionStart };

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const { speed, elapsed, totalSecs, sessionStart, onTimeChange } = playRef.current;
      const next = elapsed + speed;
      if (next >= totalSecs) {
        onTimeChange(new Date(sessionStart + totalSecs * 1000).toISOString());
      } else {
        onTimeChange(new Date(sessionStart + next * 1000).toISOString());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div className="h-14 shrink-0 border-t border-f1-border bg-f1-panel flex items-center gap-4 px-4">
      {/* Play / Live controls */}
      <div className="flex items-center gap-2 shrink-0">
        {!isLive && (
          <button
            onClick={onPlayPause}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white text-sm"
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
        )}
        <button
          onClick={onGoLive}
          className={`px-3 py-1 rounded text-[10px] font-mono font-bold tracking-wider transition-colors ${
            isLive
              ? "bg-f1-red text-white"
              : "bg-white/10 text-f1-muted hover:text-white"
          }`}
        >
          {isLive ? "● LIVE" : "GO LIVE"}
        </button>
      </div>

      {/* Scrubber */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="relative h-2">
          {/* Lap markers */}
          {lapMarkers.map(({ pct, lap }) => (
            <div
              key={lap}
              className="absolute top-0 w-px h-2 bg-white/20 pointer-events-none"
              style={{ left: `${pct}%` }}
              title={`Lap ${lap}`}
            />
          ))}
          {/* Progress fill */}
          <div
            className="absolute top-0.5 left-0 h-1 rounded-full pointer-events-none bg-f1-red/60"
            style={{ width: `${(elapsed / totalSecs) * 100}%` }}
          />
          <input
            type="range"
            min={0}
            max={totalSecs}
            value={elapsed}
            onChange={handleScrub}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
          />
          {/* Thumb indicator */}
          <div
            className="absolute top-0 w-2 h-2 rounded-full bg-white border border-f1-border pointer-events-none -translate-x-1/2"
            style={{ left: `${(elapsed / totalSecs) * 100}%` }}
          />
        </div>
      </div>

      {/* Time display */}
      <div className="shrink-0 flex items-center gap-4">
        <div className="text-right">
          <div className="text-white font-mono text-sm font-bold tracking-wider">
            {formatElapsed(elapsed)}
          </div>
          <div className="text-f1-muted text-[10px] font-mono">
            {currentLap && totalLaps
              ? `LAP ${currentLap} / ${totalLaps}`
              : currentLap
              ? `LAP ${currentLap}`
              : "—"}
          </div>
        </div>

        {/* Speed selector (only when not live) */}
        {!isLive && (
          <div className="flex gap-0.5">
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                  speed === s
                    ? "bg-white/20 text-white"
                    : "text-f1-muted hover:text-white"
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
