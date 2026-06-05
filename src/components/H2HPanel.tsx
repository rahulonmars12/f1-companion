"use client";

import { useMemo, useState } from "react";
import {
  Driver, Position, Interval, CarData, Stint, Lap,
  parseGapSeconds,
} from "@/lib/openf1";
import { COMPOUND_COLORS, COMPOUND_LABELS } from "@/lib/constants";

interface Battle {
  attacker: number;
  defender: number;
  gapSec: number;
}

interface H2HPanelProps {
  drivers: Map<number, Driver>;
  positions: Map<number, Position>;
  intervals: Map<number, Interval>;
  carData: Map<number, CarData>;
  stints: Map<number, Stint>;
  allLaps: Lap[];
  battles: Battle[];
  gapHistory: Map<string, number[]>;
  onSelectDriver: (n: number) => void;
}

const F1_POINTS: Record<number, number> = {
  1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
};

export default function H2HPanel({
  drivers, positions, intervals, carData, stints,
  allLaps, battles, gapHistory, onSelectDriver,
}: H2HPanelProps) {
  const [selectedBattle, setSelectedBattle] = useState<{ a: number; b: number } | null>(null);
  const [pickingSlot, setPickingSlot] = useState<"a" | "b" | null>(null);

  // Default custom H2H to P1 vs P2
  const driversByPos = useMemo(() =>
    [...positions.entries()]
      .sort(([, a], [, b]) => a.position - b.position)
      .map(([dn]) => dn),
    [positions]
  );

  const [customA, setCustomA] = useState<number | null>(null);
  const [customB, setCustomB] = useState<number | null>(null);
  const effA = customA ?? driversByPos[0] ?? null;
  const effB = customB ?? driversByPos[1] ?? null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-f1-dark scrollbar-thin">

      {/* Active battles */}
      <div className="px-4 pt-3 pb-2">
        <div className="text-[10px] font-mono font-bold tracking-widest text-f1-muted uppercase mb-2">
          Active Battles {battles.length > 0 && <span className="text-f1-accent">· {battles.length}</span>}
        </div>
        {battles.length === 0 ? (
          <div className="py-4 text-center text-f1-muted text-xs font-mono border border-dashed border-f1-border/50 rounded-lg">
            No close battles (gap &lt; 1s)
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {battles.map(battle => (
              <BattleCard
                key={`${battle.attacker}-${battle.defender}`}
                battle={battle}
                drivers={drivers}
                positions={positions}
                intervals={intervals}
                carData={carData}
                stints={stints}
                gapHistory={gapHistory}
                isSelected={selectedBattle?.a === battle.attacker && selectedBattle?.b === battle.defender}
                onSelect={() => {
                  setSelectedBattle({ a: battle.attacker, b: battle.defender });
                  setCustomA(battle.attacker);
                  setCustomB(battle.defender);
                }}
                onSelectDriver={onSelectDriver}
              />
            ))}
          </div>
        )}
      </div>

      {/* H2H comparison tool */}
      <div className="border-t border-f1-border/50 px-4 pt-3 pb-4">
        <div className="text-[10px] font-mono font-bold tracking-widest text-f1-muted uppercase mb-3">
          Compare Drivers
        </div>

        {pickingSlot ? (
          <DriverPicker
            drivers={drivers}
            driversByPos={driversByPos}
            onPick={dn => {
              if (pickingSlot === "a") setCustomA(dn);
              else setCustomB(dn);
              setPickingSlot(null);
            }}
            onCancel={() => setPickingSlot(null)}
          />
        ) : (
          <CompareView
            driverA={effA}
            driverB={effB}
            drivers={drivers}
            positions={positions}
            intervals={intervals}
            carData={carData}
            stints={stints}
            allLaps={allLaps}
            gapHistory={gapHistory}
            onPickA={() => setPickingSlot("a")}
            onPickB={() => setPickingSlot("b")}
            onSelectDriver={onSelectDriver}
          />
        )}
      </div>
    </div>
  );
}

// ─── Battle Card ──────────────────────────────────────────────────────────────

function BattleCard({
  battle, drivers, positions, intervals, carData, stints, gapHistory,
  isSelected, onSelect, onSelectDriver,
}: {
  battle: Battle;
  drivers: Map<number, Driver>;
  positions: Map<number, Position>;
  intervals: Map<number, Interval>;
  carData: Map<number, CarData>;
  stints: Map<number, Stint>;
  gapHistory: Map<string, number[]>;
  isSelected: boolean;
  onSelect: () => void;
  onSelectDriver: (n: number) => void;
}) {
  const attacker = drivers.get(battle.attacker);
  const defender = drivers.get(battle.defender);
  const aColor = attacker?.team_colour ? `#${attacker.team_colour}` : "#888";
  const dColor = defender?.team_colour ? `#${defender.team_colour}` : "#888";
  const aPosNum = positions.get(battle.attacker)?.position ?? 0;
  const dPosNum = positions.get(battle.defender)?.position ?? 0;
  const history = gapHistory.get(String(battle.attacker)) ?? [];
  const trend = history.length >= 3 ? history[history.length - 1] - history[history.length - 3] : 0;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-lg border p-3 transition-colors ${
        isSelected ? "border-yellow-400/40 bg-yellow-400/5" : "border-f1-border bg-white/[0.02] hover:bg-white/[0.04]"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 flex items-center gap-1.5">
          <button onClick={e => { e.stopPropagation(); onSelectDriver(battle.attacker); }}
            className="font-mono font-black text-sm hover:underline" style={{ color: aColor }}>
            {attacker?.name_acronym ?? "?"}
          </button>
          <span className="text-f1-muted text-[10px] font-mono">P{aPosNum}</span>
          <span className="text-[9px] font-mono font-bold text-yellow-400 bg-yellow-400/10 px-1 rounded">ATK</span>
        </div>
        <div className="text-center">
          <div className="text-white font-mono font-black text-base tabular-nums">
            {battle.gapSec.toFixed(3)}
            <span className="text-f1-muted text-xs font-normal">s</span>
          </div>
          {history.length > 1 && (
            <div className="text-[9px] font-mono" style={{
              color: trend < -0.05 ? "#ef4444" : trend > 0.05 ? "#22c55e" : "#666"
            }}>
              {trend < -0.05 ? "▼" : trend > 0.05 ? "▲" : "—"}
            </div>
          )}
        </div>
        <div className="flex-1 flex items-center justify-end gap-1.5">
          <span className="text-f1-muted text-[10px] font-mono">P{dPosNum}</span>
          <button onClick={e => { e.stopPropagation(); onSelectDriver(battle.defender); }}
            className="font-mono font-black text-sm hover:underline" style={{ color: dColor }}>
            {defender?.name_acronym ?? "?"}
          </button>
        </div>
      </div>

      {/* Sparkline */}
      {history.length > 2 && <MiniSparkline history={history} />}
    </button>
  );
}

function MiniSparkline({ history }: { history: number[] }) {
  const W = 260, H = 20;
  const min = Math.min(...history), max = Math.max(...history, min + 0.01);
  const xS = (i: number) => (i / Math.max(1, history.length - 1)) * W;
  const yS = (v: number) => H - 2 - ((v - min) / (max - min)) * (H - 4);
  const d = history.map((v, i) => `${i === 0 ? "M" : "L"} ${xS(i).toFixed(1)} ${yS(v).toFixed(1)}`).join(" ");
  const closing = history[history.length - 1] < history[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H, opacity: 0.7 }}>
      <path d={d} fill="none" stroke={closing ? "#ef4444" : "#22c55e"} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Compare View ──────────────────────────────────────────────────────────────

function CompareView({
  driverA, driverB, drivers, positions, intervals, carData, stints, allLaps, gapHistory,
  onPickA, onPickB, onSelectDriver,
}: {
  driverA: number | null;
  driverB: number | null;
  drivers: Map<number, Driver>;
  positions: Map<number, Position>;
  intervals: Map<number, Interval>;
  carData: Map<number, CarData>;
  stints: Map<number, Stint>;
  allLaps: Lap[];
  gapHistory: Map<string, number[]>;
  onPickA: () => void;
  onPickB: () => void;
  onSelectDriver: (n: number) => void;
}) {
  const dA = driverA ? drivers.get(driverA) : null;
  const dB = driverB ? drivers.get(driverB) : null;
  const colorA = dA?.team_colour ? `#${dA.team_colour}` : "#888";
  const colorB = dB?.team_colour ? `#${dB.team_colour}` : "#888";
  const posA = driverA ? positions.get(driverA) : null;
  const posB = driverB ? positions.get(driverB) : null;
  const carA = driverA ? carData.get(driverA) : null;
  const carB = driverB ? carData.get(driverB) : null;
  const stintA = driverA ? stints.get(driverA) : null;
  const stintB = driverB ? stints.get(driverB) : null;

  const lapsByDriver = useMemo(() => {
    const m = new Map<number, Lap[]>();
    for (const lap of allLaps) {
      if (!lap.lap_duration || lap.is_pit_out_lap) continue;
      const arr = m.get(lap.driver_number) ?? [];
      arr.push(lap);
      m.set(lap.driver_number, arr);
    }
    for (const [dn, laps] of m) m.set(dn, laps.sort((a, b) => a.lap_number - b.lap_number));
    return m;
  }, [allLaps]);

  const lapsA = driverA ? lapsByDriver.get(driverA) ?? [] : [];
  const lapsB = driverB ? lapsByDriver.get(driverB) ?? [] : [];
  const bestA = lapsA.reduce<Lap | null>((b, l) => !b || (l.lap_duration ?? 999) < (b.lap_duration ?? 999) ? l : b, null);
  const bestB = lapsB.reduce<Lap | null>((b, l) => !b || (l.lap_duration ?? 999) < (b.lap_duration ?? 999) ? l : b, null);

  const sharedLaps = useMemo(() => {
    const setA = new Set(lapsA.map(l => l.lap_number));
    const shared = lapsB.filter(l => setA.has(l.lap_number)).map(l => l.lap_number).slice(-12);
    const mapA = new Map(lapsA.map(l => [l.lap_number, l.lap_duration ?? 0]));
    const mapB = new Map(lapsB.map(l => [l.lap_number, l.lap_duration ?? 0]));
    return shared.map(n => ({ lap: n, a: mapA.get(n) ?? 0, b: mapB.get(n) ?? 0 }));
  }, [lapsA, lapsB]);

  const lastSectorDelta = useMemo(() => {
    const mapA = new Map(lapsA.map(l => [l.lap_number, l]));
    for (let i = lapsB.length - 1; i >= 0; i--) {
      const lb = lapsB[i];
      if (!lb.duration_sector_1 || !lb.duration_sector_2 || !lb.duration_sector_3) continue;
      const la = mapA.get(lb.lap_number);
      if (!la?.duration_sector_1 || !la?.duration_sector_2 || !la?.duration_sector_3) continue;
      return {
        lap: lb.lap_number,
        s1: la.duration_sector_1 - lb.duration_sector_1,
        s2: la.duration_sector_2 - lb.duration_sector_2,
        s3: la.duration_sector_3 - lb.duration_sector_3,
      };
    }
    return null;
  }, [lapsA, lapsB]);

  return (
    <div className="flex flex-col gap-3">
      {/* Driver selector */}
      <div className="flex items-center gap-2">
        <button onClick={onPickA}
          className="flex-1 flex items-center gap-2 rounded-lg p-2.5 border border-f1-border hover:border-white/20 transition-colors"
          style={{ background: colorA + "10" }}>
          <span className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: colorA }} />
          <div className="text-left flex-1 min-w-0">
            <div className="text-xs font-mono font-black" style={{ color: colorA }}>{dA?.name_acronym ?? "?"}</div>
            <div className="text-[9px] font-mono text-f1-muted">{posA ? `P${posA.position}` : "—"}</div>
          </div>
          <span className="text-f1-border text-[10px]">▼</span>
        </button>
        <span className="text-f1-muted text-xs font-mono shrink-0 font-bold">vs</span>
        <button onClick={onPickB}
          className="flex-1 flex items-center gap-2 rounded-lg p-2.5 border border-f1-border hover:border-white/20 transition-colors"
          style={{ background: colorB + "10" }}>
          <span className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: colorB }} />
          <div className="text-left flex-1 min-w-0">
            <div className="text-xs font-mono font-black" style={{ color: colorB }}>{dB?.name_acronym ?? "?"}</div>
            <div className="text-[9px] font-mono text-f1-muted">{posB ? `P${posB.position}` : "—"}</div>
          </div>
          <span className="text-f1-border text-[10px]">▼</span>
        </button>
      </div>

      {/* Best lap row */}
      {(bestA || bestB) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/5 rounded p-2 text-center border border-f1-border/30">
            <div className="text-[9px] font-mono text-f1-muted mb-0.5">Best Lap</div>
            <div className="text-xs font-mono font-bold" style={{ color: colorA }}>{formatLap(bestA?.lap_duration)}</div>
            <div className="text-[9px] font-mono text-f1-muted">L{bestA?.lap_number ?? "—"}</div>
          </div>
          <div className="bg-white/5 rounded p-2 text-center border border-f1-border/30">
            <div className="text-[9px] font-mono text-f1-muted mb-0.5">Best Lap</div>
            <div className="text-xs font-mono font-bold" style={{ color: colorB }}>{formatLap(bestB?.lap_duration)}</div>
            <div className="text-[9px] font-mono text-f1-muted">L{bestB?.lap_number ?? "—"}</div>
          </div>
        </div>
      )}

      {/* Sector deltas — last shared lap with complete sector data */}
      {lastSectorDelta && (
        <div>
          <div className="text-[9px] font-mono text-f1-muted uppercase tracking-wider mb-1.5">
            Sectors · L{lastSectorDelta.lap}
            <span className="ml-1 normal-case text-f1-border">(+A faster)</span>
          </div>
          <div className="flex gap-2">
            {([
              { label: "S1", delta: lastSectorDelta.s1, color: "#7c8fa6" },
              { label: "S2", delta: lastSectorDelta.s2, color: "#f59e0b" },
              { label: "S3", delta: lastSectorDelta.s3, color: "#c084fc" },
            ]).map(({ label, delta, color }) => {
              const aFaster = delta < -0.001;
              const bFaster = delta > 0.001;
              return (
                <div key={label}
                  className="flex-1 rounded p-1.5 text-center border border-f1-border/30 bg-white/[0.03]">
                  <div className="text-[9px] font-mono mb-0.5" style={{ color }}>{label}</div>
                  <div className="text-[10px] font-mono font-bold tabular-nums"
                    style={{ color: aFaster ? colorA : bFaster ? colorB : "#555" }}>
                    {Math.abs(delta) < 0.001 ? "=" : `${aFaster ? "-" : "+"}${Math.abs(delta).toFixed(3)}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live telemetry bars */}
      {(carA || carB) && (
        <div className="flex flex-col gap-1.5">
          <div className="text-[9px] font-mono text-f1-muted uppercase tracking-wider">Live</div>
          {([
            { label: "Speed", a: carA?.speed ?? 0, b: carB?.speed ?? 0, unit: "km/h" },
            { label: "Throttle", a: carA?.throttle ?? 0, b: carB?.throttle ?? 0, unit: "%", max: 100 },
          ] as Array<{ label: string; a: number; b: number; unit: string; max?: number }>).map(({ label, a, b, unit, max }) => {
            const top = max ?? Math.max(a, b, 1);
            return (
              <div key={label}>
                <div className="flex justify-between text-[9px] font-mono mb-0.5">
                  <span style={{ color: colorA }}>{a}{unit}</span>
                  <span className="text-f1-muted">{label}</span>
                  <span style={{ color: colorB }}>{b}{unit}</span>
                </div>
                <div className="flex gap-0.5 h-1.5">
                  <div className="flex-1 flex justify-end bg-white/5 rounded-l overflow-hidden">
                    <div className="h-full rounded-l" style={{ width: `${(a / top) * 100}%`, backgroundColor: colorA }} />
                  </div>
                  <div className="w-px bg-f1-border shrink-0" />
                  <div className="flex-1 bg-white/5 rounded-r overflow-hidden">
                    <div className="h-full rounded-r" style={{ width: `${(b / top) * 100}%`, backgroundColor: colorB }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stint comparison */}
      {(stintA || stintB) && (
        <div className="flex items-center justify-between bg-white/5 rounded p-2 border border-f1-border/30">
          {stintA ? (
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                style={{ color: COMPOUND_COLORS[stintA.compound] ?? "#666", border: `1px solid ${COMPOUND_COLORS[stintA.compound] ?? "#666"}` }}>
                {COMPOUND_LABELS[stintA.compound] ?? "?"}
              </span>
              <span className="text-[10px] font-mono" style={{ color: colorA }}>{stintA.compound}</span>
            </div>
          ) : <div />}
          <span className="text-[9px] font-mono text-f1-muted">Tyres</span>
          {stintB ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono" style={{ color: colorB }}>{stintB.compound}</span>
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                style={{ color: COMPOUND_COLORS[stintB.compound] ?? "#666", border: `1px solid ${COMPOUND_COLORS[stintB.compound] ?? "#666"}` }}>
                {COMPOUND_LABELS[stintB.compound] ?? "?"}
              </span>
            </div>
          ) : <div />}
        </div>
      )}

      {/* Lap time chart */}
      {sharedLaps.length >= 2 && (
        <LapTimeChart laps={sharedLaps} colorA={colorA} colorB={colorB} />
      )}
    </div>
  );
}

function LapTimeChart({ laps, colorA, colorB }: {
  laps: Array<{ lap: number; a: number; b: number }>;
  colorA: string;
  colorB: string;
}) {
  const W = 290, H = 60, PL = 6, PR = 6, PT = 4, PB = 14;
  const allT = laps.flatMap(l => [l.a, l.b]).filter(Boolean);
  if (allT.length === 0) return null;
  const minT = Math.min(...allT) * 0.999, maxT = Math.max(...allT) * 1.001;
  const xS = (i: number) => PL + (i / Math.max(1, laps.length - 1)) * (W - PL - PR);
  const yS = (t: number) => PT + ((t - minT) / (maxT - minT || 1)) * (H - PT - PB);
  const pathA = laps.map((l, i) => `${i === 0 ? "M" : "L"} ${xS(i).toFixed(1)} ${yS(l.a).toFixed(1)}`).join(" ");
  const pathB = laps.map((l, i) => `${i === 0 ? "M" : "L"} ${xS(i).toFixed(1)} ${yS(l.b).toFixed(1)}`).join(" ");
  return (
    <div className="bg-white/5 rounded border border-f1-border/30 overflow-hidden">
      <div className="px-2 pt-1.5 pb-0 text-[8px] font-mono text-f1-muted">Lap Times (last {laps.length} laps)</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        <path d={pathA} fill="none" stroke={colorA} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathB} fill="none" stroke={colorB} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {laps.filter((_, i) => i === 0 || i === laps.length - 1 || (i % Math.ceil(laps.length / 4) === 0)).map((l, _, arr) => {
          const i = laps.indexOf(l);
          return (
            <text key={l.lap} x={xS(i)} y={H - 2} fontSize={6} fill="#555" textAnchor="middle" fontFamily="monospace">
              L{l.lap}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Driver Picker ─────────────────────────────────────────────────────────────

function DriverPicker({ drivers, driversByPos, onPick, onCancel }: {
  drivers: Map<number, Driver>;
  driversByPos: number[];
  onPick: (dn: number) => void;
  onCancel: () => void;
}) {
  return (
    <div>
      <div className="text-[9px] font-mono text-f1-muted mb-2">Select driver</div>
      <div className="grid grid-cols-3 gap-1.5">
        {driversByPos.map(dn => {
          const d = drivers.get(dn);
          if (!d) return null;
          const c = `#${d.team_colour ?? "555"}`;
          return (
            <button key={dn} onClick={() => onPick(dn)}
              className="text-[9px] font-mono font-bold px-2 py-2 rounded border border-f1-border hover:border-white/30 transition-colors"
              style={{ color: c }}>
              {d.name_acronym}
            </button>
          );
        })}
      </div>
      <button onClick={onCancel} className="mt-2 text-[9px] font-mono text-f1-muted hover:text-white transition-colors">
        Cancel
      </button>
    </div>
  );
}

function formatLap(secs: number | null | undefined): string {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}
