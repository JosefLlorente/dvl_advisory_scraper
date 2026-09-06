import { StatusBadge, TypeBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatAreaName, formatDateTime, formatWindow } from "@/lib/format";
import type { Advisory } from "@/lib/types";
import { cn } from "@/lib/utils";
import { areasForWindow, sortedWindows } from "@/lib/windows";

export function AdvisoryDetail({
  advisory,
  selectedWindowId,
  onSelectWindow,
  className,
}: {
  advisory: Advisory;
  selectedWindowId?: string | null;
  onSelectWindow?: (windowId: string) => void;
  className?: string;
}) {
  const failed = advisory.parseConfidence === "failed";
  const multi = advisory.windows.length > 1;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={advisory.status} />
        <TypeBadge type={advisory.advisoryType} />
      </div>

      {failed ? (
        <p className="text-sm text-muted-foreground">
          Details unavailable — view the original advisory.
        </p>
      ) : (
        <>
          {advisory.reason ? (
            <section className="space-y-1">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Reason
              </h3>
              <p className="text-sm">{advisory.reason}</p>
            </section>
          ) : null}

          <section className="space-y-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {multi ? "Timeframes" : "Window"}
            </h3>
            {advisory.windows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No parsed schedule. See the source advisory.
              </p>
            ) : (
              <ul className="space-y-2">
                {sortedWindows(advisory).map((window) => {
                  const selected = selectedWindowId === window.id;
                  const chips = areasForWindow(advisory, window.id);

                  return (
                    <li key={window.id}>
                      {multi && onSelectWindow ? (
                        <button
                          type="button"
                          aria-expanded={selected}
                          onClick={() => onSelectWindow(window.id)}
                          className={cn(
                            "w-full rounded-md border px-3 py-2 text-left transition-colors",
                            selected
                              ? "border-accent bg-muted/80"
                              : "border-border hover:bg-muted/60",
                          )}
                        >
                          <p className="text-sm font-medium">
                            {formatWindow(window.startAt, window.endAt)}
                          </p>
                          {selected ? <AreaChips areas={chips} /> : null}
                        </button>
                      ) : (
                        <p className="text-sm">
                          {formatWindow(window.startAt, window.endAt)}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Affected areas
            </h3>
            <AreaList areas={advisory.areas} />
          </section>
        </>
      )}

      <section className="space-y-1">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Source
        </h3>
        <a
          href={advisory.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all font-mono text-xs text-foreground underline underline-offset-2"
        >
          {advisory.sourceUrl}
        </a>
        {advisory.publishedAt ? (
          <p className="text-xs text-muted-foreground">
            Published {formatDateTime(advisory.publishedAt)}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function AreaChips({ areas }: { areas: { id: string; rawText: string }[] }) {
  if (areas.length === 0) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        No places listed for this window.
      </p>
    );
  }
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {areas.map((area) => (
        <li key={area.id} className="max-w-full">
          <Badge
            variant="default"
            title={formatAreaName(area.rawText)}
            className="max-w-full truncate font-normal"
          >
            {formatAreaName(area.rawText)}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function AreaList({ areas }: { areas: { id: string; rawText: string }[] }) {
  if (areas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No parsed areas. See the source advisory.
      </p>
    );
  }
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {areas.map((area) => (
        <li key={area.id} className="text-sm">
          {formatAreaName(area.rawText)}
        </li>
      ))}
    </ul>
  );
}
