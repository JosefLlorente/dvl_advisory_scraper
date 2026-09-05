import type { Advisory, AdvisoryStatus, OutageWindow } from "@/lib/types";

export function computeWindowStatus(
  window: OutageWindow,
  now = new Date(),
): AdvisoryStatus | null {
  if (!window.startAt || !window.endAt) {
    return null;
  }

  const start = new Date(window.startAt);
  const end = new Date(window.endAt);

  if (now < start) return "upcoming";
  if (now > end) return "completed";
  return "active";
}

export function computeAdvisoryStatus(
  advisory: Pick<Advisory, "isCancelledBySource" | "windows">,
  now = new Date(),
): AdvisoryStatus {
  if (advisory.isCancelledBySource) {
    return "cancelled";
  }

  const statuses = advisory.windows
    .map((window) => computeWindowStatus(window, now))
    .filter((status): status is AdvisoryStatus => status !== null);

  if (statuses.includes("active")) return "active";
  if (statuses.includes("upcoming")) return "upcoming";
  if (statuses.includes("completed")) return "completed";
  return "upcoming";
}

export function withComputedStatus<T extends Advisory>(
  advisory: T,
  now = new Date(),
): T {
  return {
    ...advisory,
    status: computeAdvisoryStatus(advisory, now),
  };
}

export const STATUS_LABEL: Record<AdvisoryStatus, string> = {
  upcoming: "Upcoming",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const TYPE_LABEL: Record<Advisory["advisoryType"], string> = {
  scheduled: "Scheduled",
  emergency: "Emergency",
  switching: "Switching",
  unspecified: "Advisory",
};
