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

// Fetcher: uses indexOf("=") so operators like date>= and date<= parse correctly.
// Key format: "endpoint?key=val&date>={iso}&date<={iso}"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetcher = (path: string): Promise<any[]> => {
  const [endpoint, qs] = path.split("?");
  const params: Record<string, string> = {};
  if (qs) {
    for (const part of qs.split("&")) {
      const idx = part.indexOf("=");
      if (idx > 0) {
        params[decodeURIComponent(part.slice(0, idx))] =
          decodeURIComponent(part.slice(idx + 1));
      }
    }
  }
  return apiFetch(endpoint, params);
};

function recentIso(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

function shiftIso(iso: string, offsetSec: number): string {
  return new Date(new Date(iso).getTime() + offsetSec * 1000).toISOString();
}

// ─── Session hooks ─────────────────────────────────────────────────────────────

export function useSession() {
  const { data, error } = useSWR<Session[]>("sessions?session_key=latest", fetcher, {
    refreshInterval: 30_000,
  });
  return { session: data?.[0] ?? null, loading: !data && !error, error };
}

export function useSessionsList() {
  const year = new Date().getFullYear();
  const { data: y0 } = useSWR<Session[]>(`sessions?year=${year}`, fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
  });
  const { data: y1 } = useSWR<Session[]>(`sessions?year=${year - 1}`, fetcher, {
    refreshInterval: 0,
    revalidateOnFocus: false,
  });
  return useMemo(() => {
    const all = [...(y0 ?? []), ...(y1 ?? [])];
    return all.sort((a, b) => b.date_start.localeCompare(a.date_start));
  }, [y0, y1]);
}

// ─── Per-session data hooks ────────────────────────────────────────────────────
// All accept optional currentTime. When provided → historical window, no polling.

export function useDrivers(sessionKey: number | null) {
  const { data } = useSWR<Driver[]>(
    sessionKey ? `drivers?session_key=${sessionKey}` : null,
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: false }
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
  const key = sessionKey
    ? live
      ? `position?session_key=${sessionKey}&date>=${recentIso(30)}`
      : `position?session_key=${sessionKey}&date>=${shiftIso(currentTime!, -120)}&date<=${currentTime}`
    : null;
  const { data } = useSWR<Position[]>(key, fetcher, {
    refreshInterval: live ? 4_000 : 0,
    revalidateOnFocus: false,
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
      ? `intervals?session_key=${sessionKey}&date>=${recentIso(30)}`
      : `intervals?session_key=${sessionKey}&date>=${shiftIso(currentTime!, -120)}&date<=${currentTime}`
    : null;
  const { data } = useSWR<Interval[]>(key, fetcher, {
    refreshInterval: live ? 4_000 : 0,
    revalidateOnFocus: false,
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
      ? `location?session_key=${sessionKey}&date>=${recentIso(5)}`
      : `location?session_key=${sessionKey}&date>=${shiftIso(currentTime!, -15)}&date<=${currentTime}`
    : null;
  const { data } = useSWR<Location[]>(key, fetcher, {
    refreshInterval: live ? 2_000 : 0,
    revalidateOnFocus: false,
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

export function useTrackPath(sessionKey: number | null, currentTime?: string | null) {
  const live = !currentTime;
  const key = sessionKey
    ? live
      ? `location?session_key=${sessionKey}&date>=${recentIso(300)}`
      : `location?session_key=${sessionKey}&date>=${shiftIso(currentTime!, -300)}&date<=${currentTime}`
    : null;
  const { data } = useSWR<Location[]>(key, fetcher, {
    refreshInterval: live ? 30_000 : 0,
    revalidateOnFocus: false,
  });
  return data ?? [];
}

export function useCarData(sessionKey: number | null, currentTime?: string | null) {
  const live = !currentTime;
  const key = sessionKey
    ? live
      ? `car_data?session_key=${sessionKey}&date>=${recentIso(5)}`
      : `car_data?session_key=${sessionKey}&date>=${shiftIso(currentTime!, -10)}&date<=${currentTime}`
    : null;
  const { data } = useSWR<CarData[]>(key, fetcher, {
    refreshInterval: live ? 2_000 : 0,
    revalidateOnFocus: false,
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
    refreshInterval: currentTime ? 0 : 10_000,
    revalidateOnFocus: false,
  });
  return useMemo(() => [...(data ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [data]);
}

export function useRaceControl(sessionKey: number | null, currentTime?: string | null) {
  const key = sessionKey
    ? currentTime
      ? `race_control?session_key=${sessionKey}&date<=${currentTime}`
      : `race_control?session_key=${sessionKey}`
    : null;
  const { data } = useSWR<RaceControl[]>(key, fetcher, {
    refreshInterval: currentTime ? 0 : 5_000,
    revalidateOnFocus: false,
  });
  return useMemo(() => [...(data ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [data]);
}

export function useStints(sessionKey: number | null, currentLap?: number) {
  const { data } = useSWR<Stint[]>(
    sessionKey ? `stints?session_key=${sessionKey}` : null,
    fetcher,
    { refreshInterval: currentLap !== undefined ? 0 : 10_000, revalidateOnFocus: false }
  );
  return useMemo(() => {
    const result = new Map<number, Stint>();
    for (const s of data ?? []) {
      if (currentLap !== undefined) {
        // Historical: find the stint active at this lap
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
    { refreshInterval: 10_000, revalidateOnFocus: false }
  );
  return useMemo(() => [...(data ?? [])].sort((a, b) => a.lap_number - b.lap_number), [data]);
}

// Gap history computed from the raw interval window (works for both live & historical)
export function useGapHistory(rawIntervals: Interval[]): Map<string, number[]> {
  return useMemo(() => {
    const history = new Map<string, number[]>();
    const sorted = [...rawIntervals].sort((a, b) => a.date.localeCompare(b.date));
    for (const i of sorted) {
      if (i.interval) {
        const val = parseFloat(i.interval.replace("+", ""));
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
