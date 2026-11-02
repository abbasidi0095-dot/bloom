import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { AuthShell } from "@/components/auth-shell";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  const { dict } = await getI18n();
  return (
    <AuthShell title={dict["auth.signUpTitle"]} subtitle={dict["auth.signUpSubtitle"]}>
      <SignupForm next={next} />
    </AuthShell>
  );
}
