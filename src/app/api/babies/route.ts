import { z } from "zod";
import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { setActiveFamilyCookies } from "@/lib/family";
import { babySchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const body = babySchema.extend({ familyId: z.string().uuid() }).parse(await request.json());

    const baby = await withUser(user.id, async (db) => {
      const membership = await db.query<{ role: string }>(
        `select role from family_members where family_id = $1 and user_id = $2 and status = 'active'`,
        [body.familyId, user.id],
      );
      if (!membership.rows[0] || !["owner", "parent"].includes(membership.rows[0].role)) {
        throw new ApiError("You don't have permission to add a baby to this family.", 403, "forbidden");
      }
      const inserted = await db.query<{ id: string }>(
        `insert into babies (
           family_id, first_name, last_name, photo_url, date_of_birth, birth_time, sex,
           birth_weight_g, birth_height_cm, head_circumference_cm, blood_type,
           pediatrician_name, pediatrician_phone, allergies, notes, created_by
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         returning id`,
        [
          body.familyId,
          body.firstName,
          body.lastName ?? null,
          body.photoUrl ?? null,
          body.dateOfBirth,
          body.birthTime ?? null,
          body.sex,
          body.birthWeightG ?? null,
          body.birthHeightCm ?? null,
          body.headCircumferenceCm ?? null,
          body.bloodType ?? null,
          body.pediatricianName ?? null,
          body.pediatricianPhone ?? null,
          body.allergies ?? null,
          body.notes ?? null,
          user.id,
        ],
      );
      return inserted.rows[0];
    });

    await setActiveFamilyCookies(body.familyId, baby.id);
    return json({ ok: true, babyId: baby.id }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
