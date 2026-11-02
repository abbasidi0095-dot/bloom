import Link from "next/link";
import { getSessionUser, sha256 } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { getI18n } from "@/i18n/server";
import { AuthShell } from "@/components/auth-shell";
import { AcceptInvite } from "./accept-invite";

export const metadata = { title: "Family invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { dict } = await getI18n();
  const user = await getSessionUser();
  const invitation = await queryOne<{
    family_name: string;
    invited_email: string;
    invited_role: string;
    expires_at: string;
  }>(`select * from preview_family_invitation($1)`, [sha256(token)]).catch(() => null);

  if (!invitation) {
    return (
      <AuthShell title={dict["invite.title"]} subtitle={dict["invite.invalid"]}>
        <div className="space-y-3">
          <div className="rounded-[16px] border border-line bg-peach-soft p-4 text-sm">{dict["invite.invalid"]}</div>
          <Link href="/dashboard" className="btn btn-primary w-full">
            {dict["onboarding.goDashboard"]}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={dict["invite.title"]}
      subtitle={`${invitation.family_name} · ${dict[`common.${invitation.invited_role}`] ?? invitation.invited_role}`}
    >
      <AcceptInvite
        token={token}
        familyName={invitation.family_name}
        invitedEmail={invitation.invited_email}
        role={invitation.invited_role}
        sessionEmail={user?.email ?? null}
      />
    </AuthShell>
  );
}
