import { ApiError, fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { assertBabyAccess } from "@/lib/family";
import { addDaysKey, endOfDay, rangeDays, startOfDay, todayKey } from "@/lib/format";

function previousRange(from: string, to: string) {
  const days = rangeDays(from, to).length;
  const prevTo = addDaysKey(from, -1);
  const prevFrom = addDaysKey(prevTo, -(days - 1));
  return { from: prevFrom, to: prevTo };
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const url = new URL(request.url);
    const babyId = url.searchParams.get("babyId");
    if (!babyId) throw new ApiError("Baby is required.", 400, "baby_required");
    const access = await assertBabyAccess(user.id, babyId);
    if (!access) throw new ApiError("Baby not found.", 404, "not_found");

    const timeZone = url.searchParams.get("tz") || "UTC";
    const to = url.searchParams.get("to") || todayKey(timeZone);
    const from = url.searchParams.get("from") || addDaysKey(to, -6);
    if (from > to) throw new ApiError("The start date must be before the end date.", 400, "invalid_range");

    const start = startOfDay(from, timeZone).toISOString();
    const end = endOfDay(to, timeZone).toISOString();
    const prev = previousRange(from, to);
    const prevStart = startOfDay(prev.from, timeZone).toISOString();
    const prevEnd = endOfDay(prev.to, timeZone).toISOString();

    const data = await withUser(user.id, async (db) => {
      const feedingSql = `
        select to_char(timezone($4::text, started_at), 'YYYY-MM-DD') as date,
               count(*)::int as feeds,
               coalesce(sum(amount_ml) filter (where type = 'formula'), 0)::int as formula_ml,
               coalesce(sum(amount_ml) filter (where type = 'expressed'), 0)::int as expressed_ml,
               coalesce(sum(left_seconds + right_seconds) filter (where type = 'breast'), 0)::int as breast_seconds
          from feeding_sessions
         where baby_id = $1 and deleted_at is null and started_at >= $2 and started_at < $3
         group by 1 order by 1`;
      const diaperSql = `
        select to_char(timezone($4::text, occurred_at), 'YYYY-MM-DD') as date,
               count(*) filter (where kind in ('wet','mixed'))::int as wet,
               count(*) filter (where kind in ('dirty','mixed'))::int as dirty,
               count(*) filter (where kind = 'mixed')::int as mixed,
               count(*) filter (where kind = 'dry')::int as dry
          from diaper_entries
         where baby_id = $1 and deleted_at is null and occurred_at >= $2 and occurred_at < $3
         group by 1 order by 1`;
      const sleepSql = `
        select to_char(timezone($4::text, started_at), 'YYYY-MM-DD') as date,
               coalesce(sum(extract(epoch from (coalesce(ended_at, now()) - started_at))), 0)::int as seconds,
               coalesce(sum(extract(epoch from (coalesce(ended_at, now()) - started_at))) filter (where kind = 'night'), 0)::int as night_seconds,
               count(*) filter (where kind = 'nap')::int as naps
          from sleep_sessions
         where baby_id = $1 and deleted_at is null and started_at >= $2 and started_at < $3
         group by 1 order by 1`;
      const growthSql = `
        select measured_at, weight_g, height_cm, head_circumference_cm, source
          from growth_measurements
         where baby_id = $1 and deleted_at is null and measured_at >= $2 and measured_at < $3
         order by measured_at asc`;

      const [feeding, diapers, sleep, growth, prevFeeding, prevDiapers, prevSleep, intervals, contributors] =
        await Promise.all([
          db.query(feedingSql, [babyId, start, end, timeZone]),
          db.query(diaperSql, [babyId, start, end, timeZone]),
          db.query(sleepSql, [babyId, start, end, timeZone]),
          db.query(growthSql, [babyId, start, end]),
          db.query(feedingSql, [babyId, prevStart, prevEnd, timeZone]),
          db.query(diaperSql, [babyId, prevStart, prevEnd, timeZone]),
          db.query(sleepSql, [babyId, prevStart, prevEnd, timeZone]),
          db.query<{ avg_interval: string | null }>(
            `select avg(extract(epoch from (started_at - previous_start)))::text as avg_interval
               from (
                 select started_at, lag(started_at) over (order by started_at) as previous_start
                   from feeding_sessions
                  where baby_id = $1 and deleted_at is null and started_at >= $2 and started_at < $3
               ) gaps where previous_start is not null`,
            [babyId, start, end],
          ),
          db.query<{ name: string }>(
            `select distinct u.name
               from (
                 select recorded_by from feeding_sessions where baby_id = $1 and deleted_at is null and started_at >= $2 and started_at < $3
                 union all select recorded_by from diaper_entries where baby_id = $1 and deleted_at is null and occurred_at >= $2 and occurred_at < $3
                 union all select recorded_by from sleep_sessions where baby_id = $1 and deleted_at is null and started_at >= $2 and started_at < $3
                 union all select recorded_by from activities where baby_id = $1 and deleted_at is null and started_at >= $2 and started_at < $3
               ) e join users u on u.id = e.recorded_by`,
            [babyId, start, end],
          ),
        ]);

      const sum = (rows: Array<Record<string, unknown>>, key: string) =>
        rows.reduce((acc, row) => acc + Number(row[key] ?? 0), 0);

      return {
        from,
        to,
        timeZone,
        feeding: {
          series: feeding.rows,
          totals: {
            feeds: sum(feeding.rows, "feeds"),
            formulaMl: sum(feeding.rows, "formula_ml"),
            expressedMl: sum(feeding.rows, "expressed_ml"),
            breastSeconds: sum(feeding.rows, "breast_seconds"),
            avgIntervalSeconds: Math.round(Number(intervals.rows[0]?.avg_interval ?? 0)),
          },
          previous: {
            feeds: sum(prevFeeding.rows, "feeds"),
            formulaMl: sum(prevFeeding.rows, "formula_ml"),
            expressedMl: sum(prevFeeding.rows, "expressed_ml"),
            breastSeconds: sum(prevFeeding.rows, "breast_seconds"),
          },
        },
        diapers: {
          series: diapers.rows,
          totals: {
            wet: sum(diapers.rows, "wet"),
            dirty: sum(diapers.rows, "dirty"),
            mixed: sum(diapers.rows, "mixed"),
            dry: sum(diapers.rows, "dry"),
          },
          previous: {
            wet: sum(prevDiapers.rows, "wet"),
            dirty: sum(prevDiapers.rows, "dirty"),
          },
        },
        sleep: {
          series: sleep.rows,
          totals: {
            seconds: sum(sleep.rows, "seconds"),
            nightSeconds: sum(sleep.rows, "night_seconds"),
            naps: sum(sleep.rows, "naps"),
          },
          previous: {
            seconds: sum(prevSleep.rows, "seconds"),
            nightSeconds: sum(prevSleep.rows, "night_seconds"),
            naps: sum(prevSleep.rows, "naps"),
          },
        },
        growth: { series: growth.rows },
        contributors: contributors.rows.map((row) => row.name),
        days: rangeDays(from, to).length,
      };
    });

    return json({ ok: true, ...data });
  } catch (error) {
    return fail(error);
  }
}
