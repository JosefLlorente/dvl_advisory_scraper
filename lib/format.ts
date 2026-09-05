const MANILA = "Asia/Manila";

const dateTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dateOnly = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA,
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeOnly = new Intl.DateTimeFormat("en-PH", {
  timeZone: MANILA,
  hour: "numeric",
  minute: "2-digit",
});

export function formatDateTime(value: string | null): string {
  if (!value) return "Time unavailable";
  return dateTime.format(new Date(value));
}

export function formatDate(value: string | null): string {
  if (!value) return "Date unavailable";
  return dateOnly.format(new Date(value));
}

export function formatTime(value: string | null): string {
  if (!value) return "";
  return timeOnly.format(new Date(value));
}

export function formatWindow(startAt: string | null, endAt: string | null): string {
  if (!startAt || !endAt) return "Schedule unavailable";

  const start = new Date(startAt);
  const end = new Date(endAt);
  const durationMs = end.getTime() - start.getTime();
  const startsMidnight = /T00:00:00/.test(startAt);
  const allDay =
    startsMidnight &&
    durationMs >= 23.5 * 60 * 60 * 1000 &&
    durationMs <= 24.5 * 60 * 60 * 1000;

  if (allDay) {
    return dateOnly.format(start);
  }

  const sameDay = dateOnly.format(start) === dateOnly.format(end);

  if (sameDay) {
    return `${dateOnly.format(start)}, ${timeOnly.format(start)} – ${timeOnly.format(end)}`;
  }

  return `${dateTime.format(start)} – ${dateTime.format(end)}`;
}

export function formatAreaName(value: string): string {
  return value.replace(/\b([a-zA-Z])/g, (letter) => letter.toUpperCase());
}

export function formatRelative(value: string | null, now = new Date()): string {
  if (!value) return "Unknown";

  const then = new Date(value);
  const deltaMs = now.getTime() - then.getTime();
  const minutes = Math.round(deltaMs / 60_000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
