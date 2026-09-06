import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SiteHeader({
  lastUpdated,
  source,
  className,
}: {
  lastUpdated: string | null;
  source: "supabase" | "demo";
  className?: string;
}) {
  return (
    <header className={cn("min-w-0", className)}>
      <div className="flex items-center gap-2.5">
        <img
          src="/dvo_scraper.png"
          alt=""
          width={32}
          height={32}
          className="size-8 shrink-0 rounded-full object-cover"
        />
        <h1 className="text-lg font-semibold tracking-tight">LightsOutinDVO</h1>
      </div>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-accent"
          />
          <span>Live</span>
        </span>
        <span aria-hidden>·</span>
        <span>
          Last updated {formatRelative(lastUpdated)}
          {source === "demo" ? " · demo data" : ""}
        </span>
      </p>
    </header>
  );
}
