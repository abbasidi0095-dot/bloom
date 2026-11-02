"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useBaby } from "@/components/baby-provider";
import { useT } from "@/i18n/provider";
import { useToast } from "@/components/providers";
import { EmptyState, Field, PageHeader, Segmented, Sheet } from "@/components/ui";
import { entryTitle, TimelineList } from "@/components/timeline-list";
import { useDeleteRecord, useTimeline, useUpdateRecord, type RecordRow } from "@/hooks/use-records";
import {
  addDaysKey,
  dayKey,
  endOfDay,
  formatDate,
  formatMonth,
  formatWeekday,
  startOfDay,
  startOfWeekKey,
  todayKey,
} from "@/lib/format";

type View = "day" | "week" | "month";

const filters = [
  { value: "all", key: "timeline.filterAll" },
  { value: "feedings", key: "feeding.title" },
  { value: "diapers", key: "diaper.title" },
  { value: "sleeps", key: "sleep.title" },
  { value: "activities", key: "activities.title" },
  { value: "growth", key: "growth.title" },
  { value: "milestones", key: "activities.milestones" },
  { value: "temperatures", key: "health.temperature" },
  { value: "medicationLogs", key: "health.medications" },
];

export function TimelineView() {
  const { baby, timezone, locale, canWrite } = useBaby();
  const { t } = useT();
  const toast = useToast();
  const router = useRouter();
  const [day, setDay] = useState(() => todayKey(timezone));
  const [view, setView] = useState<View>("day");
  const [entity, setEntity] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RecordRow | null>(null);
  const [notes, setNotes] = useState("");
  const [time, setTime] = useState("");
  const [amount, setAmount] = useState("");
  const [endTime, setEndTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const range = useMemo(() => {
    if (view === "day") return { from: day, to: day };
    if (view === "week") {
      const start = startOfWeekKey(day);
      return { from: start, to: addDaysKey(start, 6) };
    }
    const start = `${day.slice(0, 7)}-01`;
    const end = new Date(`${start}T12:00:00Z`);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(0);
    return { from: start, to: end.toISOString().slice(0, 10) };
  }, [view, day]);

  const fromIso = startOfDay(range.from, timezone).toISOString();
  const toIso = endOfDay(range.to, timezone).toISOString();
  const timeline = useTimeline(
    { babyId: baby?.id, from: fromIso, to: toIso, entity, search, limit: 1000, order: "asc" },
    Boolean(baby),
  );
  const update = useUpdateRecord(selected?.entity ?? "feedings");
  const remove = useDeleteRecord(selected?.entity ?? "feedings");

  const grouped = useMemo(() => {
    const map = new Map<string, RecordRow[]>();
    for (const entry of timeline.data ?? []) {
      const key = dayKey(entry.occurred_at, timezone);
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [timeline.data, timezone]);

  function openEntry(entry: RecordRow) {
    setSelected(entry);
    const date = new Date(entry.occurred_at);
    const pad = (value: number) => String(value).padStart(2, "0");
    setTime(
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`,
    );
    setEndTime(
      entry.ended_at
        ? (() => {
            const end = new Date(entry.ended_at);
            return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
          })()
        : "",
    );
    setNotes(entry.notes ?? "");
    setAmount(entry.amount_ml ? String(entry.amount_ml) : "");
    setError("");
  }

  async function save() {
    if (!selected || !baby) return;
    setSaving(true);
    setError("");
    try {
      const iso = (value: string) => {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
      };
      const payload: Record<string, unknown> = { notes: notes || null };
      const timeIso = iso(time);
      if (timeIso) {
        if (["feedings", "sleeps", "activities"].includes(selected.entity)) payload.startedAt = timeIso;
        else if (["diapers", "symptoms"].includes(selected.entity)) payload.occurredAt = timeIso;
        else if (["temperatures", "growth"].includes(selected.entity)) payload.measuredAt = timeIso;
        else if (selected.entity === "milestones") payload.achievedAt = timeIso;
        else if (selected.entity === "medicationLogs") payload.givenAt = timeIso;
      }
      if (endTime && ["sleeps", "activities", "feedings"].includes(selected.entity)) {
        const endIso = iso(endTime);
        if (endIso) payload.endedAt = endIso;
      }
      if (amount && ["feedings", "activities"].includes(selected.entity)) payload.amountMl = Number(amount);
      await update.mutateAsync({ id: selected.id, babyId: baby.id, data: payload });
      toast(t("timeline.entrySaved"));
      setSelected(null);
      router.refresh();
    } catch {
      setError(t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function destroy() {
    if (!selected || !baby) return;
    if (!window.confirm(t("timeline.deleteConfirm"))) return;
    setSaving(true);
    try {
      await remove.mutateAsync({ id: selected.id, babyId: baby.id });
      toast(t("timeline.entryDeleted"));
      setSelected(null);
      router.refresh();
    } catch {
      setError(t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  if (!baby) return null;

  const dates =
    view === "day"
      ? Array.from({ length: 7 }, (_, index) => addDaysKey(day, index - 3))
      : [];

  return (
    <div className="animate-fade-up">
      <PageHeader
        kicker={t("nav.timeline")}
        title={t("timeline.title")}
        subtitle={t("timeline.subtitle")}
        action={
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "day", label: t("timeline.dayView") },
              { value: "week", label: t("timeline.weekView") },
              { value: "month", label: t("timeline.monthView") },
            ]}
          />
        }
      />

      <section className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              aria-label={t("timeline.older")}
              onClick={() => setDay(addDaysKey(day, view === "month" ? -30 : view === "week" ? -7 : -1))}
            >
              <ChevronLeft size={18} className="rtl:rotate-180" />
            </button>
            <div className="min-w-[160px] text-center">
              <div className="text-sm font-bold">
                {view === "month" ? formatMonth(day, locale, timezone) : formatDate(range.from, locale, timezone, "D MMMM YYYY")}
              </div>
              <div className="text-[10px] text-muted">
                {view === "day"
                  ? formatWeekday(day, locale, timezone)
                  : `${formatDate(range.from, locale, timezone)} – ${formatDate(range.to, locale, timezone)}`}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              aria-label={t("timeline.newer")}
              onClick={() => setDay(addDaysKey(day, view === "month" ? 30 : view === "week" ? 7 : 1))}
            >
              <ChevronRight size={18} className="rtl:rotate-180" />
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDay(todayKey(timezone))}>
              {t("common.today")}
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <CalendarDays size={15} />
            <input type="date" className="input !min-h-[38px] !w-auto !py-1" value={day} onChange={(event) => setDay(event.target.value)} />
          </label>
        </div>

        {view === "day" ? (
          <div className="mt-4 grid grid-cols-7 gap-1">
            {dates.map((date) => {
              const active = date === day;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setDay(date)}
                  className={`rounded-[14px] border p-2 text-center transition-colors ${
                    active ? "border-accent bg-peach-soft" : "border-line bg-surface hover:border-accent/40"
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase text-muted">{formatWeekday(date, locale, timezone)}</div>
                  <div className={`mt-1 text-sm font-bold tabular ${active ? "text-accent-strong" : ""}`}>{date.slice(8)}</div>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input !min-h-[40px] ps-10"
              placeholder={t("timeline.searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select className="select !min-h-[40px] !w-auto" value={entity} onChange={(event) => setEntity(event.target.value)}>
            {filters.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {t(filter.key)}
              </option>
            ))}
          </select>
          {(search || entity !== "all") ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSearch(""); setEntity("all"); }}>
              {t("timeline.clearFilters")}
            </button>
          ) : null}
        </div>
      </section>

      <section className="mt-5 space-y-4">
        {timeline.isLoading ? (
          <div className="card card-pad space-y-3">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="skeleton h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-1/3" />
                  <div className="skeleton h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : grouped.length ? (
          grouped.map(([date, entries]) => (
            <section key={date} className="card card-pad">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold">{formatDate(date, locale, timezone, "D MMMM YYYY")}</h2>
                <span className="text-[11px] text-muted">{t("timeline.count", { count: entries.length })}</span>
              </div>
              <TimelineList
                entries={entries}
                timeZone={timezone}
                locale={locale}
                onEdit={canWrite ? openEntry : undefined}
              />
            </section>
          ))
        ) : (
          <div className="card card-pad">
            <EmptyState
              icon={<CalendarDays size={20} />}
              title={search || entity !== "all" ? t("timeline.noSearch") : t("timeline.noEntries")}
              action={
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setSearch(""); setEntity("all"); }}
                >
                  {t("timeline.clearFilters")}
                </button>
              }
            />
          </div>
        )}
      </section>

      <Sheet open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? entryTitle(selected, t) : t("timeline.editEntry")} subtitle={selected ? formatDate(selected.occurred_at, locale, timezone, "D MMMM YYYY") : undefined}>
        {selected ? (
          <div className="space-y-4">
            {error ? <div className="rounded-[14px] bg-peach-soft p-3 text-sm">{error}</div> : null}
            <Field label={t("common.time")}>
              <input type="datetime-local" className="input" value={time} onChange={(event) => setTime(event.target.value)} />
            </Field>
            {["sleeps", "activities", "feedings"].includes(selected.entity) ? (
              <Field label={t("common.end")} hint={t("common.optional")}>
                <input type="datetime-local" className="input" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
              </Field>
            ) : null}
            {["feedings", "activities"].includes(selected.entity) ? (
              <Field label={`${t("feeding.amount")} (ml)`}>
                <input type="number" className="input" value={amount} onChange={(event) => setAmount(event.target.value)} />
              </Field>
            ) : null}
            <Field label={t("common.notes")}>
              <textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} />
            </Field>
            <div className="flex items-center justify-between gap-2">
              <button type="button" className="btn btn-danger" onClick={destroy} disabled={saving}>
                <Trash2 size={15} />
                {t("common.delete")}
              </button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Pencil size={15} />}
                {t("common.save")}
              </button>
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
