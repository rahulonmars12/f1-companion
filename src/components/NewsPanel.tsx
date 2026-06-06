"use client";

import { useEffect, useMemo, useState } from "react";
import { Session } from "@/lib/openf1";
import { useCalendar, useDriverStandings, useConstructorStandings } from "@/hooks/useRaceData";
import { getTeamColor } from "@/lib/constants";

// ── Session badge helpers ──────────────────────────────────────────────────────

function sessionBadge(s: Session): { label: string; text: string; bg: string; border: string } {
  const name = s.session_name;
  let label: string;
  if (name === "Practice 1") label = "FP1";
  else if (name === "Practice 2") label = "FP2";
  else if (name === "Practice 3") label = "FP3";
  else if (name.includes("Practice")) label = "FP";
  else if (s.session_type === "Qualifying") label = "QUAL";
  else if (s.session_type === "Race") label = "RACE";
  else if (name === "Sprint") label = "SPR";
  else if (name === "Sprint Qualifying") label = "SQ";
  else label = s.session_type.slice(0, 4).toUpperCase();

  if (s.session_type === "Race")        return { label, text: "#e8002d", bg: "#e8002d18", border: "#e8002d40" };
  if (s.session_type === "Qualifying")  return { label, text: "#f59e0b", bg: "#f59e0b18", border: "#f59e0b40" };
  if (name.includes("Practice"))       return { label, text: "#14b8a6", bg: "#14b8a618", border: "#14b8a640" };
  return                                       { label, text: "#60a5fa", bg: "#60a5fa18", border: "#60a5fa40" };
}

function nextEventLabel(s: Session): string {
  const name = s.session_name;
  if (name === "Practice 1") return "Next FP1";
  if (name === "Practice 2") return "Next FP2";
  if (name === "Practice 3") return "Next FP3";
  if (s.session_type === "Qualifying") return "Next Qualifying";
  if (s.session_type === "Race") return "Next Race";
  if (name === "Sprint") return "Next Sprint";
  return "Next Session";
}

function timeUntil(s: Session, now: Date): string {
  const diff = new Date(s.date_start).getTime() - now.getTime();
  if (diff <= 0) return "NOW";
  const days  = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const mins  = Math.floor((diff % 3_600_000) / 60_000);
  if (days >= 2) return `${days}d`;
  if (days === 1) return `1d ${hours}h`;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

// ── Weekend grouping ───────────────────────────────────────────────────────────

type WeekendGroup = {
  key: string;
  country: string;
  circuit: string;
  sessions: Session[];
};

function groupByWeekend(sessions: Session[]): WeekendGroup[] {
  const map = new Map<string, WeekendGroup>();
  for (const s of sessions) {
    const key = `${s.year}__${s.country_name}__${s.circuit_short_name}`;
    if (!map.has(key)) map.set(key, { key, country: s.country_name, circuit: s.circuit_short_name, sessions: [] });
    map.get(key)!.sessions.push(s);
  }
  for (const wk of map.values()) {
    wk.sessions.sort((a, b) => a.date_start.localeCompare(b.date_start));
  }
  return [...map.values()];
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function NewsPanel() {
  const calendar = useCalendar();
  const driverStandings = useDriverStandings();
  const constructorStandings = useConstructorStandings();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

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
    const mins  = Math.floor((diff % 3_600_000) / 60_000);
    return { days, hours, mins, subDay: days === 0 };
  }, [nextEvent, now]);

  const weekends = useMemo(() => groupByWeekend(upcoming).slice(0, 5), [upcoming]);

  const nextBadge = nextEvent ? sessionBadge(nextEvent) : null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-f1-dark scrollbar-thin">

      {/* ── Next event countdown ────────────────────────────────────────────── */}
      {nextEvent && countdown && nextBadge && (
        <div className="mx-3 mt-3 rounded-xl border border-f1-border overflow-hidden">
          <div className="border-b border-f1-border/50 px-4 py-2 flex items-center gap-2">
            <span className="text-[9px] font-mono uppercase tracking-widest font-bold"
              style={{ color: nextBadge.text }}>
              {nextEventLabel(nextEvent)}
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

      {/* ── Upcoming calendar — grouped by race weekend ────────────────────── */}
      <div className="px-4 pt-3 pb-2">
        <div className="text-[10px] font-mono font-bold tracking-widest text-f1-muted uppercase mb-2">
          Upcoming
        </div>
        {weekends.length === 0 ? (
          <div className="text-f1-muted text-xs font-mono py-2">Loading…</div>
        ) : (
          <div className="flex flex-col gap-2">
            {weekends.map(wk => (
              <div key={wk.key} className="rounded-lg border border-f1-border/40 overflow-hidden">
                {/* Weekend header */}
                <div className="px-3 py-2 bg-white/[0.03] border-b border-f1-border/40 flex items-center gap-2">
                  <span className="text-white text-[10px] font-mono font-bold flex-1">{wk.circuit}</span>
                  <span className="text-f1-muted text-[9px] font-mono">{wk.country}</span>
                </div>
                {/* Session rows */}
                {wk.sessions.map(s => {
                  const badge = sessionBadge(s);
                  const d = new Date(s.date_start);
                  return (
                    <div key={s.session_key}
                      className="flex items-center gap-2.5 px-3 py-2 border-b border-f1-border/20 last:border-0">
                      <span
                        className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 w-9 text-center"
                        style={{ color: badge.text, backgroundColor: badge.bg, border: `1px solid ${badge.border}` }}
                      >
                        {badge.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-f1-muted text-[9px] font-mono">
                          {d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                        </span>
                        <span className="text-f1-muted/50 text-[9px] font-mono ml-1">
                          {d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-[10px] shrink-0 tabular-nums"
                        style={{ color: badge.text }}>
                        {timeUntil(s, now)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Driver championship standings ───────────────────────────────────── */}
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

      {/* ── Constructor championship standings ─────────────────────────────── */}
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
