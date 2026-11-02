"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Baby as BabyIcon,
  BarChart3,
  Bell,
  ChevronDown,
  Clock3,
  CloudOff,
  Droplets,
  FileText,
  HeartPulse,
  Home,
  Moon,
  Plus,
  Ruler,
  Settings,
  Sparkles,
  Utensils,
  Users,
  X,
} from "lucide-react";
import { useBaby } from "./baby-provider";
import { Avatar, Sheet } from "./ui";
import { useT } from "@/i18n/provider";
import { useNotifications, useOfflineStatus, useRealtime } from "@/hooks/use-records";
import { ageFromDob } from "@/lib/format";

const primary = [
  { href: "/dashboard", key: "nav.home", icon: Home },
  { href: "/timeline", key: "nav.timeline", icon: Clock3 },
  { href: "/insights", key: "nav.insights", icon: BarChart3 },
  { href: "/reports", key: "nav.reports", icon: FileText },
  { href: "/settings", key: "nav.settings", icon: Settings },
];

const trackers = [
  { href: "/feeding", key: "feeding.title", icon: Utensils },
  { href: "/diaper", key: "diaper.title", icon: Droplets },
  { href: "/sleep", key: "sleep.title", icon: Moon },
  { href: "/growth", key: "growth.title", icon: Ruler },
  { href: "/health", key: "health.title", icon: HeartPulse },
  { href: "/activities", key: "activities.title", icon: Sparkles },
  { href: "/family", key: "family.title", icon: Users },
];

const quickActions = [
  { href: "/feeding?add=1", key: "feeding.title", icon: Utensils, tone: "bg-peach-soft" },
  { href: "/diaper?add=1", key: "diaper.title", icon: Droplets, tone: "bg-sky-soft" },
  { href: "/sleep?add=1", key: "sleep.title", icon: Moon, tone: "bg-lavender-soft" },
  { href: "/growth?add=1", key: "growth.title", icon: Ruler, tone: "bg-sage-soft" },
  { href: "/health?add=1", key: "health.title", icon: HeartPulse, tone: "bg-peach-soft" },
  { href: "/activities?add=1", key: "activities.title", icon: Activity, tone: "bg-sky-soft" },
  { href: "/activities?add=milestone", key: "activities.milestones", icon: Sparkles, tone: "bg-lavender-soft" },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5" aria-label="Bloom">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-peach-soft font-display text-lg text-accent">
        b
      </span>
      {!compact ? (
        <span className="font-display text-2xl tracking-tight">
          Bloom<span className="text-accent">.</span>
        </span>
      ) : null}
    </Link>
  );
}

function BabySwitcher({ onOpen }: { onOpen: () => void }) {
  const { baby, family, role } = useBaby();
  const { t } = useT();
  const age = baby
    ? ageFromDob(baby.date_of_birth, new Date(), "UTC")
    : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-[18px] border border-line bg-surface p-2.5 text-start transition-colors hover:border-accent/40"
    >
      <Avatar src={baby?.photo_url} name={baby?.first_name ?? family.name} size={42} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{baby?.first_name ?? family.name}</span>
        <span className="block truncate text-[11px] text-muted">
          {baby && age ? `${age.months} ${t("units.months")}` : t("dashboard.addFirstBaby")}
          {role !== "owner" ? ` · ${t(`common.${role}`)}` : ""}
        </span>
      </span>
      <ChevronDown size={16} className="text-muted" />
    </button>
  );
}

export function AppShell({ children, smtpConfigured }: { children: ReactNode; smtpConfigured: boolean }) {
  const { user, families, family, baby, role, selectBaby, selectFamily, theme } = useBaby();
  const { t } = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [switchOpen, setSwitchOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const { online, pending } = useOfflineStatus();
  const notifications = useNotifications();
  useRealtime(family.id);

  useEffect(() => {
    if (localStorage.getItem("bloom-theme")) return;
    const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [theme]);

  const unread = useMemo(
    () => (notifications.data ?? []).filter((item) => !item.read_at).length,
    [notifications.data],
  );

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="px-2">
          <Brand />
        </div>
        <div className="mt-5">
          <BabySwitcher onOpen={() => setSwitchOpen(true)} />
        </div>
        <nav className="mt-6 flex flex-col gap-1" aria-label="Main">
          {primary.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive(item.href)
                    ? "bg-peach-soft text-accent-strong"
                    : "text-muted hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] hover:text-ink"
                }`}
              >
                <Icon size={18} />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
        <div className="mt-6">
          <div className="section-title px-3">Trackers</div>
          <nav className="mt-2 flex flex-col gap-0.5" aria-label="Trackers">
            {trackers.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-[12px] px-3 py-2 text-[13px] font-semibold transition-colors ${
                    isActive(item.href)
                      ? "bg-sage-soft text-ink"
                      : "text-muted hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] hover:text-ink"
                  }`}
                >
                  <Icon size={16} />
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto rounded-[18px] border border-line bg-surface p-3">
          <div className="flex items-center gap-2.5">
            <Avatar src={user.avatar_url} name={user.name} size={36} />
            <div className="min-w-0">
              <div className="truncate text-xs font-bold">{user.name}</div>
              <div className="truncate text-[10px] text-muted">{user.email}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="mobile-header sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-4 py-3 backdrop-blur-xl lg:hidden">
          <Brand />
          <div className="flex items-center gap-1">
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => setSwitchOpen(true)} aria-label={t("common.selectBaby")}>
              <BabyIcon size={19} />
            </button>
            <Link href="/notifications" className="btn btn-ghost btn-icon relative" aria-label={t("notifications.title")}>
              <Bell size={19} />
              {unread ? <span className="absolute end-2 top-2 h-2 w-2 rounded-full bg-accent" /> : null}
            </Link>
          </div>
        </header>

        {!online ? (
          <div className="flex items-center justify-center gap-2 bg-sage-soft px-4 py-2 text-xs font-semibold text-ink">
            <CloudOff size={14} />
            {t("common.offlineNotice")}
            {pending ? <span className="rounded-full bg-surface px-2 py-0.5">{pending}</span> : null}
          </div>
        ) : null}
        {online && pending > 0 ? (
          <div className="flex items-center justify-center gap-2 bg-lavender-soft px-4 py-2 text-xs font-semibold">
            {t("common.syncPending")} · {pending}
          </div>
        ) : null}
        {!user.email_verified_at && smtpConfigured ? (
          <div className="flex flex-wrap items-center justify-center gap-2 bg-peach-soft px-4 py-2 text-xs font-semibold">
            {t("auth.verificationBanner")}
            <Link href="/settings#account" className="underline underline-offset-2">
              {t("settings.verifyEmail")}
            </Link>
          </div>
        ) : null}

        <main id="main" className="page">
          {children}
        </main>
      </div>

      <nav className="tabbar" aria-label="Main">
        <Link href="/dashboard" className="tab-item" aria-current={isActive("/dashboard") ? "page" : undefined}>
          <Home size={20} />
          {t("nav.home")}
        </Link>
        <Link href="/timeline" className="tab-item" aria-current={isActive("/timeline") ? "page" : undefined}>
          <Clock3 size={20} />
          {t("nav.timeline")}
        </Link>
        <div className="flex items-start justify-center">
          <button
            type="button"
            className="fab"
            aria-label={t("common.quickAdd")}
            onClick={() => setQuickOpen(true)}
          >
            <Plus size={26} />
          </button>
        </div>
        <Link href="/insights" className="tab-item" aria-current={isActive("/insights") ? "page" : undefined}>
          <BarChart3 size={20} />
          {t("nav.insights")}
        </Link>
        <Link href="/settings" className="tab-item" aria-current={isActive("/settings") ? "page" : undefined}>
          <Settings size={20} />
          {t("nav.settings")}
        </Link>
      </nav>

      <Sheet open={switchOpen} onClose={() => setSwitchOpen(false)} title={t("common.selectBaby")}>
        <div className="space-y-2">
          {family.babies.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                selectBaby(item.id);
                setSwitchOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-[16px] border p-3 text-start ${
                baby?.id === item.id ? "border-accent bg-peach-soft" : "border-line bg-surface"
              }`}
            >
              <Avatar src={item.photo_url} name={item.first_name} size={44} />
              <div>
                <div className="text-sm font-bold">{item.first_name}</div>
                <div className="text-[11px] text-muted">
                  {ageFromDob(item.date_of_birth, new Date(), "UTC").months} {t("units.months")}
                </div>
              </div>
            </button>
          ))}
          {families.length > 1 ? (
            <div className="pt-2">
              <div className="section-title mb-2">{t("family.title")}</div>
              {families.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    selectFamily(item.id);
                    setSwitchOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-[14px] border p-3 text-start text-sm ${
                    family.id === item.id ? "border-accent bg-peach-soft" : "border-line bg-surface"
                  }`}
                >
                  <span className="font-semibold">{item.name}</span>
                  <span className="chip">{t(`common.${item.role}`)}</span>
                </button>
              ))}
            </div>
          ) : null}
          <Link
            href="/family"
            onClick={() => setSwitchOpen(false)}
            className="btn btn-secondary mt-2 w-full"
          >
            <Users size={16} />
            {t("family.addBaby")}
          </Link>
        </div>
      </Sheet>

      <Sheet
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        title={t("dashboard.quickActions")}
        subtitle={t("dashboard.timelineHint")}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.href}
                type="button"
                onClick={() => {
                  setQuickOpen(false);
                  router.push(action.href);
                }}
                className={`tile flex min-h-[108px] flex-col items-start justify-between p-4 text-start ${action.tone}`}
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-surface/80 text-ink">
                  <Icon size={19} />
                </span>
                <span className="text-sm font-bold">{t(action.key)}</span>
              </button>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}
