"use client";

import { PanelRightClose, PanelRightOpen, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { OutageList } from "@/components/outage-list";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";

const OutageMap = dynamic(() => import("@/components/outage-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

function RefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      className={className}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw className={pending ? "animate-spin" : ""} />
      Refresh
    </Button>
  );
}

export function OutageDashboard({ data }: { data: DashboardData }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  function handleSelect(id: string) {
    setSelectedId((current) => (current === id ? null : id));
    setSidebarOpen(true);
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0">
        <OutageMap
          advisories={data.advisories}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
      </div>

      <div
        className={cn(
          "absolute top-3 right-3 z-[1200] flex gap-2 transition-all duration-300 ease-out",
          sidebarOpen
            ? "pointer-events-none translate-y-1 opacity-0"
            : "translate-y-0 opacity-100",
        )}
      >
        <RefreshButton className="bg-card/90 shadow-sm backdrop-blur-md" />
        <Button
          variant="outline"
          size="sm"
          className="bg-card/90 shadow-sm backdrop-blur-md"
          onClick={() => setSidebarOpen(true)}
        >
          <PanelRightOpen />
          Show list
        </Button>
      </div>

      <aside
        className={cn(
          "absolute top-3 right-3 bottom-3 z-[1100] flex w-[min(28rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-xl border border-border bg-card/90 shadow-lg backdrop-blur-md transition-all duration-300 ease-out",
          sidebarOpen
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-[110%] opacity-0",
        )}
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
          <SiteHeader lastUpdated={data.lastUpdated} source={data.source} />
          <div className="flex shrink-0 gap-2">
            <RefreshButton />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
            >
              <PanelRightClose />
              Hide list
            </Button>
          </div>
        </div>
        <OutageList
          advisories={data.advisories}
          selectedId={selectedId}
          onSelect={handleSelect}
        />
        <SiteFooter compact />
      </aside>
    </div>
  );
}
