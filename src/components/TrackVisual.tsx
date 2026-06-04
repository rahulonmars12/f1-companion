"use client";

import { useEffect, useRef, useState } from "react";
import { Driver, Location, Session } from "@/lib/openf1";

interface TrackVisualProps {
  session: Session | null;
  drivers: Map<number, Driver>;
  trackPath: Location[];
  sectorFractions: { s1: number; s2: number } | null;
  liveLocations: Map<number, Location>;
  selectedDriver: number | null;
  battles: Array<{ attacker: number; defender: number }>;
  onSelectDriver: (n: number) => void;
}

interface Transform {
  minX: number;
  minY: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

function buildTransform(
  points: Array<{ x: number; y: number }>,
  w: number,
  h: number,
  pad = 52
): Transform {
  if (points.length === 0) return { minX: 0, minY: 0, scale: 1, offsetX: 0, offsetY: 0 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scaleX = (w - 2 * pad) / (maxX - minX || 1);
  const scaleY = (h - 2 * pad) / (maxY - minY || 1);
  const scale = Math.min(scaleX, scaleY);
  const offsetX = pad + ((w - 2 * pad) - (maxX - minX) * scale) / 2;
  const offsetY = pad + ((h - 2 * pad) - (maxY - minY) * scale) / 2;
  return { minX, minY, scale, offsetX, offsetY };
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

const S1_COLOR = "#e8002d";
const S2_COLOR = "#ffd700";
const S3_COLOR = "#8b5cf6";
const LERP = 0.1;

function drawTrackToCanvas(
  ctx: CanvasRenderingContext2D,
  trackPath: Location[],
  sectorFractions: { s1: number; s2: number } | null,
  t: Transform
) {
  const pts: [number, number][] = trackPath.map((loc) => project(loc.x, loc.y, t));
  const n = pts.length;

  // Shadow layer
  ctx.beginPath();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 20;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  tracePath(ctx, pts);
  ctx.stroke();

  // Track surface with sector colors
  if (sectorFractions) {
    const s1End = Math.min(Math.floor(n * sectorFractions.s1), n - 1);
    const s2End = Math.min(Math.floor(n * (sectorFractions.s1 + sectorFractions.s2)), n - 1);

    const segments: Array<{ slice: [number, number][]; color: string }> = [
      { slice: pts.slice(0, s1End + 1) as [number, number][], color: S1_COLOR },
      { slice: pts.slice(s1End, s2End + 1) as [number, number][], color: S2_COLOR },
      { slice: pts.slice(s2End) as [number, number][], color: S3_COLOR },
    ];

    for (const { slice, color } of segments) {
      if (slice.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = color + "cc";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      tracePath(ctx, slice);
      ctx.stroke();
    }

    // Sector boundary markers
    for (const { idx, label, color } of [
      { idx: s1End, label: "S2", color: S2_COLOR },
      { idx: s2End, label: "S3", color: S3_COLOR },
    ]) {
      if (idx <= 0 || idx >= n) continue;
      const [bx, by] = pts[idx];
      ctx.beginPath();
      ctx.arc(bx, by, 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx, by, 6, 0, Math.PI * 2);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = color;
      ctx.fillText(label, bx, by - 9);
    }
  } else {
    ctx.beginPath();
    ctx.strokeStyle = "#3a3a3a";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    tracePath(ctx, pts);
    ctx.stroke();
  }

  // Start / finish line
  if (pts.length > 1) {
    const [sfx, sfy] = pts[0];
    const angle = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
    ctx.save();
    ctx.translate(sfx, sfy);
    ctx.rotate(angle + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(9, 0);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#999";
    ctx.fillText("S/F", sfx + 12, sfy);
  }
}

export default function TrackVisual({
  session,
  drivers,
  trackPath,
  sectorFractions,
  liveLocations,
  selectedDriver,
  battles,
  onSelectDriver,
}: TrackVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 500 });

  const transformRef = useRef<Transform | null>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const targetRawRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const displayRawRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const rafRef = useRef<number>(0);

  // Mirror refs so the RAF loop always reads current props without re-creation
  const driversRef = useRef(drivers);
  const selectedDriverRef = useRef(selectedDriver);
  const battlesRef = useRef(battles);
  useEffect(() => { driversRef.current = drivers; }, [drivers]);
  useEffect(() => { selectedDriverRef.current = selectedDriver; }, [selectedDriver]);
  useEffect(() => { battlesRef.current = battles; }, [battles]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Update target positions when liveLocations changes
  useEffect(() => {
    for (const [dn, loc] of liveLocations.entries()) {
      targetRawRef.current.set(dn, { x: loc.x, y: loc.y });
      // Seed display position on first encounter so car doesn't fly in from origin
      if (!displayRawRef.current.has(dn)) {
        displayRawRef.current.set(dn, { x: loc.x, y: loc.y });
      }
    }
  }, [liveLocations]);

  // Rebuild offscreen track canvas when track / sectorFractions / size change
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
      drawTrackToCanvas(ctx, trackPath, sectorFractions, t);
    } catch (err) {
      console.error("[TrackVisual] track draw error:", err);
    }
    offscreenRef.current = offscreen;
  }, [trackPath, sectorFractions, size]);

  // Persistent RAF loop — empty deps, reads everything via refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    function frame() {
      try {
        const canvas = canvasRef.current;
        const t = transformRef.current;

        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            // Lerp display positions towards targets
            for (const [dn, target] of targetRawRef.current.entries()) {
              const display = displayRawRef.current.get(dn);
              if (!display) {
                displayRawRef.current.set(dn, { ...target });
              } else {
                display.x += (target.x - display.x) * LERP;
                display.y += (target.y - display.y) * LERP;
              }
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const offscreen = offscreenRef.current;
            if (!offscreen || !t) {
              ctx.fillStyle = "#333";
              ctx.font = "13px monospace";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("Loading track…", canvas.width / 2, canvas.height / 2);
            } else {
              ctx.drawImage(offscreen, 0, 0);

              const battleSet = new Set(
                battlesRef.current.flatMap((b) => [b.attacker, b.defender])
              );

              for (const [driverNum, raw] of displayRawRef.current.entries()) {
                if (!targetRawRef.current.has(driverNum)) continue;
                const driver = driversRef.current.get(driverNum);
                if (!driver) continue;

                const [cx, cy] = project(raw.x, raw.y, t);
                const teamColor = driver.team_colour ? `#${driver.team_colour}` : "#888";
                const isSelected = selectedDriverRef.current === driverNum;
                const isBattling = battleSet.has(driverNum);
                const radius = isSelected ? 10 : 7;

                if (isSelected) {
                  ctx.beginPath();
                  ctx.arc(cx, cy, radius + 7, 0, Math.PI * 2);
                  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius + 7);
                  g.addColorStop(0, teamColor + "55");
                  g.addColorStop(1, "transparent");
                  ctx.fillStyle = g;
                  ctx.fill();
                } else if (isBattling) {
                  ctx.beginPath();
                  ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
                  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius + 5);
                  g.addColorStop(0, "#fbbf2433");
                  g.addColorStop(1, "transparent");
                  ctx.fillStyle = g;
                  ctx.fill();
                }

                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fillStyle = isSelected ? "#fff" : teamColor;
                ctx.fill();

                if (isSelected) {
                  ctx.beginPath();
                  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                  ctx.strokeStyle = teamColor;
                  ctx.lineWidth = 2;
                  ctx.stroke();
                }

                ctx.font = `bold ${isSelected ? 10 : 8}px monospace`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillStyle = isSelected ? teamColor : "#0a0a0a";
                ctx.fillText(driver.name_acronym, cx, cy);

                if (isBattling && !isSelected) {
                  ctx.font = "7px monospace";
                  ctx.textBaseline = "bottom";
                  ctx.fillStyle = "#fbbf24";
                  ctx.fillText("⚔", cx, cy - radius - 4);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("[TrackVisual] draw error:", err);
      }
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const t = transformRef.current;
    if (!t) return;
    for (const [driverNum, raw] of displayRawRef.current.entries()) {
      const [px, py] = project(raw.x, raw.y, t);
      if ((mx - px) ** 2 + (my - py) ** 2 < 196) {
        onSelectDriver(driverNum);
        return;
      }
    }
  };

  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden relative bg-f1-dark">
      {session && (
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 pointer-events-none">
          <span className="text-white/80 text-xs font-mono font-bold tracking-wider">
            {session.circuit_short_name}
          </span>
          <span className="text-f1-muted text-[10px] font-mono">
            {session.country_name} · {session.year}
          </span>
        </div>
      )}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-1.5 pointer-events-none">
        {[
          { label: "S1", color: S1_COLOR },
          { label: "S2", color: S2_COLOR },
          { label: "S3", color: S3_COLOR },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="w-4 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] font-mono" style={{ color }}>
              {label}
            </span>
          </div>
        ))}
      </div>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        onClick={handleClick}
        style={{ display: "block" }}
      />
    </div>
  );
}
