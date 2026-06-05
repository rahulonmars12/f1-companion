"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/Header";
import StandingsPanel from "@/components/StandingsPanel";
import TrackVisual from "@/components/TrackVisual";
import ContextPanel, { PanelMode } from "@/components/ContextPanel";
import IntelPanel from "@/components/IntelPanel";
import H2HPanel from "@/components/H2HPanel";
import NewsPanel from "@/components/NewsPanel";
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
  useAllPositions,
  useAllLaps,
  useAllStints,
  useWeather,
} from "@/hooks/useRaceData";
import { parseGapSeconds, Session } from "@/lib/openf1";

type MobileTab = "order" | "track" | "intel" | "h2h" | "news";

export default function Home() {
  // ── Session ──────────────────────────────────────────────────────────────────
  const { session: liveSession, loading: sessionLoading } = useSession();
  const [pickedSession, setPickedSession] = useState<Session | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const session = pickedSession ?? liveSession;
  const sessionKey = session?.session_key ?? null;

  useEffect(() => {
    if (!sessionLoading && !liveSession && !pickedSession) setShowPicker(true);
  }, [sessionLoading, liveSession, pickedSession]);

  // ── Time scrubber ─────────────────────────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<1 | 2 | 5 | 10 | 30>(1);

  const handlePickSession = useCallback((s: Session) => {
    setPickedSession(s);
    setCurrentTime(new Date(new Date(s.date_start).getTime() + 15 * 60 * 1000).toISOString());
    setIsPlaying(false);
  }, []);

  const handleGoLive = useCallback(() => {
    setCurrentTime(null);
    setPickedSession(null);
    setIsPlaying(false);
  }, []);

  // ── Effective query time ───────────────────────────────────────────────────────
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
  const allPositions = useAllPositions(sessionKey, effectiveQueryTime);
  const allLaps = useAllLaps(sessionKey);
  const allStints = useAllStints(sessionKey);
  const weather = useWeather(sessionKey);

  const currentLap = useMemo(() => {
    const nums = raceControl.filter(m => m.lap_number != null).map(m => m.lap_number!);
    return nums.length > 0 ? Math.max(...nums) : undefined;
  }, [raceControl]);

  const stints = useStints(sessionKey, currentLap);

  // ── Fastest lap ───────────────────────────────────────────────────────────────
  const fastestLap = useMemo(() => {
    return allLaps.reduce<typeof allLaps[0] | null>((best, lap) => {
      if (!lap.lap_duration) return best;
      if (!best?.lap_duration || lap.lap_duration < best.lap_duration) return lap;
      return best;
    }, null);
  }, [allLaps]);

  // ── Track path — locked once circuit trace is stable (≥150 pts) ───────────────
  const rawTrackPath = useReferenceTrack(sessionKey, useMemo(() => {
    for (const [dn, pos] of positions.entries()) { if (pos.position === 1) return dn; }
    return drivers.size > 0 ? [...drivers.keys()][0] : null;
  }, [positions, drivers]), effectiveQueryTime);

  const [lockedTrack, setLockedTrack] = useState(rawTrackPath);
  const prevSessionKeyRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevSessionKeyRef.current !== sessionKey) {
      prevSessionKeyRef.current = sessionKey;
      setLockedTrack([]);
      return;
    }
    if (lockedTrack.length < 150 && rawTrackPath.length >= 150) {
      setLockedTrack(rawTrackPath);
    }
  }, [rawTrackPath, sessionKey]);

  const trackPath = lockedTrack.length >= 150 ? lockedTrack : rawTrackPath;

  const p1DriverNumber = useMemo(() => {
    for (const [dn, pos] of positions.entries()) { if (pos.position === 1) return dn; }
    return drivers.size > 0 ? [...drivers.keys()][0] : null;
  }, [positions, drivers]);

  const p1Lap = useDriverLap(sessionKey, p1DriverNumber);
  const sectorFractions = useMemo(() => {
    if (!p1Lap?.lap_duration || !p1Lap.duration_sector_1 || !p1Lap.duration_sector_2) return null;
    return { s1: p1Lap.duration_sector_1 / p1Lap.lap_duration, s2: p1Lap.duration_sector_2 / p1Lap.lap_duration };
  }, [p1Lap]);

  // ── Battle detection ───────────────────────────────────────────────────────────
  const battles = useMemo(() => {
    const result: Array<{ attacker: number; defender: number; gapSec: number }> = [];
    for (const [dn, interval] of intervals.entries()) {
      const pos = positions.get(dn);
      if (!pos || pos.position === 1) continue;
      const gapSec = parseGapSeconds(interval.interval);
      if (gapSec === null || gapSec >= 1.0) continue;
      const defender = [...positions.values()].find(p => p.position === pos.position - 1);
      if (!defender) continue;
      result.push({ attacker: dn, defender: defender.driver_number, gapSec });
    }
    return result.sort((a, b) =>
      (positions.get(a.defender)?.position ?? 99) - (positions.get(b.defender)?.position ?? 99)
    );
  }, [intervals, positions]);

  // ── Pit stop / undercut detection ──────────────────────────────────────────────
  const prevStintNums = useRef<Map<number, number>>(new Map());
  const [pitAlert, setPitAlert] = useState<{ driverNumber: number; message: string } | null>(null);

  useEffect(() => {
    const prev = prevStintNums.current;
    for (const [dn, stint] of stints.entries()) {
      const prevNum = prev.get(dn) ?? 0;
      if (prevNum > 0 && stint.stint_number > prevNum) {
        const driver = drivers.get(dn);
        const pos = positions.get(dn);
        if (driver && pos) {
          const aheadPos = [...positions.values()].find(p => p.position === pos.position - 1);
          const aheadDriver = aheadPos ? drivers.get(aheadPos.driver_number) : null;
          const gapBefore = parseGapSeconds(intervals.get(dn)?.interval);
          let message = `${driver.name_acronym}`;
          if (aheadDriver && gapBefore !== null && gapBefore < 30)
            message += ` pits → undercut threat vs ${aheadDriver.name_acronym}`;
          else
            message += ` pits (P${pos.position})`;
          setPitAlert({ driverNumber: dn, message });
        }
      }
    }
    prevStintNums.current = new Map([...stints.entries()].map(([dn, s]) => [dn, s.stint_number]));
  }, [stints]);

  useEffect(() => {
    if (!pitAlert) return;
    const t = setTimeout(() => setPitAlert(null), 20_000);
    return () => clearTimeout(t);
  }, [pitAlert]);

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

  const handleSelectDriver = useCallback((n: number) => {
    setManualOverride(true);
    setPanelMode({ type: "driver", driverNumber: n });
  }, []);

  const handleClosePanel = useCallback(() => {
    setManualOverride(false);
    setPanelMode({ type: "idle" });
  }, []);

  const radioDriverNumber = panelMode.type === "driver" ? panelMode.driverNumber : null;
  const radios = useTeamRadio(sessionKey, radioDriverNumber, currentTime);

  // ── Favourites ────────────────────────────────────────────────────────────────
  const [favorites, setFavorites] = useState<number[]>([]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("f1-favorites");
      if (stored) setFavorites(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const toggleFavorite = useCallback((dn: number) => {
    setFavorites(prev => {
      const next = prev.includes(dn)
        ? prev.filter(n => n !== dn)
        : prev.length < 3 ? [...prev, dn] : prev;
      localStorage.setItem("f1-favorites", JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Mobile tab ────────────────────────────────────────────────────────────────
  const [mobileTab, setMobileTab] = useState<MobileTab>("track");

  // ── Loading / no-session screens ──────────────────────────────────────────────
  if (sessionLoading && !pickedSession) {
    return (
      <div className="h-dvh flex items-center justify-center bg-f1-dark">
        <div className="text-center">
          <div className="text-f1-red font-mono font-black text-4xl tracking-widest mb-4">F1</div>
          <div className="text-white/60 font-mono text-sm">Loading…</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-dvh flex items-center justify-center bg-f1-dark">
        <div className="text-center max-w-sm">
          <div className="text-f1-red font-mono font-black text-4xl tracking-widest mb-4">F1</div>
          <div className="text-white font-mono text-lg mb-2">No Live Session</div>
          <div className="text-white/40 font-mono text-sm mb-6">Load a previous race to explore historical data.</div>
          <button onClick={() => setShowPicker(true)}
            className="bg-f1-red text-white font-mono font-bold text-sm px-6 py-3 rounded hover:bg-red-700 transition-colors">
            Browse Sessions
          </button>
        </div>
        {showPicker && <SessionSelector currentSession={session} onSelect={handlePickSession} onClose={() => setShowPicker(false)} />}
      </div>
    );
  }

  const TABS: Array<{ id: MobileTab; label: string; icon: string }> = [
    { id: "order", label: "Order", icon: "≡" },
    { id: "track", label: "Track", icon: "◎" },
    { id: "intel", label: "Intel", icon: "⚡" },
    { id: "h2h",   label: "H2H",   icon: "⚔" },
    { id: "news",  label: "News",  icon: "★" },
  ];

  return (
    <div className="h-dvh flex flex-col bg-f1-dark overflow-hidden safe-layout">
      <Header
        session={session}
        raceControl={raceControl}
        isHistorical={currentTime !== null}
        onOpenPicker={() => setShowPicker(true)}
      />

      <main className="flex-1 flex overflow-hidden min-h-0">
        {/* Standings */}
        <div className={`${mobileTab === "order" ? "flex w-full" : "hidden"} md:block md:w-auto`}>
          <StandingsPanel
            drivers={drivers}
            positions={positions}
            intervals={intervals}
            carData={carData}
            stints={stints}
            selectedDriver={panelMode.type === "driver" ? panelMode.driverNumber : null}
            battles={battles}
            fastestLapDriverNumber={fastestLap?.driver_number ?? null}
            pitAlert={pitAlert}
            currentLap={currentLap}
            favorites={favorites}
            onSelectDriver={handleSelectDriver}
            onToggleFavorite={toggleFavorite}
          />
        </div>

        {/* Track */}
        <div className={`${mobileTab === "track" ? "flex" : "hidden"} md:flex flex-1 min-w-0`}>
          <TrackVisual
            session={session}
            drivers={drivers}
            trackPath={trackPath}
            sectorFractions={sectorFractions}
            liveLocations={liveLocations}
            carData={carData}
            selectedDriver={panelMode.type === "driver" ? panelMode.driverNumber : null}
            battles={battles}
            onSelectDriver={handleSelectDriver}
          />
        </div>

        {/* Intel */}
        <div className={`${mobileTab === "intel" ? "flex w-full" : "hidden"} md:hidden`}>
          <IntelPanel
            drivers={drivers}
            positions={positions}
            allPositions={allPositions as never}
            allLaps={allLaps}
            allStints={allStints}
            raceControl={raceControl}
            pitAlert={pitAlert}
            weather={weather}
            currentTime={effectiveQueryTime}
            currentLap={currentLap}
          />
        </div>

        {/* H2H */}
        <div className={`${mobileTab === "h2h" ? "flex w-full" : "hidden"} md:hidden`}>
          <H2HPanel
            drivers={drivers}
            positions={positions}
            intervals={intervals}
            carData={carData}
            stints={stints}
            allLaps={allLaps}
            battles={battles}
            gapHistory={gapHistory}
            onSelectDriver={handleSelectDriver}
          />
        </div>

        {/* News */}
        <div className={`${mobileTab === "news" ? "flex w-full" : "hidden"} md:hidden`}>
          <NewsPanel />
        </div>

        {/* Detail sidebar (desktop only) */}
        <div className="hidden md:block md:w-auto">
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

      {/* Mobile tab bar */}
      <nav className="md:hidden flex shrink-0 border-t border-f1-border bg-f1-panel">
        {TABS.map(tab => (
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
        onPlayPause={() => setIsPlaying(p => !p)}
        onSpeedChange={setPlaySpeed}
        onGoLive={handleGoLive}
      />

      {/* Mobile driver detail overlay — only on explicit tap, not auto-battle */}
      {panelMode.type === "driver" && (
        <div className="md:hidden fixed inset-0 z-50" onClick={handleClosePanel}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="absolute inset-x-0 rounded-t-2xl overflow-hidden bg-f1-panel border-t border-f1-border"
            style={{ bottom: 52, maxHeight: "75vh" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2 pb-1 border-b border-f1-border">
              <div className="w-8 h-1 rounded-full bg-f1-border" />
            </div>
            <div style={{ height: "calc(75vh - 24px)", overflow: "auto" }}>
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
          </div>
        </div>
      )}

      {showPicker && (
        <SessionSelector currentSession={session} onSelect={handlePickSession} onClose={() => setShowPicker(false)} />
      )}
    </div>
  );
}
