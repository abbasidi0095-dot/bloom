"use client";

import type { ReactNode } from "react";
import { Baby, Droplets, Moon, ShieldCheck } from "lucide-react";
import { useT } from "@/i18n/provider";
import { LanguageSwitcher, ThemeToggle } from "./preferences";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const { t, locale } = useT();
  return (
    <div className="auth-wrap">
      <aside className="auth-art grain">
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-12">
          <div>
            <div className="font-display text-3xl">
              Bloom<span className="text-accent">.</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">{t("app.tagline")}</p>
          </div>

          <div className="space-y-3">
            <div className="max-w-sm rounded-[26px] border border-white/60 bg-paper/80 p-5 shadow-[var(--shadow-soft)] backdrop-blur">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                <Baby size={14} /> {t("nav.home")}
              </div>
              <div className="mt-4 flex items-end gap-2">
                <span className="font-display text-4xl">4</span>
                <span className="mb-1 text-xs text-muted">{t("units.months")}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-peach-soft p-3">
                  <UtensilsMini />
                  <div className="mt-2 text-[10px] font-bold text-muted">{t("feeding.title")}</div>
                </div>
                <div className="rounded-2xl bg-sky-soft p-3">
                  <Droplets size={16} />
                  <div className="mt-2 text-[10px] font-bold text-muted">{t("diaper.title")}</div>
                </div>
                <div className="rounded-2xl bg-lavender-soft p-3">
                  <Moon size={16} />
                  <div className="mt-2 text-[10px] font-bold text-muted">{t("sleep.title")}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted">
              <ShieldCheck size={14} />
              {t("settings.privacyNote")}
            </div>
          </div>

          <div className="text-xs text-muted">© {new Date().getFullYear()} Bloom</div>
        </div>
      </aside>

      <main className="flex min-h-dvh flex-col">
        <div className="auth-top flex items-center justify-between p-5 lg:justify-end">
          <div className="font-display text-2xl lg:hidden">
            Bloom<span className="text-accent">.</span>
          </div>
          <div className="flex items-center gap-1">
            <LanguageSwitcher current={locale} />
            <ThemeToggle />
          </div>
        </div>
        <div className={`flex flex-1 items-center justify-center px-5 pb-12 ${wide ? "w-full" : ""}`}>
          <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"}`}>
            <h1 className="text-[2.1rem] leading-tight">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p> : null}
            <div className="mt-7">{children}</div>
            {footer ? <div className="mt-6 text-center text-sm text-muted">{footer}</div> : null}
          </div>
        </div>
      </main>
    </div>
  );
}

function UtensilsMini() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M5 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M7 12v9M17 3c-2 2-3 4-3 7v3h3v8M17 3v10" />
    </svg>
  );
}
