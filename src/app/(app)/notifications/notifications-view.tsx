"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Bell, Check, Loader2 } from "lucide-react";
import { useBaby } from "@/components/baby-provider";
import { useT } from "@/i18n/provider";
import { EmptyState, PageHeader } from "@/components/ui";
import { FeedingReminderPrompt } from "@/components/feeding-reminder-prompt";
import { useNotifications } from "@/hooks/use-records";
import { apiFetch } from "@/lib/client";
import { formatDateTime } from "@/lib/format";

export function NotificationsView() {
  const { timezone, locale } = useBaby();
  const { t } = useT();
  const queryClient = useQueryClient();
  const notifications = useNotifications();

  async function markAll() {
    await apiFetch("/api/notifications", { method: "PATCH", json: { all: true } });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function markOne(id: string) {
    await apiFetch("/api/notifications", { method: "PATCH", json: { id } });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        kicker={t("nav.home")}
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
        action={
          (notifications.data?.length ?? 0) > 0 ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={markAll}>
              <Check size={14} />
              {t("notifications.markAll")}
            </button>
          ) : null
        }
      />

      <div className="mb-4">
        <FeedingReminderPrompt showWhenOn />
      </div>

      <section className="card card-pad">
        {notifications.isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin text-muted" />
          </div>
        ) : notifications.data?.length ? (
          <ul className="divide-y divide-line">
            {notifications.data.map((item) => (
              <li key={item.id} className={`flex items-start gap-3 py-3 ${item.read_at ? "opacity-60" : ""}`}>
                <span className={`grid h-9 w-9 place-items-center rounded-full ${item.read_at ? "bg-surface" : "bg-peach-soft"}`}>
                  <Bell size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold">{item.title}</div>
                      <div className="text-[12px] text-muted">{item.body}</div>
                    </div>
                    {!item.read_at ? (
                      <button type="button" className="btn btn-ghost btn-icon" onClick={() => markOne(item.id)} aria-label={t("notifications.markAll")}>
                        <Check size={15} />
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-muted">
                    <span>{formatDateTime(item.created_at, locale, timezone)}</span>
                    {item.url ? (
                      <Link href={item.url} className="font-bold text-accent-strong underline underline-offset-2">
                        {t("common.viewAll")}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Bell size={20} />} title={t("notifications.empty")} body={t("settings.reminderHint")} />
        )}
      </section>
    </div>
  );
}
