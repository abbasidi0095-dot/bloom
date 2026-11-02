"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellRing,
  Download,
  Globe2,
  Loader2,
  LogOut,
  Palette,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useBaby } from "@/components/baby-provider";
import { useT } from "@/i18n/provider";
import { useToast } from "@/components/providers";
import { Field, PageHeader, Segmented, Sheet, Toggle } from "@/components/ui";
import { apiFetch, ApiClientError } from "@/lib/client";
import { formatTime } from "@/lib/format";
import { localeMeta, locales, type Locale } from "@/i18n/config";
import { disablePushNotifications, enablePushNotifications } from "@/lib/push";

const reminderTypes = ["feeding", "diaper", "medication", "sleep", "pumping", "appointment", "custom"] as const;
const days = [1, 2, 3, 4, 5, 6, 0];

export function SettingsView() {
  const { user, baby, family, locale, timezone, units, dateFormat, timeFormat, role, quietStart, quietEnd, pushEnabled, emailReminders } = useBaby();
  const { t } = useT();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState({
    locale,
    timezone,
    units,
    dateFormat,
    timeFormat,
    quietStart: quietStart ?? "",
    quietEnd: quietEnd ?? "",
    pushEnabled,
    emailReminders,
  });
  const [themeMode, setThemeMode] = useState<"light" | "dark">("light");
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderType, setReminderType] = useState<(typeof reminderTypes)[number]>("feeding");
  const [reminderLabel, setReminderLabel] = useState("");
  const [scheduleKind, setScheduleKind] = useState<"interval" | "daily">("interval");
  const [intervalMinutes, setIntervalMinutes] = useState(180);
  const [time, setTime] = useState("09:00");
  const [selectedDays, setSelectedDays] = useState<number[]>(days);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const [verification, setVerification] = useState<{ devLink?: string | null } | null>(null);

  const reminders = useQuery({
    queryKey: ["reminders", family.id],
    queryFn: () => apiFetch<{ reminders: any[] }>(`/api/reminders?familyId=${family.id}`),
  });

  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return [timezone, "UTC", "Europe/Paris", "America/New_York", "Asia/Dubai"];
    }
  }, [timezone]);

  useEffect(() => {
    setThemeMode(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/profile", {
        method: "PATCH",
        json: {
          name,
          ...prefs,
          theme: themeMode,
          quietStart: prefs.quietStart || null,
          quietEnd: prefs.quietEnd || null,
        },
      });
      document.cookie = `bloom_locale=${prefs.locale}; path=/; max-age=${365 * 86400}; samesite=lax`;
      document.cookie = `bloom_theme=${themeMode}; path=/; max-age=${365 * 86400}; samesite=lax`;
      localStorage.setItem("bloom-theme", document.documentElement.dataset.theme === "dark" ? "dark" : "light");
      toast(t("settings.savedChanges"));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function resendVerification() {
    try {
      const result = await apiFetch<{ devLink?: string | null; delivered?: boolean }>("/api/auth/resend", { method: "POST" });
      setVerification(result);
      toast(result.delivered ? t("auth.checkEmail") : t("auth.smtpMissing"), { tone: result.delivered ? "success" : "info" });
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : t("common.error"), { tone: "error" });
    }
  }

  async function signOutAll() {
    if (!window.confirm(t("common.signOut") + "?")) return;
    await apiFetch("/api/auth/logout-all", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function deleteAccount() {
    if (confirmDelete !== "DELETE") return;
    try {
      await apiFetch("/api/profile", { method: "DELETE", json: { confirm: "DELETE" } });
      toast(t("settings.accountDeleted"));
      router.push("/signup");
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : t("common.error"), { tone: "error" });
    }
  }

  async function addReminder(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/reminders", {
        method: "POST",
        json: {
          familyId: family.id,
          babyId: baby?.id ?? null,
          type: reminderType,
          label: reminderLabel || t(`reminders.types.${reminderType}`),
          scheduleKind,
          intervalMinutes: scheduleKind === "interval" ? intervalMinutes : null,
          times: scheduleKind === "daily" ? [time] : null,
          days: scheduleKind === "daily" ? selectedDays : null,
        },
      });
      toast(t("settings.reminderSaved"));
      setReminderOpen(false);
      setReminderLabel("");
      void queryClient.invalidateQueries({ queryKey: ["reminders", family.id] });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("common.error"));
    }
  }

  async function deleteReminder(id: string) {
    await apiFetch(`/api/reminders/${id}`, { method: "DELETE" });
    void queryClient.invalidateQueries({ queryKey: ["reminders", family.id] });
    toast(t("reminders.deleted"));
  }

  async function updatePush(enabled: boolean) {
    setPrefs((current) => ({ ...current, pushEnabled: enabled }));
    if (!enabled) {
      await disablePushNotifications();
      return;
    }
    const result = await enablePushNotifications();
    if (!result.ok) {
      toast(
        result.state === "not-installed"
          ? t("notifications.installTitle")
          : result.state === "denied"
            ? t("notifications.denied")
            : t("notifications.failed"),
        { tone: "error" },
      );
      setPrefs((current) => ({ ...current, pushEnabled: false }));
      return;
    }
    toast(t("notifications.enabled"));
  }

  function setTheme(next: "light" | "dark" | "system") {
    localStorage.setItem("bloom-theme", next);
    const dark = next === "dark" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }

  return (
    <div className="animate-fade-up">
      <PageHeader kicker={t("nav.settings")} title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <form onSubmit={saveProfile} className="space-y-4">
        {error ? <div className="rounded-[14px] bg-peach-soft p-3 text-sm">{error}</div> : null}

        <section id="account" className="card card-pad">
          <h2 className="section-title mb-3 flex items-center gap-2">
            <UserRound size={15} /> {t("settings.account")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("common.name")}>
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
            </Field>
            <Field label={t("common.email")}>
              <input className="input" value={user.email} readOnly disabled />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className={`badge ${user.email_verified_at ? "bg-sage-soft" : "bg-peach-soft"}`}>
              {user.email_verified_at ? t("settings.emailVerified") : t("auth.verificationBanner")}
            </span>
            {!user.email_verified_at ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={resendVerification}>
                {t("auth.verifyResend")}
              </button>
            ) : null}
            {verification?.devLink ? (
              <Link href={verification.devLink} className="text-[10px] font-bold text-accent-strong underline">
                {t("auth.devLink")}
              </Link>
            ) : null}
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-muted">{t("settings.privacyNote")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                await apiFetch("/api/auth/logout", { method: "POST" });
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOut size={14} />
              {t("common.signOut")}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={signOutAll}>
              {t("settings.signOutAll")}
            </button>
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="section-title mb-3 flex items-center gap-2">
            <Palette size={15} /> {t("settings.appearance")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("settings.language")}>
              <select className="select" value={prefs.locale} onChange={(event) => setPrefs({ ...prefs, locale: event.target.value as Locale })}>
                {locales.map((item) => (
                  <option key={item} value={item}>{localeMeta[item].native}</option>
                ))}
              </select>
            </Field>
            <Field label={t("settings.timezone")}>
              <select className="select" value={prefs.timezone} onChange={(event) => setPrefs({ ...prefs, timezone: event.target.value })}>
                {timezones.map((zone) => (
                  <option key={zone} value={zone}>{zone}</option>
                ))}
              </select>
            </Field>
            <Field label={t("settings.units")}>
              <select className="select" value={prefs.units} onChange={(event) => setPrefs({ ...prefs, units: event.target.value as "metric" | "imperial" })}>
                <option value="metric">{t("settings.metric")}</option>
                <option value="imperial">{t("settings.imperial")}</option>
              </select>
            </Field>
            <Field label={t("settings.dateFormat")}>
              <select className="select" value={prefs.dateFormat} onChange={(event) => setPrefs({ ...prefs, dateFormat: event.target.value })}>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="D MMMM YYYY">D MMMM YYYY</option>
              </select>
            </Field>
            <Field label={t("settings.timeFormat")}>
              <Segmented
                value={prefs.timeFormat}
                onChange={(value) => setPrefs({ ...prefs, timeFormat: value })}
                options={[
                  { value: "24h", label: "24h" },
                  { value: "12h", label: "12h" },
                ]}
              />
            </Field>
            <Field label={t("common.theme")}>
              <Segmented
                value={themeMode}
                onChange={(value) => { setThemeMode(value); setTheme(value); }}
                options={[
                  { value: "light", label: t("settings.themeLight") },
                  { value: "dark", label: t("settings.themeDark") },
                ]}
              />
            </Field>
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="section-title mb-3 flex items-center gap-2">
            <Bell size={15} /> {t("settings.notifications")}
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-[14px] border border-line p-3">
              <div>
                <div className="text-sm font-bold">{t("settings.pushEnabled")}</div>
                <div className="text-[10px] text-muted">{t("settings.quietHoursHint")}</div>
              </div>
              <Toggle
                checked={prefs.pushEnabled}
                onChange={(value) => {
                  void updatePush(value);
                }}
                label={t("settings.pushEnabled")}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-[14px] border border-line p-3">
              <div className="text-sm font-bold">{t("settings.emailReminders")}</div>
              <Toggle checked={prefs.emailReminders} onChange={(value) => setPrefs({ ...prefs, emailReminders: value })} label={t("settings.emailReminders")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("settings.quietStart")}>
                <input type="time" className="input" value={prefs.quietStart} onChange={(event) => setPrefs({ ...prefs, quietStart: event.target.value })} />
              </Field>
              <Field label={t("settings.quietEnd")}>
                <input type="time" className="input" value={prefs.quietEnd} onChange={(event) => setPrefs({ ...prefs, quietEnd: event.target.value })} />
              </Field>
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            {t("settings.saveChanges")}
          </button>
        </div>
      </form>

      <section className="card card-pad mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title flex items-center gap-2">
            <BellRing size={15} /> {t("settings.remindersTitle")}
          </h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReminderOpen(true)}>
            <Plus size={14} />
            {t("settings.addReminder")}
          </button>
        </div>
        <p className="mb-3 text-[10px] text-muted">{t("settings.reminderHint")}</p>
        {reminders.data?.reminders?.length ? (
          <ul className="space-y-2">
            {reminders.data.reminders.map((reminder) => (
              <li key={reminder.id} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface p-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-peach-soft"><Bell size={15} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold">{reminder.label}</div>
                  <div className="text-[10px] text-muted">
                    {reminder.schedule_kind === "interval"
                      ? t("settings.everyXMinutes", { count: reminder.interval_minutes })
                      : t("settings.dailyAt", { time: reminder.times?.[0] ?? "09:00" })}
                    {reminder.next_due_at ? ` · ${t("reminders.nextDue", { time: formatTime(reminder.next_due_at, locale, timezone, timeFormat) })}` : ""}
                  </div>
                </div>
                <button type="button" className="btn btn-ghost btn-icon" aria-label={t("settings.deleteReminder")} onClick={() => deleteReminder(reminder.id)}>
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">{t("settings.noReminders")}</p>
        )}
      </section>

      <section className="card card-pad mt-4">
        <h2 className="section-title mb-3 flex items-center gap-2">
          <Globe2 size={15} /> {t("settings.exportData")}
        </h2>
        <p className="mb-3 text-xs text-muted">{t("settings.exportHint")}</p>
        <div className="flex flex-wrap gap-2">
          {baby ? (
            <>
              <a
                className="btn btn-secondary btn-sm"
                href={`/api/export?babyId=${baby.id}&format=json&tz=${encodeURIComponent(timezone)}`}
                download
              >
                <Download size={14} />
                {t("settings.exportJson")}
              </a>
              <a
                className="btn btn-secondary btn-sm"
                href={`/api/export?babyId=${baby.id}&format=csv&tz=${encodeURIComponent(timezone)}`}
                download
              >
                <Download size={14} />
                {t("settings.exportCsv")}
              </a>
            </>
          ) : null}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link href="/family" className="btn btn-secondary btn-sm">{t("settings.familyManagement")}</Link>
          <Link href="/family" className="btn btn-secondary btn-sm">{t("settings.memberPermissions")}</Link>
        </div>
        <p className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-muted">
          <ShieldCheck size={13} className="mt-0.5" />
          {t("settings.privacyNote")}
        </p>
      </section>

      <section className="card card-pad mt-4 border-rose/40">
        <h2 className="section-title mb-3 text-accent-strong">{t("settings.danger")}</h2>
        <p className="text-xs text-muted">{t("settings.deleteAccountHint")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input className="input max-w-[220px]" placeholder={t("settings.deleteAccountConfirm")} value={confirmDelete} onChange={(event) => setConfirmDelete(event.target.value)} />
          <button type="button" className="btn btn-danger" onClick={deleteAccount} disabled={confirmDelete !== "DELETE"}>
            <Trash2 size={15} />
            {t("settings.deleteAccount")}
          </button>
        </div>
        <p className="mt-2 text-[10px] text-muted">{t("settings.deleteAccountWarning")}</p>
      </section>

      <Sheet open={reminderOpen} onClose={() => setReminderOpen(false)} title={t("settings.addReminder")} subtitle={t("settings.reminderHint")}>
        <form onSubmit={addReminder} className="space-y-4">
          {error ? <div className="rounded-[14px] bg-peach-soft p-3 text-sm">{error}</div> : null}
          <Field label={t("settings.reminderType")}>
            <select className="select" value={reminderType} onChange={(event) => setReminderType(event.target.value as typeof reminderType)}>
              {reminderTypes.map((item) => (
                <option key={item} value={item}>{t(`reminders.types.${item}`)}</option>
              ))}
            </select>
          </Field>
          <Field label={t("reminders.label")}>
            <input className="input" value={reminderLabel} onChange={(event) => setReminderLabel(event.target.value)} placeholder={t(`reminders.types.${reminderType}`)} maxLength={120} />
          </Field>
          <Field label={t("reminders.schedule")}>
            <Segmented
              value={scheduleKind}
              onChange={setScheduleKind}
              options={[
                { value: "interval", label: t("reminders.every") },
                { value: "daily", label: t("reminders.daily") },
              ]}
            />
          </Field>
          {scheduleKind === "interval" ? (
            <Field label={t("settings.everyXMinutes", { count: intervalMinutes })}>
              <input type="range" min={15} max={600} step={15} value={intervalMinutes} onChange={(event) => setIntervalMinutes(Number(event.target.value))} className="w-full accent-[var(--accent)]" />
              <div className="mt-1 text-xs font-bold">{intervalMinutes} min</div>
            </Field>
          ) : (
            <>
              <Field label={t("reminders.time")}>
                <input type="time" className="input" value={time} onChange={(event) => setTime(event.target.value)} />
              </Field>
              <div>
                <span className="label">{t("reminders.days")}</span>
                <div className="mt-2 flex flex-wrap gap-1">
                  {days.map((day) => (
                    <button
                      key={day}
                      type="button"
                      className={`chip ${selectedDays.includes(day) ? "chip-active" : ""}`}
                      onClick={() =>
                        setSelectedDays((current) =>
                          current.includes(day) ? current.filter((item) => item !== day) : [...current, day],
                        )
                      }
                    >
                      {new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 7 + day)))}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          <button type="submit" className="btn btn-primary btn-lg w-full">
            {t("common.save")}
          </button>
        </form>
      </Sheet>
    </div>
  );
}
