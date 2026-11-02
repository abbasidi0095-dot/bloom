import { getSessionUser } from "@/lib/auth";
import { getI18n } from "@/i18n/server";
import { AuthShell } from "@/components/auth-shell";
import { JoinForm } from "./join-form";

export const metadata = { title: "Join a family" };

export default async function JoinPage() {
  const user = await getSessionUser();
  const { dict } = await getI18n();
  return (
    <AuthShell title={dict["invite.codeTitle"]} subtitle={dict["invite.signInFirst"]}>
      <JoinForm sessionEmail={user?.email ?? null} />
    </AuthShell>
  );
}
