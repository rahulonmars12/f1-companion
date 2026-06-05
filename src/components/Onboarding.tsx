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
  body: string | React.ReactNode;
  cta: string;
  beacon?: { x: string; y: string };
  cardOffset?: string;
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
    body: "Live battle cards and a comparison tool — sector deltas, lap chart, telemetry. Tap either driver chip to swap them.",
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
    cta: "Next",
    beacon: { x: "90%", y: "calc(100dvh - 84px)" },
    cardOffset: "136px",
    action: "tab:news",
  },
  {
    id: "install",
    icon: "+",
    title: "Add to Home Screen",
    body: <InstallInstructions />,
    cta: "Let's go",
    cardOffset: "16px",
  },
];

function InstallInstructions() {
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("other");

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) setPlatform("ios");
    else if (/Android/.test(ua)) setPlatform("android");
  }, []);

  return (
    <div className="flex flex-col gap-2.5">
      <p style={{ color: "#555", fontSize: 11, fontFamily: "monospace", lineHeight: 1.6 }}>
        Add this app to your home screen for a full-screen experience without the browser UI.
      </p>
      {(platform === "ios" || platform === "other") && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ backgroundColor: "#fff5f5", border: "1px solid #fecaca" }}>
          <span style={{ color: "#e8002d", fontSize: 11, fontFamily: "monospace", fontWeight: 700, lineHeight: 1.6, flexShrink: 0 }}>
            iOS
          </span>
          <span style={{ color: "#555", fontSize: 11, fontFamily: "monospace", lineHeight: 1.6 }}>
            Safari → tap the Share icon → <strong style={{ color: "#111" }}>Add to Home Screen</strong>
          </span>
        </div>
      )}
      {(platform === "android" || platform === "other") && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ backgroundColor: "#fff5f5", border: "1px solid #fecaca" }}>
          <span style={{ color: "#e8002d", fontSize: 11, fontFamily: "monospace", fontWeight: 700, lineHeight: 1.6, flexShrink: 0 }}>
            Android
          </span>
          <span style={{ color: "#555", fontSize: 11, fontFamily: "monospace", lineHeight: 1.6 }}>
            Chrome → tap the menu (⋮) → <strong style={{ color: "#111" }}>Add to Home Screen</strong>
          </span>
        </div>
      )}
    </div>
  );
}

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
    // pointer-events-none on the wrapper — only the card itself captures input
    <div className="fixed inset-0 z-[100] pointer-events-none">

      {/* Beacon — no overlay, floats above the live UI */}
      {step.beacon && (
        <div
          className="absolute"
          style={{
            left: step.beacon.x,
            top: step.beacon.y,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
        >
          <div
            className="absolute rounded-full animate-ping"
            style={{ width: 40, height: 40, top: -20, left: -20, backgroundColor: "rgba(232,0,45,0.3)" }}
          />
          <div
            className="absolute rounded-full"
            style={{ width: 22, height: 22, top: -11, left: -11, backgroundColor: "rgba(232,0,45,0.15)" }}
          />
          <div
            className="w-3 h-3 rounded-full"
            style={{
              marginLeft: -6, marginTop: -6,
              backgroundColor: "#e8002d",
              border: "2px solid white",
              boxShadow: "0 0 0 2px rgba(232,0,45,0.4), 0 2px 8px rgba(0,0,0,0.3)",
            }}
          />
        </div>
      )}

      {/* Card — white, high contrast against the dark app */}
      <div
        className="absolute inset-x-3 pointer-events-auto"
        style={{
          bottom: step.cardOffset ?? (isWelcome ? "auto" : "16px"),
          top: isWelcome ? "50%" : "auto",
          transform: isWelcome ? "translateY(-50%)" : "none",
        }}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "white",
            boxShadow: "0 8px 32px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15)",
            border: "1px solid rgba(0,0,0,0.08)",
          }}
        >
          {/* Body */}
          <div className="px-5 pt-5 pb-4 flex items-start gap-3.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-mono font-bold"
              style={{
                backgroundColor: "#fff0f0",
                color: "#e8002d",
                border: "1.5px solid #fecaca",
              }}
            >
              {step.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="font-mono font-black text-base leading-tight tracking-wide"
                style={{ color: "#111" }}
              >
                {step.title}
              </div>
              <div className="mt-2">
                {typeof step.body === "string" ? (
                  <p
                    className="font-mono leading-relaxed"
                    style={{ color: "#555", fontSize: 11 }}
                  >
                    {step.body}
                  </p>
                ) : (
                  step.body
                )}
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
                      i === stepIdx ? "#e8002d" : i < stepIdx ? "#fca5a5" : "#e5e7eb",
                  }}
                />
              ))}
            </div>
            {/* Actions */}
            <div className="flex items-center gap-4">
              {!isLast && !isWelcome && (
                <button
                  onClick={skip}
                  className="font-mono transition-colors"
                  style={{ color: "#aaa", fontSize: 11 }}
                >
                  Skip
                </button>
              )}
              <button
                onClick={advance}
                className="px-5 py-2 rounded-lg font-mono font-bold tracking-wider transition-all active:scale-95"
                style={{ backgroundColor: "#e8002d", color: "white", fontSize: 11 }}
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
