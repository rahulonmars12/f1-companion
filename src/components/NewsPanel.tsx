"use client";

import { useMemo } from "react";
import { Session } from "@/lib/openf1";
import { useCalendar, useDriverStandings, useConstructorStandings } from "@/hooks/useRaceData";
import { getTeamColor } from "@/lib/constants";

function sessionLabel(s: Session) {
  if (s.session_type === "Qualifying") return "QUAL";
  if (s.session_type === "Race") return "RACE";
  return s.session_type.toUpperCase().slice(0, 4);
}

function sessionLabelColor(s: Session) {
  if (s.session_type === "Qualifying") return { text: "#f59e0b", bg: "#f59e0b18", border: "#f59e0b40" };
  return { text: "#e8002d", bg: "#e8002d18", border: "#e8002d40" };
}

export default function NewsPanel() {
  const calendar = useCalendar();
  const driverStandings = useDriverStandings();
  const constructorStandings = useConstructorStandings();
  const now = useMemo(() => new Date(), []);

  const upcoming = useMemo(
    () => calendar.filter(s => new Date(s.date_start) > now),
    [calendar, now]
  );
  const nextEvent = upcoming[0] ?? null;

  const countdown = useMemo(() => {
    if (!nextEvent) return null;
    const diff = new Date(nextEvent.date_start).getTime() - now.getTime();
    if (diff <= 0) return null;
    const days  = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const mins  = Math.floor((diff % 3_600_000)  / 60_000);
    const secs  = Math.floor((diff % 60_000)      / 1_000);
    return { days, hours, mins, secs, subDay: days === 0 };
  }, [nextEvent, now]);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-f1-dark scrollbar-thin">

      {/* Next event countdown */}
      {nextEvent && countdown && (
        <div className="mx-3 mt-3 rounded-xl border border-f1-border overflow-hidden">
          <div className="border-b border-f1-border/50 px-4 py-2 flex items-center gap-2">
            <span className="text-[9px] font-mono uppercase tracking-widest font-bold"
              style={{ color: sessionLabelColor(nextEvent).text }}>
              {nextEvent.session_type === "Qualifying" ? "Next Qualifying" : "Next Race"}
            </span>
          </div>
          <div className="px-4 py-3">
            <div className="text-white font-mono font-black text-base leading-tight">
              {nextEvent.circuit_short_name}
            </div>
            <div className="text-f1-muted text-xs font-mono mb-3">
              {nextEvent.country_name} · {nextEvent.year}
            </div>

            {countdown.subDay ? (
              /* Under 24 h — show HH:MM */
              <div className="flex flex-col items-center gap-1">
                <div className="text-white font-mono font-black tabular-nums"
                  style={{ fontSize: 44, lineHeight: 1, letterSpacing: "-0.02em" }}>
                  {String(countdown.hours).padStart(2, "0")}
                  <span className="text-f1-muted" style={{ fontSize: 32 }}>:</span>
                  {String(countdown.mins).padStart(2, "0")}
                </div>
                <div className="text-f1-muted text-[9px] font-mono uppercase tracking-widest">
                  hours : minutes
                </div>
              </div>
            ) : (
              /* Multi-day — show boxes */
              <div className="flex gap-3">
                {[
                  { value: countdown.days,  label: "DAYS" },
                  { value: countdown.hours, label: "HRS"  },
                  { value: countdown.mins,  label: "MIN"  },
                ].map(({ value, label }) => (
                  <div key={label} className="flex-1 text-center bg-white/5 rounded-lg py-2">
                    <div className="text-white font-mono font-black text-xl tabular-nums">
                      {String(value).padStart(2, "0")}
                    </div>
                    <div className="text-f1-muted text-[9px] font-mono uppercase tracking-wider">
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-2.5 text-f1-muted text-[10px] font-mono text-center">
              {new Date(nextEvent.date_start).toLocaleDateString(undefined, {
                weekday: "short", month: "short", day: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming calendar */}
      <div className="px-4 pt-3 pb-2">
        <div className="text-[10px] font-mono font-bold tracking-widest text-f1-muted uppercase mb-2">
          Upcoming
        </div>
        <div className="flex flex-col gap-1.5">
          {upcoming.slice(0, 7).map(s => {
            const d = new Date(s.date_start);
            const diff = d.getTime() - now.getTime();
            const days  = Math.floor(diff / 86_400_000);
            const hours = Math.floor((diff % 86_400_000) / 3_600_000);
            const lbl = sessionLabelColor(s);
            return (
              <div key={s.session_key}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-f1-border/40">
                {/* Session type badge */}
                <span
                  className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0"
                  style={{ color: lbl.text, backgroundColor: lbl.bg, border: `1px solid ${lbl.border}` }}
                >
                  {sessionLabel(s)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-xs font-mono font-bold truncate">
                    {s.circuit_short_name}
                  </div>
                  <div className="text-f1-muted text-[9px] font-mono">{s.country_name}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-[10px]" style={{ color: lbl.text }}>
                    {days === 0
                      ? `${String(hours).padStart(2, "0")}h`
                      : days === 1
                      ? "TOMORROW"
                      : `${days}d`}
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
              const color = getTeamColor(s.Constructors[0]?.name ?? "");
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
