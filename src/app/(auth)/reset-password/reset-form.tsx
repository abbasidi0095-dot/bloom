"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/client";
import { Field } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import { useT } from "@/i18n/provider";

export function ResetForm({ token }: { token: string }) {
  const { t } = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <div className="space-y-4">
        <div className="rounded-[16px] border border-line bg-peach-soft p-4 text-sm">{t("auth.verifyFailed")}</div>
        <Link href="/forgot-password" className="btn btn-secondary w-full">
          {t("auth.forgotTitle")}
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-[18px] border border-line bg-sage-soft p-4 text-sm font-semibold">
          {t("settings.savedChanges")}
        </div>
        <Link href="/login" className="btn btn-primary w-full">
          {t("auth.signIn")}
        </Link>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError(t("common.passwordShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("common.error"));
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/auth/reset", { method: "POST", json: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <div className="rounded-[14px] border border-rose/40 bg-peach-soft px-4 py-3 text-sm">{error}</div> : null}
      <Field label={t("auth.newPassword")} htmlFor="password" hint={t("auth.passwordHint")}>
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" />
      </Field>
      <Field label={t("common.confirm")} htmlFor="confirm">
        <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </Field>
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
        {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
        {t("auth.resetPassword")}
      </button>
    </form>
  );
}
