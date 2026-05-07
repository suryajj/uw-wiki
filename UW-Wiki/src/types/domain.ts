// Application-layer types and constants used throughout the app.

export const ORG_CATEGORIES = [
  "Design Teams",
  "Engineering Clubs",
  "Non-Engineering Clubs",
  "Academic Programs",
  "Student Societies",
  "Campus Organizations",
] as const;

export type OrgCategory = (typeof ORG_CATEGORIES)[number];

export const PULSE_METRICS = [
  "selectivity",
  "vibe_check",
  "coop_boost",
  "tech_stack",
] as const;

export type PulseMetric = (typeof PULSE_METRICS)[number];
