"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Baby, Family, Role } from "@/lib/family";
import type { Locale } from "@/i18n/config";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  email_verified_at: string | null;
  avatar_url?: string | null;
};

type ContextValue = {
  user: SessionUser;
  families: Family[];
  family: Family;
  baby: Baby | null;
  role: Role;
  locale: Locale;
  timezone: string;
  units: "metric" | "imperial";
  dateFormat: string;
  timeFormat: "12h" | "24h";
  theme: "light" | "dark" | "system";
  quietStart: string | null;
  quietEnd: string | null;
  pushEnabled: boolean;
  emailReminders: boolean;
  canWrite: boolean;
  canManage: boolean;
  selectBaby: (babyId: string) => void;
  selectFamily: (familyId: string) => void;
};

const BabyContext = createContext<ContextValue | null>(null);

export function BabyProvider({
  user,
  families,
  family,
  baby,
  role,
  locale,
  timezone,
  units,
  dateFormat,
  timeFormat,
  theme,
  quietStart,
  quietEnd,
  pushEnabled,
  emailReminders,
  children,
}: Omit<ContextValue, "canWrite" | "canManage" | "selectBaby" | "selectFamily"> & {
  children: ReactNode;
}) {
  const router = useRouter();
  const value = useMemo<ContextValue>(
    () => ({
      user,
      families,
      family,
      baby,
      role,
      locale,
      timezone,
      units,
      dateFormat,
      timeFormat,
      theme,
      quietStart,
      quietEnd,
      pushEnabled,
      emailReminders,
      canWrite: role === "owner" || role === "parent" || role === "caregiver",
      canManage: role === "owner" || role === "parent",
      selectBaby: (babyId: string) => {
        document.cookie = `bloom_baby=${encodeURIComponent(babyId)}; path=/; max-age=${365 * 86400}; samesite=lax`;
        router.refresh();
      },
      selectFamily: (familyId: string) => {
        document.cookie = `bloom_family=${encodeURIComponent(familyId)}; path=/; max-age=${365 * 86400}; samesite=lax`;
        document.cookie = "bloom_baby=; path=/; max-age=0; samesite=lax";
        router.push("/dashboard");
        router.refresh();
      },
    }),
    [user, families, family, baby, role, locale, timezone, units, dateFormat, timeFormat, theme, quietStart, quietEnd, pushEnabled, emailReminders, router],
  );
  return <BabyContext.Provider value={value}>{children}</BabyContext.Provider>;
}

export function useBaby() {
  const context = useContext(BabyContext);
  if (!context) throw new Error("useBaby must be used inside BabyProvider");
  return context;
}
