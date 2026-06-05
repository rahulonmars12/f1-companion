"use client";

import { useEffect, useRef, useState } from "react";
import { Driver, Location, Session, CarData } from "@/lib/openf1";

interface TrackVisualProps {
  session: Session | null;
  drivers: Map<number, Driver>;
  trackPath: Location[];
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

// Sector colors: cool grey / amber / lavender
const S1 = "#7c8fa6", S2 = "#f59e0b", S3 = "#c084fc";
const LERP = 0.1;

function drawTrack(
  ctx: CanvasRenderingContext2D,
  trackPath: Location[],
  sectorFractions: { s1: number; s2: number } | null,
  t: Transform,
) {
  const pts: [number, number][] = trackPath.map(l => project(l.x, l.y, t));
  const n = pts.length;
  if (n < 2) return;

  const centX = pts.reduce((s, p) => s + p[0], 0) / n;
  const centY = pts.reduce((s, p) => s + p[1], 0) / n;

  // ── Layer 1: deep shadow ──────────────────────────────────────────────────
  ctx.beginPath(); ctx.strokeStyle = "#000"; ctx.lineWidth = 18;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  tracePath(ctx, pts); ctx.stroke();

  // ── Layer 2: asphalt surface ──────────────────────────────────────────────
  ctx.beginPath(); ctx.strokeStyle = "#1d1d1d"; ctx.lineWidth = 9;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  tracePath(ctx, pts); ctx.stroke();

  // ── Layer 3: sector tint (thin overlay, semi-transparent) ─────────────────
  if (sectorFractions) {
    const s1e = Math.min(Math.floor(n * sectorFractions.s1), n - 1);
    const s2e = Math.min(Math.floor(n * (sectorFractions.s1 + sectorFractions.s2)), n - 1);
    for (const { slice, color } of [
      { slice: pts.slice(0, s1e + 1) as [number, number][], color: S1 },
      { slice: pts.slice(s1e, s2e + 1) as [number, number][], color: S2 },
      { slice: pts.slice(s2e) as [number, number][], color: S3 },
    ]) {
      if (slice.length < 2) continue;
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 3.5;
      ctx.globalAlpha = 0.55; ctx.lineCap = "round"; ctx.lineJoin = "round";
      tracePath(ctx, slice); ctx.stroke(); ctx.globalAlpha = 1;
    }

    // Sector boundary ticks — clean butt-capped lines, outward labels
    for (const { idx, label, color } of [
      { idx: s1e, label: "S2", color: S2 },
      { idx: s2e, label: "S3", color: S3 },
    ]) {
      if (idx <= 0 || idx >= n) continue;
      const [bx, by] = pts[idx];
      const i0 = Math.max(0, idx - 3), i1 = Math.min(n - 1, idx + 3);
      const ddx = pts[i1][0] - pts[i0][0], ddy = pts[i1][1] - pts[i0][1];
      const len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      const nx = -ddy / len, ny = ddx / len;
      const inward = nx * (centX - bx) + ny * (centY - by) > 0;
      const outNx = inward ? -nx : nx, outNy = inward ? -ny : ny;
      ctx.beginPath();
      ctx.moveTo(bx - nx * 6, by - ny * 6); ctx.lineTo(bx + nx * 6, by + ny * 6);
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineCap = "butt"; ctx.stroke();
      ctx.lineCap = "round";
      ctx.font = "bold 8px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = color; ctx.globalAlpha = 0.85;
      ctx.fillText(label, bx + outNx * 13, by + outNy * 13); ctx.globalAlpha = 1;
    }
  } else {
    // No sector data — subtle grey surface
    ctx.beginPath(); ctx.strokeStyle = "#3a3a3a"; ctx.lineWidth = 3.5;
    ctx.globalAlpha = 0.7; ctx.lineCap = "round"; ctx.lineJoin = "round";
    tracePath(ctx, pts); ctx.stroke(); ctx.globalAlpha = 1;
  }

  // ── Direction of travel chevron (~7% along track) ─────────────────────────
  const arrIdx = Math.floor(n * 0.07);
  if (arrIdx > 0 && arrIdx < n - 2) {
    const [ax, ay] = pts[arrIdx];
    const [bx2, by2] = pts[arrIdx + 2];
    const ang = Math.atan2(by2 - ay, bx2 - ax);
    ctx.save();
    ctx.translate(ax, ay); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(-5, -3); ctx.lineTo(0, 0); ctx.lineTo(-5, 3);
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1.2;
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
    ctx.restore();
  }

  // ── S/F: tiny checkered finish line — no text ─────────────────────────────
  if (pts.length > 1) {
    const [sfx, sfy] = pts[0];
    const angle = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
    ctx.save(); ctx.translate(sfx, sfy); ctx.rotate(angle + Math.PI / 2);
    const SQ = 2.2, COLS = 4, ROWS = 2;
    const W = COLS * SQ, H = ROWS * SQ;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? "rgba(255,255,255,0.92)" : "rgba(5,5,5,0.92)";
        ctx.fillRect(-W / 2 + c * SQ, -H / 2 + r * SQ, SQ, SQ);
      }
    }
    ctx.restore();
  }
}

export default function TrackVisual({
  session, drivers, trackPath, sectorFractions,
  liveLocations, carData, selectedDriver, battles, onSelectDriver,
}: TrackVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 500 });

  const transformRef = useRef<Transform | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const dprRef = useRef(1);
  const sizeRef = useRef(size);
  const targetRawRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const displayRawRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const rafRef = useRef<number>(0);

  const driversRef = useRef(drivers);
  const selectedDriverRef = useRef(selectedDriver);
  const battlesRef = useRef(battles);
  const carDataRef = useRef(carData);
  useEffect(() => { driversRef.current = drivers; }, [drivers]);
  useEffect(() => { selectedDriverRef.current = selectedDriver; }, [selectedDriver]);
  useEffect(() => { battlesRef.current = battles; }, [battles]);
  useEffect(() => { carDataRef.current = carData; }, [carData]);
  useEffect(() => { sizeRef.current = size; }, [size]);

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

  // Update target positions
  useEffect(() => {
    for (const [dn, loc] of liveLocations.entries()) {
      targetRawRef.current.set(dn, { x: loc.x, y: loc.y });
      if (!displayRawRef.current.has(dn))
        displayRawRef.current.set(dn, { x: loc.x, y: loc.y });
    }
  }, [liveLocations]);

  // Rebuild offscreen track canvas — DPR-aware for sharp rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;

    if (trackPath.length < 10) {
      offscreenRef.current = null;
      transformRef.current = null;
      return;
    }

    const t = buildTransform(trackPath, size.w, size.h);
    transformRef.current = t;

    const offscreen = document.createElement("canvas");
    offscreen.width = size.w * dpr;
    offscreen.height = size.h * dpr;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    try {
      drawTrack(ctx, trackPath, sectorFractions, t);
    } catch (err) {
      console.error("[TrackVisual] track draw error:", err);
    }
    offscreenRef.current = offscreen;
  }, [trackPath, sectorFractions, size]);

  // Persistent RAF loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    function frame() {
      try {
        const canvas = canvasRef.current;
        const t = transformRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const dpr = dprRef.current;
            const { w, h } = sizeRef.current;

            for (const [dn, tgt] of targetRawRef.current.entries()) {
              const disp = displayRawRef.current.get(dn);
              if (!disp) { displayRawRef.current.set(dn, { ...tgt }); }
              else { disp.x += (tgt.x - disp.x) * LERP; disp.y += (tgt.y - disp.y) * LERP; }
            }

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);
            const offscreen = offscreenRef.current;

            if (!offscreen || !t) {
              ctx.fillStyle = "#333"; ctx.font = "13px monospace";
              ctx.textAlign = "center"; ctx.textBaseline = "middle";
              ctx.fillText("Loading track…", w / 2, h / 2);
            } else {
              ctx.drawImage(offscreen, 0, 0, w, h);
              const battleSet = new Set(battlesRef.current.flatMap(b => [b.attacker, b.defender]));

              for (const [dn, raw] of displayRawRef.current.entries()) {
                if (!targetRawRef.current.has(dn)) continue;
                const driver = driversRef.current.get(dn);
                if (!driver) continue;

                const [_cx, _cy] = project(raw.x, raw.y, t);
                const cx = Math.round(_cx), cy = Math.round(_cy);
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

                // Overtake-mode ring (green outer)
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

                // Acronym label — crisp at DPR
                ctx.font = `bold ${isSelected ? 10 : 8}px monospace`;
                ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillStyle = isSelected ? teamColor : "#0a0a0a";
                ctx.fillText(driver.name_acronym, cx, cy);

                if (isBattling && !isSelected) {
                  ctx.font = "7px monospace"; ctx.textBaseline = "bottom";
                  ctx.fillStyle = "#fbbf24";
                  ctx.fillText("⚔", cx, cy - radius - 3);
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
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-0.5 pointer-events-none">
          <span className="text-white/80 text-xs font-mono font-bold tracking-wider">{session.circuit_short_name}</span>
          <span className="text-f1-muted text-[10px] font-mono">{session.country_name} · {session.year}</span>
        </div>
      )}
      {/* Sector legend */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 pointer-events-none">
        {([{ label: "S1", color: S1 }, { label: "S2", color: S2 }, { label: "S3", color: S3 }]).map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[9px] font-mono opacity-70" style={{ color }}>{label}</span>
          </div>
        ))}
      </div>
      <canvas ref={canvasRef} className="w-full h-full cursor-pointer" onClick={handleClick} style={{ display: "block" }} />
    </div>
  );
}
