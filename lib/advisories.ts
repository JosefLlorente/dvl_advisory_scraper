import { DEMO_DASHBOARD } from "@/lib/demo-data";
import { withComputedStatus } from "@/lib/status";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  Advisory,
  AdvisoryStatus,
  AdvisoryType,
  AffectedArea,
  DashboardData,
  GeocodeConfidence,
  OutageWindow,
  ParseConfidence,
} from "@/lib/types";

type AdvisoryRow = {
  id: string;
  source_url: string;
  title: string;
  raw_text: string;
  advisory_type: AdvisoryType;
  status: AdvisoryStatus;
  is_cancelled_by_source: boolean;
  reason: string | null;
  published_at: string | null;
  scraped_at: string;
  parse_confidence: ParseConfidence;
  parser_version: number;
};

type WindowRow = {
  id: string;
  advisory_id: string;
  start_at: string | null;
  end_at: string | null;
  raw_date_text: string;
};

type AreaRow = {
  id: string;
  advisory_id: string;
  raw_text: string;
  normalized_name: string | null;
  barangay: string | null;
  lat: number | null;
  lng: number | null;
  geocode_confidence: GeocodeConfidence;
};

function mapWindow(row: WindowRow): OutageWindow {
  return {
    id: row.id,
    advisoryId: row.advisory_id,
    startAt: row.start_at,
    endAt: row.end_at,
    rawDateText: row.raw_date_text,
  };
}

function mapArea(row: AreaRow): AffectedArea {
  return {
    id: row.id,
    advisoryId: row.advisory_id,
    rawText: row.raw_text,
    normalizedName: row.normalized_name,
    barangay: row.barangay,
    lat: row.lat,
    lng: row.lng,
    geocodeConfidence: row.geocode_confidence,
  };
}

function assemble(
  rows: AdvisoryRow[],
  windows: WindowRow[],
  areas: AreaRow[],
): Advisory[] {
  const windowsByAdvisory = new Map<string, OutageWindow[]>();
  const areasByAdvisory = new Map<string, AffectedArea[]>();

  for (const window of windows) {
    const list = windowsByAdvisory.get(window.advisory_id) ?? [];
    list.push(mapWindow(window));
    windowsByAdvisory.set(window.advisory_id, list);
  }

  for (const area of areas) {
    const list = areasByAdvisory.get(area.advisory_id) ?? [];
    list.push(mapArea(area));
    areasByAdvisory.set(area.advisory_id, list);
  }

  return rows.map((row) =>
    withComputedStatus({
      id: row.id,
      sourceUrl: row.source_url,
      title: row.title,
      rawText: row.raw_text,
      advisoryType: row.advisory_type,
      status: row.status,
      isCancelledBySource: row.is_cancelled_by_source,
      reason: row.reason,
      publishedAt: row.published_at,
      scrapedAt: row.scraped_at,
      parseConfidence: row.parse_confidence,
      parserVersion: row.parser_version,
      windows: windowsByAdvisory.get(row.id) ?? [],
      areas: areasByAdvisory.get(row.id) ?? [],
    }),
  );
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = createServerSupabase();

  if (!supabase) {
    return {
      ...DEMO_DASHBOARD,
      advisories: DEMO_DASHBOARD.advisories.map((advisory) =>
        withComputedStatus(advisory),
      ),
    };
  }

  const [advisoriesRes, windowsRes, areasRes] = await Promise.all([
    supabase
      .from("advisories")
      .select(
        "id, source_url, title, raw_text, advisory_type, status, is_cancelled_by_source, reason, published_at, scraped_at, parse_confidence, parser_version",
      )
      .order("published_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("outage_windows")
      .select("id, advisory_id, start_at, end_at, raw_date_text"),
    supabase
      .from("affected_areas")
      .select(
        "id, advisory_id, raw_text, normalized_name, barangay, lat, lng, geocode_confidence",
      ),
  ]);

  if (advisoriesRes.error) {
    throw new Error(advisoriesRes.error.message);
  }

  const advisories = assemble(
    (advisoriesRes.data ?? []) as AdvisoryRow[],
    (windowsRes.data ?? []) as WindowRow[],
    (areasRes.data ?? []) as AreaRow[],
  );

  const lastUpdated =
    advisories.reduce<string | null>((latest, advisory) => {
      if (!latest || advisory.scrapedAt > latest) {
        return advisory.scrapedAt;
      }
      return latest;
    }, null);

  return {
    advisories,
    lastUpdated,
    source: "supabase",
  };
}
