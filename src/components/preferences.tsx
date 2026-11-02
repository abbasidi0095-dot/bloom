"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Moon, Sun } from "lucide-react";
import { localeMeta, locales, type Locale } from "@/i18n/config";
import { useT } from "@/i18n/provider";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  useEffect(() => {
    const stored = (localStorage.getItem("bloom-theme") as "light" | "dark" | "system" | null) ?? "system";
    setTheme(stored);
  }, []);

  const apply = (next: "light" | "dark" | "system") => {
    setTheme(next);
    localStorage.setItem("bloom-theme", next);
    document.cookie = `bloom_theme=${next}; path=/; max-age=${365 * 86400}; samesite=lax`;
    const dark =
      next === "dark" ||
      (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  };

  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      onClick={() => apply(next)}
      aria-label="Toggle theme"
      title={theme}
    >
      <Icon size={18} />
      {!compact ? null : null}
    </button>
  );
}

export function LanguageSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  const { t } = useT();
  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">{t("common.language")}</span>
      <select
        className="select !min-h-[40px] !w-auto !rounded-full !py-1 !ps-3 !pe-8 text-xs font-bold"
        value={current}
        onChange={async (event) => {
          const locale = event.target.value;
          document.cookie = `bloom_locale=${locale}; path=/; max-age=${365 * 86400}; samesite=lax`;
          try {
            await fetch("/api/profile", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ locale }),
              credentials: "same-origin",
            });
          } catch {
            // language still switches locally
          }
          router.refresh();
        }}
      >
        {locales.map((locale) => (
          <option key={locale} value={locale}>
            {localeMeta[locale].native}
          </option>
        ))}
      </select>
    </label>
  );
}
