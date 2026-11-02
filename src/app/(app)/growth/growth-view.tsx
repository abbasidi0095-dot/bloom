"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, Plus, Ruler } from "lucide-react";
import { useBaby } from "@/components/baby-provider";
import { useT } from "@/i18n/provider";
import { useToast } from "@/components/providers";
import { Field, EmptyState, PageHeader, Segmented, Sheet, Stat } from "@/components/ui";
import { useCreateRecord, useRecords } from "@/hooks/use-records";
import { formatDate } from "@/lib/format";
import { ApiClientError } from "@/lib/client";
import {
  ageInDays,
  bandsFor,
  measurementValue,
  percentile,
  valueAtZ,
  zBands,
  type Indicator,
} from "@/lib/who";

const indicators: Array<{ value: Indicator; key: string; unit: string; color: string }> = [
  { value: "wfa", key: "growth.weight", unit: "kg", color: "var(--accent)" },
  { value: "lfa", key: "growth.height", unit: "cm", color: "var(--sage)" },
  { value: "hcfa", key: "growth.head", unit: "cm", color: "var(--lavender)" },
];

export function GrowthView() {
  const { baby, timezone, locale, canWrite, units } = useBaby();
  const { t } = useT();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("add") === "1");
  const [indicator, setIndicator] = useState<Indicator>("wfa");
  const [measuredAt, setMeasuredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [head, setHead] = useState("");
  const [source, setSource] = useState<"measured" | "estimated">("measured");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const records = useRecords("growth", { babyId: baby?.id, limit: 300 }, Boolean(baby));
  const createRecord = useCreateRecord("growth");

  useEffect(() => {
    if (open) router.replace("/growth");
  }, [open, router]);

  const sorted = useMemo(
    () => [...(records.data ?? [])].sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime()),
    [records.data],
  );
  const latest = sorted[sorted.length - 1];
  const previous = sorted[sorted.length - 2];

  const current = indicators.find((item) => item.value === indicator)!;
  const maxAge = baby
    ? Math.max(
        90,
        ...sorted.map((row) => ageInDays(baby.date_of_birth, new Date(row.measured_at))),
      ) + 30
    : 365;

  const chartData = useMemo(() => {
    if (!baby) return [];
    const bands = bandsFor(indicator, baby.sex, maxAge, 15);
    const points = new Map<number, number>();
    for (const row of sorted) {
      const value = measurementValue(indicator, row);
      if (value === null) continue;
      points.set(ageInDays(baby.date_of_birth, new Date(row.measured_at)), value);
    }
    for (const [age, value] of points) {
      if (!bands.some((b) => b.ageDays === age)) {
        bands.push({
          ageDays: age,
          ageLabel: `${Math.round(age / 30.4375)}m`,
          p3: Number(valueAtZ(indicator, baby.sex, age, zBands.p3).toFixed(3)),
          p15: Number(valueAtZ(indicator, baby.sex, age, zBands.p15).toFixed(3)),
          p50: Number(valueAtZ(indicator, baby.sex, age, zBands.p50).toFixed(3)),
          p85: Number(valueAtZ(indicator, baby.sex, age, zBands.p85).toFixed(3)),
          p97: Number(valueAtZ(indicator, baby.sex, age, zBands.p97).toFixed(3)),
        });
      }
    }
    return bands
      .sort((a, b) => a.ageDays - b.ageDays)
      .map((band) => ({
        ...band,
        base: band.p3,
        range: Math.max(0, band.p97 - band.p3),
        measured: points.get(band.ageDays) ?? null,
      }));
  }, [baby, indicator, maxAge, sorted]);

  const latestPercentile =
    baby && latest && measurementValue(indicator, latest) !== null
      ? percentile(
          indicator,
          baby.sex,
          ageInDays(baby.date_of_birth, new Date(latest.measured_at)),
          measurementValue(indicator, latest)!,
        )
      : null;

  const displayWeight = (grams: number) =>
    units === "imperial" ? `${(grams / 453.592).toFixed(1)} lb` : `${(grams / 1000).toFixed(2)} kg`;
  const displayHeight = (cm: number) =>
    units === "imperial" ? `${(cm / 2.54).toFixed(1)} in` : `${Number(cm).toFixed(1)} cm`;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!baby) return;
    setError("");
    if (!weight && !height && !head) {
      setError(t("common.requiredField"));
      return;
    }
    setLoading(true);
    try {
      const date = new Date(measuredAt);
      await createRecord.mutateAsync({
        babyId: baby.id,
        measuredAt: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
        weightG: weight ? Math.round(Number(weight) * 1000) : null,
        heightCm: height ? Number(height) : null,
        headCircumferenceCm: head ? Number(head) : null,
        source,
        notes: notes || null,
      });
      toast(t("common.saved"));
      setWeight("");
      setHeight("");
      setHead("");
      setNotes("");
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
        title={t("growth.title")}
        subtitle={t("growth.subtitle")}
        action={
          canWrite ? (
            <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
              <Plus size={16} />
              {t("growth.addMeasurement")}
            </button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          label={t("growth.weight")}
          value={latest?.weight_g ? displayWeight(Number(latest.weight_g)) : "—"}
          hint={previous?.weight_g && latest?.weight_g ? `${latest.weight_g - previous.weight_g > 0 ? "+" : ""}${((latest.weight_g - previous.weight_g) / 1000).toFixed(2)} kg` : undefined}
          tone="peach"
        />
        <Stat
          label={t("growth.height")}
          value={latest?.height_cm ? displayHeight(Number(latest.height_cm)) : "—"}
          hint={previous?.height_cm && latest?.height_cm ? `${(latest.height_cm - previous.height_cm).toFixed(1)} cm` : undefined}
          tone="sage"
        />
        <Stat
          label={t("growth.head")}
          value={latest?.head_circumference_cm ? displayHeight(Number(latest.head_circumference_cm)) : "—"}
          hint={latest?.head_circumference_cm && latestPercentile ? `${Math.round(latestPercentile)}${t("growth.percentile")}` : undefined}
          tone="lavender"
        />
      </div>

      <section className="card card-pad mt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="section-title">{t("growth.chart")}</h2>
          <Segmented
            value={indicator}
            onChange={setIndicator}
            options={indicators.map((item) => ({ value: item.value, label: t(item.key) }))}
          />
        </div>
        {chartData.length ? (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="ageLabel" tickLine={false} axisLine={false} interval={Math.max(1, Math.floor(chartData.length / 8))} />
                <YAxis tickLine={false} axisLine={false} width={40} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{ borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="base" stackId="band" stroke="none" fill="transparent" />
                <Area type="monotone" dataKey="range" stackId="band" stroke="none" fill="var(--peach)" fillOpacity={0.18} />
                <Line type="monotone" dataKey="p97" dot={false} stroke="var(--peach)" strokeWidth={1} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="p50" dot={false} stroke="var(--muted)" strokeWidth={1.2} />
                <Line type="monotone" dataKey="p3" dot={false} stroke="var(--sage)" strokeWidth={1} strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="measured"
                  connectNulls
                  dot={{ r: 3, fill: current.color, strokeWidth: 0 }}
                  stroke={current.color}
                  strokeWidth={2.4}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState icon={<Ruler size={20} />} title={t("growth.noGrowth")} />
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted">
          <span>{t("growth.percentileBand")} · {t("growth.percentile")}: {latestPercentile ? `${Math.round(latestPercentile)}%` : "—"}</span>
          <span>{current.unit}</span>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted">{t("growth.whoNote")}</p>
      </section>

      <section className="card card-pad mt-5">
        <h2 className="section-title mb-3">{t("growth.measuredOn")}</h2>
        {records.isLoading ? (
          <div className="skeleton h-24" />
        ) : sorted.length ? (
          <ul className="divide-y divide-line">
            {[...sorted].reverse().map((row) => (
              <li key={row.id} className="flex items-center gap-3 py-3">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-sage-soft">
                  <Ruler size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold">{formatDate(row.measured_at, locale, timezone, "D MMMM YYYY")}</span>
                    <span className={`badge ${row.source === "estimated" ? "bg-lavender-soft" : "bg-sage-soft"}`}>
                      {row.source === "estimated" ? t("growth.estimated") : t("growth.measured")}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted">
                    {[
                      row.weight_g ? displayWeight(Number(row.weight_g)) : null,
                      row.height_cm ? displayHeight(Number(row.height_cm)) : null,
                      row.head_circumference_cm ? displayHeight(Number(row.head_circumference_cm)) : null,
                      row.notes,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Ruler size={20} />} title={t("growth.noGrowth")} body={t("growth.measuredHint")} />
        )}
      </section>

      <Sheet open={open} onClose={() => setOpen(false)} title={t("growth.addMeasurement")} subtitle={t("growth.measuredHint")}>
        <form onSubmit={submit} className="space-y-4">
          {error ? <div className="rounded-[14px] bg-peach-soft p-3 text-sm">{error}</div> : null}
          <Field label={t("growth.measuredOn")}>
            <input type="datetime-local" className="input" value={measuredAt} onChange={(event) => setMeasuredAt(event.target.value)} />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label={`${t("growth.weight")} (kg)`}>
              <input type="number" step="0.01" inputMode="decimal" className="input" value={weight} onChange={(event) => setWeight(event.target.value)} />
            </Field>
            <Field label={`${t("growth.height")} (cm)`}>
              <input type="number" step="0.1" inputMode="decimal" className="input" value={height} onChange={(event) => setHeight(event.target.value)} />
            </Field>
            <Field label={`${t("growth.head")} (cm)`}>
              <input type="number" step="0.1" inputMode="decimal" className="input" value={head} onChange={(event) => setHead(event.target.value)} />
            </Field>
          </div>
          <Field label={t("growth.source")}>
            <Segmented
              value={source}
              onChange={setSource}
              options={[
                { value: "measured", label: t("growth.measured") },
                { value: "estimated", label: t("growth.estimated") },
              ]}
            />
          </Field>
          <Field label={t("common.notes")}>
            <textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} />
          </Field>
          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {t("growth.saveMeasurement")}
          </button>
          <p className="text-[10px] leading-relaxed text-muted">{t("growth.notDiagnosis")}</p>
        </form>
      </Sheet>
    </div>
  );
}
