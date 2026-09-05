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
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader lastUpdated={data.lastUpdated} source={data.source} />
      <div
        className={cn(
          "grid min-h-0 flex-1",
          sidebarOpen ? "lg:grid-cols-[1fr_28rem]" : "lg:grid-cols-1",
        )}
      >
        <section
          className={cn(
            "relative overflow-hidden border-b border-border lg:border-b-0",
            sidebarOpen
              ? "h-[45vh] min-h-[280px] lg:h-auto lg:border-r"
              : "h-[calc(100dvh-4.5rem)] min-h-[280px] lg:h-auto",
          )}
        >
          <OutageMap
            advisories={data.advisories}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
          {sidebarOpen ? null : (
            <div className="absolute top-3 right-3 z-[1100] flex gap-2">
              <RefreshButton className="bg-background" />
              <Button
                variant="outline"
                size="sm"
                className="bg-background"
                onClick={() => setSidebarOpen(true)}
              >
                <PanelRightOpen />
                Show list
              </Button>
            </div>
          )}
        </section>
        {sidebarOpen ? (
          <section className="flex min-h-0 flex-col bg-background">
            <div className="flex justify-end gap-2 px-4 pt-3">
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
            <OutageList
              advisories={data.advisories}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </section>
        ) : null}
      </div>
      <SiteFooter />
    </div>
  );
}
