"use client";

import { useMemo } from "react";
import { useCalendar, useDriverStandings, useConstructorStandings } from "@/hooks/useRaceData";
import { getTeamColor } from "@/lib/constants";

export default function NewsPanel() {
  const races = useCalendar();
  const driverStandings = useDriverStandings();
  const constructorStandings = useConstructorStandings();
  const now = new Date();

  const nextRace = races.find(s => new Date(s.date_start) > now) ?? null;

  const countdown = useMemo(() => {
    if (!nextRace) return null;
    const diff = new Date(nextRace.date_start).getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { days, hours, mins };
  }, [nextRace]);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-f1-dark scrollbar-thin">

      {/* Next race countdown */}
      {nextRace && countdown && (
        <div className="mx-3 mt-3 rounded-xl border border-f1-border overflow-hidden">
          <div className="bg-f1-red/10 border-b border-f1-red/20 px-4 py-2">
            <div className="text-[9px] font-mono text-f1-red uppercase tracking-widest font-bold">Next Race</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-white font-mono font-black text-base">{nextRace.circuit_short_name}</div>
            <div className="text-f1-muted text-xs font-mono mb-3">{nextRace.country_name} · {nextRace.year}</div>
            <div className="flex gap-3">
              {[
                { value: countdown.days, label: "DAYS" },
                { value: countdown.hours, label: "HRS" },
                { value: countdown.mins, label: "MIN" },
              ].map(({ value, label }) => (
                <div key={label} className="flex-1 text-center bg-white/5 rounded-lg py-2">
                  <div className="text-white font-mono font-black text-xl tabular-nums">
                    {String(value).padStart(2, "0")}
                  </div>
                  <div className="text-f1-muted text-[9px] font-mono uppercase tracking-wider">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-f1-muted text-[10px] font-mono text-center">
              {new Date(nextRace.date_start).toLocaleDateString(undefined, {
                weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming calendar */}
      <div className="px-4 pt-3 pb-2">
        <div className="text-[10px] font-mono font-bold tracking-widest text-f1-muted uppercase mb-2">
          Race Calendar
        </div>
        <div className="flex flex-col gap-1.5">
          {races.filter(s => new Date(s.date_start) > now).slice(0, 5).map(s => {
            const d = new Date(s.date_start);
            const diff = d.getTime() - now.getTime();
            const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            return (
              <div key={s.session_key}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-f1-border/40">
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-mono font-bold">{s.circuit_short_name}</div>
                  <div className="text-f1-muted text-[9px] font-mono">{s.country_name}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-f1-accent text-[10px] font-mono font-bold">
                    {days === 1 ? "TOMORROW" : `${days}d`}
                  </div>
                  <div className="text-f1-muted text-[9px] font-mono">
                    {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Driver championship standings */}
      <div className="px-4 pb-2 border-t border-f1-border/50 pt-3">
        <div className="text-[10px] font-mono font-bold tracking-widest text-f1-muted uppercase mb-2">
          Championship · Drivers
        </div>
        {driverStandings.length === 0 ? (
          <div className="text-f1-muted text-xs font-mono py-2">Loading…</div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {driverStandings.map(s => {
              const teamName = s.Constructors[0]?.name ?? "";
              const color = getTeamColor(teamName);
              return (
                <div key={s.Driver.code} className="flex items-center gap-2 px-2 py-1.5 rounded">
                  <span className="text-[10px] font-mono text-f1-muted tabular-nums w-5 text-right shrink-0">
                    {s.position}
                  </span>
                  <span className="w-0.5 h-5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="flex-1 text-xs font-mono font-bold" style={{ color }}>
                    {s.Driver.code}
                  </span>
                  <span className="text-f1-muted text-[9px] font-mono truncate max-w-[80px] shrink-0">
                    {s.Constructors[0]?.name}
                  </span>
                  <span className="text-white text-xs font-mono font-bold tabular-nums shrink-0">
                    {s.points}
                    <span className="text-f1-muted font-normal text-[9px] ml-0.5">pts</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Constructor championship standings */}
      <div className="px-4 pb-6 border-t border-f1-border/50 pt-3">
        <div className="text-[10px] font-mono font-bold tracking-widest text-f1-muted uppercase mb-2">
          Championship · Constructors
        </div>
        {constructorStandings.length === 0 ? (
          <div className="text-f1-muted text-xs font-mono py-2">Loading…</div>
        ) : (
          <div className="flex flex-col gap-1">
            {constructorStandings.map((s, i) => {
              const color = getTeamColor(s.Constructor.name);
              return (
                <div key={s.Constructor.constructorId} className="flex items-center gap-2 px-2 py-1.5 rounded">
                  <span className="text-[10px] font-mono text-f1-muted tabular-nums w-4 text-right shrink-0">
                    {i + 1}
                  </span>
                  <span className="w-0.5 h-5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono font-bold truncate" style={{ color }}>
                      {s.Constructor.name}
                    </div>
                  </div>
                  <span className="text-white text-xs font-mono font-bold tabular-nums shrink-0">
                    {s.points}
                    <span className="text-f1-muted font-normal text-[9px] ml-0.5">pts</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
