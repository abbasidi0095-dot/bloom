"use client";

import {
  Activity,
  AlertCircle,
  CalendarDays,
  Droplets,
  Moon,
  Pill,
  Ruler,
  Sparkles,
  Star,
  Thermometer,
  Utensils,
} from "lucide-react";
import type { RecordRow } from "@/hooks/use-records";
import { durationLabel, formatTime } from "@/lib/format";
import { useT } from "@/i18n/provider";
import type { Locale } from "@/i18n/config";

const iconFor: Record<string, typeof Utensils> = {
  feedings: Utensils,
  diapers: Droplets,
  sleeps: Moon,
  growth: Ruler,
  activities: Activity,
  milestones: Star,
  medicationLogs: Pill,
  temperatures: Thermometer,
  appointments: CalendarDays,
  symptoms: AlertCircle,
};

const toneFor: Record<string, string> = {
  feedings: "bg-peach-soft",
  diapers: "bg-sky-soft",
  sleeps: "bg-lavender-soft",
  growth: "bg-sage-soft",
  activities: "bg-sage-soft",
  milestones: "bg-lavender-soft",
  medicationLogs: "bg-peach-soft",
  temperatures: "bg-sky-soft",
  appointments: "bg-sage-soft",
  symptoms: "bg-peach-soft",
};

export function entryTitle(entry: RecordRow, t: (key: string, values?: Record<string, string | number>) => string) {
  const meta = (entry.meta ?? {}) as Record<string, any>;
  switch (entry.entity) {
    case "feedings":
      return t(`feeding.${entry.kind ?? "breast"}`);
    case "diapers":
      return t(`diaper.${entry.kind ?? "wet"}`);
    case "sleeps":
      return t(`sleep.${entry.kind ?? "nap"}`);
    case "activities":
      return entry.title || t(`activities.${entry.kind ?? "custom"}`);
    case "temperatures":
      return `${t("health.temperature")} · ${meta.celsius ?? ""}°C`;
    case "growth":
      return t("growth.addMeasurement");
    case "appointments":
      return entry.title || t("health.appointments");
    case "milestones":
      return entry.title;
    case "medicationLogs":
      return `${t("health.medication")} · ${entry.title}`;
    case "symptoms":
      return entry.title;
    default:
      return entry.title;
  }
}

export function entryDetail(
  entry: RecordRow,
  locale: Locale,
  timeZone: string,
  t: (key: string, values?: Record<string, string | number>) => string,
) {
  const meta = (entry.meta ?? {}) as Record<string, any>;
  const parts: string[] = [];
  if (entry.amount_ml) parts.push(`${entry.amount_ml} ml`);
  if (entry.entity === "feedings" && entry.kind === "breast") {
    const seconds = Number(meta.leftSeconds ?? 0) + Number(meta.rightSeconds ?? 0);
    if (seconds) parts.push(durationLabel(seconds));
  } else if (entry.duration_seconds) {
    parts.push(durationLabel(entry.duration_seconds));
  }
  if (entry.entity === "sleeps" && !entry.ended_at) parts.push(t("time.ongoing"));
  return parts.join(" · ");
}

export function TimelineList({
  entries,
  timeZone,
  locale,
  onEdit,
  showName = true,
}: {
  entries: RecordRow[];
  timeZone: string;
  locale: Locale;
  onEdit?: (entry: RecordRow) => void;
  showName?: boolean;
}) {
  const { t } = useT();
  if (!entries.length) return null;

  return (
    <ol className="relative space-y-1">
      {entries.map((entry) => {
        const Icon = iconFor[entry.entity] ?? Sparkles;
        const detail = entryDetail(entry, locale, timeZone, t);
        return (
          <li key={`${entry.entity}-${entry.id}`}>
            <button
              type="button"
              onClick={() => onEdit?.(entry)}
              className={`flex w-full items-start gap-3 rounded-[16px] p-2 text-start transition-colors ${
                onEdit ? "hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]" : "cursor-default"
              }`}
            >
              <span className={`grid h-10 w-10 flex-shrink-0 place-items-center rounded-full ${toneFor[entry.entity] ?? "bg-sage-soft"}`}>
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-bold">{entryTitle(entry, t)}</span>
                  <span className="flex-shrink-0 text-[11px] font-semibold tabular text-muted">
                    {formatTime(entry.occurred_at, locale, timeZone, "24h")}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted">
                  {[detail, entry.notes].filter(Boolean).join(" · ") || "—"}
                </span>
                {showName && entry.recorded_by_name ? (
                  <span className="mt-0.5 block text-[10px] text-muted">
                    {t("common.by")} {entry.recorded_by_name}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
