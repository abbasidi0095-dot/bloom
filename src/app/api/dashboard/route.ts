import { ApiError, fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { assertBabyAccess } from "@/lib/family";
import { endOfDay, startOfDay, todayKey } from "@/lib/format";
import { getTimeline } from "@/lib/timeline";

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
    const date = url.searchParams.get("date") || todayKey(timeZone);
    const start = startOfDay(date, timeZone).toISOString();
    const end = endOfDay(date, timeZone).toISOString();

    const data = await withUser(user.id, async (db) => {
      const [lastFeed, lastDiaper, openSleep, feedingTotals, diaperTotals, sleepTotals, reminders, timeline] =
        await Promise.all([
          db.query(
            `select id, type, started_at, ended_at, amount_ml, left_seconds, right_seconds, formula_brand
               from feeding_sessions where baby_id = $1 and deleted_at is null
              order by started_at desc limit 1`,
            [babyId],
          ),
          db.query(
            `select id, kind, occurred_at from diaper_entries where baby_id = $1 and deleted_at is null
              order by occurred_at desc limit 1`,
            [babyId],
          ),
          db.query(
            `select id, started_at, kind from sleep_sessions
              where baby_id = $1 and ended_at is null and deleted_at is null
              order by started_at desc limit 1`,
            [babyId],
          ),
          db.query(
            `select count(*)::int as sessions,
                    coalesce(sum(amount_ml) filter (where type = 'formula'), 0)::int as formula_ml,
                    coalesce(sum(amount_ml) filter (where type = 'expressed'), 0)::int as expressed_ml,
                    coalesce(sum(left_seconds + right_seconds) filter (where type = 'breast'), 0)::int as breast_seconds
               from feeding_sessions
              where baby_id = $1 and deleted_at is null and started_at between $2 and $3`,
            [babyId, start, end],
          ),
          db.query(
            `select
               count(*) filter (where kind in ('wet','mixed'))::int as wet,
               count(*) filter (where kind in ('dirty','mixed'))::int as dirty,
               count(*)::int as total
             from diaper_entries
             where baby_id = $1 and deleted_at is null and occurred_at between $2 and $3`,
            [babyId, start, end],
          ),
          db.query(
            `select coalesce(sum(extract(epoch from (
                      least(coalesce(ended_at, now()), $3::timestamptz) -
                      greatest(started_at, $2::timestamptz)
                    ))), 0)::int as seconds,
                    count(*) filter (where kind = 'nap')::int as naps,
                    coalesce(sum(extract(epoch from (
                      least(coalesce(ended_at, now()), $3::timestamptz) -
                      greatest(started_at, $2::timestamptz)
                    ))) filter (where kind = 'night'), 0)::int as night_seconds
               from sleep_sessions
              where baby_id = $1 and deleted_at is null
                and started_at < $3 and coalesce(ended_at, now()) > $2`,
            [babyId, start, end],
          ),
          db.query(
            `select id, label, type, next_due_at, schedule_kind, interval_minutes, times
               from reminders
              where family_id = $1 and enabled and deleted_at is null
              order by next_due_at asc nulls last limit 3`,
            [access.family_id],
          ),
          getTimeline(db, { babyId, from: start, to: end, limit: 10, ascending: true }),
        ]);

      return {
        date,
        timeZone,
        dayStart: start,
        dayEnd: end,
        lastFeed: lastFeed.rows[0] ?? null,
        lastDiaper: lastDiaper.rows[0] ?? null,
        openSleep: openSleep.rows[0] ?? null,
        feeding: feedingTotals.rows[0],
        diapers: diaperTotals.rows[0],
        sleep: sleepTotals.rows[0],
        reminders: reminders.rows,
        timeline,
      };
    });

    return json({ ok: true, ...data });
  } catch (error) {
    return fail(error);
  }
}
