**4/6/2026 Changes**

  Fix 1 — Flashing (root cause)
  recentIso(30) was called during render, embedding a live timestamp in the SWR cache key. On every re-render (including ones triggered by fresh data arriving), the key changed, SWR saw a new query,
  cleared its data, and refetched → blank flash.
  
  Now live-mode keys are stable: position?session_key=9839&live_window=60. The fetcher converts live_window=60 → date>=${recentIso(60)} at fetch time, not render time. The key never changes between
  renders. Also added keepPreviousData: true on every hook so historical scrubbing transitions smoothly.

  Fix 2 — Race order empty (wrong start time)
  currentTime was initialized to session.date_start — the scheduled session start — but OpenF1 has no position data before the session actually gets going (formation lap, grid procedures, etc.). Now
  starts 15 minutes in where data is guaranteed to exist.

  Fix 3 — Race order empty (driver metadata race)
  StandingsPanel did if (!driver) return null — if driver metadata hadn't loaded yet when the first positions arrived, every row disappeared silently. Now falls back to showing #44 instead of the name,
  and "Loading…" for the team, so position rows are always visible.

  
  Session Selector — click "Sessions ▾" in the header to open a modal. Defaults to Race sessions only, with search and "All" toggle to show qualifying/practice. Grouped by year and Grand Prix.

  Time Scrubber — always-visible bottom bar:
  - Scrubber with lap markers derived from race control messages
  - Play/Pause + speed selector: 1×, 2×, 5×, 10×, 30×
  - Elapsed time (HH:MM:SS) + current lap counter 
  - "● LIVE" / "GO LIVE" button toggles between modes
  
  Historical mode — when a past session is selected:
  - All data hooks switch from polling to fetching a time window (date>= / date<=) around the scrubber position
  - Stints filter by lap number so tire compounds are correct at each point in the race
  - Gap history and battle detection work from the windowed data 
  
  "LIVE" → "REPLAY" badge in the header when viewing historical data.

  To test: pick the last race from the session browser, then hit play and watch it scrub through.

