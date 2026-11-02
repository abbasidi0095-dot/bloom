"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Baby, Loader2 } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/client";
import { Field, Segmented } from "@/components/ui";
import { useT } from "@/i18n/provider";

export function OnboardingForm({ userName }: { userName: string }) {
  const { t } = useT();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [familyName, setFamilyName] = useState(
    userName.split(" ").slice(-1)[0] ? `${userName.split(" ").slice(-1)[0]} family` : "Our family",
  );
  const [firstName, setFirstName] = useState("");
  const [dob, setDob] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [sex, setSex] = useState<"female" | "male" | "unspecified">("unspecified");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [head, setHead] = useState("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  async function submit(withBaby: boolean) {
    setError("");
    setFields({});
    if (!familyName.trim()) {
      setFields({ familyName: t("common.requiredField") });
      return;
    }
    if (withBaby && !firstName.trim()) {
      setFields({ firstName: t("common.requiredField") });
      return;
    }
    if (withBaby && !dob) {
      setFields({ dob: t("common.requiredField") });
      return;
    }
    setLoading(true);
    try {
      const body: Record<string, unknown> = { name: familyName.trim() };
      if (withBaby) {
        body.baby = {
          firstName: firstName.trim(),
          dateOfBirth: dob,
          birthTime: birthTime || null,
          sex,
          birthWeightG: weight ? Math.round(Number(weight) * 1000) : null,
          birthHeightCm: height ? Number(height) : null,
          headCircumferenceCm: head ? Number(head) : null,
        };
      }
      await apiFetch("/api/families", { method: "POST", json: body });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("common.error"));
      if (err instanceof ApiClientError && err.fields) {
        setFields(Object.fromEntries(err.fields.map((field) => [field.path, field.message])));
      }
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-2">
        {[1, 2].map((index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full ${step >= index ? "bg-accent" : "bg-line"}`}
          />
        ))}
      </div>
      <p className="section-title mb-4">{t("onboarding.step", { current: step, total: 2 })}</p>

      {error ? (
        <div role="alert" className="mb-4 rounded-[14px] border border-rose/40 bg-peach-soft px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-5">
          <Field label={t("onboarding.familyName")} htmlFor="family" error={fields.familyName} hint={t("onboarding.familyHint")}>
            <input
              id="family"
              className="input"
              value={familyName}
              onChange={(event) => setFamilyName(event.target.value)}
              maxLength={80}
              autoFocus
            />
          </Field>
          <div className="rounded-[18px] border border-line bg-sage-soft p-4 text-xs leading-relaxed text-ink">
            {t("family.roleHint")}
          </div>
          <button type="button" className="btn btn-primary btn-lg w-full" onClick={() => setStep(2)}>
            {t("common.next")}
            <ArrowRight size={18} />
          </button>
          <button
            type="button"
            className="btn btn-ghost w-full"
            onClick={() => submit(false)}
            disabled={loading}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {t("onboarding.skipBaby")}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <Field label={t("onboarding.babyName")} htmlFor="baby" error={fields.firstName}>
            <input
              id="baby"
              className="input"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              maxLength={60}
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("onboarding.dob")} htmlFor="dob" error={fields.dob}>
              <input
                id="dob"
                type="date"
                className="input"
                value={dob}
                max={today}
                onChange={(event) => setDob(event.target.value)}
              />
            </Field>
            <Field label={t("onboarding.birthTime")} htmlFor="time">
              <input
                id="time"
                type="time"
                className="input"
                value={birthTime}
                onChange={(event) => setBirthTime(event.target.value)}
              />
            </Field>
          </div>
          <div>
            <span className="label">{t("onboarding.sex")}</span>
            <div className="mt-2">
              <Segmented
                value={sex}
                onChange={setSex}
                label={t("onboarding.sex")}
                options={[
                  { value: "female", label: t("onboarding.sexFemale") },
                  { value: "male", label: t("onboarding.sexMale") },
                  { value: "unspecified", label: t("onboarding.sexUnspecified") },
                ]}
              />
            </div>
          </div>
          <div className="rounded-[18px] border border-line p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Baby size={16} />
              {t("onboarding.birthDetails")}
              <span className="chip ms-auto">{t("common.optional")}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field label={`${t("growth.weight")} (kg)`} htmlFor="weight">
                <input
                  id="weight"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  className="input"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                />
              </Field>
              <Field label={`${t("growth.height")} (cm)`} htmlFor="height">
                <input
                  id="height"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  className="input"
                  value={height}
                  onChange={(event) => setHeight(event.target.value)}
                />
              </Field>
              <Field label={`${t("growth.head")} (cm)`} htmlFor="head">
                <input
                  id="head"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  className="input"
                  value={head}
                  onChange={(event) => setHead(event.target.value)}
                />
              </Field>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
              {t("common.back")}
            </button>
            <button type="button" className="btn btn-primary btn-lg flex-1" onClick={() => submit(true)} disabled={loading}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              {t("onboarding.finish")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
