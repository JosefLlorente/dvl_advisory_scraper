import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const cronHeader = request.headers.get("x-vercel-cron");
  if (cronHeader === "1") {
    return true;
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabase();
  if (!supabase) {
    return Response.json({
      ok: true,
      message:
        "Supabase is not configured. Run `python -m scraper` locally or via GitHub Actions.",
    });
  }

  const { data, error } = await supabase
    .from("scrape_runs")
    .select(
      "id, started_at, finished_at, discovered, inserted, updated, parse_failures, geocode_failures, notes",
    )
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    latestRun: data,
    message:
      "Hourly scraping runs from GitHub Actions (`python -m scraper`). This endpoint reports the latest scrape_runs row.",
  });
}
