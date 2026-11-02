import type { Db } from "./db";

const TIMELINE_SQL = `
with entries as (
  select 'feedings' as entity, id, baby_id, started_at as occurred_at, ended_at,
         type as kind, amount_ml, (left_seconds + right_seconds) as duration_seconds,
         coalesce(formula_brand, case when type = 'breast' then 'Breastfeeding'
           when type = 'formula' then 'Formula' when type = 'expressed' then 'Expressed milk'
           else 'Solids' end) as title,
         notes, recorded_by,
         jsonb_build_object(
           'leftSeconds', left_seconds, 'rightSeconds', right_seconds,
           'waterMl', water_ml, 'powderG', powder_g, 'storage', storage_location
         ) as meta
    from feeding_sessions
   where baby_id = $1 and deleted_at is null
     and ($2::timestamptz is null or started_at >= $2)
     and ($3::timestamptz is null or started_at <= $3)
  union all
  select 'diapers', id, baby_id, occurred_at, null,
         kind, null, null,
         case kind when 'wet' then 'Wet diaper' when 'dirty' then 'Dirty diaper'
           when 'mixed' then 'Wet & dirty' else 'Dry diaper' end,
         notes, recorded_by,
         jsonb_build_object('urineAmount', urine_amount, 'stoolConsistency', stool_consistency,
           'stoolColor', stool_color, 'urineColor', urine_color)
    from diaper_entries
   where baby_id = $1 and deleted_at is null
     and ($2::timestamptz is null or occurred_at >= $2)
     and ($3::timestamptz is null or occurred_at <= $3)
  union all
  select 'sleeps', id, baby_id, started_at, ended_at,
         kind, null,
         case when ended_at is null then extract(epoch from (now() - started_at))::int
              else extract(epoch from (ended_at - started_at))::int end,
         case kind when 'night' then 'Night sleep' else 'Nap' end,
         notes, recorded_by,
         jsonb_build_object('quality', quality, 'interruptions', interruptions)
    from sleep_sessions
   where baby_id = $1 and deleted_at is null
     and ($2::timestamptz is null or started_at >= $2)
     and ($3::timestamptz is null or started_at <= $3)
  union all
  select 'growth', id, baby_id, measured_at, null,
         source, null, null, 'Growth measurement', notes, recorded_by,
         jsonb_build_object('weightG', weight_g, 'heightCm', height_cm,
           'headCircumferenceCm', head_circumference_cm)
    from growth_measurements
   where baby_id = $1 and deleted_at is null
     and ($2::timestamptz is null or measured_at >= $2)
     and ($3::timestamptz is null or measured_at <= $3)
  union all
  select 'medicationLogs', id, baby_id, given_at, null,
         'medication', null, null, name, notes, recorded_by,
         jsonb_build_object('dose', dose, 'medicationId', medication_id)
    from medication_logs
   where baby_id = $1 and deleted_at is null
     and ($2::timestamptz is null or given_at >= $2)
     and ($3::timestamptz is null or given_at <= $3)
  union all
  select 'temperatures', id, baby_id, measured_at, null,
         'temperature', null, null, 'Temperature', notes, recorded_by,
         jsonb_build_object('celsius', celsius, 'method', method)
    from temperature_records
   where baby_id = $1 and deleted_at is null
     and ($2::timestamptz is null or measured_at >= $2)
     and ($3::timestamptz is null or measured_at <= $3)
  union all
  select 'activities', id, baby_id, started_at, ended_at,
         type, amount_ml,
         case when ended_at is null then null else extract(epoch from (ended_at - started_at))::int end,
         coalesce(label, initcap(type)), notes, recorded_by, metadata
    from activities
   where baby_id = $1 and deleted_at is null
     and ($2::timestamptz is null or started_at >= $2)
     and ($3::timestamptz is null or started_at <= $3)
  union all
  select 'milestones', id, baby_id, achieved_at, null,
         'milestone', null, null, title, notes, recorded_by,
         jsonb_build_object('photoUrl', photo_url)
    from milestones
   where baby_id = $1 and deleted_at is null
     and ($2::timestamptz is null or achieved_at >= $2)
     and ($3::timestamptz is null or achieved_at <= $3)
  union all
  select 'appointments', id, baby_id, scheduled_at, null,
         'appointment', null, null, title, notes, recorded_by,
         jsonb_build_object('doctor', doctor, 'location', location, 'status', status)
    from appointments
   where baby_id = $1 and deleted_at is null
     and ($2::timestamptz is null or scheduled_at >= $2)
     and ($3::timestamptz is null or scheduled_at <= $3)
  union all
  select 'symptoms', id, baby_id, occurred_at, null,
         'symptom', null, null, description, notes, recorded_by,
         jsonb_build_object('severity', severity)
    from symptoms
   where baby_id = $1 and deleted_at is null
     and ($2::timestamptz is null or occurred_at >= $2)
     and ($3::timestamptz is null or occurred_at <= $3)
)
select e.*, u.name as recorded_by_name
  from entries e
  join users u on u.id = e.recorded_by
 where ($4::text = 'all' or e.entity = $4::text)
   and ($5::text = '' or coalesce(e.notes,'') ilike '%' || $5 || '%' or coalesce(e.title,'') ilike '%' || $5 || '%')
 order by e.occurred_at {{order}}
 limit {{limit}}`;

export type TimelineEntry = {
  entity: string;
  id: string;
  baby_id: string;
  occurred_at: string;
  ended_at: string | null;
  kind: string | null;
  amount_ml: number | null;
  duration_seconds: number | null;
  title: string;
  notes: string | null;
  recorded_by: string;
  recorded_by_name: string;
  meta: Record<string, unknown>;
};

export async function getTimeline(
  db: Db,
  input: {
    babyId: string;
    from?: string | null;
    to?: string | null;
    entity?: string;
    search?: string;
    limit?: number;
    ascending?: boolean;
  },
) {
  const limit = Math.min(Math.max(input.limit ?? 300, 1), 1000);
  const sql = TIMELINE_SQL.replace("{{order}}", input.ascending ? "asc" : "desc").replace(
    "{{limit}}",
    String(limit),
  );
  const result = await db.query<TimelineEntry>(sql, [
    input.babyId,
    input.from ?? null,
    input.to ?? null,
    input.entity ?? "all",
    input.search ?? "",
  ]);
  return result.rows;
}
