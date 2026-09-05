import { StatusBadge, TypeBadge } from "@/components/status-badge";
import { formatAreaName, formatDateTime, formatWindow } from "@/lib/format";
import type { Advisory } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AdvisoryDetail({
  advisory,
  className,
}: {
  advisory: Advisory;
  className?: string;
}) {
  const failed = advisory.parseConfidence === "failed";

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
              Windows
            </h3>
            {advisory.windows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No parsed schedule. See the source advisory.
              </p>
            ) : (
              <ul className="space-y-2">
                {advisory.windows.map((window) => (
                  <li key={window.id} className="text-sm">
                    <p>{formatWindow(window.startAt, window.endAt)}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {window.rawDateText}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Affected areas
            </h3>
            {advisory.areas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No parsed areas. See the source advisory.
              </p>
            ) : (
              <ul className="list-disc space-y-1.5 pl-5">
                {advisory.areas.map((area) => (
                  <li key={area.id} className="text-sm">
                    {formatAreaName(area.rawText)}
                  </li>
                ))}
              </ul>
            )}
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
