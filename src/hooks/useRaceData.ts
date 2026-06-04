"use client";

import useSWR from "swr";
import { useMemo, useRef } from "react";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetcher = (path: string): Promise<any[]> => {
  const [endpoint, qs] = path.split("?");
  const params: Record<string, string> = {};
  if (qs) {
    for (const part of qs.split("&")) {
      const [k, v] = part.split("=");
      params[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  }
  return apiFetch(endpoint, params);
};

export interface DriverStanding {
  driver: Driver;
  position: number;
  interval: string | null;
  gapToLeader: string | null;
  latestCarData: CarData | null;
  latestLocation: Location | null;
  currentStint: Stint | null;
  isBattling: boolean;
  battleWith: number | null;
}

export function useSession() {
  const { data, error } = useSWR<Session[]>(
    "sessions?session_key=latest",
    fetcher,
    { refreshInterval: 30_000 }
  );
  return {
    session: data?.[0] ?? null,
    loading: !data && !error,
    error,
  };
}

export function useDrivers(sessionKey: number | null) {
  const { data } = useSWR<Driver[]>(
    sessionKey ? `drivers?session_key=${sessionKey}` : null,
    fetcher,
    { refreshInterval: 60_000 }
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

export function usePositions(sessionKey: number | null) {
  const { data } = useSWR<Position[]>(
    sessionKey ? `position?session_key=${sessionKey}&date>${getRecentDate(10)}` : null,
    fetcher,
    { refreshInterval: 4_000 }
  );
  return useMemo(() => {
    const latest = new Map<number, Position>();
    for (const p of data ?? []) {
      const existing = latest.get(p.driver_number);
      if (!existing || p.date > existing.date) latest.set(p.driver_number, p);
    }
    return latest;
  }, [data]);
}

export function useIntervals(sessionKey: number | null) {
  const { data } = useSWR<Interval[]>(
    sessionKey ? `intervals?session_key=${sessionKey}&date>${getRecentDate(10)}` : null,
    fetcher,
    { refreshInterval: 4_000 }
  );
  return useMemo(() => {
    const latest = new Map<number, Interval>();
    for (const i of data ?? []) {
      const existing = latest.get(i.driver_number);
      if (!existing || i.date > existing.date) latest.set(i.driver_number, i);
    }
    return latest;
  }, [data]);
}

export function useLocations(sessionKey: number | null) {
  const { data } = useSWR<Location[]>(
    sessionKey ? `location?session_key=${sessionKey}&date>${getRecentDate(5)}` : null,
    fetcher,
    { refreshInterval: 2_000 }
  );
  return useMemo(() => {
    const latest = new Map<number, Location>();
    for (const loc of data ?? []) {
      const existing = latest.get(loc.driver_number);
      if (!existing || loc.date > existing.date) latest.set(loc.driver_number, loc);
    }
    return latest;
  }, [data]);
}

export function useTrackPath(sessionKey: number | null) {
  // Fetch 5 minutes of location data from all drivers to build the circuit outline.
  // No driver filter — union of all cars traces the full track.
  const { data } = useSWR<Location[]>(
    sessionKey ? `location?session_key=${sessionKey}&date>${getRecentDate(300)}` : null,
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: false }
  );
  return data ?? [];
}

export function useCarData(sessionKey: number | null) {
  const { data } = useSWR<CarData[]>(
    sessionKey ? `car_data?session_key=${sessionKey}&date>${getRecentDate(5)}` : null,
    fetcher,
    { refreshInterval: 2_000 }
  );
  return useMemo(() => {
    const latest = new Map<number, CarData>();
    for (const c of data ?? []) {
      const existing = latest.get(c.driver_number);
      if (!existing || c.date > existing.date) latest.set(c.driver_number, c);
    }
    return latest;
  }, [data]);
}

export function useTeamRadio(sessionKey: number | null, driverNumber: number | null) {
  const { data } = useSWR<TeamRadio[]>(
    sessionKey && driverNumber
      ? `team_radio?session_key=${sessionKey}&driver_number=${driverNumber}`
      : null,
    fetcher,
    { refreshInterval: 10_000 }
  );
  return useMemo(() => [...(data ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [data]);
}

export function useRaceControl(sessionKey: number | null) {
  const { data } = useSWR<RaceControl[]>(
    sessionKey ? `race_control?session_key=${sessionKey}` : null,
    fetcher,
    { refreshInterval: 5_000 }
  );
  return useMemo(() => [...(data ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [data]);
}

export function useStints(sessionKey: number | null) {
  const { data } = useSWR<Stint[]>(
    sessionKey ? `stints?session_key=${sessionKey}` : null,
    fetcher,
    { refreshInterval: 10_000 }
  );
  return useMemo(() => {
    const latest = new Map<number, Stint>();
    for (const s of data ?? []) {
      const existing = latest.get(s.driver_number);
      if (!existing || s.stint_number > existing.stint_number) latest.set(s.driver_number, s);
    }
    return latest;
  }, [data]);
}

export function useLaps(sessionKey: number | null, driverNumber: number | null) {
  const { data } = useSWR<Lap[]>(
    sessionKey && driverNumber
      ? `laps?session_key=${sessionKey}&driver_number=${driverNumber}`
      : null,
    fetcher,
    { refreshInterval: 10_000 }
  );
  return useMemo(
    () => [...(data ?? [])].sort((a, b) => a.lap_number - b.lap_number),
    [data]
  );
}

export function useGapHistory(intervals: Map<number, Interval>): Map<string, number[]> {
  const historyRef = useRef<Map<string, number[]>>(new Map());

  for (const [driverNum, interval] of intervals.entries()) {
    if (interval.interval) {
      const val = parseFloat(interval.interval.replace("+", ""));
      if (!isNaN(val)) {
        const key = String(driverNum);
        const arr = historyRef.current.get(key) ?? [];
        arr.push(val);
        if (arr.length > 20) arr.shift();
        historyRef.current.set(key, arr);
      }
    }
  }

  return historyRef.current;
}

function getRecentDate(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}
