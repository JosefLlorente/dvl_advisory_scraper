import { formatRelative } from "@/lib/format";

export function SiteHeader({
  lastUpdated,
  source,
}: {
  lastUpdated: string | null;
  source: "supabase" | "demo";
}) {
  return (
    <header className="border-b border-border bg-background">
      <div className="px-4 py-3 md:px-6">
        <h1 className="text-lg font-semibold tracking-tight">
          Davao Light Outages
        </h1>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="size-1.5 rounded-full bg-status-completed"
            />
            <span>Live</span>
          </span>
          <span aria-hidden>·</span>
          <span>
            Last updated {formatRelative(lastUpdated)}
            {source === "demo" ? " · demo data" : ""}
          </span>
        </p>
      </div>
    </header>
  );
}
