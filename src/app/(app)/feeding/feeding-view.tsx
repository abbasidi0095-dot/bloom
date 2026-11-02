"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock3, Loader2, Pause, Play, Plus, RotateCcw, Utensils } from "lucide-react";
import { useBaby } from "@/components/baby-provider";
import { useT } from "@/i18n/provider";
import { useToast } from "@/components/providers";
import { Field, EmptyState, PageHeader, Segmented, Sheet, Stat } from "@/components/ui";
import { useCreateRecord, useRecords } from "@/hooks/use-records";
import { durationLabel, endOfDay, formatTime, startOfDay, todayKey } from "@/lib/format";
import { ApiClientError } from "@/lib/client";

type FeedType = "breast" | "formula" | "expressed";
const quickAmounts = [30, 60, 90, 120, 150, 180, 210, 240];
const timerKey = "bloom-feeding-timer";

type TimerState = {
  startedAt: string;
  side: "left" | "right";
  running: boolean;
  left: number;
  right: number;
  updatedAt: number;
};

export function FeedingView() {
  const { baby, timezone, locale, canWrite } = useBaby();
  const { t } = useT();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("add") === "1");
  const [type, setType] = useState<FeedType>("breast");
  const [timer, setTimer] = useState<TimerState | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(120);
  const [brand, setBrand] = useState("");
  const [water, setWater] = useState("");
  const [powder, setPowder] = useState("");
  const [bottle, setBottle] = useState("");
  const [storage, setStorage] = useState("");
  const [notes, setNotes] = useState("");
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString().slice(0, 16));

  const date = todayKey(timezone);
  const from = startOfDay(date, timezone).toISOString();
  const to = endOfDay(date, timezone).toISOString();
  const records = useRecords("feedings", { babyId: baby?.id, from, to, limit: 100 }, Boolean(baby));
  const create = useCreateRecord("feedings");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(timerKey);
      if (raw) {
        const parsed = JSON.parse(raw) as TimerState;
        if (parsed.running && parsed.updatedAt) {
          const elapsed = Math.max(0, Math.floor((Date.now() - parsed.updatedAt) / 1000));
          parsed[parsed.side] += elapsed;
          parsed.updatedAt = Date.now();
          localStorage.setItem(timerKey, JSON.stringify(parsed));
        }
        setTimer(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!timer?.running) return;
    const interval = setInterval(() => {
      setTimer((current) => {
        if (!current?.running) return current;
        const next = {
          ...current,
          [current.side]: current[current.side] + 1,
          updatedAt: Date.now(),
        } as TimerState;
        localStorage.setItem(timerKey, JSON.stringify(next));
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timer?.running, timer?.side]);

  useEffect(() => {
    if (open) router.replace("/feeding");
  }, [open, router]);

  const totals = useMemo(() => {
    const list = records.data ?? [];
    return {
      sessions: list.length,
      formula: list.filter((r) => r.type === "formula").reduce((sum, r) => sum + Number(r.amount_ml ?? 0), 0),
      expressed: list.filter((r) => r.type === "expressed").reduce((sum, r) => sum + Number(r.amount_ml ?? 0), 0),
      breast: list.filter((r) => r.type === "breast").reduce((sum, r) => sum + Number(r.left_seconds ?? 0) + Number(r.right_seconds ?? 0), 0),
    };
  }, [records.data]);

  function reset() {
    setTimer(null);
    localStorage.removeItem(timerKey);
    setAmount(120);
    setBrand("");
    setWater("");
    setPowder("");
    setBottle("");
    setStorage("");
    setNotes("");
    setError("");
  }

  async function finishTimer() {
    if (!baby || !timer) return;
    const endedAt = new Date().toISOString();
    setLoading(true);
    try {
      await create.mutateAsync({
        babyId: baby.id,
        type: "breast",
        startedAt: timer.startedAt,
        endedAt,
        leftSeconds: timer.left,
        rightSeconds: timer.right,
        lastSide: timer.left > timer.right ? "left" : timer.right > timer.left ? "right" : "both",
        segments: [],
      });
      toast(t("feeding.saved"));
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!baby) return;
    setError("");
    if ((type === "formula" || type === "expressed") && (!Number.isFinite(amount) || amount <= 0)) {
      setError(t("common.requiredField"));
      return;
    }
    setLoading(true);
    try {
      const start = new Date(startedAt);
      const payload: Record<string, unknown> = {
        babyId: baby.id,
        type,
        startedAt: Number.isNaN(start.getTime()) ? new Date().toISOString() : start.toISOString(),
        endedAt: new Date().toISOString(),
        notes: notes || null,
      };
      if (type === "formula" || type === "expressed") payload.amountMl = amount;
      if (type === "formula") {
        payload.formulaBrand = brand || null;
        payload.waterMl = water ? Number(water) : null;
        payload.powderG = powder ? Number(powder) : null;
        payload.bottleType = bottle || null;
        payload.storageLocation = storage || null;
      }
      if (type === "expressed") payload.storageLocation = storage || null;
      await create.mutateAsync(payload as { babyId: string });
      toast(t("feeding.saved"));
      reset();
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
        title={t("feeding.title")}
        subtitle={t("feeding.subtitle")}
        action={
          canWrite ? (
            <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
              <Plus size={16} />
              {t("feeding.logFeeding")}
            </button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("feeding.sessions")} value={totals.sessions} tone="peach" />
        <Stat label={t("feeding.todayFormula")} value={`${totals.formula} ml`} tone="sky" />
        <Stat label={t("feeding.todayExpressed")} value={`${totals.expressed} ml`} tone="sage" />
        <Stat label={t("feeding.breastTime")} value={durationLabel(totals.breast)} tone="lavender" />
      </div>

      {canWrite ? (
        <section className="card card-pad mt-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">{t("feeding.timer")}</h2>
            <span className="chip">{t("feeding.breast")}</span>
          </div>
          {!timer ? (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-[22px] bg-peach-soft p-6 text-center">
              <p className="max-w-sm text-xs leading-relaxed text-muted">{t("feeding.breastHint")}</p>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() =>
                  setTimer({
                    startedAt: new Date().toISOString(),
                    side: "left",
                    running: true,
                    left: 0,
                    right: 0,
                    updatedAt: Date.now(),
                  })
                }
              >
                <Play size={18} />
                {t("feeding.startTimer")}
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-[22px] bg-peach-soft p-5">
              <div className="flex items-center justify-center gap-8">
                <button
                  type="button"
                  onClick={() => setTimer({ ...timer, side: "left" })}
                  className={`flex h-24 w-24 flex-col items-center justify-center rounded-full border-2 transition-all ${
                    timer.side === "left" ? "border-accent bg-surface" : "border-transparent bg-surface/50"
                  }`}
                  aria-pressed={timer.side === "left"}
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{t("feeding.left")}</span>
                  <span className="mt-1 font-display text-xl tabular">{formatSeconds(timer.left)}</span>
                </button>
                <div className="text-center">
                  <div className="font-display text-4xl tabular">{formatSeconds(timer.left + timer.right)}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted">
                    {timer.running ? t("feeding.running") : t("feeding.paused")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTimer({ ...timer, side: "right" })}
                  className={`flex h-24 w-24 flex-col items-center justify-center rounded-full border-2 transition-all ${
                    timer.side === "right" ? "border-accent bg-surface" : "border-transparent bg-surface/50"
                  }`}
                  aria-pressed={timer.side === "right"}
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{t("feeding.right")}</span>
                  <span className="mt-1 font-display text-xl tabular">{formatSeconds(timer.right)}</span>
                </button>
              </div>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setTimer({ ...timer, running: !timer.running })}
                >
                  {timer.running ? <Pause size={14} /> : <Play size={14} />}
                  {timer.running ? t("feeding.pause") : t("feeding.resume")}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setTimer({ ...timer, side: timer.side === "left" ? "right" : "left" })}
                >
                  <RotateCcw size={14} />
                  {t("feeding.switchSide")}
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={finishTimer} disabled={loading}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Clock3 size={14} />}
                  {t("feeding.finishAndSave")}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
                  {t("feeding.discard")}
                </button>
              </div>
            </div>
          )}
        </section>
      ) : null}

      <section className="card card-pad mt-5">
        <h2 className="section-title mb-3">{t("feeding.history")}</h2>
        {records.isLoading ? (
          <div className="skeleton h-24" />
        ) : records.data?.length ? (
          <ul className="divide-y divide-line">
            {records.data.map((record) => (
              <li key={record.id} className="flex items-center gap-3 py-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-peach-soft">
                  <Utensils size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold">{t(`feeding.${record.type}`)}</span>
                    <span className="text-[11px] tabular text-muted">
                      {formatTime(record.started_at, locale, timezone, "24h")}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted">
                    {[
                      record.type === "breast"
                        ? durationLabel(Number(record.left_seconds) + Number(record.right_seconds))
                        : record.amount_ml
                          ? `${record.amount_ml} ml`
                          : null,
                      record.formula_brand,
                      record.notes,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Utensils size={20} />} title={t("feeding.noFeedings")} body={t("feeding.breastHint")} />
        )}
      </section>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("feeding.logFeeding")}
        subtitle={t("feeding.formulaHint")}
      >
        <form onSubmit={submit} className="space-y-4">
          {error ? <div className="rounded-[14px] bg-peach-soft p-3 text-sm">{error}</div> : null}
          <Segmented
            value={type}
            onChange={setType}
            label={t("feeding.title")}
            options={[
              { value: "breast", label: t("feeding.breast") },
              { value: "formula", label: t("feeding.formula") },
              { value: "expressed", label: t("feeding.expressed") },
            ]}
          />
          {type === "breast" ? (
            <div className="rounded-[18px] bg-peach-soft p-4 text-sm leading-relaxed text-ink">
              {t("feeding.breastHint")}
              <button
                type="button"
                className="btn btn-primary mt-3 w-full"
                onClick={() => {
                  setOpen(false);
                  if (!timer) {
                    setTimer({
                      startedAt: new Date().toISOString(),
                      side: "left",
                      running: true,
                      left: 0,
                      right: 0,
                      updatedAt: Date.now(),
                    });
                  }
                }}
              >
                <Play size={16} />
                {t("feeding.startTimer")}
              </button>
            </div>
          ) : (
            <>
              <Field label={t("feeding.amount")}>
                <div className="grid grid-cols-4 gap-2">
                  {quickAmounts.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`rounded-[14px] border px-1 py-2.5 text-center transition-colors ${
                        amount === value
                          ? "border-accent bg-peach-soft text-accent-strong"
                          : "border-line bg-surface text-ink"
                      }`}
                      onClick={() => setAmount(value)}
                    >
                      <span className="block text-lg font-extrabold tabular">{value}</span>
                      <span className="text-[10px] font-bold text-muted">ml</span>
                    </button>
                  ))}
                </div>
                <div className="relative mt-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min={1}
                    max={3000}
                    className="input pe-12 text-center text-xl font-extrabold tabular"
                    value={amount}
                    onChange={(event) => setAmount(Number(event.target.value))}
                    required
                  />
                  <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">
                    ml
                  </span>
                </div>
                <p className="hint mt-1">{type === "formula" ? t("feeding.formulaHint") : t("feeding.expressedHint")}</p>
              </Field>

              <details className="rounded-[16px] border border-line bg-surface p-3">
                <summary className="cursor-pointer text-xs font-bold text-muted">{t("common.details")}</summary>
                <div className="mt-3 space-y-3">
                  <Field label={t("feeding.startedAt")}>
                    <input
                      type="datetime-local"
                      className="input"
                      value={startedAt}
                      onChange={(event) => setStartedAt(event.target.value)}
                    />
                  </Field>
                  {type === "formula" ? (
                    <>
                      <Field label={t("feeding.formulaBrand")}>
                        <input className="input" value={brand} onChange={(event) => setBrand(event.target.value)} />
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label={`${t("feeding.water")} (ml)`}>
                          <input type="number" inputMode="numeric" className="input" value={water} onChange={(event) => setWater(event.target.value)} />
                        </Field>
                        <Field label={`${t("feeding.powder")} (g)`}>
                          <input type="number" inputMode="numeric" className="input" value={powder} onChange={(event) => setPowder(event.target.value)} />
                        </Field>
                      </div>
                      <Field label={t("feeding.bottleType")}>
                        <input className="input" value={bottle} onChange={(event) => setBottle(event.target.value)} />
                      </Field>
                    </>
                  ) : (
                    <Field label={t("feeding.storage")}>
                      <input className="input" value={storage} onChange={(event) => setStorage(event.target.value)} placeholder="Fridge" />
                    </Field>
                  )}
                  <Field label={t("common.notes")}>
                    <textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} />
                  </Field>
                </div>
              </details>
            </>
          )}
          {type !== "breast" ? (
            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {t("common.save")}
            </button>
          ) : null}
        </form>
      </Sheet>
    </div>
  );
}

function formatSeconds(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
