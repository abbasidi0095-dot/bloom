"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/client";
import { useT } from "@/i18n/provider";

export function VerifyEmail({ token }: { token: string }) {
  const { t } = useT();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage(t("auth.verifyFailed"));
      return;
    }
    let cancelled = false;
    apiFetch("/api/auth/verify", { method: "POST", json: { token } })
      .then(() => {
        if (!cancelled) setState("ok");
      })
      .catch((error) => {
        if (!cancelled) {
          setState("error");
          setMessage(error instanceof ApiClientError ? error.message : t("auth.verifyFailed"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-[18px] border border-line bg-surface p-5">
        {state === "loading" ? <Loader2 size={22} className="animate-spin text-muted" /> : null}
        {state === "ok" ? <CheckCircle2 size={22} className="text-sage" /> : null}
        {state === "error" ? <XCircle size={22} className="text-rose" /> : null}
        <div>
          <p className="text-sm font-bold">
            {state === "loading" ? t("common.loading") : state === "ok" ? t("auth.verifySuccess") : t("auth.verifyFailed")}
          </p>
          {message ? <p className="mt-1 text-xs text-muted">{message}</p> : null}
        </div>
      </div>
      <div className="flex gap-2">
        <Link href="/dashboard" className="btn btn-primary flex-1">
          {t("onboarding.goDashboard")}
        </Link>
        <Link href="/login" className="btn btn-secondary flex-1">
          {t("auth.signIn")}
        </Link>
      </div>
    </div>
  );
}
