"use client";

import { useMemo } from "react";
import { Driver, Position, RaceControl, Lap, Stint, Weather } from "@/lib/openf1";
import { COMPOUND_COLORS, COMPOUND_LABELS } from "@/lib/constants";
import LapChart from "./LapChart";

interface PitAlert {
  driverNumber: number;
  message: string;
}

interface IntelPanelProps {
  drivers: Map<number, Driver>;
  positions: Map<number, Position>;
  allPositions: Lap[];
  allLaps: Lap[];
  allStints: Stint[];
  raceControl: RaceControl[];
  pitAlert: PitAlert | null;
  weather?: Weather | null;
  currentTime?: string | null;
  currentLap?: number;
}

export default function IntelPanel({
  drivers,
  positions,
  allPositions,
  allLaps,
  allStints,
  raceControl,
  pitAlert,
  weather,
  currentTime,
  currentLap,
}: IntelPanelProps) {
  const fastestLap = allLaps.reduce<Lap | null>((best, lap) => {
    if (!lap.lap_duration) return best;
    if (!best?.lap_duration || lap.lap_duration < best.lap_duration) return lap;
    return best;
  }, null);

  const fastestDriver = fastestLap ? drivers.get(fastestLap.driver_number) : null;
  const fastestColor = fastestDriver?.team_colour ? `#${fastestDriver.team_colour}` : "#8b5cf6";

  const driversByPos = useMemo(() =>
    [...positions.entries()]
      .sort(([, a], [, b]) => a.position - b.position)
      .map(([dn]) => dn),
    [positions]
  );

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-f1-dark scrollbar-thin">

      {/* Weather strip */}
      {weather && <WeatherStrip weather={weather} />}

      {/* Live ticker */}
      <div className="border-b border-f1-border/50">
        <div className="px-4 py-2 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-f1-red animate-pulse shrink-0" />
          <span className="text-[10px] font-mono font-bold tracking-widest text-f1-muted uppercase">
            Live Feed
          </span>
        </div>
        <LiveTicker raceControl={raceControl} pitAlert={pitAlert} drivers={drivers} />
      </div>

      {/* Fastest lap */}
      {fastestLap && fastestDriver && (
        <div className="mx-3 mt-3 rounded-lg p-3 flex items-center gap-3 border border-f1-border"
          style={{ background: fastestColor + "0d" }}>
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#a855f7" }} />
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
        <div className="px-4 py-2 flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold tracking-widest text-f1-muted uppercase">
            Lap Chart · P1–10
          </span>
          <span className="text-[9px] font-mono text-f1-muted">Tap to highlight</span>
        </div>
        <LapChart
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          allPositions={allPositions as any}
          raceControl={raceControl}
          drivers={drivers}
          currentTime={currentTime}
        />
      </div>

      {/* Tyre strategy */}
      {allStints.length > 0 && driversByPos.length > 0 && (
        <div className="border-t border-f1-border/50 mt-1">
          <div className="px-4 py-2">
            <span className="text-[10px] font-mono font-bold tracking-widest text-f1-muted uppercase">
              Tyre Strategy
            </span>
          </div>
          <TyreStrategyMap
            allStints={allStints}
            drivers={drivers}
            driversByPos={driversByPos.slice(0, 10)}
            currentLap={currentLap}
          />
        </div>
      )}
    </div>
  );
}

// ─── Weather Strip ────────────────────────────────────────────────────────────

function WeatherStrip({ weather }: { weather: Weather }) {
  const isWet = weather.rainfall > 0;
  const windDir = ["N","NE","E","SE","S","SW","W","NW"][Math.round(weather.wind_direction / 45) % 8];
  return (
    <div className="px-3 py-2 border-b border-f1-border/50 flex items-center gap-3 flex-wrap">
      <span className="text-[9px] font-mono font-bold tracking-widest text-f1-muted uppercase shrink-0">
        Weather
      </span>
      <div className="flex items-center gap-3 flex-wrap">
        <Chip label="TRK" value={`${Math.round(weather.track_temperature)}°`} />
        <Chip label="AIR" value={`${Math.round(weather.air_temperature)}°`} />
        <Chip label="HUM" value={`${Math.round(weather.humidity)}%`} />
        <Chip label="WIND" value={`${Math.round(weather.wind_speed)} ${windDir}`} />
        {isWet && (
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
            style={{ color: "#3b82f6", backgroundColor: "#3b82f620", border: "1px solid #3b82f640" }}>
            RAIN
          </span>
        )}
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[8px] font-mono text-f1-border uppercase">{label}</span>
      <span className="text-[10px] font-mono font-bold text-white/80">{value}</span>
    </div>
  );
}

// ─── Live Ticker ──────────────────────────────────────────────────────────────

type TickerType = "red" | "yellow" | "green" | "orange" | "info";

function getTickerType(msg: RaceControl): TickerType {
  const flag = msg.flag?.toUpperCase() ?? "";
  const text = msg.message.toUpperCase();
  if (flag === "RED" || text.includes("RED FLAG")) return "red";
  if (flag === "YELLOW" || text.includes("YELLOW") || text.includes("SAFETY CAR") || text.includes("VSC")) return "yellow";
  if (flag === "GREEN" || text.includes("GREEN")) return "green";
  if (text.includes("INVESTIGATION") || text.includes("INCIDENT") || text.includes("PENALTY")) return "orange";
  return "info";
}

const TICKER_COLORS: Record<TickerType, { text: string; dot: string }> = {
  red:    { text: "#ef4444", dot: "#ef4444" },
  yellow: { text: "#fbbf24", dot: "#fbbf24" },
  green:  { text: "#22c55e", dot: "#22c55e" },
  orange: { text: "#f97316", dot: "#f97316" },
  info:   { text: "#6b7280", dot: "#374151" },
};

function LiveTicker({
  raceControl, pitAlert, drivers,
}: {
  raceControl: RaceControl[];
  pitAlert: PitAlert | null;
  drivers: Map<number, Driver>;
}) {
  const items = raceControl.slice(0, 20);

  return (
    <div className="overflow-y-auto" style={{ maxHeight: 160 }}>
      {pitAlert && (() => {
        const driver = drivers.get(pitAlert.driverNumber);
        const color = driver?.team_colour ? `#${driver.team_colour}` : "#f97316";
        return (
          <div className="px-3 py-2 flex items-start gap-2.5 border-b border-orange-500/20 bg-orange-500/5">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1 shrink-0" />
            <div>
              <div className="text-[9px] font-mono font-bold text-orange-400 uppercase tracking-wider mb-0.5">PIT STOP</div>
              <div className="text-[10px] font-mono" style={{ color }}>{pitAlert.message}</div>
            </div>
          </div>
        );
      })()}
      {items.length === 0 && !pitAlert ? (
        <div className="px-3 py-4 text-f1-muted text-xs font-mono text-center">No messages yet</div>
      ) : (
        items.map((msg, i) => {
          const type = getTickerType(msg);
          const { text, dot } = TICKER_COLORS[type];
          const time = new Date(msg.date).toLocaleTimeString(undefined, {
            hour: "2-digit", minute: "2-digit", second: "2-digit",
          });
          return (
            <div key={i}
              className="px-3 py-1.5 flex items-start gap-2.5 border-b border-f1-border/20"
              style={{ background: type !== "info" ? text + "08" : undefined }}>
              <div className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: dot }} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono leading-tight" style={{ color: text }}>
                  {msg.message}
                </div>
                {(msg.driver_number != null || msg.lap_number != null) && (
                  <div className="flex items-center gap-2 mt-0.5">
                    {msg.driver_number != null && (
                      <span className="text-[9px] font-mono text-f1-border">
                        {drivers.get(msg.driver_number)?.name_acronym ?? `#${msg.driver_number}`}
                      </span>
                    )}
                    {msg.lap_number != null && (
                      <span className="text-[9px] font-mono text-f1-border">L{msg.lap_number}</span>
                    )}
                  </div>
                )}
              </div>
              <span className="text-[8px] font-mono text-f1-border shrink-0 mt-0.5">{time}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Tyre Strategy Map ────────────────────────────────────────────────────────

function TyreStrategyMap({
  allStints, drivers, driversByPos, currentLap,
}: {
  allStints: Stint[];
  drivers: Map<number, Driver>;
  driversByPos: number[];
  currentLap: number | undefined;
}) {
  const maxLap = useMemo(() => {
    const fromStints = Math.max(...allStints.map(s => s.lap_end ?? 0), 0);
    return Math.max(fromStints, currentLap ?? 0, 50);
  }, [allStints, currentLap]);

  const stintsByDriver = useMemo(() => {
    const m = new Map<number, Stint[]>();
    for (const s of allStints) {
      const arr = m.get(s.driver_number) ?? [];
      arr.push(s);
      m.set(s.driver_number, arr);
    }
    return m;
  }, [allStints]);

  return (
    <div className="px-3 pb-3 flex flex-col gap-1.5">
      {driversByPos.map(dn => {
        const driver = drivers.get(dn);
        const stints = stintsByDriver.get(dn) ?? [];
        if (!driver || stints.length === 0) return null;
        const color = `#${driver.team_colour ?? "555"}`;
        return (
          <div key={dn} className="flex items-center gap-2">
            <span className="text-[9px] font-mono w-7 text-right shrink-0 font-bold" style={{ color }}>
              {driver.name_acronym}
            </span>
            <div className="flex-1 h-3.5 bg-white/5 rounded overflow-hidden relative">
              {stints.map((stint, i) => {
                const lapEnd = stint.lap_end ?? currentLap ?? maxLap;
                const startPct = ((stint.lap_start - 1) / maxLap) * 100;
                const widthPct = Math.max(0.5, ((lapEnd - stint.lap_start + 1) / maxLap) * 100);
                const cColor = COMPOUND_COLORS[stint.compound] ?? "#666";
                return (
                  <div key={i} className="absolute top-0 h-full flex items-center justify-center"
                    style={{ left: `${startPct}%`, width: `${widthPct}%`, backgroundColor: cColor + "cc" }}>
                    {widthPct > 8 && (
                      <span className="text-[7px] font-mono font-bold text-black/70">
                        {COMPOUND_LABELS[stint.compound] ?? "?"}
                      </span>
                    )}
                  </div>
                );
              })}
              {currentLap != null && (
                <div className="absolute top-0 h-full w-px bg-white/40"
                  style={{ left: `${((currentLap - 1) / maxLap) * 100}%` }} />
              )}
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-2">
        <span className="w-7 shrink-0" />
        <div className="flex-1 flex justify-between text-[8px] font-mono text-f1-border pt-0.5">
          <span>1</span><span>{Math.round(maxLap / 2)}</span><span>{maxLap}</span>
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
