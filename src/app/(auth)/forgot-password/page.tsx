import { getI18n } from "@/i18n/server";
import { AuthShell } from "@/components/auth-shell";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "Reset password" };

export default async function ForgotPage() {
  const { dict } = await getI18n();
  return (
    <AuthShell title={dict["auth.forgotTitle"]} subtitle={dict["auth.forgotSubtitle"]}>
      <ForgotForm />
    </AuthShell>
  );
}
