"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/client";
import { Field } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import { useT } from "@/i18n/provider";

export function SignupForm({ next }: { next?: string }) {
  const { t, locale } = useT();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setFields({});
    if (password.length < 8) {
      setFields({ password: t("common.passwordShort") });
      return;
    }
    if (password !== confirm) {
      setFields({ confirm: t("common.error") });
      return;
    }
    setLoading(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const result = await apiFetch<{ next: string; devLink?: string | null; verificationSent?: boolean }>(
        "/api/auth/signup",
        { method: "POST", json: { name, email, password, timezone, locale } },
      );
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : result.next);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        if (err.fields) {
          setFields(Object.fromEntries(err.fields.map((field) => [field.path, field.message])));
        }
      } else {
        setError(t("common.error"));
      }
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
      <Field label={t("auth.name")} htmlFor="name" error={fields.name}>
        <input
          id="name"
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          required
          maxLength={80}
          placeholder="Alex Martin"
        />
      </Field>
      <Field label={t("auth.email")} htmlFor="email" error={fields.email}>
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
      <Field label={t("auth.password")} htmlFor="password" error={fields.password} hint={t("auth.passwordHint")}>
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" />
      </Field>
      <Field label={t("common.confirm")} htmlFor="confirm" error={fields.confirm}>
        <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </Field>
      <p className="text-[11px] leading-relaxed text-muted">{t("auth.terms")}</p>
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
        {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
        {t("auth.signUp")}
      </button>
      <p className="text-center text-sm text-muted">
        {t("auth.hasAccount")}{" "}
        <Link href="/login" className="font-bold text-ink underline underline-offset-4">
          {t("auth.signIn")}
        </Link>
      </p>
    </form>
  );
}
