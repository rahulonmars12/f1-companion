"use client";

import { Driver, Position, Session } from "@/lib/openf1";
import { useCalendar } from "@/hooks/useRaceData";

interface MePanelProps {
  drivers: Map<number, Driver>;
  positions: Map<number, Position>;
  favorites: number[];
  onToggleFavorite: (dn: number) => void;
  currentSession: Session | null;
}

export default function MePanel({
  drivers,
  positions,
  favorites,
  onToggleFavorite,
}: MePanelProps) {
  const races = useCalendar();
  const now = new Date();

  const upcoming = races
    .filter(s => new Date(s.date_start) > now)
    .slice(0, 5);

  const sorted = [...positions.entries()].sort(([, a], [, b]) => a.position - b.position);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-f1-dark scrollbar-thin">

      {/* Your Picks */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono font-bold tracking-widest text-f1-muted uppercase">
            Your Picks
          </span>
          <span className="text-[9px] font-mono text-f1-border">{favorites.length}/3</span>
        </div>

        {favorites.length === 0 ? (
          <div className="py-5 text-center border border-dashed border-f1-border/50 rounded-lg">
            <div className="text-f1-muted text-xs font-mono">Tap ★ to follow up to 3 drivers</div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {favorites.map(dn => {
              const driver = drivers.get(dn);
              const pos = positions.get(dn);
              if (!driver) return null;
              const color = `#${driver.team_colour ?? "555"}`;
              return (
                <div key={dn} className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-white/[0.03]"
                  style={{ borderLeft: `3px solid ${color}` }}>
                  <span className="font-mono font-black text-sm" style={{ color }}>{driver.name_acronym}</span>
                  <span className="text-f1-muted text-[10px] font-mono flex-1 truncate">{driver.team_name}</span>
                  {pos && <span className="text-white text-xs font-mono font-bold">P{pos.position}</span>}
                  <button onClick={() => onToggleFavorite(dn)}
                    className="text-f1-accent text-sm leading-none">★</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* All drivers grid */}
      <div className="px-4 pb-4 border-t border-f1-border/50 pt-3">
        <div className="text-[10px] font-mono font-bold tracking-widest text-f1-muted uppercase mb-2">
          All Drivers
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {sorted.map(([dn, pos]) => {
            const driver = drivers.get(dn);
            if (!driver) return null;
            const isFav = favorites.includes(dn);
            const color = `#${driver.team_colour ?? "555"}`;
            const canAdd = !isFav && favorites.length >= 3;
            return (
              <button
                key={dn}
                onClick={() => !canAdd && onToggleFavorite(dn)}
                disabled={canAdd}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors disabled:opacity-30"
                style={{
                  background: isFav ? color + "18" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isFav ? color + "55" : "#1e1e1e"}`,
                }}
              >
                <span className="text-[10px] font-mono text-f1-muted tabular-nums w-4 shrink-0">
                  P{pos.position}
                </span>
                <span className="text-xs font-mono font-bold flex-1 truncate" style={{ color }}>
                  {driver.name_acronym}
                </span>
                <span className="text-[11px] shrink-0" style={{ color: isFav ? "#ffd700" : "#333" }}>
                  ★
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Race calendar */}
      <div className="px-4 pb-6 border-t border-f1-border/50 pt-3">
        <div className="text-[10px] font-mono font-bold tracking-widest text-f1-muted uppercase mb-2">
          Upcoming Races
        </div>
        {upcoming.length === 0 ? (
          <div className="text-f1-muted text-xs font-mono py-3 text-center">No upcoming races found</div>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map(s => {
              const d = new Date(s.date_start);
              const diffMs = d.getTime() - now.getTime();
              const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
              const countdownLabel =
                days === 0 ? "TODAY" :
                days === 1 ? "TOMORROW" :
                days < 7 ? `${days} DAYS` :
                days < 30 ? `${Math.round(days / 7)}W` :
                `${Math.round(days / 30)}MO`;

              return (
                <div key={s.session_key}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-white/[0.03] border border-f1-border">
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xs font-mono font-bold">{s.circuit_short_name}</div>
                    <div className="text-f1-muted text-[10px] font-mono">{s.country_name}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-f1-accent text-xs font-mono font-bold">{countdownLabel}</div>
                    <div className="text-f1-muted text-[9px] font-mono">
                      {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
