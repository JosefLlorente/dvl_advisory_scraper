"use client";

import type { LatLngExpression } from "leaflet";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";

import { FALLBACK_RADIUS_M } from "@/lib/boundaries";
import { formatAreaName } from "@/lib/format";
import type { Advisory, AdvisoryStatus } from "@/lib/types";

import "leaflet/dist/leaflet.css";

const DAVAO_CENTER: LatLngExpression = [7.0731, 125.6128];

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

function statusIcon(status: AdvisoryStatus, size: number) {
  const color = mapColor(status);
  return L.divIcon({
    className: "outage-marker",
    html: `<span class="outage-status-icon" style="width:${size}px;height:${size}px;background:${color}">${ICON_SVG[status]}</span>`,
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

function CityView({ selected }: { selected: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!selected) {
      map.setView(DAVAO_CENTER, 11);
    }
  }, [map, selected]);

  return null;
}

function AreaCircles({
  areas,
  status,
}: {
  areas: { id: string; label: string; lat: number; lng: number }[];
  status: AdvisoryStatus;
}) {
  const size = useZoomIconSize();
  const color = mapColor(status);
  const icon = statusIcon(status, size);
  const path = {
    color,
    fillColor: color,
    weight: 3,
    opacity: 0.85,
    fillOpacity: 0.16,
    dashArray: "8 7",
  };

  return (
    <>
      {areas.map((area) => (
        <Circle
          key={`${area.id}-circle`}
          center={[area.lat, area.lng]}
          radius={FALLBACK_RADIUS_M}
          pathOptions={path}
        >
          <Tooltip className="outage-preview" sticky>
            <p className="max-w-64 text-xs font-medium">
              {formatAreaName(area.label)}
            </p>
          </Tooltip>
        </Circle>
      ))}
      {areas.map((area) => (
        <Marker
          key={`${area.id}-icon`}
          position={[area.lat, area.lng]}
          icon={icon}
          interactive={false}
        />
      ))}
    </>
  );
}

export default function OutageMap({
  advisories,
  selectedId,
}: {
  advisories: Advisory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selected = useMemo(
    () => advisories.find((advisory) => advisory.id === selectedId) ?? null,
    [advisories, selectedId],
  );
  const selectedStatus = selected ? visualStatus(selected) : null;

  const selectedCircles = useMemo(
    () =>
      selected
        ? selected.areas
            .filter((area) => area.lat != null && area.lng != null)
            .map((area) => ({
              id: area.id,
              label: area.rawText,
              lat: area.lat as number,
              lng: area.lng as number,
            }))
        : [],
    [selected],
  );

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={DAVAO_CENTER}
        zoom={11}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CityView selected={Boolean(selected)} />
        {selected && selectedStatus && selectedCircles.length > 0 ? (
          <AreaCircles areas={selectedCircles} status={selectedStatus} />
        ) : null}
      </MapContainer>
    </div>
  );
}
