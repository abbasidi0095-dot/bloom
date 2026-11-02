import { getI18n } from "@/i18n/server";
import { AuthShell } from "@/components/auth-shell";
import { VerifyEmail } from "./verify-email";

export const metadata = { title: "Verify email" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const { dict } = await getI18n();
  return (
    <AuthShell title={dict["auth.verifyTitle"]} subtitle={dict["auth.verifyBody"]}>
      <VerifyEmail token={token ?? ""} />
    </AuthShell>
  );
}
