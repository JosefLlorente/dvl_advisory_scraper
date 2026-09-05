"use client";

import { useMemo, useState } from "react";

import { AdvisoryDetail } from "@/components/advisory-detail";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatWindow } from "@/lib/format";
import type { Advisory } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 5;

type ListTab = "all" | "upcoming" | "active" | "completed";

const TABS: { value: ListTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Past" },
];

const EMPTY: Record<ListTab, string> = {
  all: "No advisories yet. The hourly scraper will fill this list.",
  upcoming: "No upcoming outages.",
  active: "No active outages.",
  completed: "No completed outages yet.",
};

function filterAdvisories(advisories: Advisory[], tab: ListTab): Advisory[] {
  if (tab === "all") return advisories;
  if (tab === "completed") {
    return advisories.filter(
      (advisory) =>
        advisory.status === "completed" || advisory.status === "cancelled",
    );
  }
  return advisories.filter((advisory) => advisory.status === tab);
}

function AdvisoryCard({
  advisory,
  selected,
  onSelect,
}: {
  advisory: Advisory;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const window = advisory.windows[0];

  return (
    <div
      id={`advisory-${advisory.id}`}
      className={cn(
        "w-full overflow-hidden rounded-lg border border-border bg-card text-left transition-[border-color,box-shadow,background-color] duration-300",
        selected && "border-foreground/20 bg-muted/80 shadow-sm",
      )}
    >
      <button
        type="button"
        aria-expanded={selected}
        onClick={() => onSelect(advisory.id)}
        className="w-full px-3 py-3 text-left transition-colors duration-200 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {selected ? null : (
          <div className="mb-2">
            <StatusBadge status={advisory.status} />
          </div>
        )}
        <p className="text-sm font-semibold leading-snug">{advisory.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {advisory.parseConfidence === "failed"
            ? "Details unavailable — view original advisory"
            : window
              ? formatWindow(window.startAt, window.endAt)
              : "Schedule unavailable"}
        </p>
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          selected ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <AdvisoryDetail advisory={advisory} className="px-3 pb-3" />
        </div>
      </div>
    </div>
  );
}

export function OutageList({
  advisories,
  selectedId,
  onSelect,
}: {
  advisories: Advisory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [tab, setTab] = useState<ListTab>("all");
  const [page, setPage] = useState(0);
  const selected = advisories.find((advisory) => advisory.id === selectedId);
  const counts = {
    all: advisories.length,
    upcoming: filterAdvisories(advisories, "upcoming").length,
    active: filterAdvisories(advisories, "active").length,
    completed: filterAdvisories(advisories, "completed").length,
  };

  const items = useMemo(
    () => filterAdvisories(advisories, tab),
    [advisories, tab],
  );
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = items.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  function handleTabChange(value: string) {
    const next = value as ListTab;
    setTab(next);
    setPage(0);
    if (
      selected &&
      !filterAdvisories(advisories, next).some(
        (advisory) => advisory.id === selected.id,
      )
    ) {
      onSelect(selected.id);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        value={tab}
        onValueChange={handleTabChange}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="mx-4 mt-3 w-auto self-stretch">
          {TABS.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label} ({counts[item.value]})
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((item) => (
          <TabsContent
            key={item.value}
            value={item.value}
            className="flex min-h-0 flex-1 flex-col px-4 pb-4"
          >
            {item.value !== tab ? null : items.length === 0 ? (
              <p className="px-1 py-8 text-sm text-muted-foreground">
                {EMPTY[item.value]}
              </p>
            ) : (
              <>
                <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                  {pageItems.map((advisory) => (
                    <li key={advisory.id}>
                      <AdvisoryCard
                        advisory={advisory}
                        selected={selectedId === advisory.id}
                        onSelect={onSelect}
                      />
                    </li>
                  ))}
                </ul>
                {items.length > PAGE_SIZE ? (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Page {safePage + 1} of {pageCount}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={safePage === 0}
                        onClick={() => setPage((current) => Math.max(0, current - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={safePage >= pageCount - 1}
                        onClick={() =>
                          setPage((current) => Math.min(pageCount - 1, current + 1))
                        }
                      >
                        Next page
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
