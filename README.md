**4/6/2026 Changes**

  Track fixes
  - S/F line and S2/S3 sector markers are now fixed — the circuit path locks once 150+ GPS points arrive and won't drift with the leader's position again
  - Green ring around a car dot when DRS / overtake mode is active
  - Pit lane appears as a grey dashed line labelled "PIT" as soon as any car leaves the racing line (builds up passively during the session)

  Order tab
  - Small progress bar under each tyre badge — fills toward yellow (in pit window) then red (overdue)
  - Purple ⬟ diamond next to whoever holds the fastest lap, matching F1 timing convention
  - Tap GAP → PTS toggle in the header to switch the right column to F1 championship points for each position
  - Orange alert banner appears at the top for 20 seconds whenever a driver pits, with an undercut threat message if they were within 30s of the car ahead

  Intel tab (mobile only for now)
  - 4th tab in the bottom nav
  - Fastest lap card at the top
  - Full lap chart: every driver



Here's a summary of everything just shipped:
  
  Smooth car movement — TrackVisual.tsx now uses a persistent requestAnimationFrame loop with LERP=0.1. Cars smoothly interpolate toward new GPS positions every frame rather than jumping. Target
  positions live in targetRawRef; the display positions in displayRawRef lerp toward them each frame. The track is rendered once to an offscreen canvas and composited each frame — no redundant track
  redraws.

  All 20 positions visible — usePositions already fixed in the previous session (uses live_window=86400 live, no lower bound historical).

  Battle driver photos — BattlePanel now has a full-width hero section at the top with both drivers' headshots side by side (with team-color borders), their acronym, position, and ATTACK/DEFEND labels.

  Favorite drivers (HAM/SAI) — StandingsPanel shows a sticky "★ Your Picks" section at the top whenever HAM or SAI are in the field. They also get a gold star ★ and a left-border accent throughout the
  full standings list.

  Mobile layout — Three-tab bottom navigation (Order / Track / Detail) appears on mobile only. Each tab shows the corresponding panel full-width. Desktop layout is unchanged (all three panels
  side-by-side).

  UI quality — Richer Tailwind tokens (f1.card, f1.border tightened to #222, f1.muted darkened), font antialiasing, thinner scrollbars, fade/slide animations registered.

  What I added defensively:
  - app/error.tsx: if anything does blow up during a render, you now get a proper "Try again / Reload page" screen instead of a crash
  - TrackVisual canvas effect is wrapped in try-catch so drawing errors never reach React


  Track map — replaced the old "all 20 drivers tangled together" path with a single-driver trace sorted by time. The P1 driver's locations for the last 5 minutes are deduplicated and drawn as a smooth
  bezier curve. Once the laps API returns sector times, the track automatically splits into red (S1) / yellow (S2) / purple (S3) segments with boundary markers and a S/F line. A small sector legend sits
  in the top-right corner.
  
  Standings invisible — the root cause was that live_window=60 ("last 60 seconds of wall-clock time") returns nothing when the most recent session ended days ago. The new effectiveQueryTime detects a
  completed session and falls back to date_end as the query reference, so all data hooks fetch from near the end of the race instead of right now.
  
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

