"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Loader2, Printer, Share2, Sparkles } from "lucide-react";
import { useBaby } from "@/components/baby-provider";
import { useT } from "@/i18n/provider";
import { useToast } from "@/components/providers";
import { Field, PageHeader } from "@/components/ui";
import { addDaysKey, formatDate, todayKey } from "@/lib/format";
import { ApiClientError } from "@/lib/client";

type Preset = "today" | "yesterday" | "7" | "30" | "month" | "prev" | "custom";

const sectionKeys = [
  ["feeding", "reports.includeFeeding"],
  ["diapers", "reports.includeDiapers"],
  ["sleep", "reports.includeSleep"],
  ["growth", "reports.includeGrowth"],
  ["health", "reports.includeHealth"],
  ["activities", "reports.includeActivities"],
  ["milestones", "reports.includeMilestones"],
  ["notes", "reports.includeNotes"],
] as const;

export function ReportsView() {
  const { baby, timezone, locale } = useBaby();
  const { t } = useT();
  const toast = useToast();
  const today = todayKey(timezone);
  const [preset, setPreset] = useState<Preset>("7");
  const [from, setFrom] = useState(addDaysKey(today, -6));
  const [to, setTo] = useState(today);
  const [sections, setSections] = useState<string[]>(["feeding", "diapers", "sleep", "growth"]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  const periodLabel = useMemo(
    () => `${formatDate(from, locale, timezone, "D MMMM YYYY")} – ${formatDate(to, locale, timezone, "D MMMM YYYY")}`,
    [from, to, locale, timezone],
  );

  function choosePreset(next: Preset) {
    setPreset(next);
    if (next === "today") {
      setFrom(today);
      setTo(today);
    } else if (next === "yesterday") {
      const yesterday = addDaysKey(today, -1);
      setFrom(yesterday);
      setTo(yesterday);
    } else if (next === "7") {
      setFrom(addDaysKey(today, -6));
      setTo(today);
    } else if (next === "30") {
      setFrom(addDaysKey(today, -29));
      setTo(today);
    } else if (next === "month") {
      setFrom(`${today.slice(0, 7)}-01`);
      setTo(today);
    } else if (next === "prev") {
      const first = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
      first.setUTCMonth(first.getUTCMonth() - 1);
      const start = first.toISOString().slice(0, 10);
      const end = new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
      end.setUTCDate(0);
      setFrom(start);
      setTo(end.toISOString().slice(0, 10));
    }
  }

  function toggleSection(key: string) {
    setSections((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  async function generate() {
    if (!baby) return;
    if (!sections.length) {
      setError(t("common.requiredField"));
      return;
    }
    setLoading(true);
    setError("");
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    try {
      const response = await fetch(`/api/reports?tz=${encodeURIComponent(timezone)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          babyId: baby.id,
          from,
          to,
          sections,
          title: title || undefined,
          note: note || undefined,
        }),
        credentials: "same-origin",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new ApiClientError(payload.error || t("reports.reportError"), response.status);
      }
      const blob = await response.blob();
      if (blob.size < 1000) throw new ApiClientError(t("reports.reportError"), 500);
      setPdfBlob(blob);
      setPdfUrl(URL.createObjectURL(blob));
      toast(t("reports.reportReady"));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("reports.reportError"));
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!pdfUrl || !baby) return;
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `bloom-${baby.first_name.toLowerCase()}-${from}-${to}.pdf`;
    link.click();
  }

  async function share() {
    if (!pdfBlob || !baby) return;
    const file = new File([pdfBlob], `bloom-${baby.first_name}-${from}-${to}.pdf`, { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: t("reports.title"), text: periodLabel });
      } catch {
        // cancelled
      }
    } else {
      toast(t("common.share") + " — " + t("reports.downloadPdf"), { tone: "info" });
      download();
    }
  }

  function print() {
    if (!pdfUrl) return;
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.src = pdfUrl;
    frame.onload = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 60_000);
    };
    document.body.appendChild(frame);
  }

  if (!baby) return null;

  return (
    <div className="animate-fade-up">
      <PageHeader kicker={t("nav.reports")} title={t("reports.title")} subtitle={t("reports.subtitle")} />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <section className="card card-pad">
          <h2 className="section-title mb-3">{t("reports.builder")}</h2>
          <p className="mb-4 text-xs leading-relaxed text-muted">{t("reports.description")}</p>

          {error ? <div className="mb-4 rounded-[14px] bg-peach-soft p-3 text-sm">{error}</div> : null}

          <div className="space-y-4">
            <div>
              <span className="label">{t("reports.presets")}</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(
                  [
                    ["today", t("common.today")],
                    ["yesterday", t("common.yesterday")],
                    ["7", t("common.last7")],
                    ["30", t("common.last30")],
                    ["month", t("common.thisMonth")],
                    ["prev", t("common.prevMonth")],
                    ["custom", t("common.custom")],
                  ] as Array<[Preset, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`chip ${preset === value ? "chip-active" : ""}`}
                    onClick={() => choosePreset(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t("common.from")}>
                <input type="date" className="input" value={from} max={to} onChange={(event) => { setFrom(event.target.value); setPreset("custom"); }} />
              </Field>
              <Field label={t("common.to")}>
                <input type="date" className="input" value={to} min={from} onChange={(event) => { setTo(event.target.value); setPreset("custom"); }} />
              </Field>
            </div>

            <div>
              <span className="label">{t("reports.sections")}</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {sectionKeys.map(([key, label]) => (
                  <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-[14px] border p-2.5 text-xs font-semibold ${sections.includes(key) ? "border-accent bg-peach-soft" : "border-line bg-surface"}`}>
                    <input
                      type="checkbox"
                      className="accent-[var(--accent)]"
                      checked={sections.includes(key)}
                      onChange={() => toggleSection(key)}
                    />
                    {t(label)}
                  </label>
                ))}
              </div>
            </div>

            <Field label={t("reports.titleField")} hint={t("common.optional")}>
              <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder={t("reports.defaultTitle")} />
            </Field>
            <Field label={t("common.notes")} hint={t("reports.notesPlaceholder")}>
              <textarea className="textarea" value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} />
            </Field>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-primary" onClick={generate} disabled={loading}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                {loading ? t("reports.generating") : t("reports.generatePdf")}
              </button>
              <span className="text-[11px] text-muted">{periodLabel}</span>
            </div>
          </div>
        </section>

        <section className="card card-pad">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">{t("reports.preview")}</h2>
            {pdfUrl ? (
              <div className="flex gap-1">
                <button type="button" className="btn btn-ghost btn-icon" onClick={download} aria-label={t("reports.downloadPdf")}>
                  <Download size={17} />
                </button>
                <button type="button" className="btn btn-ghost btn-icon" onClick={share} aria-label={t("reports.sharePdf")}>
                  <Share2 size={17} />
                </button>
                <button type="button" className="btn btn-ghost btn-icon" onClick={print} aria-label={t("reports.printPdf")}>
                  <Printer size={17} />
                </button>
              </div>
            ) : null}
          </div>
          {pdfUrl ? (
            <div className="space-y-3">
              <iframe title={t("reports.preview")} src={pdfUrl} className="h-[560px] w-full rounded-[16px] border border-line bg-white" />
              <div className="flex gap-2">
                <button type="button" className="btn btn-primary flex-1" onClick={download}>
                  <Download size={16} />
                  {t("reports.downloadPdf")}
                </button>
                <button type="button" className="btn btn-secondary" onClick={share}>
                  <Share2 size={16} />
                  {t("reports.sharePdf")}
                </button>
              </div>
              <p className="text-[10px] text-muted">{t("reports.reportReady")}</p>
            </div>
          ) : (
            <div className="grid h-[560px] place-items-center rounded-[18px] border border-dashed border-line bg-[color-mix(in_srgb,var(--peach-soft)_35%,transparent)] text-center">
              <div className="max-w-xs px-6">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-surface text-accent">
                  <Sparkles size={22} />
                </div>
                <p className="mt-4 text-sm font-bold">{t("reports.builder")}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{t("reports.description")}</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
