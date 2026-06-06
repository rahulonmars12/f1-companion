"use client";

import { Session, RaceControl } from "@/lib/openf1";
import { FLAG_COLORS, FLAG_LABELS } from "@/lib/constants";

interface HeaderProps {
  session: Session | null;
  raceControl: RaceControl[];
  isHistorical?: boolean;
  hasLiveSession?: boolean;
  onOpenPicker?: () => void;
  onGoLive?: () => void;
}

export default function Header({ session, raceControl, isHistorical, hasLiveSession, onOpenPicker, onGoLive }: HeaderProps) {
  const latestFlag = raceControl.find((m) => m.flag && m.category === "Flag");
  const flagColor = latestFlag?.flag ? FLAG_COLORS[latestFlag.flag] ?? "#39b54a" : "#39b54a";
  const flagLabel = latestFlag?.flag ? FLAG_LABELS[latestFlag.flag] ?? latestFlag.flag : "CLEAR";

  const latestMessage = raceControl.find(
    (m) => m.category !== "Flag" || m.message.toLowerCase().includes("lap")
  );

  return (
    <header className="h-12 md:h-14 shrink-0 flex items-center justify-between px-3 md:px-6 border-b border-f1-border bg-f1-panel">
      {/* Left: brand + session */}
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        <span className="text-f1-red font-black text-base md:text-xl tracking-widest uppercase font-mono shrink-0">
          F1
        </span>
        <span className="text-f1-border hidden md:block">│</span>
        {session ? (
          <>
            {/* Mobile: short form */}
            <span className="text-white/70 text-xs font-mono truncate md:hidden">
              {session.circuit_short_name} · {session.session_name}
            </span>
            {/* Desktop: full */}
            <span className="text-f1-muted text-xs font-mono truncate hidden md:block">
              {session.country_name} · {session.circuit_short_name} · {session.session_name}
            </span>
          </>
        ) : (
          <span className="text-f1-muted text-xs font-mono hidden md:block">COMPANION</span>
        )}
      </div>

      {/* Right: status + controls */}
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        {/* Race message — desktop only */}
        {latestMessage && (
          <span className="text-f1-muted text-xs font-mono truncate max-w-48 hidden lg:block">
            {latestMessage.message}
          </span>
        )}

        {/* Flag indicator */}
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full shrink-0 animate-pulse"
            style={{ backgroundColor: flagColor }}
          />
          <span
            className="text-[10px] font-mono font-bold tracking-wider hidden sm:block"
            style={{ color: flagColor }}
          >
            {flagLabel}
          </span>
        </div>

        {/* Sessions picker button */}
        {onOpenPicker && (
          <button
            onClick={onOpenPicker}
            className="flex items-center gap-1 text-f1-muted hover:text-white text-xs font-mono border border-f1-border hover:border-white/30 px-2 py-1 rounded transition-colors"
          >
            <span>Race</span>
            <span className="text-[10px]">▾</span>
          </button>
        )}

        {/* Live / Replay badge */}
        {hasLiveSession ? (
          <button
            onClick={onGoLive}
            className="flex items-center gap-1.5 hover:opacity-70 active:scale-95 transition-all"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-f1-red animate-pulse shrink-0" />
            <span className="text-f1-red text-[10px] font-mono font-bold tracking-widest hidden sm:block">
              LIVE
            </span>
          </button>
        ) : isHistorical ? (
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
            <span className="text-yellow-500 text-[10px] font-mono font-bold tracking-widest hidden sm:block">
              REPLAY
            </span>
          </div>
        ) : null}
      </div>
    </header>
  );
}
