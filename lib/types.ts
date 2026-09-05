export const ADVISORY_TYPES = [
  "scheduled",
  "emergency",
  "switching",
  "unspecified",
] as const;

export const ADVISORY_STATUSES = [
  "upcoming",
  "active",
  "completed",
  "cancelled",
] as const;

export const PARSE_CONFIDENCES = ["high", "low", "failed", "manual"] as const;

export const GEOCODE_CONFIDENCES = [
  "exact",
  "approximate",
  "barangay_centroid",
  "failed",
  "pending",
] as const;

export type AdvisoryType = (typeof ADVISORY_TYPES)[number];
export type AdvisoryStatus = (typeof ADVISORY_STATUSES)[number];
export type ParseConfidence = (typeof PARSE_CONFIDENCES)[number];
export type GeocodeConfidence = (typeof GEOCODE_CONFIDENCES)[number];

export type OutageWindow = {
  id: string;
  advisoryId: string;
  startAt: string | null;
  endAt: string | null;
  rawDateText: string;
};

export type AffectedArea = {
  id: string;
  advisoryId: string;
  rawText: string;
  normalizedName: string | null;
  barangay: string | null;
  lat: number | null;
  lng: number | null;
  geocodeConfidence: GeocodeConfidence;
};

export type Advisory = {
  id: string;
  sourceUrl: string;
  title: string;
  rawText: string;
  advisoryType: AdvisoryType;
  status: AdvisoryStatus;
  isCancelledBySource: boolean;
  reason: string | null;
  publishedAt: string | null;
  scrapedAt: string;
  parseConfidence: ParseConfidence;
  parserVersion: number;
  windows: OutageWindow[];
  areas: AffectedArea[];
};

export type DashboardData = {
  advisories: Advisory[];
  lastUpdated: string | null;
  source: "supabase" | "demo";
};
