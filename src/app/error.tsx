"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[F1 Companion] Caught error:", error);
  }, [error]);

  return (
    <div className="h-screen flex items-center justify-center bg-f1-dark">
      <div className="text-center max-w-sm px-6">
        <div className="text-f1-red font-mono font-black text-4xl tracking-widest mb-4">F1</div>
        <div className="text-white font-mono text-lg mb-2">Something went wrong</div>
        <div className="text-white/40 font-mono text-xs mb-6 leading-relaxed">
          {error.message || "An unexpected error occurred."}
          {error.digest && (
            <span className="block mt-1 text-white/20">Digest: {error.digest}</span>
          )}
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="bg-f1-red text-white font-mono font-bold text-sm px-5 py-2.5 rounded hover:bg-red-700 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="bg-white/10 text-white font-mono text-sm px-5 py-2.5 rounded hover:bg-white/20 transition-colors"
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  );
}
