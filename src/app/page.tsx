"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import StandingsPanel from "@/components/StandingsPanel";
import TrackVisual from "@/components/TrackVisual";
import ContextPanel, { PanelMode } from "@/components/ContextPanel";
import SessionSelector from "@/components/SessionSelector";
import TimeControls from "@/components/TimeControls";
import {
  useSession,
  useDrivers,
  usePositions,
  useIntervals,
  useLocations,
  useReferenceTrack,
  useDriverLap,
  useCarData,
  useTeamRadio,
  useRaceControl,
  useStints,
  useGapHistory,
} from "@/hooks/useRaceData";
import { parseGapSeconds, Session } from "@/lib/openf1";

export default function Home() {
  // ── Session selection ────────────────────────────────────────────────────────
  const { session: liveSession, loading: sessionLoading } = useSession();
  const [pickedSession, setPickedSession] = useState<Session | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const session = pickedSession ?? liveSession;
  const sessionKey = session?.session_key ?? null;

  // Auto-open picker if there's no live session once loading completes
  useEffect(() => {
    if (!sessionLoading && !liveSession && !pickedSession) {
      setShowPicker(true);
    }
  }, [sessionLoading, liveSession, pickedSession]);

  // ── Time scrubber ─────────────────────────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState<string | null>(null); // null = live
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<1 | 2 | 5 | 10 | 30>(1);

  // When a historical session is picked, start 15 min in — OpenF1 has no
  // position data before a session actually begins (formation lap, grid walks, etc.)
  const handlePickSession = useCallback((s: Session) => {
    setPickedSession(s);
    const fifteenMin = new Date(new Date(s.date_start).getTime() + 15 * 60 * 1000).toISOString();
    setCurrentTime(fifteenMin);
    setIsPlaying(false);
  }, []);

  const handleGoLive = useCallback(() => {
    setCurrentTime(null);
    setPickedSession(null);
    setIsPlaying(false);
  }, []);

  const isHistorical = currentTime !== null;

  // ── Effective query time ──────────────────────────────────────────────────────
  // When the session has ended but we're in "live" mode, live_window=N returns
  // nothing. Fall back to date_end so all hooks fetch real data.
  const effectiveQueryTime = useMemo(() => {
    if (currentTime) return currentTime;
    if (session?.date_end) {
      const endMs = new Date(session.date_end).getTime();
      if (endMs < Date.now() - 120_000) return session.date_end;
    }
    return null;
  }, [currentTime, session?.date_end]);

  // ── Race data ─────────────────────────────────────────────────────────────────
  const drivers = useDrivers(sessionKey);
  const positions = usePositions(sessionKey, effectiveQueryTime);
  const { latest: intervals, raw: rawIntervals } = useIntervals(sessionKey, effectiveQueryTime);
  const liveLocations = useLocations(sessionKey, effectiveQueryTime);
  const carData = useCarData(sessionKey, effectiveQueryTime);
  const raceControl = useRaceControl(sessionKey, effectiveQueryTime);
  const gapHistory = useGapHistory(rawIntervals);

  // Derive current lap from race_control for historical stint filtering
  const currentLap = useMemo(() => {
    if (!isHistorical) return undefined;
    const nums = raceControl.filter((m) => m.lap_number != null).map((m) => m.lap_number!);
    return nums.length > 0 ? Math.max(...nums) : undefined;
  }, [raceControl, isHistorical]);

  const stints = useStints(sessionKey, currentLap);

  // ── Track path (single driver = clean circuit outline) ────────────────────────
  const p1DriverNumber = useMemo(() => {
    for (const [dn, pos] of positions.entries()) {
      if (pos.position === 1) return dn;
    }
    return drivers.size > 0 ? [...drivers.keys()][0] : null;
  }, [positions, drivers]);

  const trackPath = useReferenceTrack(sessionKey, p1DriverNumber, effectiveQueryTime);
  const p1Lap = useDriverLap(sessionKey, p1DriverNumber);
  const sectorFractions = useMemo(() => {
    if (!p1Lap?.lap_duration || !p1Lap.duration_sector_1 || !p1Lap.duration_sector_2) return null;
    return {
      s1: p1Lap.duration_sector_1 / p1Lap.lap_duration,
      s2: p1Lap.duration_sector_2 / p1Lap.lap_duration,
    };
  }, [p1Lap]);

  // ── Battle detection ───────────────────────────────────────────────────────────
  const battles = useMemo(() => {
    const result: Array<{ attacker: number; defender: number; gapSec: number }> = [];
    for (const [driverNum, interval] of intervals.entries()) {
      const pos = positions.get(driverNum);
      if (!pos || pos.position === 1) continue;
      const gapSec = parseGapSeconds(interval.interval);
      if (gapSec === null || gapSec >= 1.0) continue;
      const defender = [...positions.values()].find((p) => p.position === pos.position - 1);
      if (!defender) continue;
      result.push({ attacker: driverNum, defender: defender.driver_number, gapSec });
    }
    return result.sort((a, b) => {
      const pa = positions.get(a.defender)?.position ?? 99;
      const pb = positions.get(b.defender)?.position ?? 99;
      return pa - pb;
    });
  }, [intervals, positions]);

  // ── Mobile tab navigation ─────────────────────────────────────────────────────
  type MobileTab = "order" | "track" | "detail";
  const [mobileTab, setMobileTab] = useState<MobileTab>("track");

  // ── Context panel ─────────────────────────────────────────────────────────────
  const [panelMode, setPanelMode] = useState<PanelMode>({ type: "idle" });
  const [manualOverride, setManualOverride] = useState(false);

  useEffect(() => {
    if (manualOverride) return;
    if (battles.length > 0) {
      const top = battles[0];
      setPanelMode({ type: "battle", attacker: top.attacker, defender: top.defender });
    } else if (panelMode.type === "battle") {
      setPanelMode({ type: "idle" });
    }
  }, [battles, manualOverride]);

  const handleSelectDriver = useCallback((driverNumber: number) => {
    setManualOverride(true);
    setPanelMode({ type: "driver", driverNumber });
  }, []);

  const handleClosePanel = useCallback(() => {
    setManualOverride(false);
    setPanelMode({ type: "idle" });
  }, []);

  const radioDriverNumber = panelMode.type === "driver" ? panelMode.driverNumber : null;
  const radios = useTeamRadio(sessionKey, radioDriverNumber, currentTime);

  // ── Render ────────────────────────────────────────────────────────────────────
  if (sessionLoading && !pickedSession) {
    return (
      <div className="h-screen flex items-center justify-center bg-f1-dark">
        <div className="text-center">
          <div className="text-f1-red font-mono font-black text-4xl tracking-widest mb-4">F1</div>
          <div className="text-white/60 font-mono text-sm">Loading…</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center bg-f1-dark">
        <div className="text-center max-w-sm">
          <div className="text-f1-red font-mono font-black text-4xl tracking-widest mb-4">F1</div>
          <div className="text-white font-mono text-lg mb-2">No Live Session</div>
          <div className="text-white/40 font-mono text-sm mb-6">
            Load a previous race to explore historical data.
          </div>
          <button
            onClick={() => setShowPicker(true)}
            className="bg-f1-red text-white font-mono font-bold text-sm px-6 py-3 rounded hover:bg-red-700 transition-colors"
          >
            Browse Sessions
          </button>
        </div>
        {showPicker && (
          <SessionSelector
            currentSession={session}
            onSelect={handlePickSession}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-f1-dark overflow-hidden">
      <Header
        session={session}
        raceControl={raceControl}
        isHistorical={isHistorical}
        onOpenPicker={() => setShowPicker(true)}
      />

      <main className="flex-1 flex overflow-hidden min-h-0">
        {/* Standings — full width on mobile when active, fixed sidebar on desktop */}
        <div className={`${mobileTab === "order" ? "flex w-full" : "hidden"} md:block md:w-auto`}>
          <StandingsPanel
            drivers={drivers}
            positions={positions}
            intervals={intervals}
            carData={carData}
            stints={stints}
            selectedDriver={panelMode.type === "driver" ? panelMode.driverNumber : null}
            battles={battles}
            onSelectDriver={handleSelectDriver}
          />
        </div>

        {/* Track — always flex-1, hidden on mobile when other tab active */}
        <div className={`${mobileTab === "track" ? "flex" : "hidden"} md:flex flex-1 min-w-0`}>
          <TrackVisual
            session={session}
            drivers={drivers}
            trackPath={trackPath}
            sectorFractions={sectorFractions}
            liveLocations={liveLocations}
            selectedDriver={panelMode.type === "driver" ? panelMode.driverNumber : null}
            battles={battles}
            onSelectDriver={handleSelectDriver}
          />
        </div>

        {/* Context panel — full width on mobile when active, fixed sidebar on desktop */}
        <div className={`${mobileTab === "detail" ? "flex w-full" : "hidden"} md:block md:w-auto`}>
          <ContextPanel
            mode={panelMode}
            drivers={drivers}
            positions={positions}
            intervals={intervals}
            carData={carData}
            stints={stints}
            radios={radios}
            sessionKey={sessionKey}
            gapHistory={gapHistory}
            onClose={handleClosePanel}
          />
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden flex shrink-0 border-t border-f1-border bg-f1-panel">
        {(
          [
            { id: "order", label: "Order", icon: "≡" },
            { id: "track", label: "Track", icon: "◎" },
            { id: "detail", label: "Detail", icon: "⚡" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMobileTab(tab.id)}
            className={[
              "flex-1 flex flex-col items-center py-3 gap-0.5 text-[10px] font-mono uppercase tracking-wider transition-colors",
              mobileTab === tab.id
                ? "text-white border-t-2 border-f1-red -mt-px"
                : "text-f1-muted border-t-2 border-transparent -mt-px",
            ].join(" ")}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      <TimeControls
        session={session}
        currentTime={currentTime}
        isPlaying={isPlaying}
        speed={playSpeed}
        raceControl={raceControl}
        onTimeChange={setCurrentTime}
        onPlayPause={() => setIsPlaying((p) => !p)}
        onSpeedChange={setPlaySpeed}
        onGoLive={handleGoLive}
      />

      {showPicker && (
        <SessionSelector
          currentSession={session}
          onSelect={handlePickSession}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
