4/6/2026 Changes
  
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
