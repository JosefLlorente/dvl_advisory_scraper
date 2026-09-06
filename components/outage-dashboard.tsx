"use client";

import {
  ChevronDown,
  ChevronUp,
  LocateFixed,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { OutageList } from "@/components/outage-list";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatWindow } from "@/lib/format";
import { findAffectedHits } from "@/lib/location";
import type { Advisory, DashboardData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { sortedWindows } from "@/lib/windows";

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

function LocateButton({
  locating,
  onClick,
  className,
}: {
  locating: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={locating}
      className={className}
      onClick={onClick}
    >
      <LocateFixed className={locating ? "animate-pulse" : ""} />
      Am I affected?
    </Button>
  );
}

function ListBody({
  data,
  selectedId,
  selectedWindowId,
  revealId,
  revealNonce,
  locateMessage,
  cardIdPrefix,
  onSelect,
  onSelectWindow,
}: {
  data: DashboardData;
  selectedId: string | null;
  selectedWindowId: string | null;
  revealId: string | null;
  revealNonce: number;
  locateMessage: string | null;
  cardIdPrefix: string;
  onSelect: (id: string) => void;
  onSelectWindow: (windowId: string) => void;
}) {
  return (
    <>
      {locateMessage ? (
        <p className="mx-4 text-xs text-muted-foreground">{locateMessage}</p>
      ) : null}
      <OutageList
        key={`${cardIdPrefix}${revealId ?? "none"}-${revealNonce}`}
        advisories={data.advisories}
        selectedId={selectedId}
        selectedWindowId={selectedWindowId}
        revealId={revealId}
        revealNonce={revealNonce}
        cardIdPrefix={cardIdPrefix}
        onSelect={onSelect}
        onSelectWindow={onSelectWindow}
      />
      <SiteFooter compact />
    </>
  );
}

function TimeframePanel({
  advisory,
  selectedWindowId,
  open,
  onToggle,
  onSelectWindow,
}: {
  advisory: Advisory;
  selectedWindowId: string | null;
  open: boolean;
  onToggle: () => void;
  onSelectWindow: (windowId: string) => void;
}) {
  const windows = sortedWindows(advisory);
  const current =
    windows.find((window) => window.id === selectedWindowId) ?? windows[0];
  const summary = current
    ? formatWindow(current.startAt, current.endAt)
    : `${windows.length} timeframes`;

  return (
    <div className="absolute bottom-4 left-3 z-[1050] w-[min(22rem,calc(100%-1.5rem))] overflow-hidden rounded-lg border border-border bg-card/80 shadow-sm backdrop-blur-md md:bottom-5 md:left-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto w-full justify-between gap-2 px-3 py-2 text-left"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="min-w-0 truncate text-xs font-medium">
          {open ? "Hide timeframes" : summary}
        </span>
        {open ? <ChevronDown /> : <ChevronUp />}
      </Button>
      {open ? (
        <div className="flex flex-col gap-1 border-t border-border px-2 py-2">
          {windows.map((window) => (
            <Button
              key={window.id}
              type="button"
              size="sm"
              variant={selectedWindowId === window.id ? "default" : "outline"}
              className="justify-start"
              onClick={() => onSelectWindow(window.id)}
            >
              {formatWindow(window.startAt, window.endAt)}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function OutageDashboard({ data }: { data: DashboardData }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);
  const [windowsOpen, setWindowsOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateMessage, setLocateMessage] = useState<string | null>(null);
  const [revealId, setRevealId] = useState<string | null>(null);
  const [revealNonce, setRevealNonce] = useState(0);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    function sync() {
      if (query.matches) {
        setMobileOpen(false);
      }
    }
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!locateMessage || locating) {
      return;
    }
    const timer = window.setTimeout(() => setLocateMessage(null), 8000);
    return () => window.clearTimeout(timer);
  }, [locateMessage, locating]);

  function handleSelect(id: string) {
    setSelectedId((current) => {
      if (current === id) {
        setSelectedWindowId(null);
        setWindowsOpen(false);
        return null;
      }
      setSelectedWindowId(null);
      setWindowsOpen(false);
      return id;
    });
    setDesktopOpen(true);
  }

  function handleSelectWindow(windowId: string) {
    setSelectedWindowId((current) => (current === windowId ? null : windowId));
  }

  function selectMatch(advisoryId: string, windowId: string | null) {
    setSelectedId(advisoryId);
    setSelectedWindowId(windowId);
    setWindowsOpen(Boolean(windowId));
    setDesktopOpen(true);
    setRevealId(advisoryId);
    setRevealNonce((current) => current + 1);
    if (window.matchMedia("(max-width: 767px)").matches) {
      setMobileOpen(true);
    }
  }

  function checkLocation() {
    if (!navigator.geolocation) {
      setLocateMessage("Location is not available in this browser.");
      return;
    }
    setLocating(true);
    setLocateMessage("Checking your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const hits = findAffectedHits(data.advisories, {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocating(false);
        if (hits.length === 0) {
          setLocateMessage(
            "Not in a mapped upcoming or active outage area. Pins are approximate — this is not a guarantee of power.",
          );
          return;
        }
        const nearest = hits[0];
        const extra = new Set(hits.map((hit) => hit.advisoryId)).size - 1;
        selectMatch(nearest.advisoryId, nearest.windowId);
        setLocateMessage(
          extra > 0
            ? `Possible match near you, plus ${extra} more. Pins are approximate.`
            : "Possible match near you. Pins are approximate.",
        );
      },
      (error) => {
        setLocating(false);
        setLocateMessage(
          error.code === error.PERMISSION_DENIED
            ? "Location permission is needed to check nearby outage pins."
            : "Could not read your location. Try again.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const selected = data.advisories.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <div className="absolute inset-0">
        <OutageMap
          advisories={data.advisories}
          selectedId={selectedId}
          selectedWindowId={selectedWindowId}
          onSelect={handleSelect}
        />
      </div>

      <div className="absolute top-3 right-3 z-[1200] flex w-max flex-col items-stretch gap-2 md:hidden">
        <RefreshButton className="w-full justify-start bg-card/90 shadow-sm backdrop-blur-md" />
        <LocateButton
          locating={locating}
          onClick={checkLocation}
          className="w-full justify-start bg-card/90 shadow-sm backdrop-blur-md"
        />
        <Button
          size="sm"
          className="w-full justify-start shadow-sm"
          onClick={() => setMobileOpen(true)}
        >
          <PanelRightOpen />
          Advisories
        </Button>
      </div>

      <div
        className={cn(
          "absolute top-3 right-3 z-[1200] hidden gap-2 md:flex",
          desktopOpen
            ? "pointer-events-none translate-y-1 opacity-0"
            : "translate-y-0 opacity-100",
        )}
      >
        <RefreshButton className="bg-card/90 shadow-sm backdrop-blur-md" />
        <LocateButton
          locating={locating}
          onClick={checkLocation}
          className="bg-card/90 shadow-sm backdrop-blur-md"
        />
        <Button
          variant="outline"
          size="sm"
          className="bg-card/90 shadow-sm backdrop-blur-md"
          onClick={() => setDesktopOpen(true)}
        >
          <PanelRightOpen />
          Show list
        </Button>
      </div>

      <aside
        className={cn(
          "absolute top-3 right-3 bottom-3 z-[1100] hidden w-[min(28rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-xl border border-border bg-card/90 shadow-lg backdrop-blur-md transition-all duration-300 ease-out max-md:!hidden md:flex",
          desktopOpen
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-[110%] opacity-0",
        )}
      >
        <div className="flex flex-col gap-3 px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <SiteHeader lastUpdated={data.lastUpdated} source={data.source} />
            <div className="flex shrink-0 gap-2">
              <RefreshButton />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDesktopOpen(false)}
              >
                <PanelRightClose />
                Hide list
              </Button>
            </div>
          </div>
          <LocateButton locating={locating} onClick={checkLocation} />
        </div>
        <ListBody
          data={data}
          selectedId={selectedId}
          selectedWindowId={selectedWindowId}
          revealId={revealId}
          revealNonce={revealNonce}
          locateMessage={locateMessage}
          cardIdPrefix="desktop-"
          onSelect={handleSelect}
          onSelectWindow={handleSelectWindow}
        />
      </aside>

      {locateMessage ? (
        <div
          role="status"
          className="pointer-events-none absolute bottom-4 left-3 z-[1050] w-[min(22rem,calc(100%-1.5rem))] rounded-lg border border-border bg-card/75 px-3 py-2 text-sm text-foreground shadow-sm backdrop-blur-md md:bottom-5 md:left-4"
        >
          <p>{locateMessage}</p>
        </div>
      ) : selectedId || mobileOpen ? null : (
        <div
          role="status"
          className="pointer-events-none absolute bottom-4 left-3 z-[1050] w-[min(22rem,calc(100%-1.5rem))] rounded-lg border border-border bg-card/65 px-3 py-2 text-sm text-foreground shadow-sm backdrop-blur-md md:bottom-5 md:left-4"
        >
          <p className="md:hidden">
            Tap Advisories, then select one to see affected areas on the map.
          </p>
          <p className="hidden md:block">
            Select an advisory from the list to see affected areas on the map.
          </p>
        </div>
      )}

      {selected && selected.windows.length > 1 && !mobileOpen && !locateMessage ? (
        <TimeframePanel
          advisory={selected}
          selectedWindowId={selectedWindowId}
          open={windowsOpen}
          onToggle={() => setWindowsOpen((current) => !current)}
          onSelectWindow={handleSelectWindow}
        />
      ) : null}

      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogContent className="h-[85dvh] w-[calc(100vw-1.5rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="sr-only">Advisories</DialogTitle>
            <DialogDescription className="sr-only">
              Browse outage advisories and affected areas.
            </DialogDescription>
            <SiteHeader lastUpdated={data.lastUpdated} source={data.source} />
            <div className="flex flex-wrap gap-2 pt-1">
              <LocateButton locating={locating} onClick={checkLocation} />
              <RefreshButton />
            </div>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <ListBody
              data={data}
              selectedId={selectedId}
              selectedWindowId={selectedWindowId}
              revealId={revealId}
              revealNonce={revealNonce}
              locateMessage={locateMessage}
              cardIdPrefix="mobile-"
              onSelect={handleSelect}
              onSelectWindow={handleSelectWindow}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
