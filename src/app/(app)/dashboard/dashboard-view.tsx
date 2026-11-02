"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Baby,
  Bell,
  Droplets,
  HeartPulse,
  Moon,
  Play,
  Ruler,
  Sparkles,
  Square,
  Utensils,
} from "lucide-react";
import { useBaby } from "@/components/baby-provider";
import { Avatar, EmptyState, PageHeader, Skeleton, Stat } from "@/components/ui";
import { TimelineList } from "@/components/timeline-list";
import { FeedingReminderPrompt } from "@/components/feeding-reminder-prompt";
import { useCreateRecord, useDashboard, useUpdateRecord } from "@/hooks/use-records";
import { useToast } from "@/components/providers";
import { useT } from "@/i18n/provider";
import { ageFromDob, durationLabel, formatDate, formatTime, todayKey } from "@/lib/format";

const quickActions = [
  { href: "/feeding?add=1", key: "feeding.title", icon: Utensils, tone: "bg-peach-soft" },
  { href: "/diaper?add=1", key: "diaper.title", icon: Droplets, tone: "bg-sky-soft" },
  { href: "/sleep?add=1", key: "sleep.title", icon: Moon, tone: "bg-lavender-soft" },
  { href: "/growth?add=1", key: "growth.title", icon: Ruler, tone: "bg-sage-soft" },
  { href: "/health?add=1", key: "health.title", icon: HeartPulse, tone: "bg-peach-soft" },
  { href: "/activities?add=1", key: "activities.title", icon: Activity, tone: "bg-sky-soft" },
  { href: "/activities?add=milestone", key: "activities.milestones", icon: Sparkles, tone: "bg-lavender-soft" },
];

export function DashboardView() {
  const { baby, timezone, locale, canWrite } = useBaby();
  const { t } = useT();
  const toast = useToast();
  const router = useRouter();
  const [date] = useState(() => todayKey(timezone));
  const [greeting, setGreeting] = useState("dashboard.greetingMorning");
  const dashboard = useDashboard({ babyId: baby?.id, date, tz: timezone }, Boolean(baby));
  const createRecord = useCreateRecord("diapers");
  const createSleep = useCreateRecord("sleeps");
  const updateSleep = useUpdateRecord("sleeps");

  useEffect(() => {
    const hour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(new Date()),
    );
    setGreeting(hour < 12 ? "dashboard.greetingMorning" : hour < 18 ? "dashboard.greetingAfternoon" : "dashboard.greetingEvening");
  }, [timezone]);

  const data = dashboard.data;
  const age = baby ? ageFromDob(baby.date_of_birth, new Date(), timezone) : null;
  const openSleep = data?.openSleep as any;

  const dirtyAgo = useMemo(() => {
    if (!data?.lastDiaper?.occurred_at) return null;
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(data.lastDiaper.occurred_at).getTime()) / 60000));
    if (minutes < 1) return t("common.justNow");
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }, [data?.lastDiaper, t]);

  const fedAgo = useMemo(() => {
    if (!data?.lastFeed?.started_at) return null;
    const diff = Date.now() - new Date(data.lastFeed.started_at).getTime();
    const minutes = Math.max(0, Math.floor(diff / 60000));
    if (minutes < 1) return t("common.justNow");
    return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }, [data?.lastFeed, t]);

  async function oneTapDiaper(kind: "wet" | "dirty") {
    if (!baby || !canWrite) return;
    try {
      const result = await createRecord.mutateAsync({ babyId: baby.id, kind, occurredAt: new Date().toISOString() });
      toast(result.offline ? t("common.syncPending") : t("diaper.saved"));
      router.refresh();
    } catch {
      toast(t("common.error"), { tone: "error" });
    }
  }

  async function toggleSleep() {
    if (!baby || !canWrite) return;
    try {
      if (openSleep) {
        await updateSleep.mutateAsync({ id: openSleep.id, babyId: baby.id, data: { endedAt: new Date().toISOString() } });
        toast(t("sleep.sleepEnded"));
      } else {
        await createSleep.mutateAsync({ babyId: baby.id, startedAt: new Date().toISOString(), kind: "nap" });
        toast(t("sleep.sleepStarted"));
      }
      router.refresh();
    } catch {
      toast(t("common.error"), { tone: "error" });
    }
  }

  if (!baby) {
    return (
      <div>
        <PageHeader title={t("app.name")} subtitle={t("dashboard.babyProfileHint")} />
        <EmptyState
          icon={<Baby size={22} />}
          title={t("dashboard.addFirstBaby")}
          body={t("dashboard.babyProfileHint")}
          action={
            <Link href="/family" className="btn btn-primary">
              {t("common.addBaby")}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        kicker={formatDate(new Date(), locale, timezone, "D MMMM YYYY")}
        title={t(greeting)}
        subtitle={t("dashboard.timelineHint")}
        action={
          <Link href="/reports" className="btn btn-secondary btn-sm hidden sm:inline-flex">
            {t("nav.reports")}
            <ArrowRight size={14} />
          </Link>
        }
      />

      <section className="card overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.05fr_1fr]">
          <div className="bg-[color-mix(in_srgb,var(--peach-soft)_55%,var(--bg-elev))] p-6 lg:p-8">
            <div className="flex items-center gap-4">
              <Avatar src={baby.photo_url} name={baby.first_name} size={72} />
              <div>
                <h2 className="text-3xl">{baby.first_name}</h2>
                <p className="mt-1 text-xs text-muted">
                  {age ? `${age.months} ${t("units.months")}, ${age.days} ${t("units.days")}` : ""}
                  {" · "}
                  {baby.sex === "female" ? t("onboarding.sexFemale") : baby.sex === "male" ? t("onboarding.sexMale") : ""}
                </p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-[18px] bg-surface/80 p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                  <Utensils size={12} /> {t("dashboard.lastFeeding")}
                </div>
                <div className="mt-2 font-display text-2xl">{fedAgo ?? t("dashboard.never")}</div>
                <div className="mt-1 text-[10px] text-muted">
                  {data?.lastFeed ? t(`feeding.${data.lastFeed.type}`) : ""}
                </div>
              </div>
              <div className="rounded-[18px] bg-surface/80 p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                  <Droplets size={12} /> {t("dashboard.lastDiaper")}
                </div>
                <div className="mt-2 font-display text-2xl">
                  {dirtyAgo ?? t("dashboard.never")}
                </div>
                <div className="mt-1 text-[10px] text-muted">
                  {data?.lastDiaper ? t(`diaper.${data.lastDiaper.kind}`) : ""}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-[18px] bg-surface/80 p-4">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${openSleep ? "bg-lavender animate-soft-pulse" : "bg-sage"}`} />
                <span className="text-sm font-bold">
                  {openSleep ? t("dashboard.sleepingNow") : t("dashboard.awake")}
                </span>
                {openSleep ? (
                  <span className="text-[11px] text-muted">
                    {t("dashboard.asleepSince", { time: formatTime(openSleep.started_at, locale, timezone, "24h") })}
                  </span>
                ) : null}
              </div>
              {canWrite ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={toggleSleep}>
                  {openSleep ? <Square size={13} /> : <Play size={13} />}
                  {openSleep ? t("sleep.endSleep") : t("sleep.startSleep")}
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-5 lg:p-7">
            <Stat
              label={t("dashboard.dailyFeeding")}
              value={data?.feeding?.sessions ?? "—"}
              hint={data?.feeding ? `${data.feeding.formula_ml} ml ${t("feeding.formula")}` : undefined}
              tone="peach"
            />
            <Stat
              label={t("dashboard.dailyDiapers")}
              value={data?.diapers?.total ?? "—"}
              hint={data?.diapers ? `${data.diapers.wet} ${t("diaper.wet")} · ${data.diapers.dirty} ${t("diaper.dirty")}` : undefined}
              tone="sky"
            />
            <Stat
              label={t("dashboard.dailySleep")}
              value={data?.sleep ? durationLabel(data.sleep.seconds) : "—"}
              hint={data?.sleep ? `${data.sleep.naps} ${t("sleep.naps")}` : undefined}
              tone="lavender"
            />
            <Stat
              label={t("dashboard.nextReminder")}
              value={
                data?.reminders?.[0]?.next_due_at
                  ? formatTime(data.reminders[0].next_due_at, locale, timezone, "24h")
                  : "—"
              }
              hint={data?.reminders?.[0]?.label ?? t("dashboard.noReminders")}
              tone="sage"
            />
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">{t("dashboard.quickActions")}</h2>
          <span className="text-[11px] text-muted">{t("common.quickAdd")}</span>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className={`tile flex min-h-[92px] flex-col items-center justify-center gap-2 p-2 text-center ${action.tone}`}
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-surface/80">
                  <Icon size={17} />
                </span>
                <span className="text-[10px] font-bold leading-tight">{t(action.key)}</span>
              </Link>
            );
          })}
        </div>
        {canWrite ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => oneTapDiaper("wet")}
              disabled={createRecord.isPending}
            >
              <Droplets size={16} />
              {t("diaper.wet")} · {t("common.quickAdd")}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => oneTapDiaper("dirty")}
              disabled={createRecord.isPending}
            >
              <Droplets size={16} />
              {t("diaper.dirty")} · {t("common.quickAdd")}
            </button>
          </div>
        ) : null}
      </section>

      <div className="mt-6">
        <FeedingReminderPrompt />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="card card-pad">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">{t("dashboard.todayLog")}</h2>
            <Link href="/timeline" className="text-[11px] font-bold text-accent-strong hover:underline">
              {t("common.viewAll")}
            </Link>
          </div>
          {dashboard.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-1/3" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : data?.timeline?.length ? (
            <TimelineList entries={data.timeline} timeZone={timezone} locale={locale} showName={false} />
          ) : (
            <EmptyState icon={<Sparkles size={20} />} title={t("dashboard.noActivity")} />
          )}
        </section>

        <aside className="space-y-4">
          <section className="card card-pad">
            <h2 className="section-title mb-3">{t("dashboard.nextReminder")}</h2>
            {data?.reminders?.length ? (
              <div className="space-y-2">
                {data.reminders.map((reminder: any) => (
                  <div key={reminder.id} className="flex items-center justify-between rounded-[14px] border border-line bg-surface p-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-peach-soft">
                        <Bell size={14} />
                      </span>
                      <div>
                        <div className="text-xs font-bold">{reminder.label}</div>
                        <div className="text-[10px] text-muted">{t(`reminders.types.${reminder.type}`)}</div>
                      </div>
                    </div>
                    <div className="text-xs font-bold tabular text-muted">
                      {reminder.next_due_at
                        ? formatTime(reminder.next_due_at, locale, timezone, "24h")
                        : "—"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<Bell size={18} />} title={t("dashboard.noReminders")} body={t("settings.reminderHint")} />
            )}
          </section>

          <section className="card card-pad">
            <h2 className="section-title mb-3">{t("family.title")}</h2>
            <Link href="/family" className="btn btn-secondary w-full">
              {t("family.inviteMember")}
              <ArrowRight size={16} />
            </Link>
            <Link href="/reports" className="btn btn-ghost mt-2 w-full">
              {t("reports.builder")}
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
