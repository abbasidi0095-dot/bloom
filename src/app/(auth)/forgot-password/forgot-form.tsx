"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Loader2, MailCheck } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/client";
import { Field } from "@/components/ui";
import { useT } from "@/i18n/provider";

export function ForgotForm() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [smtpConfigured, setSmtpConfigured] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch<{ devLink: string | null; smtpConfigured: boolean }>("/api/auth/forgot", {
        method: "POST",
        json: { email },
      });
      setSent(true);
      setDevLink(result.devLink);
      setSmtpConfigured(result.smtpConfigured);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-[18px] border border-line bg-sage-soft p-4">
          <MailCheck size={20} className="mt-0.5 text-ink" />
          <div>
            <p className="text-sm font-bold">{smtpConfigured ? t("auth.emailSent") : t("auth.smtpMissing")}</p>
            {smtpConfigured ? <p className="mt-1 text-xs text-muted">{t("auth.checkEmail")}</p> : null}
            {devLink ? (
              <Link href={devLink} className="mt-3 inline-block text-xs font-bold text-accent-strong underline underline-offset-2">
                {t("auth.devLink")} {devLink}
              </Link>
            ) : null}
          </div>
        </div>
        <Link href="/login" className="btn btn-secondary w-full">
          {t("auth.signIn")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <div className="rounded-[14px] border border-rose/40 bg-peach-soft px-4 py-3 text-sm">{error}</div> : null}
      <Field label={t("auth.email")} htmlFor="email">
        <input
          id="email"
          type="email"
          className="input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </Field>
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
        {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
        {t("auth.sendLink")}
      </button>
      <p className="text-center text-sm text-muted">
        <Link href="/login" className="font-bold text-ink underline underline-offset-4">
          {t("auth.signIn")}
        </Link>
      </p>
    </form>
  );
}
