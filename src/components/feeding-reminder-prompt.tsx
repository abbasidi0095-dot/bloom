"use client";

import { useEffect, useState } from "react";
import { BellRing, Loader2, Smartphone } from "lucide-react";
import { useT } from "@/i18n/provider";
import { useToast } from "@/components/providers";
import { enablePushNotifications, getPushState, type PushState } from "@/lib/push";

export function FeedingReminderPrompt({ showWhenOn = false }: { showWhenOn?: boolean }) {
  const { t } = useT();
  const toast = useToast();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void getPushState().then((next) => {
      if (alive) setState(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const result = await enablePushNotifications();
      setState(result.state);
      toast(result.ok ? t("notifications.enabled") : t("notifications.failed"), {
        tone: result.ok ? "success" : "error",
      });
    } catch {
      toast(t("notifications.failed"), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;
  if (state === "on" && !showWhenOn) return null;

  return (
    <section className="card card-pad border-peach/40 bg-[color-mix(in_srgb,var(--peach-soft)_45%,var(--bg-elev))]">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-surface text-accent shadow-[var(--shadow-soft)]">
          <BellRing size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">{t("notifications.feedingTitle")}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">{t("notifications.feedingBody")}</p>

          {state === "on" ? (
            <div className="mt-3 flex items-center gap-2 rounded-[12px] bg-sage-soft px-3 py-2 text-xs font-bold">
              <BellRing size={14} />
              {t("notifications.enabled")}
            </div>
          ) : null}

          {state === "off" && (
            <button type="button" className="btn btn-primary mt-3 w-full sm:w-auto" onClick={enable} disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <BellRing size={16} />}
              {t("notifications.enable")}
            </button>
          )}

          {state === "no-key" ? (
            <p className="mt-2 text-[11px] text-muted">{t("notifications.unsupported")}</p>
          ) : null}

          {state === "denied" ? (
            <p className="mt-3 rounded-[12px] bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted">
              {t("notifications.denied")}
            </p>
          ) : null}

          {state === "unsupported" ? (
            <p className="mt-3 rounded-[12px] bg-surface px-3 py-2 text-[11px] leading-relaxed text-muted">
              {t("notifications.unsupported")}
            </p>
          ) : null}

          {state === "not-installed" && (
            <div className="mt-3 rounded-[14px] bg-surface p-3">
              <div className="flex items-center gap-2 text-xs font-bold">
                <Smartphone size={15} />
                {t("notifications.installTitle")}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">{t("notifications.installBody")}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
