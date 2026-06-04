export const TEAM_COLORS: Record<string, string> = {
  "Red Bull Racing": "#3671C6",
  "Ferrari": "#E8002D",
  "Mercedes": "#27F4D2",
  "McLaren": "#FF8000",
  "Aston Martin": "#229971",
  "Alpine": "#FF87BC",
  "Haas F1 Team": "#B6BABD",
  "RB": "#6692FF",
  "Williams": "#64C4FF",
  "Kick Sauber": "#52E252",
  "Sauber": "#52E252",
};

export const COMPOUND_COLORS: Record<string, string> = {
  SOFT: "#e8002d",
  MEDIUM: "#ffd700",
  HARD: "#ffffff",
  INTERMEDIATE: "#39b54a",
  WET: "#0067ff",
  UNKNOWN: "#666666",
};

export const COMPOUND_LABELS: Record<string, string> = {
  SOFT: "S",
  MEDIUM: "M",
  HARD: "H",
  INTERMEDIATE: "I",
  WET: "W",
};

export const FLAG_COLORS: Record<string, string> = {
  GREEN: "#39b54a",
  YELLOW: "#ffd700",
  RED: "#e8002d",
  BLUE: "#0067ff",
  CHEQUERED: "#ffffff",
  SAFETY_CAR: "#ffd700",
  VIRTUAL_SAFETY_CAR: "#ff8c00",
  CLEAR: "#39b54a",
};

export const FLAG_LABELS: Record<string, string> = {
  GREEN: "GREEN FLAG",
  YELLOW: "YELLOW",
  RED: "RED FLAG",
  BLUE: "BLUE FLAG",
  CHEQUERED: "CHEQUERED",
  SAFETY_CAR: "SAFETY CAR",
  VIRTUAL_SAFETY_CAR: "VSC",
  CLEAR: "TRACK CLEAR",
};

export const DRS_LABELS: Record<number, string> = {
  0: "OFF",
  1: "OFF",
  8: "ON",
  10: "ON",
  12: "ON",
  14: "ON",
};

export function getTeamColor(teamName: string | undefined): string {
  if (!teamName) return "#888888";
  for (const [key, color] of Object.entries(TEAM_COLORS)) {
    if (teamName.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(teamName.toLowerCase())) {
      return color;
    }
  }
  return "#888888";
}
