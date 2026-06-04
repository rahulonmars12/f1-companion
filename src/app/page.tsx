"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import StandingsPanel from "@/components/StandingsPanel";
import TrackVisual from "@/components/TrackVisual";
import ContextPanel, { PanelMode } from "@/components/ContextPanel";
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
import { parseGapSeconds } from "@/lib/openf1";

export default function Home() {
  const { session, loading: sessionLoading } = useSession();
  const sessionKey = session?.session_key ?? null;

  const drivers = useDrivers(sessionKey);
  const positions = usePositions(sessionKey);
  const intervals = useIntervals(sessionKey);
  const liveLocations = useLocations(sessionKey);
  const trackPath = useTrackPath(sessionKey);
  const carData = useCarData(sessionKey);
  const raceControl = useRaceControl(sessionKey);
  const stints = useStints(sessionKey);
  const gapHistory = useGapHistory(intervals);

  const [panelMode, setPanelMode] = useState<PanelMode>({ type: "idle" });
  const [manualOverride, setManualOverride] = useState(false);

  // Detect battles (gap < 1s), sorted by defender position (highest = most important)
  const battles = useMemo(() => {
    const result: Array<{ attacker: number; defender: number; gapSec: number }> = [];

    for (const [driverNum, interval] of intervals.entries()) {
      const pos = positions.get(driverNum);
      if (!pos || pos.position === 1) continue;
      const gapSec = parseGapSeconds(interval.interval);
      if (gapSec === null || gapSec >= 1.0) continue;

      // Find the defender (car directly ahead = position - 1)
      const defenderEntry = [...positions.values()].find(
        (p) => p.position === pos.position - 1
      );
      if (!defenderEntry) continue;

      result.push({
        attacker: driverNum,
        defender: defenderEntry.driver_number,
        gapSec,
      });
    }

    // Sort by defender position (lower position number = more important battle)
    return result.sort((a, b) => {
      const posA = positions.get(a.defender)?.position ?? 99;
      const posB = positions.get(b.defender)?.position ?? 99;
      return posA - posB;
    });
  }, [intervals, positions]);

  // Auto-switch to battle mode if no manual override
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

  // Determine which driver's radio to fetch
  const radioDriverNumber =
    panelMode.type === "driver" ? panelMode.driverNumber : null;
  const radios = useTeamRadio(sessionKey, radioDriverNumber);

  if (sessionLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-f1-dark">
        <div className="text-center">
          <div className="text-f1-red font-mono font-black text-4xl tracking-widest mb-4">F1</div>
          <div className="text-white/60 font-mono text-sm">Loading session…</div>
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
          <div className="text-white/40 font-mono text-sm">
            Check back when a practice, qualifying, or race session is active.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-f1-dark overflow-hidden">
      <Header session={session} raceControl={raceControl} />

      <main className="flex-1 flex overflow-hidden min-h-0">
        <StandingsPanel
          drivers={drivers}
          positions={positions}
          intervals={intervals}
          carData={carData}
          stints={stints}
          selectedDriver={
            panelMode.type === "driver" ? panelMode.driverNumber : null
          }
          battles={battles}
          onSelectDriver={handleSelectDriver}
        />

        <TrackVisual
          session={session}
          drivers={drivers}
          trackPath={trackPath}
          liveLocations={liveLocations}
          selectedDriver={
            panelMode.type === "driver" ? panelMode.driverNumber : null
          }
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
    </div>
  );
}
