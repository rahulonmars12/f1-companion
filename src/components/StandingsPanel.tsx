"use client";

import { Driver, Interval, Position, CarData, Stint, parseGapSeconds } from "@/lib/openf1";
import { COMPOUND_COLORS, COMPOUND_LABELS } from "@/lib/constants";

interface StandingsPanelProps {
  drivers: Map<number, Driver>;
  positions: Map<number, Position>;
  intervals: Map<number, Interval>;
  carData: Map<number, CarData>;
  stints: Map<number, Stint>;
  selectedDriver: number | null;
  battles: Array<{ attacker: number; defender: number }>;
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
  onSelectDriver,
}: StandingsPanelProps) {
  const sorted = [...positions.values()].sort((a, b) => a.position - b.position);

  const battleSet = new Set(battles.flatMap((b) => [b.attacker, b.defender]));

  if (sorted.length === 0) {
    return (
      <aside className="w-72 shrink-0 border-r border-f1-border bg-f1-panel flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-f1-border">
          <span className="text-xs font-mono font-bold tracking-widest text-f1-muted uppercase">
            Race Order
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center text-f1-muted text-xs font-mono">
          Waiting for data…
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-72 shrink-0 border-r border-f1-border bg-f1-panel flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-f1-border flex items-center justify-between">
        <span className="text-xs font-mono font-bold tracking-widest text-f1-muted uppercase">
          Race Order
        </span>
        <span className="text-xs font-mono text-f1-muted">{sorted.length} drivers</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {sorted.map((pos) => {
          const driver = drivers.get(pos.driver_number);

          const interval = intervals.get(pos.driver_number);
          const car = carData.get(pos.driver_number);
          const stint = stints.get(pos.driver_number);
          const isSelected = selectedDriver === pos.driver_number;
          const isBattling = battleSet.has(pos.driver_number);
          const isAttacker = battles.some((b) => b.attacker === pos.driver_number);
          const teamColor = driver?.team_colour
            ? `#${driver.team_colour}`
            : "#888888";

          const gapSec = parseGapSeconds(interval?.interval);
          const isClose = gapSec !== null && gapSec < 1.0 && pos.position > 1;

          const compound = stint?.compound ?? "UNKNOWN";
          const compoundColor = COMPOUND_COLORS[compound] ?? "#666";
          const compoundLabel = COMPOUND_LABELS[compound] ?? "?";

          return (
            <button
              key={pos.driver_number}
              onClick={() => onSelectDriver(pos.driver_number)}
              className={`
                w-full text-left px-3 py-2.5 border-b border-f1-border/50
                flex items-center gap-3 transition-colors cursor-pointer
                ${isSelected ? "bg-white/5" : "hover:bg-white/[0.03]"}
                ${isBattling && !isSelected ? "bg-yellow-500/5" : ""}
              `}
            >
              {/* Position */}
              <span
                className="text-xs font-mono font-bold w-5 text-center shrink-0"
                style={{ color: pos.position <= 3 ? "#fff" : "#888" }}
              >
                {pos.position}
              </span>

              {/* Team color stripe */}
              <span
                className="w-0.5 h-8 rounded-full shrink-0"
                style={{ backgroundColor: teamColor }}
              />

              {/* Driver info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-mono font-bold tracking-wide">
                    {driver?.name_acronym ?? `#${pos.driver_number}`}
                  </span>
                  {driver && (
                    <span className="text-f1-muted text-xs font-mono">
                      #{driver.driver_number}
                    </span>
                  )}
                  {isBattling && (
                    <span className="text-[10px] font-mono font-bold text-yellow-400 bg-yellow-400/10 px-1 rounded">
                      {isAttacker ? "▲ DRS" : "●"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-f1-muted text-[10px] font-mono truncate">
                    {driver?.team_name ?? "Loading…"}
                  </span>
                </div>
              </div>

              {/* Right side: gap + compound */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                {pos.position === 1 ? (
                  <span className="text-f1-muted text-xs font-mono">LEAD</span>
                ) : (
                  <span
                    className="text-xs font-mono"
                    style={{ color: isClose ? "#fbbf24" : "#aaa" }}
                  >
                    {interval?.interval ? formatInterval(interval.interval) : "—"}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <span
                    className="text-[10px] font-mono font-bold w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: compoundColor + "22", color: compoundColor, border: `1px solid ${compoundColor}` }}
                  >
                    {compoundLabel}
                  </span>
                  {car && (
                    <span className="text-f1-muted text-[10px] font-mono">
                      {car.speed}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function formatInterval(val: string | number): string {
  if (typeof val === "number") return `+${val.toFixed(3)}`;
  if (val.includes("LAP")) return val;
  const n = parseFloat(val.replace("+", ""));
  if (isNaN(n)) return val;
  return `+${n.toFixed(3)}`;
}

