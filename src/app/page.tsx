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
  useTrackPath,
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

  // When a historical session is picked, start from its beginning
  const handlePickSession = useCallback((s: Session) => {
    setPickedSession(s);
    setCurrentTime(s.date_start);
    setIsPlaying(false);
  }, []);

  const handleGoLive = useCallback(() => {
    setCurrentTime(null);
    setPickedSession(null);
    setIsPlaying(false);
  }, []);

  const isHistorical = currentTime !== null;

  // ── Race data ─────────────────────────────────────────────────────────────────
  const drivers = useDrivers(sessionKey);
  const positions = usePositions(sessionKey, currentTime);
  const { latest: intervals, raw: rawIntervals } = useIntervals(sessionKey, currentTime);
  const liveLocations = useLocations(sessionKey, currentTime);
  const trackPath = useTrackPath(sessionKey, currentTime);
  const carData = useCarData(sessionKey, currentTime);
  const raceControl = useRaceControl(sessionKey, currentTime);
  const gapHistory = useGapHistory(rawIntervals);

  // Derive current lap from race_control for historical stint filtering
  const currentLap = useMemo(() => {
    if (!isHistorical) return undefined;
    const nums = raceControl.filter((m) => m.lap_number != null).map((m) => m.lap_number!);
    return nums.length > 0 ? Math.max(...nums) : undefined;
  }, [raceControl, isHistorical]);

  const stints = useStints(sessionKey, currentLap);

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

        <TrackVisual
          session={session}
          drivers={drivers}
          trackPath={trackPath}
          liveLocations={liveLocations}
          selectedDriver={panelMode.type === "driver" ? panelMode.driverNumber : null}
          battles={battles}
          onSelectDriver={handleSelectDriver}
        />

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
      </main>

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
