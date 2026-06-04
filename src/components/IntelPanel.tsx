"use client";

import { useState, useMemo } from "react";
import { Driver, Position, RaceControl, Lap, Stint, CarData } from "@/lib/openf1";
import { COMPOUND_COLORS, COMPOUND_LABELS } from "@/lib/constants";
import LapChart from "./LapChart";

interface IntelPanelProps {
  drivers: Map<number, Driver>;
  positions: Map<number, Position>;
  allPositions: Position[];
  allLaps: Lap[];
  allStints: Stint[];
  carData: Map<number, CarData>;
  raceControl: RaceControl[];
  currentTime?: string | null;
  currentLap?: number;
}

export default function IntelPanel({
  drivers,
  positions,
  allPositions,
  allLaps,
  allStints,
  carData,
  raceControl,
  currentTime,
  currentLap,
}: IntelPanelProps) {
  // Fastest lap
  const fastestLap = allLaps.reduce<Lap | null>((best, lap) => {
    if (!lap.lap_duration) return best;
    if (!best?.lap_duration || lap.lap_duration < best.lap_duration) return lap;
    return best;
  }, null);

  const fastestDriver = fastestLap ? drivers.get(fastestLap.driver_number) : null;
  const fastestColor = fastestDriver?.team_colour ? `#${fastestDriver.team_colour}` : "#8b5cf6";

  // Sorted driver list by position
  const driversByPos = useMemo(() =>
    [...positions.entries()]
      .sort(([, a], [, b]) => a.position - b.position)
      .map(([dn]) => dn),
    [positions]
  );

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
            Lap Chart · Top 10
          </span>
          <span className="text-[9px] font-mono text-f1-muted">Tap to highlight</span>
        </div>
        <LapChart
          allPositions={allPositions}
          raceControl={raceControl}
          drivers={drivers}
          currentTime={currentTime}
        />
      </div>

      {/* Tyre strategy */}
      {allStints.length > 0 && driversByPos.length > 0 && (
        <div className="border-t border-f1-border/50 mt-1">
          <div className="px-4 py-2.5">
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

      {/* H2H comparison */}
      {driversByPos.length >= 2 && (
        <div className="border-t border-f1-border/50 mt-1 mb-4">
          <div className="px-4 py-2.5">
            <span className="text-[10px] font-mono font-bold tracking-widest text-f1-muted uppercase">
              Head to Head
            </span>
          </div>
          <H2H
            drivers={drivers}
            positions={positions}
            allLaps={allLaps}
            carData={carData}
            driversByPos={driversByPos}
          />
        </div>
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
    const fromStints = Math.max(...allStints.map(s => s.lap_end ?? 0));
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
                  <div
                    key={i}
                    className="absolute top-0 h-full flex items-center justify-center"
                    style={{
                      left: `${startPct}%`,
                      width: `${widthPct}%`,
                      backgroundColor: cColor + "cc",
                    }}
                    title={`${stint.compound} L${stint.lap_start}–${lapEnd}`}
                  >
                    {widthPct > 8 && (
                      <span className="text-[7px] font-mono font-bold text-black/70">
                        {COMPOUND_LABELS[stint.compound] ?? "?"}
                      </span>
                    )}
                  </div>
                );
              })}
              {/* Current lap marker */}
              {currentLap != null && (
                <div
                  className="absolute top-0 h-full w-px bg-white/50"
                  style={{ left: `${((currentLap - 1) / maxLap) * 100}%` }}
                />
              )}
            </div>
          </div>
        );
      })}
      {/* Lap numbers axis */}
      <div className="flex items-center gap-2">
        <span className="w-7 shrink-0" />
        <div className="flex-1 flex justify-between text-[8px] font-mono text-f1-border pt-0.5">
          <span>1</span>
          <span>{Math.round(maxLap / 2)}</span>
          <span>{maxLap}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Head to Head ─────────────────────────────────────────────────────────────

function H2H({
  drivers, positions, allLaps, carData, driversByPos,
}: {
  drivers: Map<number, Driver>;
  positions: Map<number, Position>;
  allLaps: Lap[];
  carData: Map<number, CarData>;
  driversByPos: number[];
}) {
  const [driverA, setDriverA] = useState<number | null>(driversByPos[0] ?? null);
  const [driverB, setDriverB] = useState<number | null>(driversByPos[1] ?? null);
  const [pickingSlot, setPickingSlot] = useState<"A" | "B" | null>(null);

  const dA = driverA ? drivers.get(driverA) : null;
  const dB = driverB ? drivers.get(driverB) : null;
  const colorA = dA?.team_colour ? `#${dA.team_colour}` : "#888";
  const colorB = dB?.team_colour ? `#${dB.team_colour}` : "#888";
  const posA = driverA ? positions.get(driverA) : null;
  const posB = driverB ? positions.get(driverB) : null;
  const carA = driverA ? carData.get(driverA) : null;
  const carB = driverB ? carData.get(driverB) : null;

  // Per-driver lap times (completed laps only)
  const lapsByDriver = useMemo(() => {
    const m = new Map<number, Lap[]>();
    for (const lap of allLaps) {
      if (!lap.lap_duration || lap.is_pit_out_lap) continue;
      const arr = m.get(lap.driver_number) ?? [];
      arr.push(lap);
      m.set(lap.driver_number, arr);
    }
    for (const [dn, laps] of m.entries()) {
      m.set(dn, laps.sort((a, b) => a.lap_number - b.lap_number));
    }
    return m;
  }, [allLaps]);

  const lapsA = driverA ? lapsByDriver.get(driverA) ?? [] : [];
  const lapsB = driverB ? lapsByDriver.get(driverB) ?? [] : [];
  const bestA = lapsA.reduce<Lap | null>((b, l) => !b || (l.lap_duration ?? Infinity) < (b.lap_duration ?? Infinity) ? l : b, null);
  const bestB = lapsB.reduce<Lap | null>((b, l) => !b || (l.lap_duration ?? Infinity) < (b.lap_duration ?? Infinity) ? l : b, null);

  // Build aligned lap comparison (last 10 shared laps)
  const sharedLaps = useMemo(() => {
    const setA = new Set(lapsA.map(l => l.lap_number));
    const setB = new Set(lapsB.map(l => l.lap_number));
    const shared = [...setA].filter(n => setB.has(n)).slice(-10);
    const mapA = new Map(lapsA.map(l => [l.lap_number, l.lap_duration ?? 0]));
    const mapB = new Map(lapsB.map(l => [l.lap_number, l.lap_duration ?? 0]));
    return shared.map(n => ({ lap: n, a: mapA.get(n) ?? 0, b: mapB.get(n) ?? 0 }));
  }, [lapsA, lapsB]);

  if (pickingSlot) {
    return (
      <div className="px-3 pb-3">
        <div className="text-[9px] font-mono text-f1-muted mb-2">
          Pick driver for {pickingSlot === "A" ? "left" : "right"}
        </div>
        <div className="grid grid-cols-3 gap-1">
          {driversByPos.map(dn => {
            const d = drivers.get(dn);
            if (!d) return null;
            const c = `#${d.team_colour ?? "555"}`;
            return (
              <button key={dn}
                onClick={() => {
                  if (pickingSlot === "A") setDriverA(dn);
                  else setDriverB(dn);
                  setPickingSlot(null);
                }}
                className="text-[9px] font-mono font-bold px-2 py-1.5 rounded border border-f1-border hover:border-white/30 transition-colors"
                style={{ color: c }}
              >
                {d.name_acronym}
              </button>
            );
          })}
        </div>
        <button onClick={() => setPickingSlot(null)}
          className="mt-2 text-[9px] font-mono text-f1-muted hover:text-white">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3 flex flex-col gap-3">
      {/* Driver selector */}
      <div className="flex items-center gap-2">
        <button onClick={() => setPickingSlot("A")}
          className="flex-1 flex items-center gap-2 rounded-lg p-2 border border-f1-border hover:border-white/20 transition-colors"
          style={{ background: colorA + "10" }}>
          <span className="w-1.5 h-8 rounded-full shrink-0" style={{ backgroundColor: colorA }} />
          <div className="text-left">
            <div className="text-xs font-mono font-black" style={{ color: colorA }}>{dA?.name_acronym ?? "—"}</div>
            {posA && <div className="text-[9px] font-mono text-f1-muted">P{posA.position}</div>}
          </div>
        </button>
        <span className="text-f1-muted text-xs font-mono shrink-0">vs</span>
        <button onClick={() => setPickingSlot("B")}
          className="flex-1 flex items-center gap-2 rounded-lg p-2 border border-f1-border hover:border-white/20 transition-colors"
          style={{ background: colorB + "10" }}>
          <span className="w-1.5 h-8 rounded-full shrink-0" style={{ backgroundColor: colorB }} />
          <div className="text-left">
            <div className="text-xs font-mono font-black" style={{ color: colorB }}>{dB?.name_acronym ?? "—"}</div>
            {posB && <div className="text-[9px] font-mono text-f1-muted">P{posB.position}</div>}
          </div>
        </button>
      </div>

      {/* Best lap comparison */}
      {(bestA || bestB) && (
        <div className="flex gap-2">
          <div className="flex-1 bg-white/5 rounded p-2 text-center">
            <div className="text-[9px] font-mono text-f1-muted mb-0.5">Best Lap</div>
            <div className="text-xs font-mono font-bold" style={{ color: colorA }}>
              {formatLap(bestA?.lap_duration)}
            </div>
          </div>
          <div className="flex-1 bg-white/5 rounded p-2 text-center">
            <div className="text-[9px] font-mono text-f1-muted mb-0.5">Best Lap</div>
            <div className="text-xs font-mono font-bold" style={{ color: colorB }}>
              {formatLap(bestB?.lap_duration)}
            </div>
          </div>
        </div>
      )}

      {/* Current telemetry */}
      {(carA || carB) && (
        <div className="flex flex-col gap-1">
          {[
            { label: "Speed", a: carA?.speed ?? 0, b: carB?.speed ?? 0, unit: "km/h" },
            { label: "Throttle", a: carA?.throttle ?? 0, b: carB?.throttle ?? 0, unit: "%", max: 100 },
          ].map(({ label, a, b, unit, max }) => {
            const top = max ?? Math.max(a, b, 1);
            return (
              <div key={label}>
                <div className="flex justify-between text-[9px] font-mono mb-0.5">
                  <span style={{ color: colorA }}>{a}{unit}</span>
                  <span className="text-f1-muted">{label}</span>
                  <span style={{ color: colorB }}>{b}{unit}</span>
                </div>
                <div className="flex gap-0.5 h-1.5">
                  <div className="flex-1 flex justify-end bg-white/5 rounded-l overflow-hidden">
                    <div className="h-full rounded-l" style={{ width: `${(a / top) * 100}%`, backgroundColor: colorA }} />
                  </div>
                  <div className="w-px bg-f1-border shrink-0" />
                  <div className="flex-1 bg-white/5 rounded-r overflow-hidden">
                    <div className="h-full rounded-r" style={{ width: `${(b / top) * 100}%`, backgroundColor: colorB }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lap time comparison chart */}
      {sharedLaps.length >= 2 && (
        <LapCompareChart laps={sharedLaps} colorA={colorA} colorB={colorB} />
      )}
    </div>
  );
}

function LapCompareChart({
  laps, colorA, colorB,
}: {
  laps: Array<{ lap: number; a: number; b: number }>;
  colorA: string;
  colorB: string;
}) {
  const W = 290, H = 70, PL = 8, PR = 8, PT = 6, PB = 14;
  const allTimes = laps.flatMap(l => [l.a, l.b]).filter(Boolean);
  const minT = Math.min(...allTimes) * 0.999;
  const maxT = Math.max(...allTimes) * 1.001;
  const xScale = (i: number) => PL + (i / Math.max(1, laps.length - 1)) * (W - PL - PR);
  const yScale = (t: number) => PT + ((t - minT) / (maxT - minT || 1)) * (H - PT - PB);

  const pathA = laps.map((l, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(l.a).toFixed(1)}`).join(" ");
  const pathB = laps.map((l, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(l.b).toFixed(1)}`).join(" ");

  return (
    <div className="bg-white/5 rounded border border-f1-border/30">
      <div className="px-2 pt-1.5 text-[8px] font-mono text-f1-muted">Lap Times</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        <path d={pathA} fill="none" stroke={colorA} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathB} fill="none" stroke={colorB} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {laps.filter((_, i) => i === 0 || i === laps.length - 1 || (laps.length > 5 && i % 3 === 0)).map((l, idx, arr) => {
          const i = laps.indexOf(l);
          return (
            <text key={l.lap} x={xScale(i)} y={H - 3} fontSize={6.5} fill="#444" textAnchor="middle" fontFamily="monospace">
              L{l.lap}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function formatLap(secs: number | null | undefined): string {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}
