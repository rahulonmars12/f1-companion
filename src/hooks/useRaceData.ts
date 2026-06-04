"use client";

import useSWR from "swr";
import { useMemo } from "react";
import {
  apiFetch,
  Session,
  Driver,
  Position,
  Interval,
  Location,
  CarData,
  TeamRadio,
  RaceControl,
  Stint,
  Lap,
} from "@/lib/openf1";
import { getTeamColor } from "@/lib/constants";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function recentIso(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

function shiftIso(iso: string, offsetSec: number): string {
  return new Date(new Date(iso).getTime() + offsetSec * 1000).toISOString();
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────
// Stable live keys use "live_window=N" instead of embedding a timestamp.
// The fetcher converts this to "date>=" at actual fetch time so the SWR
// cache key never changes between renders, eliminating the flash.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetcher = (path: string): Promise<any[]> => {
  const [endpoint, qs] = path.split("?");
  const params: Record<string, string> = {};
  if (qs) {
    for (const part of qs.split("&")) {
      const idx = part.indexOf("=");
      if (idx > 0) {
        const k = decodeURIComponent(part.slice(0, idx));
        const v = decodeURIComponent(part.slice(idx + 1));
        if (k === "live_window") {
          // Convert to a date filter at fetch time (not key-construction time)
          params["date>"] = recentIso(parseInt(v, 10));
        } else {
          params[k] = v;
        }
      }
    }
  }
  return apiFetch(endpoint, params);
};

const SWR_BASE = { revalidateOnFocus: false, keepPreviousData: true } as const;

// ─── Session hooks ─────────────────────────────────────────────────────────────

export function useSession() {
  const { data, error } = useSWR<Session[]>(
    "sessions?session_key=latest",
    fetcher,
    { ...SWR_BASE, refreshInterval: 30_000 }
  );
  return { session: data?.[0] ?? null, loading: !data && !error, error };
}

export function useSessionsList() {
  const year = new Date().getFullYear();
  const { data: y0 } = useSWR<Session[]>(`sessions?year=${year}`, fetcher, {
    ...SWR_BASE,
    refreshInterval: 0,
  });
  const { data: y1 } = useSWR<Session[]>(`sessions?year=${year - 1}`, fetcher, {
    ...SWR_BASE,
    refreshInterval: 0,
  });
  return useMemo(() => {
    const all = [...(y0 ?? []), ...(y1 ?? [])];
    return all.sort((a, b) => b.date_start.localeCompare(a.date_start));
  }, [y0, y1]);
}

// ─── Per-session data hooks ────────────────────────────────────────────────────

export function useDrivers(sessionKey: number | null) {
  const { data } = useSWR<Driver[]>(
    sessionKey ? `drivers?session_key=${sessionKey}` : null,
    fetcher,
    { ...SWR_BASE, refreshInterval: 60_000 }
  );
  return useMemo(() => {
    const map = new Map<number, Driver>();
    for (const d of data ?? []) {
      if (!map.has(d.driver_number)) {
        map.set(d.driver_number, {
          ...d,
          team_colour: d.team_colour ?? getTeamColor(d.team_name).replace("#", ""),
        });
      }
    }
    return map;
  }, [data]);
}

export function usePositions(sessionKey: number | null, currentTime?: string | null) {
  const live = !currentTime;
  // Live: use a very large window to capture ALL position changes for the session
  //       (position data is sparse — only on overtakes — so this stays small)
  // Historical: no lower bound, fetch everything up to currentTime so all
  //             20 drivers are visible even in stable, no-overtake phases
  const key = sessionKey
    ? live
      ? `position?session_key=${sessionKey}&live_window=86400`
      : `position?session_key=${sessionKey}&date<=${currentTime}`
    : null;
  const { data } = useSWR<Position[]>(key, fetcher, {
    ...SWR_BASE,
    refreshInterval: live ? 4_000 : 0,
  });
  return useMemo(() => {
    const latest = new Map<number, Position>();
    for (const p of data ?? []) {
      const ex = latest.get(p.driver_number);
      if (!ex || p.date > ex.date) latest.set(p.driver_number, p);
    }
    return latest;
  }, [data]);
}

export function useIntervals(sessionKey: number | null, currentTime?: string | null) {
  const live = !currentTime;
  const key = sessionKey
    ? live
      ? `intervals?session_key=${sessionKey}&live_window=60`
      : `intervals?session_key=${sessionKey}&date>=${shiftIso(currentTime!, -120)}&date<=${currentTime}`
    : null;
  const { data } = useSWR<Interval[]>(key, fetcher, {
    ...SWR_BASE,
    refreshInterval: live ? 4_000 : 0,
  });
  const latest = useMemo(() => {
    const map = new Map<number, Interval>();
    for (const i of data ?? []) {
      const ex = map.get(i.driver_number);
      if (!ex || i.date > ex.date) map.set(i.driver_number, i);
    }
    return map;
  }, [data]);
  return { latest, raw: data ?? [] };
}

export function useLocations(sessionKey: number | null, currentTime?: string | null) {
  const live = !currentTime;
  const key = sessionKey
    ? live
      ? `location?session_key=${sessionKey}&live_window=6`
      : `location?session_key=${sessionKey}&date>=${shiftIso(currentTime!, -15)}&date<=${currentTime}`
    : null;
  const { data } = useSWR<Location[]>(key, fetcher, {
    ...SWR_BASE,
    refreshInterval: live ? 2_000 : 0,
  });
  return useMemo(() => {
    const latest = new Map<number, Location>();
    for (const loc of data ?? []) {
      const ex = latest.get(loc.driver_number);
      if (!ex || loc.date > ex.date) latest.set(loc.driver_number, loc);
    }
    return latest;
  }, [data]);
}

// Single driver's sorted location data — produces a clean circuit trace
// unlike the old useTrackPath that mixed all 20 drivers and created a tangled path.
export function useReferenceTrack(
  sessionKey: number | null,
  driverNumber: number | null,
  currentTime?: string | null
) {
  const live = !currentTime;
  // Large window so we always capture a full circuit trace without rolling drift.
  // Historical mode has no lower bound so every lap is represented.
  const key =
    sessionKey && driverNumber
      ? live
        ? `location?session_key=${sessionKey}&driver_number=${driverNumber}&live_window=7200`
        : `location?session_key=${sessionKey}&driver_number=${driverNumber}&date<=${currentTime}`
      : null;
  const { data } = useSWR<Location[]>(key, fetcher, {
    ...SWR_BASE,
    refreshInterval: live ? 60_000 : 0,
  });
  return useMemo(() => {
    if (!data || data.length === 0) return [];
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    // Deduplicate: skip points within 2 m of the previous kept point
    const result: Location[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const prev = result[result.length - 1];
      const dx = sorted[i].x - prev.x;
      const dy = sorted[i].y - prev.y;
      if (dx * dx + dy * dy > 4) result.push(sorted[i]);
    }
    return result;
  }, [data]);
}

// Most representative completed lap for a driver — used for sector boundary fractions.
export function useDriverLap(sessionKey: number | null, driverNumber: number | null) {
  const { data } = useSWR<Lap[]>(
    sessionKey && driverNumber
      ? `laps?session_key=${sessionKey}&driver_number=${driverNumber}`
      : null,
    fetcher,
    { ...SWR_BASE, refreshInterval: 30_000 }
  );
  return useMemo(() => {
    if (!data) return null;
    const complete = data.filter(
      (l) =>
        l.lap_duration != null &&
        l.duration_sector_1 != null &&
        l.duration_sector_2 != null &&
        !l.is_pit_out_lap
    );
    if (complete.length === 0) return null;
    const sorted = [...complete].sort((a, b) => (a.lap_duration ?? 0) - (b.lap_duration ?? 0));
    // ~40th-percentile lap avoids SC laps (slow) and hot laps (atypical)
    return sorted[Math.floor(sorted.length * 0.4)] ?? sorted[0];
  }, [data]);
}

export function useCarData(sessionKey: number | null, currentTime?: string | null) {
  const live = !currentTime;
  const key = sessionKey
    ? live
      ? `car_data?session_key=${sessionKey}&live_window=6`
      : `car_data?session_key=${sessionKey}&date>=${shiftIso(currentTime!, -10)}&date<=${currentTime}`
    : null;
  const { data } = useSWR<CarData[]>(key, fetcher, {
    ...SWR_BASE,
    refreshInterval: live ? 2_000 : 0,
  });
  return useMemo(() => {
    const latest = new Map<number, CarData>();
    for (const c of data ?? []) {
      const ex = latest.get(c.driver_number);
      if (!ex || c.date > ex.date) latest.set(c.driver_number, c);
    }
    return latest;
  }, [data]);
}

export function useTeamRadio(
  sessionKey: number | null,
  driverNumber: number | null,
  currentTime?: string | null
) {
  const key =
    sessionKey && driverNumber
      ? currentTime
        ? `team_radio?session_key=${sessionKey}&driver_number=${driverNumber}&date<=${currentTime}`
        : `team_radio?session_key=${sessionKey}&driver_number=${driverNumber}`
      : null;
  const { data } = useSWR<TeamRadio[]>(key, fetcher, {
    ...SWR_BASE,
    refreshInterval: currentTime ? 0 : 10_000,
  });
  return useMemo(
    () => [...(data ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [data]
  );
}

export function useRaceControl(sessionKey: number | null, currentTime?: string | null) {
  const key = sessionKey
    ? currentTime
      ? `race_control?session_key=${sessionKey}&date<=${currentTime}`
      : `race_control?session_key=${sessionKey}`
    : null;
  const { data } = useSWR<RaceControl[]>(key, fetcher, {
    ...SWR_BASE,
    refreshInterval: currentTime ? 0 : 5_000,
  });
  return useMemo(
    () => [...(data ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [data]
  );
}

export function useStints(sessionKey: number | null, currentLap?: number) {
  const { data } = useSWR<Stint[]>(
    sessionKey ? `stints?session_key=${sessionKey}` : null,
    fetcher,
    { ...SWR_BASE, refreshInterval: currentLap !== undefined ? 0 : 10_000 }
  );
  return useMemo(() => {
    const result = new Map<number, Stint>();
    for (const s of data ?? []) {
      if (currentLap !== undefined) {
        if (s.lap_start <= currentLap && (s.lap_end == null || s.lap_end >= currentLap)) {
          result.set(s.driver_number, s);
        }
      } else {
        const ex = result.get(s.driver_number);
        if (!ex || s.stint_number > ex.stint_number) result.set(s.driver_number, s);
      }
    }
    return result;
  }, [data, currentLap]);
}

export function useLaps(sessionKey: number | null, driverNumber: number | null) {
  const { data } = useSWR<Lap[]>(
    sessionKey && driverNumber
      ? `laps?session_key=${sessionKey}&driver_number=${driverNumber}`
      : null,
    fetcher,
    { ...SWR_BASE, refreshInterval: 10_000 }
  );
  return useMemo(
    () => [...(data ?? [])].sort((a, b) => a.lap_number - b.lap_number),
    [data]
  );
}

// All position records for a session — shares SWR cache with usePositions (same key).
export function useAllPositions(sessionKey: number | null, currentTime?: string | null) {
  const live = !currentTime;
  const key = sessionKey
    ? live
      ? `position?session_key=${sessionKey}&live_window=86400`
      : `position?session_key=${sessionKey}&date<=${currentTime}`
    : null;
  const { data } = useSWR<Position[]>(key, fetcher, {
    ...SWR_BASE,
    refreshInterval: live ? 4_000 : 0,
  });
  return useMemo(() => data ?? [], [data]);
}

// All laps for every driver in the session — used for lap chart and fastest-lap detection.
export function useAllLaps(sessionKey: number | null) {
  const { data } = useSWR<Lap[]>(
    sessionKey ? `laps?session_key=${sessionKey}` : null,
    fetcher,
    { ...SWR_BASE, refreshInterval: 15_000 }
  );
  return useMemo(() => data ?? [], [data]);
}

export function useGapHistory(rawIntervals: Interval[]): Map<string, number[]> {
  return useMemo(() => {
    const history = new Map<string, number[]>();
    const sorted = [...rawIntervals].sort((a, b) => a.date.localeCompare(b.date));
    for (const i of sorted) {
      if (i.interval) {
        const raw = i.interval;
        const val = typeof raw === "number" ? raw : parseFloat((raw as string).replace("+", ""));
        if (!isNaN(val)) {
          const key = String(i.driver_number);
          const arr = history.get(key) ?? [];
          arr.push(val);
          if (arr.length > 30) arr.shift();
          history.set(key, arr);
        }
      }
    }
    return history;
  }, [rawIntervals]);
}
