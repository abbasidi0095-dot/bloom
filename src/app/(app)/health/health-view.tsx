"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  HeartPulse,
  Loader2,
  Pill,
  Plus,
  Stethoscope,
  Syringe,
  Thermometer,
  TriangleAlert,
} from "lucide-react";
import { useBaby } from "@/components/baby-provider";
import { useT } from "@/i18n/provider";
import { useToast } from "@/components/providers";
import { Field, EmptyState, PageHeader, Segmented, Sheet, Stat } from "@/components/ui";
import { useCreateRecord, useRecords } from "@/hooks/use-records";
import { formatDate, formatTime } from "@/lib/format";
import { ApiClientError } from "@/lib/client";

type HealthType = "temperature" | "medicationLog" | "medication" | "vaccination" | "appointment" | "symptom";

const entityFor: Record<HealthType, string> = {
  temperature: "temperatures",
  medicationLog: "medicationLogs",
  medication: "medications",
  vaccination: "vaccinations",
  appointment: "appointments",
  symptom: "symptoms",
};

export function HealthView() {
  const { baby, timezone, locale, canWrite } = useBaby();
  const { t } = useT();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("add") === "1");
  const [type, setType] = useState<HealthType>("temperature");
  const [when, setWhen] = useState(() => new Date().toISOString().slice(0, 16));
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [celsius, setCelsius] = useState("");
  const [method, setMethod] = useState("axillary");
  const [scheduledDate, setScheduledDate] = useState("");
  const [administeredDate, setAdministeredDate] = useState("");
  const [provider, setProvider] = useState("");
  const [doctor, setDoctor] = useState("");
  const [location, setLocation] = useState("");
  const [severity, setSeverity] = useState<"mild" | "moderate" | "severe">("mild");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const temperatures = useRecords("temperatures", { babyId: baby?.id, limit: 50 }, Boolean(baby));
  const medications = useRecords("medications", { babyId: baby?.id, limit: 50 }, Boolean(baby));
  const medicationLogs = useRecords("medicationLogs", { babyId: baby?.id, limit: 50 }, Boolean(baby));
  const vaccinations = useRecords("vaccinations", { babyId: baby?.id, limit: 50 }, Boolean(baby));
  const appointments = useRecords("appointments", { babyId: baby?.id, limit: 50 }, Boolean(baby));
  const symptoms = useRecords("symptoms", { babyId: baby?.id, limit: 50 }, Boolean(baby));

  const createTemperature = useCreateRecord("temperatures");
  const createMedication = useCreateRecord("medications");
  const createLog = useCreateRecord("medicationLogs");
  const createVaccination = useCreateRecord("vaccinations");
  const createAppointment = useCreateRecord("appointments");
  const createSymptom = useCreateRecord("symptoms");

  useEffect(() => {
    if (open) router.replace("/health");
  }, [open, router]);

  const activeMeds = useMemo(
    () => (medications.data ?? []).filter((row) => row.active),
    [medications.data],
  );
  const latestTemp = temperatures.data?.[0];
  const upcoming = (appointments.data ?? []).filter(
    (row) => new Date(row.scheduled_at).getTime() >= Date.now() && row.status === "scheduled",
  );

  function reset() {
    setName("");
    setDosage("");
    setFrequency("");
    setStartDate("");
    setEndDate("");
    setCelsius("");
    setScheduledDate("");
    setAdministeredDate("");
    setProvider("");
    setDoctor("");
    setLocation("");
    setNotes("");
    setError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!baby) return;
    setError("");
    setLoading(true);
    try {
      const iso = (() => {
        const date = new Date(when);
        return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
      })();
      if (type === "temperature") {
        if (!celsius) throw new ApiClientError(t("common.requiredField"), 422);
        await createTemperature.mutateAsync({
          babyId: baby.id,
          measuredAt: iso,
          celsius: Number(celsius),
          method,
          notes: notes || null,
        });
      } else if (type === "medication") {
        await createMedication.mutateAsync({
          babyId: baby.id,
          name,
          dosage: dosage || null,
          frequency: frequency || null,
          startDate: startDate || null,
          endDate: endDate || null,
          active: true,
          notes: notes || null,
        });
      } else if (type === "medicationLog") {
        await createLog.mutateAsync({
          babyId: baby.id,
          name,
          dose: dosage || null,
          givenAt: iso,
          notes: notes || null,
        });
      } else if (type === "vaccination") {
        await createVaccination.mutateAsync({
          babyId: baby.id,
          name,
          scheduledDate: scheduledDate || null,
          administeredDate: administeredDate || null,
          provider: provider || null,
          notes: notes || null,
        });
      } else if (type === "appointment") {
        if (!name) throw new ApiClientError(t("common.requiredField"), 422);
        await createAppointment.mutateAsync({
          babyId: baby.id,
          title: name,
          doctor: doctor || null,
          location: location || null,
          scheduledAt: iso,
          status: "scheduled",
          notes: notes || null,
        });
      } else {
        if (!name) throw new ApiClientError(t("common.requiredField"), 422);
        await createSymptom.mutateAsync({
          babyId: baby.id,
          description: name,
          severity,
          occurredAt: iso,
          notes: notes || null,
        });
      }
      toast(t("common.saved"));
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  if (!baby) return null;

  return (
    <div className="animate-fade-up">
      <PageHeader
        kicker={t("nav.home")}
        title={t("health.title")}
        subtitle={t("health.subtitle")}
        action={
          canWrite ? (
            <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
              <Plus size={16} />
              {t("common.add")}
            </button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label={t("health.temperature")}
          value={latestTemp ? `${Number(latestTemp.celsius).toFixed(1)}°C` : "—"}
          hint={latestTemp ? formatTime(latestTemp.measured_at, locale, timezone, "24h") : undefined}
          tone="peach"
        />
        <Stat label={t("health.medications")} value={activeMeds.length} tone="lavender" />
        <Stat label={t("health.vaccinations")} value={vaccinations.data?.length ?? 0} tone="sage" />
        <Stat label={t("health.appointments")} value={upcoming.length} tone="sky" />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="section-title mb-3">{t("health.medications")}</h2>
          {activeMeds.length ? (
            <ul className="divide-y divide-line">
              {activeMeds.map((med) => (
                <li key={med.id} className="flex items-start gap-3 py-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-lavender-soft"><Pill size={15} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{med.name}</div>
                    <div className="text-[11px] text-muted">{[med.dosage, med.frequency, med.notes].filter(Boolean).join(" · ")}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Pill size={18} />} title={t("health.noHealth")} />
          )}
          <p className="mt-3 text-[10px] leading-relaxed text-muted">{t("health.note")}</p>
        </section>

        <section className="card card-pad">
          <h2 className="section-title mb-3">{t("health.temperature")}</h2>
          {temperatures.data?.length ? (
            <ul className="divide-y divide-line">
              {temperatures.data.slice(0, 5).map((row) => (
                <li key={row.id} className="flex items-center gap-3 py-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-peach-soft"><Thermometer size={15} /></span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold">{Number(row.celsius).toFixed(1)}°C</span>
                      <span className="text-[11px] text-muted">{formatDate(row.measured_at, locale, timezone, "D MMMM YYYY")}</span>
                    </div>
                    <div className="text-[11px] text-muted">{row.method ?? ""}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Thermometer size={18} />} title={t("health.noHealth")} />
          )}
        </section>

        <section className="card card-pad">
          <h2 className="section-title mb-3">{t("health.vaccinations")} & {t("health.appointments")}</h2>
          {(vaccinations.data?.length ?? 0) + (appointments.data?.length ?? 0) ? (
            <ul className="divide-y divide-line">
              {(vaccinations.data ?? []).map((row) => (
                <li key={row.id} className="flex items-center gap-3 py-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-sage-soft"><Syringe size={15} /></span>
                  <div className="flex-1">
                    <div className="text-sm font-bold">{row.name}</div>
                    <div className="text-[11px] text-muted">
                      {row.administered_date ? formatDate(row.administered_date, locale, timezone) : row.scheduled_date ? formatDate(row.scheduled_date, locale, timezone) : ""}
                    </div>
                  </div>
                </li>
              ))}
              {(appointments.data ?? []).map((row) => (
                <li key={row.id} className="flex items-center gap-3 py-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-sky-soft"><CalendarDays size={15} /></span>
                  <div className="flex-1">
                    <div className="text-sm font-bold">{row.title}</div>
                    <div className="text-[11px] text-muted">{formatDate(row.scheduled_at, locale, timezone)} · {formatTime(row.scheduled_at, locale, timezone, "24h")}</div>
                  </div>
                  <span className="badge bg-sky-soft">{t(`health.${row.status}`)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Stethoscope size={18} />} title={t("health.noHealth")} />
          )}
        </section>

        <section className="card card-pad">
          <h2 className="section-title mb-3">{t("health.symptoms")}</h2>
          {symptoms.data?.length ? (
            <ul className="divide-y divide-line">
              {symptoms.data.slice(0, 6).map((row) => (
                <li key={row.id} className="flex items-center gap-3 py-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-peach-soft"><TriangleAlert size={15} /></span>
                  <div className="flex-1">
                    <div className="text-sm font-bold">{row.description}</div>
                    <div className="text-[11px] text-muted">{formatDate(row.occurred_at, locale, timezone)} · {t(`health.${row.severity}`)}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<HeartPulse size={18} />} title={t("health.noHealth")} />
          )}
        </section>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title={t("health.title")} subtitle={t("health.note")}>
        <form onSubmit={submit} className="space-y-4">
          {error ? <div className="rounded-[14px] bg-peach-soft p-3 text-sm">{error}</div> : null}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["temperature", t("health.temperature")],
                ["medicationLog", t("health.addLog")],
                ["medication", t("health.medications")],
                ["vaccination", t("health.vaccinations")],
                ["appointment", t("health.appointments")],
                ["symptom", t("health.symptoms")],
              ] as Array<[HealthType, string]>
            ).map(([value, label]) => (
              <button key={value} type="button" className={`chip ${type === value ? "chip-active" : ""}`} onClick={() => setType(value)}>
                {label}
              </button>
            ))}
          </div>

          {type === "temperature" ? (
            <>
              <Field label={t("health.celsius")}>
                <input type="number" step="0.1" min="30" max="45" className="input" value={celsius} onChange={(event) => setCelsius(event.target.value)} required />
              </Field>
              <Field label={t("health.method")}>
                <select className="select" value={method} onChange={(event) => setMethod(event.target.value)}>
                  {["axillary", "oral", "rectal", "ear", "forehead"].map((item) => (
                    <option key={item} value={item}>{t(`health.${item}`)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t("common.time")}>
                <input type="datetime-local" className="input" value={when} onChange={(event) => setWhen(event.target.value)} />
              </Field>
            </>
          ) : null}

          {type === "medication" ? (
            <>
              <Field label={t("health.medName")}>
                <input className="input" value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("health.dosage")} hint={t("health.dosageHint")}>
                  <input className="input" value={dosage} onChange={(event) => setDosage(event.target.value)} />
                </Field>
                <Field label={t("health.frequency")}>
                  <input className="input" value={frequency} onChange={(event) => setFrequency(event.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("health.startDate")}>
                  <input type="date" className="input" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </Field>
                <Field label={t("health.endDate")}>
                  <input type="date" className="input" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </Field>
              </div>
            </>
          ) : null}

          {type === "medicationLog" ? (
            <>
              <Field label={t("health.medName")}>
                <input className="input" value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} />
              </Field>
              <Field label={t("health.dose")}>
                <input className="input" value={dosage} onChange={(event) => setDosage(event.target.value)} />
              </Field>
              <Field label={t("health.givenAt")}>
                <input type="datetime-local" className="input" value={when} onChange={(event) => setWhen(event.target.value)} />
              </Field>
            </>
          ) : null}

          {type === "vaccination" ? (
            <>
              <Field label={t("health.medName")}>
                <input className="input" value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("health.scheduledDate")}>
                  <input type="date" className="input" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} />
                </Field>
                <Field label={t("health.administeredDate")}>
                  <input type="date" className="input" value={administeredDate} onChange={(event) => setAdministeredDate(event.target.value)} />
                </Field>
              </div>
              <Field label={t("health.provider")}>
                <input className="input" value={provider} onChange={(event) => setProvider(event.target.value)} />
              </Field>
            </>
          ) : null}

          {type === "appointment" ? (
            <>
              <Field label={t("health.appointments")}>
                <input className="input" value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("health.doctor")}>
                  <input className="input" value={doctor} onChange={(event) => setDoctor(event.target.value)} />
                </Field>
                <Field label={t("health.location")}>
                  <input className="input" value={location} onChange={(event) => setLocation(event.target.value)} />
                </Field>
              </div>
              <Field label={t("health.scheduledAt")}>
                <input type="datetime-local" className="input" value={when} onChange={(event) => setWhen(event.target.value)} />
              </Field>
            </>
          ) : null}

          {type === "symptom" ? (
            <>
              <Field label={t("health.description")}>
                <input className="input" value={name} onChange={(event) => setName(event.target.value)} required maxLength={300} />
              </Field>
              <Field label={t("health.severity")}>
                <Segmented
                  value={severity}
                  onChange={setSeverity}
                  options={[
                    { value: "mild", label: t("health.mild") },
                    { value: "moderate", label: t("health.moderate") },
                    { value: "severe", label: t("health.severe") },
                  ]}
                />
              </Field>
              <Field label={t("common.time")}>
                <input type="datetime-local" className="input" value={when} onChange={(event) => setWhen(event.target.value)} />
              </Field>
            </>
          ) : null}

          <Field label={t("common.notes")}>
            <textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} />
          </Field>
          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {t("common.save")}
          </button>
        </form>
      </Sheet>
    </div>
  );
}
