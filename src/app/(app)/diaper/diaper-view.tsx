"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Droplets, Loader2, Plus } from "lucide-react";
import { useBaby } from "@/components/baby-provider";
import { useT } from "@/i18n/provider";
import { useToast } from "@/components/providers";
import { Field, EmptyState, PageHeader, Segmented, Sheet, Stat } from "@/components/ui";
import { useAnalytics, useCreateRecord, useRecords } from "@/hooks/use-records";
import { addDaysKey, endOfDay, formatTime, startOfDay, todayKey } from "@/lib/format";
import { ApiClientError } from "@/lib/client";

type Kind = "wet" | "dirty" | "mixed" | "dry";

export function DiaperView() {
  const { baby, timezone, locale, canWrite } = useBaby();
  const { t } = useT();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("add") === "1");
  const [kind, setKind] = useState<Kind>("wet");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [urineAmount, setUrineAmount] = useState<"" | "small" | "medium" | "large">("");
  const [urineColor, setUrineColor] = useState("");
  const [consistency, setConsistency] = useState<"" | "watery" | "soft" | "normal" | "hard" | "mucus">("");
  const [stoolColor, setStoolColor] = useState<"" | "yellow" | "mustard" | "brown" | "green" | "other">("");
  const [stoolAmount, setStoolAmount] = useState<"" | "small" | "medium" | "large">("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const date = todayKey(timezone);
  const from = startOfDay(date, timezone).toISOString();
  const to = endOfDay(date, timezone).toISOString();
  const records = useRecords("diapers", { babyId: baby?.id, from, to, limit: 100 }, Boolean(baby));
  const analytics = useAnalytics(
    { babyId: baby?.id, from: addDaysKey(date, -6), to: date, tz: timezone },
    Boolean(baby),
  );
  const create = useCreateRecord("diapers");

  useEffect(() => {
    if (open) router.replace("/diaper");
  }, [open, router]);

  const stats = (records.data ?? []).reduce(
    (acc, row) => {
      if (row.kind === "wet" || row.kind === "mixed") acc.wet += 1;
      if (row.kind === "dirty" || row.kind === "mixed") acc.dirty += 1;
      if (row.kind === "dry") acc.dry += 1;
      acc.total += 1;
      return acc;
    },
    { wet: 0, dirty: 0, dry: 0, total: 0 },
  );

  const dailyAverage = analytics.data?.diapers?.totals
    ? ((analytics.data.diapers.totals.wet + analytics.data.diapers.totals.dirty) / 7).toFixed(1)
    : "—";

  async function quick(kind: Kind) {
    if (!baby || !canWrite) return;
    try {
      const result = await create.mutateAsync({ babyId: baby.id, kind, occurredAt: new Date().toISOString() });
      toast(result.offline ? t("common.syncPending") : t("diaper.saved"));
      router.refresh();
    } catch {
      toast(t("common.error"), { tone: "error" });
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!baby) return;
    setError("");
    setLoading(true);
    try {
      const start = new Date(occurredAt);
      await create.mutateAsync({
        babyId: baby.id,
        kind,
        occurredAt: Number.isNaN(start.getTime()) ? new Date().toISOString() : start.toISOString(),
        urineAmount: urineAmount || null,
        urineColor: urineColor || null,
        stoolConsistency: consistency || null,
        stoolColor: stoolColor || null,
        stoolAmount: stoolAmount || null,
        notes: notes || null,
      });
      toast(t("diaper.saved"));
      setOpen(false);
      setNotes("");
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
        title={t("diaper.title")}
        subtitle={t("diaper.subtitle")}
        action={
          canWrite ? (
            <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
              <Plus size={16} />
              {t("diaper.addDiaper")}
            </button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("diaper.wetToday")} value={stats.wet} tone="sky" />
        <Stat label={t("diaper.dirtyToday")} value={stats.dirty} tone="peach" />
        <Stat label={t("diaper.diapersToday")} value={stats.total} tone="sage" />
        <Stat label={t("diaper.weeklyAverage")} value={dailyAverage} tone="lavender" />
      </div>

      {canWrite ? (
        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["wet", "dirty", "mixed", "dry"] as Kind[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => quick(item)}
              disabled={create.isPending}
              className={`tile flex min-h-[112px] flex-col items-center justify-center gap-3 p-4 ${
                item === "wet" ? "bg-sky-soft" : item === "dirty" ? "bg-peach-soft" : item === "mixed" ? "bg-lavender-soft" : "bg-sage-soft"
              }`}
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-surface/80">
                <Droplets size={20} />
              </span>
              <span className="text-sm font-bold">{t(`diaper.${item}`)}</span>
              <span className="text-[10px] text-muted">{t("common.quickAdd")}</span>
            </button>
          ))}
        </section>
      ) : null}

      <section className="card card-pad mt-5">
        <h2 className="section-title mb-3">{t("diaper.history")}</h2>
        {records.isLoading ? (
          <div className="skeleton h-24" />
        ) : records.data?.length ? (
          <ul className="divide-y divide-line">
            {records.data.map((record) => (
              <li key={record.id} className="flex items-center gap-3 py-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-sky-soft">
                  <Droplets size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold">{t(`diaper.${record.kind}`)}</span>
                    <span className="text-[11px] tabular text-muted">
                      {formatTime(record.occurred_at, locale, timezone, "24h")}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted">
                    {[record.urine_amount, record.stool_consistency, record.stool_color, record.notes]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Droplets size={20} />} title={t("diaper.noDiapers")} body={t("diaper.subtitle")} />
        )}
      </section>

      <Sheet open={open} onClose={() => setOpen(false)} title={t("diaper.logDiaper")} subtitle={t("diaper.subtitle")}>
        <form onSubmit={submit} className="space-y-4">
          {error ? <div className="rounded-[14px] bg-peach-soft p-3 text-sm">{error}</div> : null}
          <Segmented
            value={kind}
            onChange={setKind}
            label={t("diaper.title")}
            options={[
              { value: "wet", label: t("diaper.wet") },
              { value: "dirty", label: t("diaper.dirty") },
              { value: "mixed", label: t("diaper.mixed") },
              { value: "dry", label: t("diaper.dry") },
            ]}
          />
          <Field label={t("common.time")}>
            <input
              type="datetime-local"
              className="input"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
            />
          </Field>
          {kind === "wet" || kind === "mixed" ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("diaper.urineAmount")}>
                <select className="select" value={urineAmount} onChange={(event) => setUrineAmount(event.target.value as typeof urineAmount)}>
                  <option value="">—</option>
                  <option value="small">{t("diaper.small")}</option>
                  <option value="medium">{t("diaper.medium")}</option>
                  <option value="large">{t("diaper.large")}</option>
                </select>
              </Field>
              <Field label={t("diaper.urineColor")}>
                <input className="input" value={urineColor} onChange={(event) => setUrineColor(event.target.value)} />
              </Field>
            </div>
          ) : null}
          {kind === "dirty" || kind === "mixed" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("diaper.consistency")}>
                  <select className="select" value={consistency} onChange={(event) => setConsistency(event.target.value as typeof consistency)}>
                    <option value="">—</option>
                    <option value="watery">{t("diaper.watery")}</option>
                    <option value="soft">{t("diaper.soft")}</option>
                    <option value="normal">{t("diaper.normal")}</option>
                    <option value="hard">{t("diaper.hard")}</option>
                    <option value="mucus">{t("diaper.mucus")}</option>
                  </select>
                </Field>
                <Field label={t("diaper.color")}>
                  <select className="select" value={stoolColor} onChange={(event) => setStoolColor(event.target.value as typeof stoolColor)}>
                    <option value="">—</option>
                    <option value="yellow">{t("diaper.yellow")}</option>
                    <option value="mustard">{t("diaper.mustard")}</option>
                    <option value="brown">{t("diaper.brown")}</option>
                    <option value="green">{t("diaper.green")}</option>
                    <option value="other">{t("diaper.other")}</option>
                  </select>
                </Field>
              </div>
              <Field label={t("diaper.stoolAmount")}>
                <select className="select" value={stoolAmount} onChange={(event) => setStoolAmount(event.target.value as typeof stoolAmount)}>
                  <option value="">—</option>
                  <option value="small">{t("diaper.small")}</option>
                  <option value="medium">{t("diaper.medium")}</option>
                  <option value="large">{t("diaper.large")}</option>
                </select>
              </Field>
            </>
          ) : null}
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
