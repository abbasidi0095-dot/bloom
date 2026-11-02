import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  const { dict } = await getI18n();
  return (
    <AuthShell
      title={dict["auth.signInTitle"]}
      subtitle={dict["auth.signInSubtitle"]}
      footer={<span>{dict["app.tagline"]}</span>}
    >
      <Suspense fallback={<div className="skeleton h-72 w-full" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
