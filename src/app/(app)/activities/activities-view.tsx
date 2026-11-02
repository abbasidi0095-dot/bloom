"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Bath,
  Footprints,
  Loader2,
  Milk,
  Plus,
  Sparkles,
  Star,
  Sun,
  ToyBrick,
  Utensils,
} from "lucide-react";
import { useBaby } from "@/components/baby-provider";
import { useT } from "@/i18n/provider";
import { useToast } from "@/components/providers";
import { Field, EmptyState, PageHeader, Segmented, Sheet } from "@/components/ui";
import { useCreateRecord, useRecords } from "@/hooks/use-records";
import { formatDate, formatTime } from "@/lib/format";
import { ApiClientError, uploadImage } from "@/lib/client";

type ActivityType = "bath" | "tummy" | "play" | "walk" | "vitamin" | "pumping" | "solid" | "custom";

const activityTypes: Array<{ value: ActivityType; key: string; icon: typeof Activity; tone: string }> = [
  { value: "bath", key: "activities.bath", icon: Bath, tone: "bg-sky-soft" },
  { value: "tummy", key: "activities.tummy", icon: Activity, tone: "bg-sage-soft" },
  { value: "play", key: "activities.play", icon: ToyBrick, tone: "bg-peach-soft" },
  { value: "walk", key: "activities.walk", icon: Sun, tone: "bg-sage-soft" },
  { value: "vitamin", key: "activities.vitamin", icon: Sparkles, tone: "bg-lavender-soft" },
  { value: "pumping", key: "activities.pumping", icon: Milk, tone: "bg-peach-soft" },
  { value: "solid", key: "activities.solid", icon: Utensils, tone: "bg-sky-soft" },
  { value: "custom", key: "activities.custom", icon: Footprints, tone: "bg-lavender-soft" },
];

const milestonePresets = [
  "activities.firstSmile",
  "activities.firstLaugh",
  "activities.firstRoll",
  "activities.firstSit",
  "activities.firstCrawl",
  "activities.firstSteps",
];

export function ActivitiesView() {
  const { baby, timezone, locale, canWrite } = useBaby();
  const { t } = useT();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [activityOpen, setActivityOpen] = useState(params.get("add") === "1");
  const [milestoneOpen, setMilestoneOpen] = useState(params.get("add") === "milestone");
  const [type, setType] = useState<ActivityType>("tummy");
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [endedAt, setEndedAt] = useState("");
  const [minutes, setMinutes] = useState("");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [achievedAt, setAchievedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const activities = useRecords("activities", { babyId: baby?.id, limit: 100 }, Boolean(baby));
  const milestones = useRecords("milestones", { babyId: baby?.id, limit: 100 }, Boolean(baby));
  const createActivity = useCreateRecord("activities");
  const createMilestone = useCreateRecord("milestones");

  useEffect(() => {
    if (activityOpen || milestoneOpen) router.replace("/activities");
  }, [activityOpen, milestoneOpen, router]);

  async function logQuick(next: ActivityType) {
    if (!baby || !canWrite) return;
    if (next === "pumping" || next === "solid" || next === "custom") {
      setType(next);
      setActivityOpen(true);
      return;
    }
    try {
      const result = await createActivity.mutateAsync({
        babyId: baby.id,
        type: next,
        startedAt: new Date().toISOString(),
      });
      toast(result.offline ? t("common.syncPending") : t("activities.activitySaved"));
      router.refresh();
    } catch {
      toast(t("common.error"), { tone: "error" });
    }
  }

  async function submitActivity(event: React.FormEvent) {
    event.preventDefault();
    if (!baby) return;
    setError("");
    setLoading(true);
    try {
      const start = new Date(startedAt);
      const startIso = Number.isNaN(start.getTime()) ? new Date().toISOString() : start.toISOString();
      let endIso = endedAt ? new Date(endedAt).toISOString() : null;
      if (!endIso && minutes) endIso = new Date(start.getTime() + Number(minutes) * 60000).toISOString();
      await createActivity.mutateAsync({
        babyId: baby.id,
        type,
        label: label || null,
        startedAt: startIso,
        endedAt: endIso,
        amountMl: amount ? Number(amount) : null,
        notes: notes || null,
      });
      toast(t("activities.activitySaved"));
      setActivityOpen(false);
      setNotes("");
      setLabel("");
      setAmount("");
      setMinutes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  async function submitMilestone(event: React.FormEvent) {
    event.preventDefault();
    if (!baby) return;
    setError("");
    setLoading(true);
    try {
      const date = new Date(achievedAt);
      await createMilestone.mutateAsync({
        babyId: baby.id,
        title,
        achievedAt: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
        photoUrl: photoUrl || null,
        notes: notes || null,
      });
      toast(t("activities.milestoneSaved"));
      setMilestoneOpen(false);
      setTitle("");
      setPhotoUrl("");
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  async function upload(file: File | null) {
    if (!file || !baby) return;
    setUploading(true);
    try {
      const result = await uploadImage(file, baby.id);
      setPhotoUrl(result.url);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("common.error"));
    } finally {
      setUploading(false);
    }
  }

  if (!baby) return null;

  return (
    <div className="animate-fade-up">
      <PageHeader
        kicker={t("nav.home")}
        title={t("activities.title")}
        subtitle={t("activities.subtitle")}
        action={
          canWrite ? (
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setError(""); setMilestoneOpen(true); }}>
                <Star size={14} />
                {t("activities.addMilestone")}
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => { setError(""); setActivityOpen(true); }}>
                <Plus size={14} />
                {t("activities.addActivity")}
              </button>
            </div>
          ) : null
        }
      />

      {canWrite ? (
        <section className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {activityTypes.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                type="button"
                className={`tile flex min-h-[92px] flex-col items-center justify-center gap-2 p-2 text-center ${item.tone}`}
                onClick={() => logQuick(item.value)}
              >
                <span className="grid h-9 w-9 place-items-center rounded-full bg-surface/80"><Icon size={16} /></span>
                <span className="text-[10px] font-bold">{t(item.key)}</span>
              </button>
            );
          })}
        </section>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="card card-pad">
          <h2 className="section-title mb-3">{t("activities.timeline")}</h2>
          {activities.isLoading ? (
            <div className="skeleton h-24" />
          ) : activities.data?.length ? (
            <ul className="divide-y divide-line">
              {activities.data.map((row) => {
                const Icon = activityTypes.find((item) => item.value === row.type)?.icon ?? Activity;
                return (
                  <li key={row.id} className="flex items-center gap-3 py-3">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-sage-soft"><Icon size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-bold">{row.label || t(`activities.${row.type}`)}</span>
                        <span className="text-[11px] tabular text-muted">{formatTime(row.started_at, locale, timezone, "24h")}</span>
                      </div>
                      <div className="text-[11px] text-muted">
                        {[row.amount_ml ? `${row.amount_ml} ml` : null, row.notes].filter(Boolean).join(" · ") || formatDate(row.started_at, locale, timezone)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={<Activity size={20} />} title={t("activities.noActivities")} body={t("activities.subtitle")} />
          )}
        </section>

        <section className="card card-pad">
          <h2 className="section-title mb-3">{t("activities.milestones")}</h2>
          {milestones.data?.length ? (
            <div className="grid grid-cols-2 gap-2">
              {milestones.data.map((row) => (
                <div key={row.id} className="rounded-[18px] border border-line bg-surface p-3">
                  {row.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.photo_url} alt={row.title} className="mb-2 h-24 w-full rounded-[12px] object-cover" />
                  ) : (
                    <div className="mb-2 grid h-24 place-items-center rounded-[12px] bg-lavender-soft">
                      <Star size={22} />
                    </div>
                  )}
                  <div className="text-xs font-bold">{row.title}</div>
                  <div className="mt-1 text-[10px] text-muted">{formatDate(row.achieved_at, locale, timezone)}</div>
                  {row.notes ? <div className="mt-1 line-clamp-2 text-[10px] text-muted">{row.notes}</div> : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Star size={20} />} title={t("activities.noMilestones")} body={t("activities.milestoneHint")} />
          )}
        </section>
      </div>

      <Sheet open={activityOpen} onClose={() => setActivityOpen(false)} title={t("activities.addActivity")} subtitle={t("activities.subtitle")}>
        <form onSubmit={submitActivity} className="space-y-4">
          {error ? <div className="rounded-[14px] bg-peach-soft p-3 text-sm">{error}</div> : null}
          <Segmented
            value={type}
            onChange={setType}
            options={activityTypes.map((item) => ({ value: item.value, label: t(item.key) }))}
          />
          {type === "custom" ? (
            <Field label={t("common.name")}>
              <input className="input" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={160} />
            </Field>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("common.start")}>
              <input type="datetime-local" className="input" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} />
            </Field>
            <Field label={t("common.duration")} hint="min">
              <input type="number" min="0" className="input" value={minutes} onChange={(event) => setMinutes(event.target.value)} />
            </Field>
          </div>
          {type === "pumping" || type === "solid" ? (
            <Field label={`${t("activities.pumpingAmount")}`}>
              <input type="number" min="0" className="input" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </Field>
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

      <Sheet open={milestoneOpen} onClose={() => setMilestoneOpen(false)} title={t("activities.addMilestone")} subtitle={t("activities.milestoneHint")}>
        <form onSubmit={submitMilestone} className="space-y-4">
          {error ? <div className="rounded-[14px] bg-peach-soft p-3 text-sm">{error}</div> : null}
          <div className="flex flex-wrap gap-1.5">
            {milestonePresets.map((key) => (
              <button key={key} type="button" className={`chip ${title === t(key) ? "chip-active" : ""}`} onClick={() => setTitle(t(key))}>
                {t(key)}
              </button>
            ))}
          </div>
          <Field label={t("activities.milestones")}>
            <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} />
          </Field>
          <Field label={t("activities.achievedOn")}>
            <input type="datetime-local" className="input" value={achievedAt} onChange={(event) => setAchievedAt(event.target.value)} />
          </Field>
          <Field label={t("activities.photo")} hint={t("common.optional")}>
            <div className="flex items-center gap-2">
              <input className="input" value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} placeholder="/api/files/…" />
              <label className="btn btn-secondary btn-sm cursor-pointer">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : null}
                {t("common.add")}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => upload(event.target.files?.[0] ?? null)} />
              </label>
            </div>
          </Field>
          <Field label={t("common.notes")}>
            <textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} />
          </Field>
          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading || !title}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {t("common.save")}
          </button>
        </form>
      </Sheet>
    </div>
  );
}
