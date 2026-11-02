"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Users } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/client";
import { Field } from "@/components/ui";
import { useT } from "@/i18n/provider";

export function JoinForm({ sessionEmail }: { sessionEmail: string | null }) {
  const { t } = useT();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<{ family_name: string; invited_email: string; invited_role: string } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function lookup(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await apiFetch<{
        invitation: { family_name: string; invited_email: string; invited_role: string };
      }>(`/api/invitations/code?code=${encodeURIComponent(code)}`);
      setPreview(result.invitation);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("invite.invalid"));
    } finally {
      setLoading(false);
    }
  }

  async function accept() {
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<{ next: string }>("/api/invitations/accept", {
        method: "POST",
        json: { code },
      });
      router.push(result.next || "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("invite.invalid"));
      setLoading(false);
    }
  }

  if (preview) {
    const mismatch = sessionEmail && sessionEmail.toLowerCase() !== preview.invited_email.toLowerCase();
    return (
      <div className="space-y-4">
        <div className="rounded-[24px] border border-line bg-surface p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-peach-soft text-accent">
            <Users size={24} />
          </div>
          <h2 className="mt-4 text-2xl">{preview.family_name}</h2>
          <p className="mt-1 text-sm text-muted">
            {t(`common.${preview.invited_role}`)} · {preview.invited_email}
          </p>
        </div>
        {error ? <div className="rounded-[14px] bg-peach-soft p-3 text-sm">{error}</div> : null}
        {!sessionEmail ? (
          <div className="space-y-2">
            <Link href={`/login?next=${encodeURIComponent(`/join?code=${code}`)}`} className="btn btn-primary btn-lg w-full">
              {t("auth.signIn")}
            </Link>
            <Link href={`/signup?next=${encodeURIComponent(`/join?code=${code}`)}`} className="btn btn-secondary w-full">
              {t("auth.signUp")}
            </Link>
            <p className="text-center text-xs text-muted">{t("invite.signInFirst")}</p>
          </div>
        ) : mismatch ? (
          <div className="rounded-[16px] bg-peach-soft p-4 text-sm">{t("invite.emailMismatch")}</div>
        ) : (
          <button type="button" className="btn btn-primary btn-lg w-full" onClick={accept} disabled={loading}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
            {t("invite.accept")}
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={lookup} className="space-y-4">
      {error ? <div className="rounded-[14px] bg-peach-soft p-3 text-sm">{error}</div> : null}
      <Field label={t("family.inviteCode")} hint={t("invite.codeTitle")}>
        <input
          className="input text-center text-lg font-bold uppercase tracking-[0.25em]"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          maxLength={12}
          placeholder="ABC123"
          autoFocus
        />
      </Field>
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading || code.length < 4}>
        {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
        {t("invite.join")}
      </button>
    </form>
  );
}
