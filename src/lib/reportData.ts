import type { Db } from "./db";

export type ReportData = Awaited<ReturnType<typeof getReportData>>;

export async function getReportData(
  db: Db,
  input: { babyId: string; familyId: string; from: string; to: string; start: string; end: string; timeZone: string },
) {
  const baby = await db.query(
    `select * from babies where id = $1 and family_id = $2`,
    [input.babyId, input.familyId],
  );
  const family = await db.query(`select id, name, owner_id from families where id = $1`, [input.familyId]);
  const members = await db.query(
    `select u.name, fm.role from family_members fm join users u on u.id = fm.user_id
      where fm.family_id = $1 and fm.status = 'active' order by fm.joined_at`,
    [input.familyId],
  );
  const feedings = await db.query(
    `select * from feeding_sessions where baby_id = $1 and deleted_at is null
      and started_at >= $2 and started_at <= $3 order by started_at`,
    [input.babyId, input.start, input.end],
  );
  const diapers = await db.query(
    `select * from diaper_entries where baby_id = $1 and deleted_at is null
      and occurred_at >= $2 and occurred_at <= $3 order by occurred_at`,
    [input.babyId, input.start, input.end],
  );
  const sleeps = await db.query(
    `select * from sleep_sessions where baby_id = $1 and deleted_at is null
      and started_at >= $2 and started_at <= $3 order by started_at`,
    [input.babyId, input.start, input.end],
  );
  const growth = await db.query(
    `select * from growth_measurements where baby_id = $1 and deleted_at is null
      and measured_at >= $2 and measured_at <= $3 order by measured_at`,
    [input.babyId, input.start, input.end],
  );
  const medications = await db.query(
    `select * from medications where baby_id = $1 and deleted_at is null and created_at <= $3
      and (end_date is null or end_date >= $2::date) order by created_at`,
    [input.babyId, input.start, input.end],
  );
  const medLogs = await db.query(
    `select * from medication_logs where baby_id = $1 and deleted_at is null
      and given_at >= $2 and given_at <= $3 order by given_at`,
    [input.babyId, input.start, input.end],
  );
  const temperatures = await db.query(
    `select * from temperature_records where baby_id = $1 and deleted_at is null
      and measured_at >= $2 and measured_at <= $3 order by measured_at`,
    [input.babyId, input.start, input.end],
  );
  const vaccinations = await db.query(
    `select * from vaccinations where baby_id = $1 and deleted_at is null
      and (administered_date between $2::date and $3::date or scheduled_date between $2::date and $3::date)
      order by coalesce(administered_date, scheduled_date)`,
    [input.babyId, input.start, input.end],
  );
  const appointments = await db.query(
    `select * from appointments where baby_id = $1 and deleted_at is null
      and scheduled_at >= $2 and scheduled_at <= $3 order by scheduled_at`,
    [input.babyId, input.start, input.end],
  );
  const activities = await db.query(
    `select * from activities where baby_id = $1 and deleted_at is null
      and started_at >= $2 and started_at <= $3 order by started_at`,
    [input.babyId, input.start, input.end],
  );
  const milestones = await db.query(
    `select * from milestones where baby_id = $1 and deleted_at is null
      and achieved_at >= $2 and achieved_at <= $3 order by achieved_at`,
    [input.babyId, input.start, input.end],
  );
  const notes = await db.query(
    `select * from baby_notes where baby_id = $1 and deleted_at is null
      and created_at >= $2 and created_at <= $3 order by created_at`,
    [input.babyId, input.start, input.end],
  );
  const contributors = await db.query<{ name: string; role: string }>(
    `select distinct u.name, fm.role
       from (
         select recorded_by from feeding_sessions where baby_id = $1 and deleted_at is null and started_at between $2 and $3
         union all select recorded_by from diaper_entries where baby_id = $1 and deleted_at is null and occurred_at between $2 and $3
         union all select recorded_by from sleep_sessions where baby_id = $1 and deleted_at is null and started_at between $2 and $3
         union all select recorded_by from activities where baby_id = $1 and deleted_at is null and started_at between $2 and $3
         union all select recorded_by from growth_measurements where baby_id = $1 and deleted_at is null and measured_at between $2 and $3
       ) e
       join users u on u.id = e.recorded_by
       join family_members fm on fm.user_id = u.id and fm.family_id = $4
      order by u.name`,
    [input.babyId, input.start, input.end, input.familyId],
  );

  return {
    meta: input,
    baby: baby.rows[0] ?? null,
    family: family.rows[0] ?? null,
    members: members.rows,
    feedings: feedings.rows,
    diapers: diapers.rows,
    sleeps: sleeps.rows,
    growth: growth.rows,
    medications: medications.rows,
    medLogs: medLogs.rows,
    temperatures: temperatures.rows,
    vaccinations: vaccinations.rows,
    appointments: appointments.rows,
    activities: activities.rows,
    milestones: milestones.rows,
    notes: notes.rows,
    contributors: contributors.rows,
  };
}

export function reportTotals(data: ReportData) {
  const formulaMl = data.feedings.reduce(
    (sum, row: { type: string; amount_ml: number | null }) =>
      sum + (row.type === "formula" ? Number(row.amount_ml ?? 0) : 0),
    0,
  );
  const expressedMl = data.feedings.reduce(
    (sum, row: { type: string; amount_ml: number | null }) =>
      sum + (row.type === "expressed" ? Number(row.amount_ml ?? 0) : 0),
    0,
  );
  const breastSeconds = data.feedings.reduce(
    (sum, row: { left_seconds: number; right_seconds: number }) =>
      sum + Number(row.left_seconds ?? 0) + Number(row.right_seconds ?? 0),
    0,
  );
  const sleepSeconds = data.sleeps.reduce((sum, row: any) => {
    if (!row.ended_at) return sum;
    return sum + Math.max(0, (new Date(row.ended_at).getTime() - new Date(row.started_at).getTime()) / 1000);
  }, 0);
  const naps = data.sleeps.filter((row: any) => row.kind === "nap").length;
  const wet = data.diapers.filter((row: any) => ["wet", "mixed"].includes(row.kind)).length;
  const dirty = data.diapers.filter((row: any) => ["dirty", "mixed"].includes(row.kind)).length;

  const byDay = new Map<string, { feeds: number; formula: number; wet: number; dirty: number; sleep: number }>();
  const keyFor = (value: string) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: data.meta.timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(value));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "01";
    return `${get("year")}-${get("month")}-${get("day")}`;
  };
  for (const feed of data.feedings as any[]) {
    const key = keyFor(feed.started_at);
    const day = byDay.get(key) ?? { feeds: 0, formula: 0, wet: 0, dirty: 0, sleep: 0 };
    day.feeds += 1;
    if (feed.type === "formula") day.formula += Number(feed.amount_ml ?? 0);
    byDay.set(key, day);
  }
  for (const diaper of data.diapers as any[]) {
    const key = keyFor(diaper.occurred_at);
    const day = byDay.get(key) ?? { feeds: 0, formula: 0, wet: 0, dirty: 0, sleep: 0 };
    if (["wet", "mixed"].includes(diaper.kind)) day.wet += 1;
    if (["dirty", "mixed"].includes(diaper.kind)) day.dirty += 1;
    byDay.set(key, day);
  }
  for (const sleep of data.sleeps as any[]) {
    if (!sleep.ended_at) continue;
    const key = keyFor(sleep.started_at);
    const day = byDay.get(key) ?? { feeds: 0, formula: 0, wet: 0, dirty: 0, sleep: 0 };
    day.sleep += Math.max(0, (new Date(sleep.ended_at).getTime() - new Date(sleep.started_at).getTime()) / 1000);
    byDay.set(key, day);
  }

  return {
    feeds: data.feedings.length,
    formulaMl,
    expressedMl,
    breastSeconds,
    sleepSeconds,
    naps,
    wet,
    dirty,
    byDay: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, ...value })),
    latestGrowth: data.growth[data.growth.length - 1] ?? null,
  };
}
