import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { babySchema } from "@/lib/schemas";

const map: Record<string, string> = {
  firstName: "first_name",
  lastName: "last_name",
  photoUrl: "photo_url",
  dateOfBirth: "date_of_birth",
  birthTime: "birth_time",
  sex: "sex",
  birthWeightG: "birth_weight_g",
  birthHeightCm: "birth_height_cm",
  headCircumferenceCm: "head_circumference_cm",
  bloodType: "blood_type",
  pediatricianName: "pediatrician_name",
  pediatricianPhone: "pediatrician_phone",
  allergies: "allergies",
  notes: "notes",
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const { id } = await context.params;
    const body = babySchema.partial().parse(await request.json());
    const updates: string[] = [];
    const values: unknown[] = [];
    for (const [key, column] of Object.entries(map)) {
      const value = body[key as keyof typeof body];
      if (value !== undefined) {
        updates.push(`${column} = $${values.length + 1}`);
        values.push(value === "" ? null : value);
      }
    }
    if (!updates.length) return json({ ok: true });
    values.push(id);
    const row = await withUser(user.id, async (db) => {
      const result = await db.query(
        `update babies set ${updates.join(", ")}, updated_at = now()
          where id = $${values.length} and archived_at is null returning id`,
        values,
      );
      return result.rows[0] ?? null;
    });
    if (!row) throw new ApiError("Baby profile not found.", 404, "not_found");
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const { id } = await context.params;
    await withUser(user.id, async (db) => {
      const result = await db.query(`delete from babies where id = $1 returning id`, [id]);
      if (!result.rows[0]) throw new ApiError("Baby profile not found.", 404, "not_found");
    });
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
