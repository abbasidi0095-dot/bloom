import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getFamilyContext } from "@/lib/family";
import { getI18n } from "@/i18n/server";
import { AuthShell } from "@/components/auth-shell";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Set up your family" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const context = await getFamilyContext(user.id);
  if (context.family) redirect("/dashboard");
  const { dict } = await getI18n();
  return (
    <AuthShell
      wide
      title={dict["onboarding.title"]}
      subtitle={dict["onboarding.subtitle"]}
      footer={<span>{dict["app.tagline"]}</span>}
    >
      <OnboardingForm userName={user.name} />
    </AuthShell>
  );
}
