import { z } from "zod";
import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { setActiveFamilyCookies } from "@/lib/family";
import { familySchema } from "@/lib/schemas";
import { getI18n } from "@/i18n/server";

function babyColumns(baby: z.infer<typeof familySchema>["baby"], familyId: string, userId: string) {
  if (!baby) return null;
  return {
    values: [
      familyId,
      baby.firstName,
      baby.lastName ?? null,
      baby.photoUrl ?? null,
      baby.dateOfBirth,
      baby.birthTime ?? null,
      baby.sex,
      baby.birthWeightG ?? null,
      baby.birthHeightCm ?? null,
      baby.headCircumferenceCm ?? null,
      baby.bloodType ?? null,
      baby.pediatricianName ?? null,
      baby.pediatricianPhone ?? null,
      baby.allergies ?? null,
      baby.notes ?? null,
      userId,
    ],
  };
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const body = familySchema.parse(await request.json());
    const { dict } = await getI18n();

    const result = await withUser(user.id, async (db) => {
      const family = await db.query<{ id: string; name: string }>(
        `insert into families (name, owner_id) values ($1, $2) returning id, name`,
        [body.name.trim(), user.id],
      );
      const created = family.rows[0];
      await db.query(
        `insert into family_members (family_id, user_id, role, status) values ($1, $2, 'owner', 'active')`,
        [created.id, user.id],
      );
      let babyId: string | null = null;
      const baby = babyColumns(body.baby, created.id, user.id);
      if (baby) {
        const inserted = await db.query<{ id: string }>(
          `insert into babies (
             family_id, first_name, last_name, photo_url, date_of_birth, birth_time, sex,
             birth_weight_g, birth_height_cm, head_circumference_cm, blood_type,
             pediatrician_name, pediatrician_phone, allergies, notes, created_by
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           returning id`,
          baby.values,
        );
        babyId = inserted.rows[0].id;
      }
      await db.query(
        `insert into reminders (
           family_id, baby_id, type, label, enabled, schedule_kind, interval_minutes,
           next_due_at, created_by
         ) values ($1, $2, 'feeding', $3, true, 'interval', 180, now() + interval '3 hours', $4)`,
        [created.id, babyId, dict["reminders.types.feeding"] ?? "Feeding", user.id],
      );
      await db.query(
        `insert into audit_logs (family_id, actor_id, entity, action, details)
         values ($1, $2, 'family', 'create', $3)`,
        [created.id, user.id, JSON.stringify({ name: created.name })],
      );
      return { family: created, babyId };
    });

    await setActiveFamilyCookies(result.family.id, result.babyId ?? undefined);
    return json({ ok: true, family: result.family, babyId: result.babyId, next: "/dashboard" }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
