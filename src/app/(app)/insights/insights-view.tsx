"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { useBaby } from "@/components/baby-provider";
import { useT } from "@/i18n/provider";
import { EmptyState, PageHeader, Segmented, Stat } from "@/components/ui";
import { useAnalytics } from "@/hooks/use-records";
import { addDaysKey, durationLabel, formatDate, todayKey } from "@/lib/format";

type Tab = "feeding" | "diapers" | "sleep" | "growth";
type Preset = "7" | "30" | "month" | "custom";

function chartStyle() {
  return {
    contentStyle: {
      borderRadius: 14,
      border: "1px solid var(--line)",
      background: "var(--surface)",
      fontSize: 12,
      color: "var(--ink)",
    },
    labelStyle: { color: "var(--muted)" },
  };
}

function Change({ current, previous, suffix = "" }: { current: number; previous: number; suffix?: string }) {
  if (!previous) return <span className="text-[10px] text-muted">—</span>;
  const change = current - previous;
  const positive = change >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${positive ? "text-sage" : "text-accent-strong"}`}>
      <Icon size={12} />
      {positive ? "+" : ""}
      {change.toFixed(1)}
      {suffix}
    </span>
  );
}

export function InsightsView() {
  const { baby, timezone, locale } = useBaby();
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("feeding");
  const [preset, setPreset] = useState<Preset>("7");
  const [to, setTo] = useState(() => todayKey(timezone));
  const [from, setFrom] = useState(() => addDaysKey(todayKey(timezone), -6));

  function choosePreset(next: Preset) {
    setPreset(next);
    const today = todayKey(timezone);
    if (next === "7") {
      setTo(today);
      setFrom(addDaysKey(today, -6));
    } else if (next === "30") {
      setTo(today);
      setFrom(addDaysKey(today, -29));
    } else if (next === "month") {
      setTo(today);
      setFrom(`${today.slice(0, 7)}-01`);
    }
  }

  const analytics = useAnalytics({ babyId: baby?.id, from, to, tz: timezone }, Boolean(baby));
  const data = analytics.data;

  const feedingSeries = useMemo(
    () =>
      (data?.feeding?.series ?? []).map((row: any) => ({
        ...row,
        label: String(row.date).slice(5),
        formula_ml: Number(row.formula_ml),
        expressed_ml: Number(row.expressed_ml),
        feeds: Number(row.feeds),
      })),
    [data],
  );
  const diaperSeries = useMemo(
    () =>
      (data?.diapers?.series ?? []).map((row: any) => ({
        ...row,
        label: String(row.date).slice(5),
        wet: Number(row.wet),
        dirty: Number(row.dirty),
      })),
    [data],
  );
  const sleepSeries = useMemo(
    () =>
      (data?.sleep?.series ?? []).map((row: any) => ({
        ...row,
        label: String(row.date).slice(5),
        hours: Number((Number(row.seconds) / 3600).toFixed(2)),
        night: Number((Number(row.night_seconds) / 3600).toFixed(2)),
      })),
    [data],
  );
  const growthSeries = useMemo(
    () =>
      (data?.growth?.series ?? []).map((row: any) => ({
        label: formatDate(row.measured_at, locale, timezone, "DD/MM"),
        weight: row.weight_g ? Number(row.weight_g) / 1000 : null,
        height: row.height_cm ? Number(row.height_cm) : null,
        head: row.head_circumference_cm ? Number(row.head_circumference_cm) : null,
      })),
    [data, locale, timezone],
  );

  const totalRecords =
    (data?.feeding?.totals?.feeds ?? 0) +
    (data?.diapers?.totals?.wet ?? 0) +
    (data?.diapers?.totals?.dirty ?? 0) +
    (data?.sleep?.series?.length ?? 0);

  const tip = chartStyle();

  return (
    <div className="animate-fade-up">
      <PageHeader kicker={t("nav.insights")} title={t("insights.title")} subtitle={t("insights.subtitle")} />

      <section className="card card-pad">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "feeding", label: t("insights.feedingTab") },
              { value: "diapers", label: t("insights.diapersTab") },
              { value: "sleep", label: t("insights.sleepTab") },
              { value: "growth", label: t("insights.growthTab") },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select className="select !min-h-[38px] !w-auto !py-1" value={preset} onChange={(event) => choosePreset(event.target.value as Preset)}>
              <option value="7">{t("common.last7")}</option>
              <option value="30">{t("common.last30")}</option>
              <option value="month">{t("common.thisMonth")}</option>
              <option value="custom">{t("common.custom")}</option>
            </select>
            {preset === "custom" ? (
              <div className="flex items-center gap-1">
                <input type="date" className="input !min-h-[38px] !w-auto !py-1" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
                <span className="text-xs text-muted">–</span>
                <input type="date" className="input !min-h-[38px] !w-auto !py-1" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
              </div>
            ) : (
              <span className="chip">
                {formatDate(from, locale, timezone)} – {formatDate(to, locale, timezone)}
              </span>
            )}
          </div>
        </div>
      </section>

      {analytics.isLoading ? (
        <div className="card card-pad mt-5 skeleton h-72" />
      ) : !totalRecords && tab !== "growth" ? (
        <div className="card card-pad mt-5">
          <EmptyState icon={<BarChart3 size={22} />} title={t("insights.noData")} body={t("insights.emptyChart")} />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {tab === "feeding" && data ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label={t("insights.feedsPerDay")} value={(data.feeding.totals.feeds / data.days).toFixed(1)} hint={`${data.feeding.totals.feeds} ${t("common.total").toLowerCase()}`} tone="peach" />
                <Stat label={t("insights.formulaVolume")} value={`${data.feeding.totals.formulaMl} ml`} hint={`${t("insights.averageShort")} ${Math.round(data.feeding.totals.formulaMl / data.days)} ml`} tone="sky" />
                <Stat label={t("insights.expressedVolume")} value={`${data.feeding.totals.expressedMl} ml`} tone="sage" />
                <Stat
                  label={t("insights.feedInterval")}
                  value={data.feeding.totals.avgIntervalSeconds ? durationLabel(data.feeding.totals.avgIntervalSeconds) : "—"}
                  hint={t("insights.comparedTo")}
                  tone="lavender"
                />
              </div>
              <section className="card card-pad">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="section-title">{t("insights.formulaVolume")} & {t("insights.feedsPerDay")}</h2>
                  <Change current={data.feeding.totals.feeds} previous={data.feeding.previous.feeds} />
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={feedingSeries} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={36} />
                      <Tooltip {...tip} />
                      <Bar dataKey="formula_ml" fill="var(--peach)" radius={[6, 6, 0, 0]} name={t("insights.formulaVolume")} />
                      <Bar dataKey="expressed_ml" fill="var(--sky)" radius={[6, 6, 0, 0]} name={t("insights.expressedVolume")} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </>
          ) : null}

          {tab === "diapers" && data ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label={t("insights.wetPerDay")} value={(data.diapers.totals.wet / data.days).toFixed(1)} tone="sky" />
                <Stat label={t("insights.dirtyPerDay")} value={(data.diapers.totals.dirty / data.days).toFixed(1)} tone="peach" />
                <Stat label={t("diaper.mixed")} value={data.diapers.totals.mixed} tone="lavender" />
                <Stat label={t("diaper.dry")} value={data.diapers.totals.dry} tone="sage" />
              </div>
              <section className="card card-pad">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="section-title">{t("diaper.weekChart")}</h2>
                  <Change current={data.diapers.totals.wet} previous={data.diapers.previous.wet} />
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={diaperSeries} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={30} />
                      <Tooltip {...tip} />
                      <Bar dataKey="wet" stackId="a" fill="var(--sky)" radius={[0, 0, 0, 0]} name={t("diaper.wet")} />
                      <Bar dataKey="dirty" stackId="a" fill="var(--peach)" radius={[6, 6, 0, 0]} name={t("diaper.dirty")} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </>
          ) : null}

          {tab === "sleep" && data ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label={t("insights.totalSleepPerDay")} value={`${(data.sleep.totals.seconds / 3600 / data.days).toFixed(1)} h`} tone="lavender" />
                <Stat label={t("sleep.nightSleep")} value={`${(data.sleep.totals.nightSeconds / 3600).toFixed(1)} h`} tone="sky" />
                <Stat label={t("sleep.naps")} value={data.sleep.totals.naps} tone="peach" />
                <Stat label={t("insights.avgNapDuration")} value={data.sleep.totals.naps ? durationLabel(data.sleep.totals.seconds / data.sleep.totals.naps) : "—"} tone="sage" />
              </div>
              <section className="card card-pad">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="section-title">{t("insights.totalSleepPerDay")}</h2>
                  <Change current={data.sleep.totals.seconds / 3600} previous={data.sleep.previous.seconds / 3600} suffix="h" />
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sleepSeries} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="sleepFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--lavender)" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="var(--lavender)" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={36} />
                      <Tooltip {...tip} />
                      <Area type="monotone" dataKey="hours" stroke="var(--lavender)" strokeWidth={2} fill="url(#sleepFill)" name={t("sleep.totalSleep")} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </>
          ) : null}

          {tab === "growth" && data ? (
            <section className="card card-pad">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="section-title">{t("growth.chart")}</h2>
                <span className="text-[10px] text-muted">{t("insights.growthHint")}</span>
              </div>
              {growthSeries.length ? (
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={growthSeries} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={40} />
                      <Tooltip {...tip} />
                      <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} connectNulls name={`${t("growth.weight")} (kg)`} />
                      <Line type="monotone" dataKey="height" stroke="var(--sage)" strokeWidth={2} dot={{ r: 3 }} connectNulls name={`${t("growth.height")} (cm)`} />
                      <Line type="monotone" dataKey="head" stroke="var(--lavender)" strokeWidth={2} dot={{ r: 3 }} connectNulls name={`${t("growth.head")} (cm)`} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState icon={<BarChart3 size={20} />} title={t("insights.noData")} body={t("insights.growthHint")} />
              )}
            </section>
          ) : null}

          <p className="text-[10px] text-muted">{t("insights.fromRecords", { count: totalRecords })}</p>
        </div>
      )}
    </div>
  );
}
