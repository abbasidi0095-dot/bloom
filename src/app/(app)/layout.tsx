import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getFamilyContext } from "@/lib/family";
import { BabyProvider } from "@/components/baby-provider";
import { AppShell } from "@/components/app-shell";
import { getLocale } from "@/i18n/server";
import { mailerConfigured } from "@/lib/email";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const context = await getFamilyContext(user.id);
  const locale = await getLocale();
  if (!context.family) redirect("/onboarding");

  return (
    <BabyProvider
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        email_verified_at: user.email_verified_at,
        avatar_url: user.avatar_url,
      }}
      families={context.families}
      family={context.family}
      baby={context.baby}
      role={context.family.role}
      locale={locale}
      timezone={user.timezone || "UTC"}
      units={user.units}
      dateFormat={user.date_format}
      timeFormat={user.time_format}
      theme={user.theme}
      quietStart={user.quiet_start}
      quietEnd={user.quiet_end}
      pushEnabled={user.push_enabled}
      emailReminders={user.email_reminders}
    >
      <AppShell smtpConfigured={mailerConfigured()}>{children}</AppShell>
    </BabyProvider>
  );
}
