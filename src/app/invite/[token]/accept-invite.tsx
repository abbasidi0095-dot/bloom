"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2, Users } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/client";
import { useT } from "@/i18n/provider";

export function AcceptInvite({
  token,
  familyName,
  invitedEmail,
  role,
  sessionEmail,
}: {
  token: string;
  familyName: string;
  invitedEmail: string;
  role: string;
  sessionEmail: string | null;
}) {
  const { t } = useT();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const mismatch =
    sessionEmail && sessionEmail.toLowerCase() !== invitedEmail.toLowerCase();

  async function accept() {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<{ next: string }>("/api/invitations/accept", {
        method: "POST",
        json: { token },
      });
      router.push(result.next || "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("common.error"));
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-line bg-surface p-6 text-center shadow-[var(--shadow-soft)]">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-peach-soft text-accent">
          <Users size={24} />
        </div>
        <h2 className="mt-4 text-2xl">{familyName}</h2>
        <p className="mt-1 text-sm text-muted">
          {t(`common.${role}`)} · {invitedEmail}
        </p>
      </div>

      {error ? (
        <div role="alert" className="rounded-[14px] border border-rose/40 bg-peach-soft px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      {!sessionEmail ? (
        <div className="space-y-3">
          <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="btn btn-primary btn-lg w-full">
            {t("auth.signIn")}
            <ArrowRight size={18} />
          </Link>
          <Link
            href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}
            className="btn btn-secondary w-full"
          >
            {t("auth.signUp")}
          </Link>
          <p className="text-center text-xs text-muted">{t("invite.signInFirst")}</p>
        </div>
      ) : mismatch ? (
        <div className="space-y-3">
          <div className="rounded-[16px] border border-line bg-peach-soft p-4 text-sm">
            {t("invite.emailMismatch")}
          </div>
          <Link href="/login" className="btn btn-secondary w-full">
            {t("common.signOut")}
          </Link>
        </div>
      ) : (
        <button type="button" className="btn btn-primary btn-lg w-full" onClick={accept} disabled={loading}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
          {t("invite.accept")}
        </button>
      )}
    </div>
  );
}
