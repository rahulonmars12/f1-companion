"use client";

import { useEffect, useRef, useState } from "react";
import { Driver, Location, Session } from "@/lib/openf1";

interface TrackVisualProps {
  session: Session | null;
  drivers: Map<number, Driver>;
  trackPath: Location[];
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

function buildTransform(points: Array<{ x: number; y: number }>, w: number, h: number, pad = 48): Transform {
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
  return [
    t.offsetX + (x - t.minX) * t.scale,
    t.offsetY + (y - t.minY) * t.scale,
  ];
}

export default function TrackVisual({
  session,
  drivers,
  trackPath,
  liveLocations,
  selectedDriver,
  battles,
  onSelectDriver,
}: TrackVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 500 });
  const transformRef = useRef<Transform | null>(null);

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

  // Build and cache transform when trackPath changes
  useEffect(() => {
    if (trackPath.length > 10) {
      transformRef.current = buildTransform(trackPath, size.w, size.h);
    }
  }, [trackPath, size]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = size.w;
    canvas.height = size.h;

    ctx.clearRect(0, 0, size.w, size.h);

    const allPoints =
      trackPath.length > 0
        ? trackPath
        : [...liveLocations.values()];

    if (allPoints.length === 0) {
      ctx.fillStyle = "#333";
      ctx.font = "13px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Waiting for telemetry data…", size.w / 2, size.h / 2);
      return;
    }

    const t = transformRef.current ?? buildTransform(allPoints, size.w, size.h);

    // --- Draw track outline ---
    if (trackPath.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = "#2a2a2a";
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      const [sx, sy] = project(trackPath[0].x, trackPath[0].y, t);
      ctx.moveTo(sx, sy);
      for (let i = 1; i < trackPath.length; i++) {
        const [px, py] = project(trackPath[i].x, trackPath[i].y, t);
        ctx.lineTo(px, py);
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "#3a3a3a";
      ctx.lineWidth = 10;
      const [sx2, sy2] = project(trackPath[0].x, trackPath[0].y, t);
      ctx.moveTo(sx2, sy2);
      for (let i = 1; i < trackPath.length; i++) {
        const [px, py] = project(trackPath[i].x, trackPath[i].y, t);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    const battleSet = new Set(battles.flatMap((b) => [b.attacker, b.defender]));

    // --- Draw cars ---
    const locationsByPosition = [...liveLocations.entries()].sort(([a], [b]) => {
      const da = drivers.get(a);
      const db = drivers.get(b);
      return (da ? 0 : 1) - (db ? 0 : 1);
    });

    for (const [driverNum, loc] of locationsByPosition) {
      const driver = drivers.get(driverNum);
      if (!driver) continue;

      const [cx, cy] = project(loc.x, loc.y, t);
      const teamColor = driver.team_colour ? `#${driver.team_colour}` : "#888";
      const isSelected = selectedDriver === driverNum;
      const isBattling = battleSet.has(driverNum);
      const radius = isSelected ? 10 : 7;

      // Glow for selected / battling
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius + 6);
        grad.addColorStop(0, teamColor + "44");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fill();
      } else if (isBattling) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 5, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius + 5);
        grad.addColorStop(0, "#fbbf2433");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Car dot
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

      // Driver abbreviation
      ctx.font = `bold ${isSelected ? 10 : 8}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isSelected ? teamColor : "#0f0f0f";
      ctx.fillText(driver.name_acronym, cx, cy);

      // Battle indicator above dot
      if (isBattling && !isSelected) {
        ctx.font = "7px monospace";
        ctx.fillStyle = "#fbbf24";
        ctx.fillText("⚔", cx, cy - radius - 6);
      }
    }

    // --- Draw start/finish if we have track ---
    if (trackPath.length > 0) {
      const [sfx, sfy] = project(trackPath[0].x, trackPath[0].y, t);
      ctx.beginPath();
      ctx.arc(sfx, sfy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.font = "9px monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = "#888";
      ctx.fillText("S/F", sfx + 7, sfy + 3);
    }
  }, [trackPath, liveLocations, drivers, selectedDriver, battles, size]);

  // Click hit-test
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const t = transformRef.current;
    if (!t) return;

    for (const [driverNum, loc] of liveLocations.entries()) {
      const [px, py] = project(loc.x, loc.y, t);
      const dist = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2);
      if (dist < 16) {
        onSelectDriver(driverNum);
        return;
      }
    }
  };

  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden relative">
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
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        onClick={handleClick}
        style={{ display: "block" }}
      />
    </div>
  );
}
