"use client";

import { useEffect, useRef, useState } from "react";

interface OnboardingProps {
  onComplete: () => void;
  onAction: (action: string) => void;
}

interface Step {
  id: string;
  icon: string;
  title: string;
  body: string;
  cta: string;
  beacon?: { x: string; y: string };
  cardOffset?: string; // bottom offset for the card
  action?: string;
}

const STEPS: Step[] = [
  {
    id: "welcome",
    icon: "⚑",
    title: "F1 Companion",
    body: "A live race dashboard for the committed fan. Takes about 30 seconds to explore.",
    cta: "Start Tour",
  },
  {
    id: "race",
    icon: "◎",
    title: "Canadian GP · Montréal",
    body: "The 2025 Canadian Grand Prix has been loaded. Tap the circuit name in the top bar any time to switch sessions.",
    cta: "Got it",
    beacon: { x: "50%", y: "26px" },
    cardOffset: "16px",
    action: "select-montreal",
  },
  {
    id: "scrubber",
    icon: "▶",
    title: "Race Timeline",
    body: "Drag the red slider to jump to any moment in the race. Hit play to watch it unfold — up to 30× speed.",
    cta: "Next",
    beacon: { x: "50%", y: "calc(100dvh - 44px)" },
    cardOffset: "136px",
    action: "seek-midrace",
  },
  {
    id: "order",
    icon: "≡",
    title: "Race Order",
    body: "20 drivers ranked live — gap, tyre compound and age, and a yellow dot for close battles. Tap any row for full stats and team radio.",
    cta: "Next",
    beacon: { x: "10%", y: "calc(100dvh - 84px)" },
    cardOffset: "136px",
    action: "tab:order",
  },
  {
    id: "h2h",
    icon: "⚔",
    title: "Head-to-Head",
    body: "Live battle cards and a full comparison tool — sector deltas, lap chart, telemetry. Tap either driver chip to swap them.",
    cta: "Next",
    beacon: { x: "70%", y: "calc(100dvh - 84px)" },
    cardOffset: "136px",
    action: "tab:h2h",
  },
  {
    id: "news",
    icon: "★",
    title: "Championship & Calendar",
    body: "Full-season driver and constructor standings, plus the race calendar and a countdown to the next event.",
    cta: "Let's go",
    beacon: { x: "90%", y: "calc(100dvh - 84px)" },
    cardOffset: "136px",
    action: "tab:news",
  },
];

export default function Onboarding({ onComplete, onAction }: OnboardingProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const prevIdx = useRef(-1);
  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;
  const isWelcome = stepIdx === 0;

  useEffect(() => {
    if (prevIdx.current === stepIdx) return;
    prevIdx.current = stepIdx;
    if (step.action) onAction(step.action);
  }, [stepIdx, step, onAction]);

  const advance = () => {
    if (isLast) { onComplete(); return; }
    setStepIdx(i => i + 1);
  };

  const skip = () => onComplete();

  return (
    <div className="fixed inset-0 z-[100] pointer-events-auto">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80" onClick={isWelcome ? undefined : advance} />

      {/* Beacon */}
      {step.beacon && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: step.beacon.x,
            top: step.beacon.y,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className="absolute rounded-full animate-ping"
            style={{
              width: 36, height: 36,
              top: -18, left: -18,
              backgroundColor: "rgba(232,0,45,0.35)",
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: 20, height: 20,
              top: -10, left: -10,
              backgroundColor: "rgba(232,0,45,0.25)",
            }}
          />
          <div
            className="w-3 h-3 rounded-full"
            style={{
              marginLeft: -6, marginTop: -6,
              backgroundColor: "#e8002d",
              border: "2px solid rgba(255,255,255,0.8)",
              boxShadow: "0 0 8px rgba(232,0,45,0.6)",
            }}
          />
        </div>
      )}

      {/* Card */}
      <div
        className="absolute inset-x-3 pointer-events-auto"
        style={{ bottom: step.cardOffset ?? (isWelcome ? "auto" : "16px"), top: isWelcome ? "50%" : "auto" }}
      >
        <div
          className="rounded-2xl border border-white/10 overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #161616 0%, #111 100%)",
            transform: isWelcome ? "translateY(-50%)" : "none",
          }}
        >
          {/* Body */}
          <div className="px-5 pt-5 pb-4 flex items-start gap-3.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-mono font-bold"
              style={{
                backgroundColor: "#e8002d18",
                color: "#e8002d",
                border: "1px solid #e8002d35",
              }}
            >
              {step.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-mono font-black text-base leading-tight tracking-wide">
                {step.title}
              </div>
              <div className="text-white/55 text-[11px] font-mono mt-2 leading-relaxed">
                {step.body}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 flex items-center justify-between">
            {/* Progress pills */}
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === stepIdx ? 18 : 6,
                    height: 6,
                    backgroundColor:
                      i === stepIdx ? "#e8002d" : i < stepIdx ? "#e8002d60" : "#2a2a2a",
                  }}
                />
              ))}
            </div>
            {/* Actions */}
            <div className="flex items-center gap-4">
              {!isLast && !isWelcome && (
                <button
                  onClick={skip}
                  className="text-white/30 text-[11px] font-mono hover:text-white/60 transition-colors"
                >
                  Skip
                </button>
              )}
              <button
                onClick={advance}
                className="px-5 py-2 rounded-lg text-[11px] font-mono font-bold tracking-wider transition-all active:scale-95"
                style={{ backgroundColor: "#e8002d", color: "white" }}
              >
                {step.cta}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
