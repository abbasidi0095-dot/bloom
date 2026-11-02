import path from "node:path";
import {
  Document,
  Font,
  Image,
  Page,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import { ageFromDob, durationLabel, formatDate, formatTime } from "@/lib/format";
import type { Locale } from "@/i18n/config";
import type { ReportData } from "@/lib/reportData";
import { reportTotals } from "@/lib/reportData";

const fontDir = path.join(process.cwd(), "assets", "fonts");
Font.register({
  family: "Manrope",
  fonts: [
    { src: path.join(fontDir, "Manrope-400.woff"), fontWeight: 400 },
    { src: path.join(fontDir, "Manrope-500.woff"), fontWeight: 500 },
    { src: path.join(fontDir, "Manrope-600.woff"), fontWeight: 600 },
    { src: path.join(fontDir, "Manrope-700.woff"), fontWeight: 700 },
  ],
});
Font.register({
  family: "Fraunces",
  fonts: [
    { src: path.join(fontDir, "Fraunces-400.woff"), fontWeight: 400 },
    { src: path.join(fontDir, "Fraunces-600.woff"), fontWeight: 600 },
  ],
});
Font.register({
  family: "NotoKufi",
  fonts: [
    { src: path.join(fontDir, "NotoKufi-400.woff"), fontWeight: 400 },
    { src: path.join(fontDir, "NotoKufi-600.woff"), fontWeight: 600 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const colors = {
  ink: "#2c2622",
  muted: "#7c7169",
  line: "#e9dfd2",
  peach: "#efb99e",
  peachSoft: "#fbe9de",
  sage: "#a9c3a4",
  sageSoft: "#e9f1e5",
  lavender: "#c6b7df",
  lavenderSoft: "#f1ebf8",
  sky: "#a9c9e6",
  skySoft: "#e8f1f9",
  cream: "#f8f4ec",
  paper: "#fffdf9",
  accent: "#c97b5a",
};

function makeStyles(bodyFont: string, displayFont: string, rtl: boolean) {
  return StyleSheet.create({
  page: {
    fontFamily: bodyFont,
    fontSize: 9.5,
    color: colors.ink,
    backgroundColor: colors.paper,
    textAlign: rtl ? "right" : "left",
    paddingTop: 44,
    paddingBottom: 48,
    paddingHorizontal: 42,
  },
  cover: {
    fontFamily: bodyFont,
    backgroundColor: colors.cream,
    textAlign: rtl ? "right" : "left",
    padding: 0,
    color: colors.ink,
  },
  coverInner: { padding: 54, height: "100%", justifyContent: "space-between" },
  brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontFamily: displayFont, fontSize: 20, color: colors.ink },
  brandDot: { color: colors.accent, fontFamily: "Manrope" },
  kicker: {
    fontSize: 8,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    color: colors.muted,
    marginBottom: 10,
  },
  coverTitle: { fontFamily: displayFont, fontSize: 42, lineHeight: 1.03, color: colors.ink, marginBottom: 14 },
  coverSub: { fontSize: 12, color: colors.muted, lineHeight: 1.5, maxWidth: 360 },
  coverName: { fontFamily: displayFont, fontSize: 26, marginTop: 22, marginBottom: 4 },
  metaGrid: { flexDirection: "row", gap: 10, marginTop: 26 },
  metaCell: {
    flex: 1,
    border: `1 solid ${colors.line}`,
    borderRadius: 14,
    padding: 12,
    backgroundColor: colors.paper,
  },
  metaLabel: { fontSize: 7, textTransform: "uppercase", letterSpacing: 1.2, color: colors.muted, marginBottom: 5 },
  metaValue: { fontSize: 10, fontWeight: 600 },
  summaryGrid: { flexDirection: "row", gap: 10, marginTop: 16 },
  summaryCell: { flex: 1, borderRadius: 16, padding: 14 },
  summaryValue: { fontFamily: displayFont, fontSize: 22, marginBottom: 3 },
  summaryLabel: { fontSize: 7.5, textTransform: "uppercase", letterSpacing: 1.1, color: colors.muted },
  avatar: { width: 82, height: 82, borderRadius: 41, marginBottom: 18, backgroundColor: colors.peachSoft },
  avatarFallback: {
    width: 82,
    height: 82,
    borderRadius: 41,
    marginBottom: 18,
    backgroundColor: colors.peachSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { fontFamily: displayFont, fontSize: 32, color: colors.accent },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 },
  sectionKicker: { fontSize: 7.5, letterSpacing: 1.8, textTransform: "uppercase", color: colors.accent, marginBottom: 5 },
  sectionTitle: { fontFamily: displayFont, fontSize: 24 },
  sectionMeta: { fontSize: 8, color: colors.muted, textAlign: "right", maxWidth: 180 },
  statRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  stat: { flex: 1, border: `1 solid ${colors.line}`, borderRadius: 12, padding: 10, backgroundColor: colors.paper },
  statValue: { fontFamily: displayFont, fontSize: 17, marginBottom: 2 },
  statLabel: { fontSize: 7.5, color: colors.muted },
  h3: { fontFamily: displayFont, fontSize: 14, marginTop: 14, marginBottom: 8 },
  table: { border: `1 solid ${colors.line}`, borderRadius: 10, overflow: "hidden" },
  thead: { flexDirection: "row", backgroundColor: colors.cream, borderBottom: `1 solid ${colors.line}` },
  th: { fontSize: 7, textTransform: "uppercase", letterSpacing: 0.8, color: colors.muted, padding: 7, fontWeight: 700 },
  tr: { flexDirection: "row", borderBottom: `0.5 solid ${colors.line}` },
  td: { fontSize: 8, padding: 7, color: colors.ink },
  tdMuted: { fontSize: 8, padding: 7, color: colors.muted },
  empty: { padding: 18, fontSize: 9, color: colors.muted, textAlign: "center" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 42,
    right: 42,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: colors.muted,
    borderTop: `0.5 solid ${colors.line}`,
    paddingTop: 7,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: { borderRadius: 20, backgroundColor: colors.paper, border: `0.5 solid ${colors.line}`, paddingVertical: 4, paddingHorizontal: 9, fontSize: 8 },
  note: { fontSize: 9, lineHeight: 1.55, color: colors.ink },
  timelineRow: { flexDirection: "row", gap: 10, paddingVertical: 7, borderBottom: `0.5 solid ${colors.line}` },
  timelineTime: { width: 68, fontSize: 7.5, color: colors.muted },
  timelineBody: { flex: 1 },
  timelineTitle: { fontSize: 8.5, fontWeight: 600 },
  timelineNote: { fontSize: 7.5, color: colors.muted, marginTop: 2 },
  });
}

const stylesLtr = makeStyles("Manrope", "Fraunces", false);
const stylesAr = makeStyles("NotoKufi", "NotoKufi", true);

function brand(styles: any) {
  return (
    <View style={styles.brandRow}>
      <Text style={styles.brand}>
        Bloom<Text style={styles.brandDot}>.</Text>
      </Text>
      <Text style={{ fontSize: 7.5, letterSpacing: 1.2, color: colors.muted }}>PRIVATE FAMILY REPORT</Text>
    </View>
  );
}

function footer(labels: { page: string; generated: string }) {
  return (
    <View style={stylesLtr.footer} fixed>
      <Text>Bloom · {labels.generated}</Text>
      <Text
        render={({ pageNumber, totalPages }) => `${labels.page} ${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

function SectionHeader({
  kicker,
  title,
  meta,
  styles,
}: {
  kicker: string;
  title: string;
  meta: string;
  styles: any;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View>
        <Text style={styles.sectionKicker}>{kicker}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Text style={styles.sectionMeta}>{meta}</Text>
    </View>
  );
}

function Stat({ value, label, color, styles }: { value: string; label: string; color: string; styles: any }) {
  return (
    <View style={[styles.stat, { backgroundColor: color }]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Table({
  columns,
  rows,
  widths,
  empty,
  styles,
}: {
  columns: string[];
  rows: string[][];
  widths: number[];
  empty: string;
  styles: any;
}) {
  return (
    <View style={styles.table}>
      <View style={styles.thead} fixed>
        {columns.map((column, index) => (
          <Text key={column} style={[styles.th, { width: `${widths[index]}%` }]}>
            {column}
          </Text>
        ))}
      </View>
      {rows.length === 0 ? (
        <Text style={styles.empty}>{empty}</Text>
      ) : (
        rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.tr} wrap={false}>
            {row.map((cell, cellIndex) => (
              <Text
                key={cellIndex}
                style={[
                  cellIndex === row.length - 1 ? styles.tdMuted : styles.td,
                  { width: `${widths[cellIndex]}%` },
                ]}
              >
                {cell || "—"}
              </Text>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

function BarChart({
  data,
  color,
  secondaryColor,
}: {
  data: Array<{ label: string; value: number; secondary?: number }>;
  color: string;
  secondaryColor: string;
}) {
  const width = 500;
  const height = 92;
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.secondary ?? 0)));
  const gap = data.length > 14 ? 2 : 6;
  const barWidth = Math.max(3, (width - gap * (data.length - 1)) / Math.max(1, data.length));
  return (
    <View style={{ marginTop: 6, marginBottom: 4 }}>
      <Svg width={width} height={height + 18}>
        <Rect x={0} y={height} width={width} height={0.5} fill={colors.line} />
        {data.map((item, index) => {
          const h = Math.max(1, (item.value / max) * (height - 8));
          const h2 = Math.max(0, ((item.secondary ?? 0) / max) * (height - 8));
          const x = index * (barWidth + gap);
          return (
            <Rect
              key={index}
              x={x}
              y={height - h}
              width={barWidth}
              height={h}
              rx={2}
              fill={color}
            />
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 3 }}>
        <Text style={{ fontSize: 6.5, color: colors.muted }}>{data[0]?.label ?? ""}</Text>
        <Text style={{ fontSize: 6.5, color: colors.muted }}>{data[data.length - 1]?.label ?? ""}</Text>
      </View>
    </View>
  );
}

export function ReportDocument({
  data,
  dict,
  locale,
  sections,
  title,
  note,
  photo,
}: {
  data: ReportData;
  dict: Record<string, string>;
  locale: Locale;
  sections: string[];
  title: string;
  note?: string;
  photo?: string | null;
}) {
  const t = (key: string, values?: Record<string, string | number>) => {
    let template = dict[key] ?? key;
    if (values) {
      template = template.replace(/\{(\w+)\}/g, (_, name: string) =>
        values[name] === undefined ? `{${name}}` : String(values[name]),
      );
    }
    return template;
  };
  const l = (key: string, values?: Record<string, string | number>) => t(`reports.${key}`, values);
  const styles = locale === "ar" ? stylesAr : stylesLtr;
  const totals = reportTotals(data);
  const baby = data.baby as any;
  const dateFormat = "D MMMM YYYY";
  const fmtDate = (value: string) => formatDate(value, locale, data.meta.timeZone, dateFormat);
  const fmtTime = (value: string) => formatTime(value, locale, data.meta.timeZone, "24h");
  const age = baby
    ? ageFromDob(baby.date_of_birth, new Date(`${data.meta.from}T12:00:00Z`), data.meta.timeZone)
    : { months: 0, days: 0 };
  const periodLabel = `${fmtDate(data.meta.from)} — ${fmtDate(data.meta.to)}`;
  const generated = fmtDate(new Date().toISOString());
  const labels = { page: t("common.page"), generated };
  const sectionSet = new Set(sections);

  return (
    <Document title={title} author="Bloom" subject={t("reports.title")} creator="Bloom">
      {/* Cover */}
      <Page size="A4" style={styles.cover}>
        <View style={styles.coverInner}>
          <View>
            {brand(styles)}
            <View style={{ marginTop: 42 }}>
              {photo ? (
                <Image src={photo} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarLetter}>{baby?.first_name?.slice(0, 1) ?? "B"}</Text>
                </View>
              )}
              <Text style={styles.kicker}>{l("reportFor", { name: baby?.first_name ?? "" })}</Text>
              <Text style={styles.coverTitle}>{title}</Text>
              <Text style={styles.coverName}>{baby?.first_name} {baby?.last_name ?? ""}</Text>
              <Text style={styles.coverSub}>
                {t("onboarding.dob")}: {baby ? fmtDate(baby.date_of_birth) : "—"}
                {"\n"}
                {l("ageDuring")}: {age.months} {t("units.months")}, {age.days} {t("units.days")}
                {"\n"}
                {l("periodLabel")}: {periodLabel}
              </Text>
            </View>
          </View>

          <View>
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryCell, { backgroundColor: colors.peachSoft }]}>
                <Text style={styles.summaryValue}>{totals.feeds}</Text>
                <Text style={styles.summaryLabel}>{t("feeding.sessions")}</Text>
              </View>
              <View style={[styles.summaryCell, { backgroundColor: colors.skySoft }]}>
                <Text style={styles.summaryValue}>{totals.formulaMl} ml</Text>
                <Text style={styles.summaryLabel}>{t("feeding.todayFormula")}</Text>
              </View>
              <View style={[styles.summaryCell, { backgroundColor: colors.sageSoft }]}>
                <Text style={styles.summaryValue}>{totals.wet}</Text>
                <Text style={styles.summaryLabel}>{t("diaper.wet")}</Text>
              </View>
              <View style={[styles.summaryCell, { backgroundColor: colors.lavenderSoft }]}>
                <Text style={styles.summaryValue}>{durationLabel(totals.sleepSeconds)}</Text>
                <Text style={styles.summaryLabel}>{t("sleep.totalSleep")}</Text>
              </View>
            </View>
            <View style={styles.metaGrid}>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>{l("generatedOn")}</Text>
                <Text style={styles.metaValue}>{generated}</Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>{t("family.title")}</Text>
                <Text style={styles.metaValue}>{data.family?.name ?? "—"}</Text>
              </View>
              <View style={styles.metaCell}>
                <Text style={styles.metaLabel}>{t("reports.contributors")}</Text>
                <Text style={styles.metaValue}>
                  {data.contributors.map((c) => c.name).join(", ") || "—"}
                </Text>
              </View>
            </View>
            <View style={{ marginTop: 26, borderTop: `0.5 solid ${colors.line}`, paddingTop: 10 }}>
              <Text style={{ fontSize: 7.5, color: colors.muted }}>
                {t("settings.privacyNote")}
              </Text>
            </View>
          </View>
        </View>
      </Page>

      {sectionSet.has("feeding") && (
        <Page size="A4" style={styles.page}>
          <SectionHeader styles={styles} kicker={l("includeFeeding")} title={t("feeding.title")} meta={`${periodLabel}\n${data.feedings.length} ${t("timeline.count", { count: data.feedings.length })}`} />
          <View style={styles.statRow}>
            <Stat styles={styles} value={String(totals.feeds)} label={t("feeding.sessions")} color={colors.peachSoft} />
            <Stat styles={styles} value={`${totals.formulaMl} ml`} label={t("feeding.todayFormula")} color={colors.skySoft} />
            <Stat styles={styles} value={`${totals.expressedMl} ml`} label={t("feeding.todayExpressed")} color={colors.sageSoft} />
            <Stat styles={styles} value={durationLabel(totals.breastSeconds)} label={t("feeding.breastTime")} color={colors.lavenderSoft} />
          </View>
          <Text style={styles.h3}>{t("insights.feedsPerDay")}</Text>
          <BarChart
            data={totals.byDay.map((day) => ({ label: day.date.slice(5), value: day.feeds, secondary: day.formula }))}
            color={colors.peach}
            secondaryColor={colors.sky}
          />
          <Text style={styles.h3}>{t("feeding.history")}</Text>
          <Table styles={styles}
            columns={[t("common.date"), t("common.time"), t("feeding.amount"), t("common.duration"), t("common.details")]}
            widths={[16, 12, 16, 14, 42]}
            rows={(data.feedings as any[]).map((row) => [
              fmtDate(row.started_at),
              fmtTime(row.started_at),
              row.type === "breast"
                ? durationLabel(Number(row.left_seconds) + Number(row.right_seconds))
                : row.amount_ml
                  ? `${row.amount_ml} ml`
                  : "—",
              row.ended_at
                ? durationLabel((new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()) / 1000)
                : "—",
              [row.type, row.formula_brand, row.notes].filter(Boolean).join(" · "),
            ])}
            empty={t("feeding.noFeedings")}
          />
          {footer(labels)}
        </Page>
      )}

      {sectionSet.has("diapers") && (
        <Page size="A4" style={styles.page}>
          <SectionHeader styles={styles} kicker={l("includeDiapers")} title={t("diaper.title")} meta={`${periodLabel}\n${data.diapers.length}`} />
          <View style={styles.statRow}>
            <Stat styles={styles} value={String(totals.wet)} label={t("diaper.wet")} color={colors.skySoft} />
            <Stat styles={styles} value={String(totals.dirty)} label={t("diaper.dirty")} color={colors.peachSoft} />
            <Stat styles={styles} value={String(data.diapers.filter((d: any) => d.kind === "mixed").length)} label={t("diaper.mixed")} color={colors.lavenderSoft} />
            <Stat styles={styles} value={String(data.diapers.filter((d: any) => d.kind === "dry").length)} label={t("diaper.dry")} color={colors.sageSoft} />
          </View>
          <Text style={styles.h3}>{t("diaper.weekChart")}</Text>
          <BarChart
            data={totals.byDay.map((day) => ({ label: day.date.slice(5), value: day.wet, secondary: day.dirty }))}
            color={colors.sky}
            secondaryColor={colors.peach}
          />
          <Text style={styles.h3}>{t("diaper.history")}</Text>
          <Table styles={styles}
            columns={[t("common.date"), t("common.time"), t("diaper.title"), t("diaper.consistency"), t("common.notes")]}
            widths={[15, 12, 18, 18, 37]}
            rows={(data.diapers as any[]).map((row) => [
              fmtDate(row.occurred_at),
              fmtTime(row.occurred_at),
              row.kind,
              [row.stool_consistency, row.stool_color, row.urine_amount].filter(Boolean).join(" · "),
              row.notes ?? "",
            ])}
            empty={t("diaper.noDiapers")}
          />
          {footer(labels)}
        </Page>
      )}

      {sectionSet.has("sleep") && (
        <Page size="A4" style={styles.page}>
          <SectionHeader styles={styles} kicker={l("includeSleep")} title={t("sleep.title")} meta={`${periodLabel}\n${data.sleeps.length}`} />
          <View style={styles.statRow}>
            <Stat styles={styles} value={durationLabel(totals.sleepSeconds)} label={t("sleep.totalSleep")} color={colors.lavenderSoft} />
            <Stat styles={styles} value={String(totals.naps)} label={t("sleep.naps")} color={colors.skySoft} />
            <Stat styles={styles} value={durationLabel(totals.naps ? totals.sleepSeconds / Math.max(1, totals.naps) : 0)} label={t("sleep.avgNap")} color={colors.sageSoft} />
            <Stat styles={styles} value={String(data.sleeps.filter((s: any) => s.kind === "night").length)} label={t("sleep.night")} color={colors.peachSoft} />
          </View>
          <Text style={styles.h3}>{t("sleep.sleepHistory")}</Text>
          <BarChart
            data={totals.byDay.map((day) => ({ label: day.date.slice(5), value: Math.round(day.sleep / 3600) }))}
            color={colors.lavender}
            secondaryColor={colors.lavenderSoft}
          />
          <Table styles={styles}
            columns={[t("common.date"), t("common.start"), t("common.end"), t("common.duration"), t("common.notes")]}
            widths={[15, 13, 13, 14, 45]}
            rows={(data.sleeps as any[]).map((row) => [
              fmtDate(row.started_at),
              fmtTime(row.started_at),
              row.ended_at ? fmtTime(row.ended_at) : t("time.ongoing"),
              row.ended_at
                ? durationLabel((new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()) / 1000)
                : "—",
              row.notes ?? "",
            ])}
            empty={t("sleep.noSleep")}
          />
          {footer(labels)}
        </Page>
      )}

      {(sectionSet.has("growth") || sectionSet.has("health")) && (
        <Page size="A4" style={styles.page}>
          <SectionHeader styles={styles}
            kicker={[sectionSet.has("growth") ? l("includeGrowth") : "", sectionSet.has("health") ? l("includeHealth") : ""].filter(Boolean).join(" · ")}
            title={[sectionSet.has("growth") ? t("growth.title") : "", sectionSet.has("health") ? t("health.title") : ""].filter(Boolean).join(" & ")}
            meta={periodLabel}
          />
          {sectionSet.has("growth") && (
            <>
              <Text style={styles.h3}>{t("growth.addMeasurement")}</Text>
              <Table styles={styles}
                columns={[t("common.date"), t("growth.weight"), t("growth.height"), t("growth.head"), t("growth.source")]}
                widths={[20, 20, 20, 22, 18]}
                rows={(data.growth as any[]).map((row) => [
                  fmtDate(row.measured_at),
                  row.weight_g ? `${(row.weight_g / 1000).toFixed(2)} kg` : "—",
                  row.height_cm ? `${Number(row.height_cm).toFixed(1)} cm` : "—",
                  row.head_circumference_cm ? `${Number(row.head_circumference_cm).toFixed(1)} cm` : "—",
                  row.source,
                ])}
                empty={t("growth.noGrowth")}
              />
              <Text style={{ fontSize: 7.5, color: colors.muted, marginTop: 8 }}>{t("growth.whoNote")}</Text>
            </>
          )}
          {sectionSet.has("health") && (
            <>
              <Text style={styles.h3}>{t("health.title")}</Text>
              <Table styles={styles}
                columns={[t("common.date"), t("health.medication"), t("health.dose"), t("health.temperature"), t("common.notes")]}
                widths={[15, 26, 14, 13, 32]}
                rows={[
                  ...(data.medLogs as any[]).map((row) => [
                    fmtDate(row.given_at),
                    row.name,
                    row.dose ?? "—",
                    "—",
                    row.notes ?? "",
                  ]),
                  ...(data.temperatures as any[]).map((row) => [
                    fmtDate(row.measured_at),
                    "—",
                    "—",
                    `${row.celsius} °C`,
                    row.notes ?? "",
                  ]),
                ].sort((a, b) => String(a[0]).localeCompare(String(b[0])))}
                empty={t("health.noHealth")}
              />
              <Text style={styles.h3}>{t("health.vaccinations")} & {t("health.appointments")}</Text>
              <Table styles={styles}
                columns={[t("common.date"), t("common.name"), t("health.provider"), t("health.status"), t("common.notes")]}
                widths={[15, 30, 20, 13, 22]}
                rows={[
                  ...(data.vaccinations as any[]).map((row) => [
                    fmtDate(row.administered_date ?? row.scheduled_date),
                    row.name,
                    row.provider ?? "—",
                    row.administered_date ? t("health.completed") : t("health.scheduled"),
                    row.notes ?? "",
                  ]),
                  ...(data.appointments as any[]).map((row) => [
                    fmtDate(row.scheduled_at),
                    row.title,
                    row.doctor ?? "—",
                    row.status,
                    row.notes ?? "",
                  ]),
                ]}
                empty={t("health.noHealth")}
              />
              <Text style={{ fontSize: 7.5, color: colors.muted, marginTop: 8 }}>{t("health.note")}</Text>
            </>
          )}
          {footer(labels)}
        </Page>
      )}

      {(sectionSet.has("activities") || sectionSet.has("milestones") || sectionSet.has("notes")) && (
        <Page size="A4" style={styles.page}>
          <SectionHeader styles={styles}
            kicker={t("reports.recentReports")}
            title={[sectionSet.has("activities") ? t("activities.title") : "", sectionSet.has("milestones") ? t("activities.milestones") : ""].filter(Boolean).join(" & ") || t("common.notes")}
            meta={periodLabel}
          />
          {sectionSet.has("activities") && (
            <>
              <Text style={styles.h3}>{t("activities.timeline")}</Text>
              {(data.activities as any[]).length === 0 ? (
                <Text style={styles.empty}>{t("activities.noActivities")}</Text>
              ) : (
                (data.activities as any[]).map((row) => (
                  <View key={row.id} style={styles.timelineRow} wrap={false}>
                    <Text style={styles.timelineTime}>
                      {fmtDate(row.started_at)} {"\n"} {fmtTime(row.started_at)}
                    </Text>
                    <View style={styles.timelineBody}>
                      <Text style={styles.timelineTitle}>{row.label ?? row.type}</Text>
                      {row.notes ? <Text style={styles.timelineNote}>{row.notes}</Text> : null}
                    </View>
                  </View>
                ))
              )}
            </>
          )}
          {sectionSet.has("milestones") && (
            <>
              <Text style={styles.h3}>{t("activities.milestones")}</Text>
              <Table styles={styles}
                columns={[t("common.date"), t("activities.milestones"), t("common.notes")]}
                widths={[18, 30, 52]}
                rows={(data.milestones as any[]).map((row) => [
                  fmtDate(row.achieved_at),
                  row.title,
                  row.notes ?? "",
                ])}
                empty={t("activities.noMilestones")}
              />
            </>
          )}
          {sectionSet.has("notes") && (
            <>
              <Text style={styles.h3}>{t("common.notes")}</Text>
              {(data.notes as any[]).length === 0 && !note ? (
                <Text style={styles.empty}>{t("common.noRecords")}</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {note ? (
                    <View style={{ backgroundColor: colors.cream, borderRadius: 10, padding: 12 }}>
                      <Text style={styles.kicker}>{l("notesPlaceholder")}</Text>
                      <Text style={styles.note}>{note}</Text>
                    </View>
                  ) : null}
                  {(data.notes as any[]).map((row) => (
                    <View key={row.id} style={{ borderBottom: `0.5 solid ${colors.line}`, paddingBottom: 7 }}>
                      <Text style={{ fontSize: 7.5, color: colors.muted, marginBottom: 3 }}>
                        {fmtDate(row.created_at)} · {fmtTime(row.created_at)}
                      </Text>
                      <Text style={styles.note}>{row.body}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
          <Text style={styles.h3}>{l("contributors")}</Text>
          <View style={styles.chipRow}>
            {data.contributors.map((contributor) => (
              <Text key={contributor.name} style={styles.chip}>
                {contributor.name} · {contributor.role}
              </Text>
            ))}
          </View>
          {footer(labels)}
        </Page>
      )}
    </Document>
  );
}
