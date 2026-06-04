"use client";

import { useMemo, useState } from "react";
import { Driver, Position, RaceControl } from "@/lib/openf1";

interface LapChartProps {
  allPositions: Position[];
  raceControl: RaceControl[];
  drivers: Map<number, Driver>;
  currentTime?: string | null;
}

export default function LapChart({ allPositions, raceControl, drivers, currentTime }: LapChartProps) {
  const [highlighted, setHighlighted] = useState<number | null>(null);

  // Build lap-start timestamps from race control messages
  const lapBoundaries = useMemo(() => {
    const seen = new Set<number>();
    const result: Array<{ lap: number; date: string }> = [];
    for (const m of [...raceControl].sort((a, b) => a.date.localeCompare(b.date))) {
      if (m.lap_number && !seen.has(m.lap_number)) {
        seen.add(m.lap_number);
        result.push({ lap: m.lap_number, date: m.date });
      }
    }
    return result;
  }, [raceControl]);

  // Per-driver sorted position history
  const byDriver = useMemo(() => {
    const map = new Map<number, Position[]>();
    for (const pos of [...allPositions].sort((a, b) => a.date.localeCompare(b.date))) {
      const arr = map.get(pos.driver_number) ?? [];
      arr.push(pos);
      map.set(pos.driver_number, arr);
    }
    return map;
  }, [allPositions]);

  // For each lap boundary, snapshot each driver's position
  const lapGrid = useMemo(() => {
    if (lapBoundaries.length < 2) return null;
    const grid = new Map<number, Map<number, number>>(); // lap → driverNum → pos
    for (const { lap, date } of lapBoundaries) {
      const snap = new Map<number, number>();
      for (const [dn, positions] of byDriver.entries()) {
        // last position at or before this lap boundary
        let found: Position | undefined;
        for (let i = positions.length - 1; i >= 0; i--) {
          if (positions[i].date <= date) { found = positions[i]; break; }
        }
        if (found) snap.set(dn, found.position);
      }
      grid.set(lap, snap);
    }
    return grid;
  }, [lapBoundaries, byDriver]);

  // Current-lap marker from currentTime
  const currentLapX = useMemo(() => {
    if (!currentTime || !lapBoundaries.length) return null;
    let idx = -1;
    for (let i = lapBoundaries.length - 1; i >= 0; i--) {
      if (lapBoundaries[i].date <= currentTime) { idx = i; break; }
    }
    return idx >= 0 ? lapBoundaries[idx].lap : null;
  }, [currentTime, lapBoundaries]);

  if (!lapGrid || lapBoundaries.length < 2) {
    return (
      <div className="flex items-center justify-center py-12 text-f1-muted text-xs font-mono">
        Waiting for lap data…
      </div>
    );
  }

  const maxLap = Math.max(...lapBoundaries.map(b => b.lap));
  const W = 320, H = 220;
  const PL = 22, PR = 14, PT = 8, PB = 18;
  const plotW = W - PL - PR, plotH = H - PT - PB;
  const MAX_POS = 10;

  const xScale = (lap: number) => PL + ((lap - 1) / Math.max(1, maxLap - 1)) * plotW;
  const yScale = (pos: number) => PT + ((pos - 1) / (MAX_POS - 1)) * plotH;

  // Only show drivers who reached top 10 at some point
  const driverNumbers = [...byDriver.keys()].filter(dn => {
    for (const snap of lapGrid.values()) {
      const p = snap.get(dn);
      if (p !== undefined && p <= MAX_POS) return true;
    }
    return false;
  });

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H, maxHeight: H }}>
        {/* Grid lines */}
        {[1, 3, 5, 7, 10].map(pos => (
          <g key={pos}>
            <line x1={PL} y1={yScale(pos)} x2={W - PR} y2={yScale(pos)} stroke="#1e1e1e" strokeWidth={0.8} />
            <text x={PL - 3} y={yScale(pos) + 3} fontSize={6.5} fill="#444" textAnchor="end" fontFamily="monospace">
              P{pos}
            </text>
          </g>
        ))}

        {/* Lap axis labels */}
        {lapBoundaries.filter(b => b.lap === 1 || b.lap % 10 === 0).map(({ lap }) => (
          <text key={lap} x={xScale(lap)} y={H - 3} fontSize={6.5} fill="#444" textAnchor="middle" fontFamily="monospace">
            {lap}
          </text>
        ))}

        {/* Current position marker */}
        {currentLapX !== null && (
          <line
            x1={xScale(currentLapX)} y1={PT}
            x2={xScale(currentLapX)} y2={H - PB}
            stroke="#e10600" strokeWidth={1} strokeDasharray="3,2" opacity={0.8}
          />
        )}

        {/* Driver lines — dimmed ones first, highlighted on top */}
        {[false, true].map(isHighlightedPass =>
          driverNumbers.map(dn => {
            const driver = drivers.get(dn);
            const color = driver?.team_colour ? `#${driver.team_colour}` : "#555";
            const isHL = highlighted === dn;
            const isDim = highlighted !== null && !isHL;
            if (isHighlightedPass !== isHL) return null;

            const points: [number, number][] = [];
            for (const { lap } of lapBoundaries) {
              const pos = lapGrid.get(lap)?.get(dn);
              if (pos !== undefined) points.push([xScale(lap), yScale(pos)]);
            }
            if (points.length < 2) return null;

            let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
            for (let i = 1; i < points.length; i++) {
              d += ` L ${points[i][0].toFixed(1)} ${points[i][1].toFixed(1)}`;
            }
            const last = points[points.length - 1];

            return (
              <g key={dn} onClick={() => setHighlighted(highlighted === dn ? null : dn)} style={{ cursor: "pointer" }}>
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={isHL ? 2.5 : isDim ? 0.5 : 1.2}
                  opacity={isDim ? 0.15 : 1}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Hit-test transparent fat line */}
                <path d={d} fill="none" stroke="transparent" strokeWidth={10} />
                {/* Label on highlighted line */}
                {isHL && (
                  <text
                    x={last[0] + 2} y={last[1] + 3}
                    fontSize={7.5} fill={color} fontFamily="monospace" fontWeight="bold"
                    stroke="#0a0a0a" strokeWidth={2} paintOrder="stroke"
                  >
                    {driver?.name_acronym}
                  </text>
                )}
              </g>
            );
          })
        )}
      </svg>

      {/* Driver pill selector */}
      <div className="px-2 pb-2 flex flex-wrap gap-1 justify-center">
        {driverNumbers.map(dn => {
          const driver = drivers.get(dn);
          if (!driver) return null;
          const color = `#${driver.team_colour ?? "555"}`;
          const isHL = highlighted === dn;
          return (
            <button
              key={dn}
              onClick={() => setHighlighted(isHL ? null : dn)}
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded transition-all"
              style={{
                backgroundColor: isHL ? color + "33" : "transparent",
                color: isHL ? color : "#444",
                border: `1px solid ${isHL ? color + "88" : "#1e1e1e"}`,
              }}
            >
              {driver.name_acronym}
            </button>
          );
        })}
      </div>
    </div>
  );
}
