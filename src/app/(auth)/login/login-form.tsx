"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/client";
import { Field } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import { useT } from "@/i18n/provider";

export function LoginForm() {
  const { t } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await apiFetch<{ next: string }>("/api/auth/login", {
        method: "POST",
        json: { email, password },
      });
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : result.next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("common.error"));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? (
        <div role="alert" className="rounded-[14px] border border-rose/40 bg-peach-soft px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}
      <Field label={t("auth.email")} htmlFor="email">
        <input
          id="email"
          type="email"
          className="input"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </Field>
      <Field label={t("auth.password")} htmlFor="password">
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      <div className="flex items-center justify-between text-xs">
        <Link href="/forgot-password" className="font-semibold text-accent-strong hover:underline">
          {t("auth.forgot")}
        </Link>
        <span className="text-muted">{t("auth.passwordHint")}</span>
      </div>
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
        {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
        {t("auth.signIn")}
      </button>
      <p className="text-center text-sm text-muted">
        {t("auth.noAccount")}{" "}
        <Link href="/signup" className="font-bold text-ink underline underline-offset-4">
          {t("auth.signUp")}
        </Link>
      </p>
      <p className="text-center text-xs text-muted">
        <Link href="/join" className="font-semibold text-accent-strong underline underline-offset-2">
          {t("family.inviteCode")}
        </Link>
      </p>
    </form>
  );
}
