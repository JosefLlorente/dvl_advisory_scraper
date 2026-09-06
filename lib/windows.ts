import type { Advisory, AffectedArea, OutageWindow } from "@/lib/types";

export function sortedWindows(advisory: Advisory): OutageWindow[] {
  return [...advisory.windows].sort((left, right) => {
    if (left.startAt && right.startAt) {
      return left.startAt.localeCompare(right.startAt);
    }
    return 0;
  });
}

export function defaultWindowId(
  advisory: Advisory,
  now = new Date(),
): string | null {
  const windows = sortedWindows(advisory);
  const active = windows.find((window) => {
    if (!window.startAt || !window.endAt) return false;
    const start = new Date(window.startAt);
    const end = new Date(window.endAt);
    return start <= now && end >= now;
  });
  if (active) return active.id;

  const upcoming = windows.find(
    (window) => window.startAt && new Date(window.startAt) > now,
  );
  return upcoming?.id ?? windows[0]?.id ?? null;
}

export function areasForWindow(
  advisory: Advisory,
  windowId: string | null,
): AffectedArea[] {
  if (!windowId) return advisory.areas;
  const linked = advisory.areas.some((area) => area.windowId);
  if (!linked) return advisory.areas;
  return advisory.areas.filter(
    (area) => area.windowId === windowId || area.windowId == null,
  );
}

export function unassignedAreas(advisory: Advisory): AffectedArea[] {
  const linked = advisory.areas.some((area) => area.windowId);
  if (!linked) return [];
  return advisory.areas.filter((area) => area.windowId == null);
}

export function areasForWindowOnly(
  advisory: Advisory,
  windowId: string,
): AffectedArea[] {
  const linked = advisory.areas.some((area) => area.windowId);
  if (!linked) return advisory.areas;
  return advisory.areas.filter((area) => area.windowId === windowId);
}

export function windowById(
  advisory: Advisory,
  windowId: string | null,
): OutageWindow | null {
  if (!windowId) return advisory.windows[0] ?? null;
  return advisory.windows.find((window) => window.id === windowId) ?? null;
}
