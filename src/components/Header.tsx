"use client";

import { Session, RaceControl } from "@/lib/openf1";
import { FLAG_COLORS, FLAG_LABELS } from "@/lib/constants";

interface HeaderProps {
  session: Session | null;
  raceControl: RaceControl[];
  isHistorical?: boolean;
  onOpenPicker?: () => void;
}

export default function Header({ session, raceControl, isHistorical, onOpenPicker }: HeaderProps) {
  const latestFlag = raceControl.find((m) => m.flag && m.category === "Flag");
  const flagColor = latestFlag?.flag ? FLAG_COLORS[latestFlag.flag] ?? "#888" : "#39b54a";
  const flagLabel = latestFlag?.flag ? FLAG_LABELS[latestFlag.flag] ?? latestFlag.flag : "TRACK CLEAR";

  const latestMessage = raceControl.find(
    (m) => m.category !== "Flag" || m.message.toLowerCase().includes("lap")
  );

  return (
    <header className="h-14 flex items-center justify-between px-6 border-b border-f1-border bg-f1-panel shrink-0">
      <div className="flex items-center gap-4">
        <span className="text-f1-red font-bold text-xl tracking-widest uppercase font-mono">
          F1
        </span>
        <span className="text-white font-semibold tracking-wide">
          COMPANION
        </span>
        {session && (
          <span className="text-f1-muted text-sm font-mono">
            {session.country_name} · {session.circuit_short_name} · {session.session_name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-6">
        {latestMessage && (
          <span className="text-f1-muted text-xs font-mono truncate max-w-xs">
            {latestMessage.message}
          </span>
        )}
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: flagColor }}
          />
          <span
            className="text-xs font-mono font-bold tracking-wider"
            style={{ color: flagColor }}
          >
            {flagLabel}
          </span>
        </div>
        {onOpenPicker && (
          <button
            onClick={onOpenPicker}
            className="text-f1-muted hover:text-white text-xs font-mono border border-f1-border hover:border-white/30 px-2.5 py-1 rounded transition-colors"
          >
            Sessions ▾
          </button>
        )}
        <div className="flex items-center gap-1.5">
          {isHistorical ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              <span className="text-yellow-500 text-xs font-mono font-bold tracking-widest">REPLAY</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-f1-red animate-pulse" />
              <span className="text-f1-red text-xs font-mono font-bold tracking-widest">LIVE</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
