"use client";

import L from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Tooltip,
  useMap,
  ZoomControl,
} from "react-leaflet";

import { fetchAreaBoundary, resolveMapAreas } from "@/lib/boundaries";
import { formatAreaName } from "@/lib/format";
import {
  addMindanaoTiles,
  MINDANAO_BOUNDS,
  MINDANAO_CENTER,
  MINDANAO_DEFAULT_ZOOM,
  MINDANAO_MAX_ZOOM,
  MINDANAO_MIN_ZOOM,
} from "@/lib/mindanao-map";
import type { Advisory, AdvisoryStatus, AffectedArea } from "@/lib/types";
import { areasForWindow } from "@/lib/windows";

import "leaflet/dist/leaflet.css";

const MAP_COLOR = {
  upcoming: "var(--map-upcoming)",
  active: "var(--map-active)",
  completed: "var(--map-completed)",
  cancelled: "var(--map-cancelled)",
} as const;

const ICON_SVG: Record<AdvisoryStatus, string> = {
  upcoming:
    '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></svg>',
  active:
    '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>',
  completed:
    '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.8 2.8L16.5 9"/></svg>',
  cancelled:
    '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8 8 8 8M16 8l-8 8"/></svg>',
};

function isUpdatedTitle(title: string) {
  return /\[updated\]|\bupdated\b/i.test(title);
}

function visualStatus(advisory: Advisory): AdvisoryStatus {
  if (advisory.status === "completed") {
    return "completed";
  }
  if (advisory.status === "active") {
    return "active";
  }
  if (advisory.status === "upcoming" || isUpdatedTitle(advisory.title)) {
    return "upcoming";
  }
  return "cancelled";
}

function mapColor(status: AdvisoryStatus) {
  return MAP_COLOR[status];
}

function iconSizePx(zoom: number) {
  return Math.round(Math.min(64, Math.max(28, 28 + (13 - zoom) * 6)));
}

function statusIcon(status: AdvisoryStatus, size: number, dimmed: boolean) {
  const color = mapColor(status);
  return L.divIcon({
    className: "outage-marker",
    html: `<span class="outage-status-icon" style="width:${size}px;height:${size}px;background:${color};opacity:${dimmed ? 0.28 : 1}">${ICON_SVG[status]}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function useZoomIconSize() {
  const map = useMap();
  const [size, setSize] = useState(() => iconSizePx(map.getZoom()));

  useEffect(() => {
    function sync() {
      setSize(iconSizePx(map.getZoom()));
    }
    sync();
    map.on("zoom", sync);
    return () => {
      map.off("zoom", sync);
    };
  }, [map]);

  return size;
}

function MindanaoView({
  selected,
  areas,
}: {
  selected: boolean;
  areas: { lat: number; lng: number }[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!selected || areas.length === 0) {
      map.setView(MINDANAO_CENTER, MINDANAO_DEFAULT_ZOOM);
      return;
    }
    if (areas.length === 1) {
      map.setView([areas[0].lat, areas[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(areas.map((area) => [area.lat, area.lng]));
    map.fitBounds(bounds.pad(0.35), { maxZoom: 14, animate: false });
  }, [map, selected, areas]);

  return null;
}

function useResolvedAreas(areas: AffectedArea[], selectedId: string | null) {
  const [upgrades, setUpgrades] = useState<
    Record<string, { lat: number; lng: number }>
  >({});
  const areaKey = areas.map((area) => area.id).join("|");
  const areasRef = useRef(areas);
  areasRef.current = areas;

  useEffect(() => {
    setUpgrades({});
    if (!selectedId) {
      return;
    }
    const missing = areasRef.current.filter(
      (area) => area.lat == null || area.lng == null,
    );
    if (missing.length === 0) {
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    void (async () => {
      for (const area of missing) {
        if (cancelled) {
          return;
        }
        try {
          const result = await fetchAreaBoundary(area, controller.signal);
          if (result.lat != null && result.lng != null && !cancelled) {
            setUpgrades((current) => ({
              ...current,
              [area.id]: { lat: result.lat as number, lng: result.lng as number },
            }));
          }
        } catch {
          // Neighbor fallback still renders the area.
        }
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selectedId, areaKey]);

  return useMemo(() => {
    const merged = areas.map((area) => {
      const upgrade = upgrades[area.id];
      return upgrade
        ? { ...area, lat: upgrade.lat, lng: upgrade.lng }
        : area;
    });
    return resolveMapAreas(merged);
  }, [areas, upgrades]);
}

function CachedTiles() {
  const map = useMap();

  useEffect(() => {
    const layer = addMindanaoTiles(map);
    return () => {
      layer.remove();
    };
  }, [map]);

  return null;
}

function AreaCircles({
  areas,
  focusedIds,
  status,
}: {
  areas: { id: string; label: string; lat: number; lng: number; radius: number }[];
  focusedIds: Set<string>;
  status: AdvisoryStatus;
}) {
  const size = useZoomIconSize();
  const color = mapColor(status);
  const dimPath = {
    color,
    fillColor: color,
    weight: 3,
    opacity: 0.22,
    fillOpacity: 0.05,
    dashArray: "8 7",
  };
  const focusPath = {
    color,
    fillColor: color,
    weight: 3,
    opacity: 0.85,
    fillOpacity: 0.16,
    dashArray: "8 7",
  };

  return (
    <>
      {areas.map((area) => {
        const dimmed = focusedIds.size > 0 && !focusedIds.has(area.id);
        return (
          <Circle
            key={`${area.id}-circle`}
            center={[area.lat, area.lng]}
            radius={area.radius}
            pathOptions={dimmed ? dimPath : focusPath}
            interactive={false}
          />
        );
      })}
      {areas.map((area) => {
        const dimmed = focusedIds.size > 0 && !focusedIds.has(area.id);
        return (
          <Marker
            key={`${area.id}-icon`}
            position={[area.lat, area.lng]}
            icon={statusIcon(status, size, dimmed)}
            opacity={dimmed ? 0.35 : 1}
            zIndexOffset={dimmed ? 0 : 200}
          >
            <Tooltip
              className="outage-preview"
              direction="top"
              offset={[0, -Math.round(size / 2) - 4]}
              opacity={1}
            >
              <p className="max-w-64 text-xs font-medium">
                {formatAreaName(area.label)}
              </p>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}

const EMPTY_AREAS: AffectedArea[] = [];

export default function OutageMap({
  advisories,
  selectedId,
  selectedWindowId,
}: {
  advisories: Advisory[];
  selectedId: string | null;
  selectedWindowId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = useMemo(
    () => advisories.find((advisory) => advisory.id === selectedId) ?? null,
    [advisories, selectedId],
  );
  const selectedStatus = selected ? visualStatus(selected) : null;
  const focusedAreas = useMemo(
    () => (selected ? areasForWindow(selected, selectedWindowId) : EMPTY_AREAS),
    [selected, selectedWindowId],
  );
  const focusedIds = useMemo(
    () => new Set(focusedAreas.map((area) => area.id)),
    [focusedAreas],
  );

  const selectedCircles = useResolvedAreas(
    selected?.areas ?? EMPTY_AREAS,
    selectedId,
  );

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={MINDANAO_CENTER}
        zoom={MINDANAO_DEFAULT_ZOOM}
        minZoom={MINDANAO_MIN_ZOOM}
        maxZoom={MINDANAO_MAX_ZOOM}
        maxBounds={MINDANAO_BOUNDS}
        maxBoundsViscosity={1}
        zoomControl={false}
        className="h-full w-full"
        scrollWheelZoom
      >
        <ZoomControl position="topleft" />
        <CachedTiles />
        <MindanaoView
          selected={Boolean(selected)}
          areas={selectedCircles}
        />
        {selected && selectedStatus && selectedCircles.length > 0 ? (
          <AreaCircles
            areas={selectedCircles}
            focusedIds={focusedIds}
            status={selectedStatus}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
