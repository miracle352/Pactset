import { formatInTimeZone } from "date-fns-tz";

export function eventTime(value: string | Date, timezone: string, pattern = "d MMM yyyy, HH:mm zzz") {
  try { return formatInTimeZone(value, timezone, pattern); }
  catch { return `${new Date(value).toISOString()} (${timezone})`; }
}

export function relativeDeadline(value: string | Date, now = new Date()) {
  const difference = new Date(value).getTime() - now.getTime();
  const hours = Math.round(Math.abs(difference) / 3_600_000);
  if (difference < 0) return `${hours}h overdue`;
  if (hours < 48) return `${hours}h remaining`;
  return `${Math.round(hours / 24)}d remaining`;
}
