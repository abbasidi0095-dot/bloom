"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Moon, Plus, Play, Square } from "lucide-react";
import { useBaby } from "@/components/baby-provider";
import { useT } from "@/i18n/provider";
import { useToast } from "@/components/providers";
import { Field, EmptyState, PageHeader, Segmented, Sheet, Stat } from "@/components/ui";
import { useCreateRecord, useRecords, useUpdateRecord } from "@/hooks/use-records";
import { durationLabel, endOfDay, formatTime, startOfDay, todayKey } from "@/lib/format";
import { ApiClientError } from "@/lib/client";

type SleepKind = "nap" | "night";

export function SleepView() {
  const { baby, timezone, locale, canWrite } = useBaby();
  const { t } = useT();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("add") === "1");
  const [kind, setKind] = useState<SleepKind>("nap");
  const [startedAt, setStartedAt] = useState(() => new Date(Date.now() - 3600000).toISOString().slice(0, 16));
  const [endedAt, setEndedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [quality, setQuality] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  const date = todayKey(timezone);
  const from = startOfDay(date, timezone).toISOString();
  const to = endOfDay(date, timezone).toISOString();
  const records = useRecords("sleeps", { babyId: baby?.id, from, to, limit: 100 }, Boolean(baby));
  const openRecords = useRecords("sleeps", { babyId: baby?.id, open: true, limit: 5 }, Boolean(baby));
  const create = useCreateRecord("sleeps");
  const update = useUpdateRecord("sleeps");

  useEffect(() => {
    if (open) router.replace("/sleep");
  }, [open, router]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const current = openRecords.data?.[0] ?? null;

  const stats = useMemo(() => {
    const list = records.data ?? [];
    let total = 0;
    let night = 0;
    let naps = 0;
    for (const row of list) {
      const end = row.ended_at ? new Date(row.ended_at).getTime() : now;
      const seconds = Math.max(0, Math.round((end - new Date(row.started_at).getTime()) / 1000));
      total += seconds;
      if (row.kind === "night") night += seconds;
      else naps += 1;
    }
    return { total, night, naps, avgNap: naps ? total / naps : 0 };
  }, [records.data, now]);

  async function startSleep(nextKind: SleepKind) {
    if (!baby) return;
    try {
      await create.mutateAsync({ babyId: baby.id, startedAt: new Date().toISOString(), kind: nextKind });
      toast(t("sleep.sleepStarted"));
      router.refresh();
    } catch {
      toast(t("common.error"), { tone: "error" });
    }
  }

  async function endSleep() {
    if (!current || !baby) return;
    setLoading(true);
    try {
      await update.mutateAsync({
        id: current.id,
        babyId: baby.id,
        data: {
          endedAt: new Date().toISOString(),
          quality: quality ? Number(quality) : null,
          notes: notes || null,
        },
      });
      toast(t("sleep.sleepEnded"));
      setNotes("");
      setQuality("");
      router.refresh();
    } catch {
      toast(t("common.error"), { tone: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!baby) return;
    setError("");
    setLoading(true);
    try {
      const start = new Date(startedAt);
      const end = new Date(endedAt);
      await create.mutateAsync({
        babyId: baby.id,
        kind,
        startedAt: start.toISOString(),
        endedAt: end.toISOString(),
        quality: quality ? Number(quality) : null,
        notes: notes || null,
      });
      toast(t("sleep.sleepEnded"));
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  if (!baby) return null;

  return (
    <div className="animate-fade-up">
      <PageHeader
        kicker={t("nav.home")}
        title={t("sleep.title")}
        subtitle={t("sleep.subtitle")}
        action={
          canWrite ? (
            <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
              <Plus size={16} />
              {t("sleep.addSleep")}
            </button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("sleep.totalSleep")} value={durationLabel(stats.total)} tone="lavender" />
        <Stat label={t("sleep.nightSleep")} value={durationLabel(stats.night)} tone="sky" />
        <Stat label={t("sleep.naps")} value={stats.naps} tone="peach" />
        <Stat label={t("sleep.avgNap")} value={durationLabel(stats.avgNap)} tone="sage" />
      </div>

      {canWrite ? (
        <section className="card card-pad mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`grid h-12 w-12 place-items-center rounded-full ${current ? "bg-lavender animate-soft-pulse" : "bg-sage-soft"}`}>
                <Moon size={20} />
              </span>
              <div>
                <div className="text-sm font-bold">
                  {current ? t("sleep.currentlySleeping") : t("dashboard.awake")}
                </div>
                <div className="text-[11px] text-muted">
                  {current
                    ? `${t("dashboard.asleepSince", { time: formatTime(current.started_at, locale, timezone, "24h") })} · ${durationLabel((now - new Date(current.started_at).getTime()) / 1000)}`
                    : t("sleep.sleepTimer")}
                </div>
              </div>
            </div>
            {current ? (
              <button type="button" className="btn btn-primary" onClick={endSleep} disabled={loading}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />}
                {t("sleep.endSleep")}
              </button>
            ) : (
              <div className="flex gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => startSleep("nap")}>
                  <Play size={15} />
                  {t("sleep.startNap")}
                </button>
                <button type="button" className="btn btn-primary" onClick={() => startSleep("night")}>
                  <Play size={15} />
                  {t("sleep.startNight")}
                </button>
              </div>
            )}
          </div>
        </section>
      ) : null}

      <section className="card card-pad mt-5">
        <h2 className="section-title mb-3">{t("sleep.sleepHistory")}</h2>
        {records.isLoading ? (
          <div className="skeleton h-24" />
        ) : records.data?.length ? (
          <ul className="divide-y divide-line">
            {records.data.map((record) => {
              const end = record.ended_at ? new Date(record.ended_at).getTime() : now;
              const seconds = (end - new Date(record.started_at).getTime()) / 1000;
              return (
                <li key={record.id} className="flex items-center gap-3 py-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-lavender-soft">
                    <Moon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-bold">{t(`sleep.${record.kind}`)}</span>
                      <span className="text-[11px] tabular text-muted">
                        {formatTime(record.started_at, locale, timezone, "24h")}
                        {record.ended_at ? ` – ${formatTime(record.ended_at, locale, timezone, "24h")}` : ""}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted">
                      {record.ended_at ? durationLabel(seconds) : t("time.ongoing")}
                      {record.notes ? ` · ${record.notes}` : ""}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<Moon size={20} />} title={t("sleep.noSleep")} body={t("sleep.subtitle")} />
        )}
      </section>

      <Sheet open={open} onClose={() => setOpen(false)} title={t("sleep.addManual")} subtitle={t("sleep.addManual")}>
        <form onSubmit={submit} className="space-y-4">
          {error ? <div className="rounded-[14px] bg-peach-soft p-3 text-sm">{error}</div> : null}
          <Segmented
            value={kind}
            onChange={setKind}
            label={t("sleep.title")}
            options={[
              { value: "nap", label: t("sleep.nap") },
              { value: "night", label: t("sleep.night") },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("common.start")}>
              <input type="datetime-local" className="input" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} />
            </Field>
            <Field label={t("common.end")}>
              <input type="datetime-local" className="input" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} />
            </Field>
          </div>
          <Field label={t("sleep.quality")}>
            <Segmented
              value={quality}
              onChange={setQuality}
              options={[
                { value: "", label: "—" },
                { value: "2", label: t("sleep.qualityPoor") },
                { value: "4", label: t("sleep.qualityGreat") },
              ]}
            />
          </Field>
          <Field label={t("common.notes")}>
            <textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} />
          </Field>
          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {t("common.save")}
          </button>
        </form>
      </Sheet>
    </div>
  );
}
