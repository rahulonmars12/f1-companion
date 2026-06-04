"use client";

import { useEffect, useRef, useState } from "react";
import { Driver, Location, Session, CarData } from "@/lib/openf1";

interface TrackVisualProps {
  session: Session | null;
  drivers: Map<number, Driver>;
  trackPath: Location[];          // locked circuit outline from page.tsx
  pitLanePath: Array<{ x: number; y: number }>;
  sectorFractions: { s1: number; s2: number } | null;
  liveLocations: Map<number, Location>;
  carData: Map<number, CarData>;
  selectedDriver: number | null;
  battles: Array<{ attacker: number; defender: number }>;
  onSelectDriver: (n: number) => void;
}

interface Transform {
  minX: number; minY: number; scale: number; offsetX: number; offsetY: number;
}

function buildTransform(pts: Array<{ x: number; y: number }>, w: number, h: number, pad = 52): Transform {
  if (pts.length === 0) return { minX: 0, minY: 0, scale: 1, offsetX: 0, offsetY: 0 };
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min((w - 2 * pad) / (maxX - minX || 1), (h - 2 * pad) / (maxY - minY || 1));
  return {
    minX, minY, scale,
    offsetX: pad + ((w - 2 * pad) - (maxX - minX) * scale) / 2,
    offsetY: pad + ((h - 2 * pad) - (maxY - minY) * scale) / 2,
  };
}

function project(x: number, y: number, t: Transform): [number, number] {
  return [t.offsetX + (x - t.minX) * t.scale, t.offsetY + (y - t.minY) * t.scale];
}

function tracePath(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  if (pts.length < 2) return;
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
}

// Nearest-neighbour sort so scattered pit dots connect into a path
function sortByProximity(pts: Array<{ x: number; y: number }>) {
  if (pts.length < 2) return pts;
  const result = [pts[0]];
  const rem = pts.slice(1);
  while (rem.length > 0) {
    const last = result[result.length - 1];
    let best = 0, bestD = Infinity;
    for (let i = 0; i < rem.length; i++) {
      const d = (rem[i].x - last.x) ** 2 + (rem[i].y - last.y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    result.push(rem.splice(best, 1)[0]);
  }
  return result;
}

const S1 = "#e8002d", S2 = "#ffd700", S3 = "#8b5cf6";
const LERP = 0.1;

function drawTrack(
  ctx: CanvasRenderingContext2D,
  trackPath: Location[],
  pitLanePath: Array<{ x: number; y: number }>,
  sectorFractions: { s1: number; s2: number } | null,
  t: Transform,
) {
  const pts: [number, number][] = trackPath.map(l => project(l.x, l.y, t));
  const n = pts.length;

  // Shadow
  ctx.beginPath(); ctx.strokeStyle = "#000"; ctx.lineWidth = 20;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  tracePath(ctx, pts); ctx.stroke();

  // Sector-coloured surface
  // Centroid — used for outward label placement
  const centX = pts.reduce((s, p) => s + p[0], 0) / n;
  const centY = pts.reduce((s, p) => s + p[1], 0) / n;

  if (sectorFractions) {
    const s1e = Math.min(Math.floor(n * sectorFractions.s1), n - 1);
    const s2e = Math.min(Math.floor(n * (sectorFractions.s1 + sectorFractions.s2)), n - 1);
    for (const { slice, color } of [
      { slice: pts.slice(0, s1e + 1) as [number,number][], color: S1 },
      { slice: pts.slice(s1e, s2e + 1) as [number,number][], color: S2 },
      { slice: pts.slice(s2e) as [number,number][], color: S3 },
    ]) {
      if (slice.length < 2) continue;
      ctx.beginPath(); ctx.strokeStyle = color + "cc"; ctx.lineWidth = 6;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      tracePath(ctx, slice); ctx.stroke();
    }
    // Sector boundary markers — short perpendicular tick lines, labels outside the track
    for (const { idx, label, color } of [
      { idx: s1e, label: "S2", color: S2 },
      { idx: s2e, label: "S3", color: S3 },
    ]) {
      if (idx <= 0 || idx >= n) continue;
      const [bx, by] = pts[idx];
      // Smooth direction using points 3 steps away (avoids local jitter)
      const i0 = Math.max(0, idx - 3), i1 = Math.min(n - 1, idx + 3);
      const dx = pts[i1][0] - pts[i0][0], dy = pts[i1][1] - pts[i0][1];
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len, ny = dx / len; // perpendicular unit vector
      // Outward = away from centroid
      const inward = nx * (centX - bx) + ny * (centY - by) > 0;
      const outNx = inward ? -nx : nx, outNy = inward ? -ny : ny;
      // Tick line (short, perpendicular, both sides of track edge)
      ctx.beginPath();
      ctx.moveTo(bx - nx * 7, by - ny * 7);
      ctx.lineTo(bx + nx * 7, by + ny * 7);
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = "square"; ctx.stroke();
      ctx.lineCap = "round";
      // Label outside the track
      ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.fillText(label, bx + outNx * 16, by + outNy * 16);
    }
  } else {
    ctx.beginPath(); ctx.strokeStyle = "#3a3a3a"; ctx.lineWidth = 6;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    tracePath(ctx, pts); ctx.stroke();
  }

  // Start / finish line — short tick, label outside
  if (pts.length > 1) {
    const [sfx, sfy] = pts[0];
    const angle = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
    // Perpendicular normal
    const nx = -Math.sin(angle), ny = Math.cos(angle);
    const inward = nx * (centX - sfx) + ny * (centY - sfy) > 0;
    const outNx = inward ? -nx : nx, outNy = inward ? -ny : ny;
    // Short tick
    ctx.save(); ctx.translate(sfx, sfy); ctx.rotate(angle + Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    // Label outside
    ctx.font = "bold 8px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#aaa"; ctx.fillText("S/F", sfx + outNx * 14, sfy + outNy * 14);
  }

  // Pit lane path (accumulated from passive detection)
  if (pitLanePath.length >= 4) {
    const sorted = sortByProximity([...pitLanePath]);
    const pitPts = sorted.map(p => project(p.x, p.y, t));
    ctx.beginPath();
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.lineCap = "round";
    pitPts.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py));
    ctx.stroke();
    ctx.setLineDash([]);
    // PIT label near first point
    const [lx, ly] = pitPts[0];
    ctx.font = "bold 8px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#888"; ctx.fillText("PIT", lx, ly - 8);
  }
}

export default function TrackVisual({
  session, drivers, trackPath, pitLanePath, sectorFractions,
  liveLocations, carData, selectedDriver, battles, onSelectDriver,
}: TrackVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 500 });

  const transformRef = useRef<Transform | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenSizeRef = useRef({ w: 0, h: 0 });
  const targetRawRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const displayRawRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const rafRef = useRef<number>(0);

  // Mirror refs so the RAF loop always reads fresh data without re-creating itself
  const driversRef = useRef(drivers);
  const selectedDriverRef = useRef(selectedDriver);
  const battlesRef = useRef(battles);
  const carDataRef = useRef(carData);
  useEffect(() => { driversRef.current = drivers; }, [drivers]);
  useEffect(() => { selectedDriverRef.current = selectedDriver; }, [selectedDriver]);
  useEffect(() => { battlesRef.current = battles; }, [battles]);
  useEffect(() => { carDataRef.current = carData; }, [carData]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Update target positions when live locations arrive
  useEffect(() => {
    for (const [dn, loc] of liveLocations.entries()) {
      targetRawRef.current.set(dn, { x: loc.x, y: loc.y });
      if (!displayRawRef.current.has(dn))
        displayRawRef.current.set(dn, { x: loc.x, y: loc.y });
    }
  }, [liveLocations]);

  // Rebuild offscreen track canvas when track / pit lane / size change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size.w;
    canvas.height = size.h;

    if (trackPath.length < 10) {
      offscreenRef.current = null;
      transformRef.current = null;
      return;
    }

    const t = buildTransform(trackPath, size.w, size.h);
    transformRef.current = t;

    const offscreen = document.createElement("canvas");
    offscreen.width = size.w;
    offscreen.height = size.h;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    try {
      drawTrack(ctx, trackPath, pitLanePath, sectorFractions, t);
    } catch (err) {
      console.error("[TrackVisual] track draw error:", err);
    }
    offscreenRef.current = offscreen;
    offscreenSizeRef.current = { w: size.w, h: size.h };
  }, [trackPath, pitLanePath, sectorFractions, size]);

  // Persistent RAF loop — reads everything via refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    function frame() {
      try {
        const canvas = canvasRef.current;
        const t = transformRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            for (const [dn, tgt] of targetRawRef.current.entries()) {
              const disp = displayRawRef.current.get(dn);
              if (!disp) { displayRawRef.current.set(dn, { ...tgt }); }
              else { disp.x += (tgt.x - disp.x) * LERP; disp.y += (tgt.y - disp.y) * LERP; }
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const offscreen = offscreenRef.current;

            if (!offscreen || !t) {
              ctx.fillStyle = "#333"; ctx.font = "13px monospace";
              ctx.textAlign = "center"; ctx.textBaseline = "middle";
              ctx.fillText("Loading track…", canvas.width / 2, canvas.height / 2);
            } else {
              ctx.drawImage(offscreen, 0, 0);
              const battleSet = new Set(battlesRef.current.flatMap(b => [b.attacker, b.defender]));

              for (const [dn, raw] of displayRawRef.current.entries()) {
                if (!targetRawRef.current.has(dn)) continue;
                const driver = driversRef.current.get(dn);
                if (!driver) continue;

                const [cx, cy] = project(raw.x, raw.y, t);
                const teamColor = driver.team_colour ? `#${driver.team_colour}` : "#888";
                const isSelected = selectedDriverRef.current === dn;
                const isBattling = battleSet.has(dn);
                const car = carDataRef.current.get(dn);
                const drsActive = car ? car.drs >= 8 : false;
                const radius = isSelected ? 10 : 7;

                // Glow aura
                if (isSelected) {
                  ctx.beginPath(); ctx.arc(cx, cy, radius + 7, 0, Math.PI * 2);
                  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius + 7);
                  g.addColorStop(0, teamColor + "55"); g.addColorStop(1, "transparent");
                  ctx.fillStyle = g; ctx.fill();
                } else if (isBattling) {
                  ctx.beginPath(); ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
                  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius + 5);
                  g.addColorStop(0, "#fbbf2433"); g.addColorStop(1, "transparent");
                  ctx.fillStyle = g; ctx.fill();
                }

                // DRS / Overtake-mode ring (outer, green)
                if (drsActive) {
                  ctx.beginPath(); ctx.arc(cx, cy, radius + 3.5, 0, Math.PI * 2);
                  ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 1.5;
                  ctx.globalAlpha = 0.85; ctx.stroke(); ctx.globalAlpha = 1;
                }

                // Car dot
                ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fillStyle = isSelected ? "#fff" : teamColor; ctx.fill();

                if (isSelected) {
                  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                  ctx.strokeStyle = teamColor; ctx.lineWidth = 2; ctx.stroke();
                }

                ctx.font = `bold ${isSelected ? 10 : 8}px monospace`;
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillStyle = isSelected ? teamColor : "#0a0a0a";
                ctx.fillText(driver.name_acronym, cx, cy);

                if (isBattling && !isSelected) {
                  ctx.font = "7px monospace"; ctx.textBaseline = "bottom";
                  ctx.fillStyle = "#fbbf24";
                  ctx.fillText("⚔", cx, cy - radius - 4);
                }
              }
            }
          }
        }
      } catch (err) { console.error("[TrackVisual] draw error:", err); }
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const t = transformRef.current;
    if (!t) return;
    for (const [dn, raw] of displayRawRef.current.entries()) {
      const [px, py] = project(raw.x, raw.y, t);
      if ((mx - px) ** 2 + (my - py) ** 2 < 196) { onSelectDriver(dn); return; }
    }
  };

  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden relative bg-f1-dark">
      {session && (
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 pointer-events-none">
          <span className="text-white/80 text-xs font-mono font-bold tracking-wider">{session.circuit_short_name}</span>
          <span className="text-f1-muted text-[10px] font-mono">{session.country_name} · {session.year}</span>
        </div>
      )}
      {/* Sector legend + DRS hint */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-1.5 pointer-events-none">
        {([{ label: "S1", color: S1 }, { label: "S2", color: S2 }, { label: "S3", color: S3 }]).map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-4 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] font-mono" style={{ color }}>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 mt-1">
          <span className="w-3 h-3 rounded-full border border-green-500 opacity-70" />
          <span className="text-[10px] font-mono text-green-500 opacity-70">OT</span>
        </div>
      </div>
      <canvas ref={canvasRef} className="w-full h-full cursor-pointer" onClick={handleClick} style={{ display: "block" }} />
    </div>
  );
}
