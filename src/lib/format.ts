import type { Locale } from "@/i18n/config";

export function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "01";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")) };
}

export function dayKey(date: Date | string, timeZone: string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const { year, month, day } = dateParts(d, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function todayKey(timeZone: string) {
  return dayKey(new Date(), timeZone);
}

function tzOffset(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - date.getTime();
}

/** Convert a wall-clock date/time in a timezone to a UTC Date. */
export function zonedToUtc(dateKey: string, time: string, timeZone: string) {
  const guess = new Date(`${dateKey}T${time.length === 5 ? time : "00:00"}:00Z`);
  const offset = tzOffset(guess, timeZone);
  return new Date(guess.getTime() - offset);
}

export function startOfDay(dateKey: string, timeZone: string) {
  return zonedToUtc(dateKey, "00:00", timeZone);
}

export function endOfDay(dateKey: string, timeZone: string) {
  const start = zonedToUtc(dateKey, "00:00", timeZone);
  return new Date(start.getTime() + 86_400_000 - 1);
}

export function addDaysKey(dateKey: string, days: number) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ageFromDob(dob: string | Date, at: Date = new Date(), timeZone = "UTC") {
  const birth = dob instanceof Date ? dob : new Date(`${dob}T12:00:00Z`);
  const now = dateParts(at, timeZone);
  const b = dateParts(birth, timeZone);
  let months = (now.year - b.year) * 12 + (now.month - b.month);
  if (now.day < b.day) months -= 1;
  months = Math.max(0, months);
  let years = Math.floor(months / 12);
  let remMonths = months % 12;
  const anchor = new Date(Date.UTC(b.year, b.month - 1 + months, b.day));
  const totalDays = Math.max(
    0,
    Math.floor((at.getTime() - birth.getTime()) / 86_400_000),
  );
  let days = Math.floor((at.getTime() - anchor.getTime()) / 86_400_000);
  if (days < 0) days = 0;
  return {
    years,
    months: years * 12 + remMonths,
    remainderMonths: remMonths,
    days,
    weeks: Math.floor(totalDays / 7),
    totalDays,
  };
}

export function formatDate(
  value: string | Date,
  locale: Locale,
  timeZone: string,
  format = "DD/MM/YYYY",
) {
  const date = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value) : value;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const day = get("day");
  const month = get("month");
  const year = get("year");
  if (format === "MM/DD/YYYY") return `${month}/${day}/${year}`;
  if (format === "YYYY-MM-DD") return `${year}-${month}-${day}`;
  if (format === "D MMMM YYYY") {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }
  return `${day}/${month}/${year}`;
}

export function formatTime(value: string | Date, locale: Locale, timeZone: string, format = "24h") {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: format === "12h",
  }).format(date);
}

export function formatDateTime(
  value: string | Date,
  locale: Locale,
  timeZone: string,
  dateFormat = "DD/MM/YYYY",
  timeFormat = "24h",
) {
  return `${formatDate(value, locale, timeZone, dateFormat)} · ${formatTime(value, locale, timeZone, timeFormat)}`;
}

export function formatWeekday(value: string | Date, locale: Locale, timeZone: string) {
  const date = typeof value === "string" ? new Date(`${value}T12:00:00Z`) : value;
  return new Intl.DateTimeFormat(locale, { timeZone, weekday: "short" }).format(date);
}

export function formatMonth(value: string | Date, locale: Locale, timeZone: string, long = true) {
  const date = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value) : value;
  return new Intl.DateTimeFormat(locale, { timeZone, month: long ? "long" : "short", year: "numeric" }).format(date);
}

export function durationLabel(seconds: number | null | undefined) {
  const total = Math.max(0, Math.round(seconds ?? 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m`;
  return `${total}s`;
}

export function minutesLabel(seconds: number | null | undefined) {
  return Math.max(0, Math.round((seconds ?? 0) / 60));
}

export function relativeTime(
  value: string | Date,
  locale: Locale,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  const date = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t("time.justNow");
  if (minutes < 60) return t("time.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("time.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  return t("time.daysAgo", { count: days });
}

export function startOfWeekKey(dateKey: string) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function rangeDays(fromKey: string, toKey: string) {
  const out: string[] = [];
  let cursor = fromKey;
  let guard = 0;
  while (cursor <= toKey && guard < 400) {
    out.push(cursor);
    cursor = addDaysKey(cursor, 1);
    guard += 1;
  }
  return out;
}

export function sleepDuration(startedAt: string, endedAt: string | null) {
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  return Math.max(0, Math.round((end - new Date(startedAt).getTime()) / 1000));
}
