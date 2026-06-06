"use client";

import { useMemo, useState } from "react";
import { Session } from "@/lib/openf1";
import { useSessionsList } from "@/hooks/useRaceData";

interface SessionSelectorProps {
  currentSession: Session | null;
  onSelect: (session: Session) => void;
  onClose: () => void;
}

const SESSION_TYPE_ORDER = ["Race", "Qualifying", "Sprint", "Sprint Qualifying", "Practice 3", "Practice 2", "Practice 1"];

const SESSION_ICONS: Record<string, string> = {
  Race: "⬛",
  Qualifying: "⏱",
  Sprint: "⚡",
  "Sprint Qualifying": "⚡",
  "Practice 1": "○",
  "Practice 2": "○",
  "Practice 3": "○",
};

export default function SessionSelector({ currentSession, onSelect, onClose }: SessionSelectorProps) {
  const allSessions = useSessionsList();
  const [filter, setFilter] = useState<"Race" | "All">("Race");
  const [search, setSearch] = useState("");
  const nowMs = useMemo(() => Date.now(), []);

  const filtered = useMemo(() => {
    return allSessions.filter((s) => {
      // Only show sessions that have already started
      if (new Date(s.date_start).getTime() > nowMs) return false;
      if (filter === "Race" && s.session_type !== "Race") return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          s.country_name.toLowerCase().includes(q) ||
          s.circuit_short_name.toLowerCase().includes(q) ||
          s.session_name.toLowerCase().includes(q) ||
          String(s.year).includes(q)
        );
      }
      return true;
    });
  }, [allSessions, filter, search, nowMs]);

  // Group by year → meeting (country+circuit)
  const grouped = useMemo(() => {
    const years = new Map<number, Map<string, Session[]>>();
    for (const s of filtered) {
      const meetingKey = `${s.country_name}__${s.circuit_short_name}`;
      if (!years.has(s.year)) years.set(s.year, new Map());
      const meetings = years.get(s.year)!;
      if (!meetings.has(meetingKey)) meetings.set(meetingKey, []);
      meetings.get(meetingKey)!.push(s);
    }
    // Sort sessions within each meeting
    for (const meetings of years.values()) {
      for (const sessions of meetings.values()) {
        sessions.sort((a, b) => {
          const ai = SESSION_TYPE_ORDER.indexOf(a.session_name);
          const bi = SESSION_TYPE_ORDER.indexOf(b.session_name);
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
      }
    }
    return [...years.entries()].sort((a, b) => b[0] - a[0]);
  }, [filtered]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#111] border border-f1-border rounded-xl w-[640px] max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-f1-border flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-white font-mono font-bold text-base tracking-wide">Select Session</h2>
            <p className="text-f1-muted text-xs font-mono mt-0.5">
              {allSessions.length === 0 ? "Loading…" : `${allSessions.length} sessions available`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-f1-muted hover:text-white font-mono text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Filters */}
        <div className="px-5 py-3 border-b border-f1-border flex items-center gap-3 shrink-0">
          <div className="flex gap-1">
            {(["Race", "All"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-xs font-mono font-bold transition-colors ${
                  filter === f
                    ? "bg-f1-red text-white"
                    : "bg-white/5 text-f1-muted hover:text-white"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search circuit, country…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-white/5 border border-f1-border rounded px-3 py-1 text-xs font-mono text-white placeholder-f1-muted outline-none focus:border-white/30"
          />
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto">
          {grouped.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-f1-muted text-xs font-mono">
              {allSessions.length === 0 ? "Loading sessions…" : "No results"}
            </div>
          ) : (
            grouped.map(([year, meetings]) => (
              <div key={year}>
                <div className="px-5 py-2 text-f1-muted text-[10px] font-mono font-bold tracking-widest uppercase bg-white/[0.02] border-b border-f1-border sticky top-0">
                  {year} Season
                </div>
                {[...meetings.entries()].map(([meetingKey, sessions]) => {
                  const rep = sessions[0];
                  return (
                    <div key={meetingKey} className="border-b border-f1-border/50">
                      {/* Meeting header */}
                      <div className="px-5 py-2 flex items-center gap-3">
                        <div className="flex-1">
                          <span className="text-white/80 text-xs font-mono font-semibold">
                            {rep.country_name}
                          </span>
                          <span className="text-f1-muted text-[10px] font-mono ml-2">
                            {rep.circuit_short_name}
                          </span>
                        </div>
                        <span className="text-f1-muted text-[10px] font-mono">
                          {formatDate(rep.date_start)}
                        </span>
                      </div>
                      {/* Session type buttons */}
                      <div className="px-5 pb-3 flex flex-wrap gap-2">
                        {sessions.map((s) => {
                          const isActive = currentSession?.session_key === s.session_key;
                          const isRace = s.session_type === "Race";
                          return (
                            <button
                              key={s.session_key}
                              onClick={() => { onSelect(s); onClose(); }}
                              className={`
                                flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-mono
                                transition-all cursor-pointer
                                ${isActive
                                  ? "border-f1-red bg-f1-red/10 text-white"
                                  : isRace
                                  ? "border-white/20 bg-white/5 text-white hover:border-white/40"
                                  : "border-f1-border bg-transparent text-f1-muted hover:text-white hover:border-white/20"}
                              `}
                            >
                              <span>{SESSION_ICONS[s.session_name] ?? "○"}</span>
                              <span className="font-bold">{s.session_name}</span>
                              {isActive && <span className="text-f1-red text-[9px]">●</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
