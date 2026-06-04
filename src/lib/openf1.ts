export interface Session {
  session_key: number;
  session_name: string;
  session_type: string;
  circuit_short_name: string;
  circuit_key: number;
  country_name: string;
  country_code: string;
  location: string;
  date_start: string;
  date_end: string;
  year: number;
  gmt_offset: string;
}

export interface Driver {
  driver_number: number;
  broadcast_name: string;
  full_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string;
  headshot_url: string | null;
  country_code: string;
  session_key: number;
}

export interface Position {
  date: string;
  driver_number: number;
  position: number;
  session_key: number;
}

export interface Interval {
  date: string;
  driver_number: number;
  gap_to_leader: string | number | null;
  interval: string | number | null;
  session_key: number;
}

export interface Location {
  date: string;
  driver_number: number;
  x: number;
  y: number;
  z: number;
  session_key: number;
}

export interface CarData {
  date: string;
  driver_number: number;
  speed: number;
  throttle: number;
  brake: number;
  drs: number;
  n_gear: number;
  rpm: number;
  session_key: number;
}

export interface TeamRadio {
  date: string;
  driver_number: number;
  recording_url: string;
  session_key: number;
}

export interface RaceControl {
  date: string;
  message: string;
  flag: string | null;
  category: string;
  scope: string | null;
  sector: number | null;
  driver_number: number | null;
  lap_number: number | null;
  session_key: number;
}

export interface Stint {
  driver_number: number;
  stint_number: number;
  lap_start: number;
  lap_end: number | null;
  compound: string;
  tyre_age_at_start: number;
  session_key: number;
}

export interface Lap {
  date_start: string;
  driver_number: number;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  lap_duration: number | null;
  lap_number: number;
  i1_speed: number | null;
  i2_speed: number | null;
  st_speed: number | null;
  is_pit_out_lap: boolean;
  session_key: number;
}

export const BASE = "/api/openf1";

export async function apiFetch<T>(path: string, params: Record<string, string | number> = {}): Promise<T[]> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const url = `${BASE}/${path}${qs.toString() ? "?" + qs.toString() : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenF1 ${path} ${res.status}`);
  return res.json();
}

export function parseGapSeconds(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  if (!val || val === "+INF" || val === "INF") return null;
  const cleaned = val.replace("+", "").replace("LAP", "").trim();
  if (cleaned.includes("LAP")) return 999;
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export function formatGap(val: string | null | undefined): string {
  if (!val) return "—";
  if (val.includes("LAP")) return val;
  const n = parseGapSeconds(val);
  if (n === null) return "—";
  return `+${n.toFixed(3)}`;
}
