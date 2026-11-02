import { getI18n } from "@/i18n/server";
import { AuthShell } from "@/components/auth-shell";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Choose a new password" };

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const { dict } = await getI18n();
  return (
    <AuthShell title={dict["auth.resetTitle"]} subtitle={dict["auth.forgotSubtitle"]}>
      <ResetForm token={token ?? ""} />
    </AuthShell>
  );
}
