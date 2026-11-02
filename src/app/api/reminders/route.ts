import { z } from "zod";
import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { canManage, type Role } from "@/lib/family";
import { addDaysKey, todayKey, zonedToUtc } from "@/lib/format";
import { reminderSchema } from "@/lib/schemas";

function nextDailyDue(times: string[], days: number[] | undefined, timeZone: string) {
  const now = Date.now();
  const allowed = days && days.length ? new Set(days) : null;
  for (let offset = 0; offset < 8; offset += 1) {
    const key = addDaysKey(todayKey(timeZone), offset);
    const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
    if (allowed && !allowed.has(weekday)) continue;
    for (const time of [...times].sort()) {
      const due = zonedToUtc(key, time, timeZone);
      if (due.getTime() > now) return due;
    }
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const familyId = new URL(request.url).searchParams.get("familyId");
    if (!familyId) throw new ApiError("Family is required.", 400, "family_required");
    const rows = await withUser(user.id, async (db) => {
      const result = await db.query(
        `select r.*, b.first_name as baby_name from reminders r
           left join babies b on b.id = r.baby_id
          where r.family_id = $1 and r.deleted_at is null
          order by r.created_at desc`,
        [familyId],
      );
      return result.rows;
    });
    return json({ ok: true, reminders: rows });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const body = reminderSchema
      .extend({ familyId: z.string().uuid() })
      .parse(await request.json());

    const created = await withUser(user.id, async (db) => {
      const membership = await db.query<{ role: string }>(
        `select role from family_members where family_id = $1 and user_id = $2 and status = 'active'`,
        [body.familyId, user.id],
      );
      if (!membership.rows[0] || !canManage(membership.rows[0].role as Role)) {
        throw new ApiError("Only parents and owners can create reminders.", 403, "forbidden");
      }
      const profile = await db.query<{ timezone: string }>(
        `select timezone from profiles where user_id = $1`,
        [user.id],
      );
      const tz = profile.rows[0]?.timezone || "UTC";
      let nextDue: Date | null = null;
      if (body.scheduleKind === "interval") {
        nextDue = new Date(Date.now() + (body.intervalMinutes ?? 180) * 60_000);
      } else {
        nextDue = nextDailyDue(body.times?.length ? body.times : ["09:00"], body.days ?? undefined, tz);
      }
      const inserted = await db.query(
        `insert into reminders (
           family_id, baby_id, type, label, enabled, schedule_kind, interval_minutes,
           times, days, next_due_at, created_by
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         returning *`,
        [
          body.familyId,
          body.babyId ?? null,
          body.type,
          body.label,
          body.enabled ?? true,
          body.scheduleKind,
          body.intervalMinutes ?? null,
          body.times ?? null,
          body.days ?? null,
          nextDue,
          user.id,
        ],
      );
      return inserted.rows[0];
    });

    return json({ ok: true, reminder: created }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
