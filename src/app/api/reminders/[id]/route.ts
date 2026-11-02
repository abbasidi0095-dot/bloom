import { z } from "zod";
import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const { id } = await context.params;
    const body = z.object({ enabled: z.boolean() }).parse(await request.json());
    await withUser(user.id, async (db) => {
      const result = await db.query(
        `update reminders set enabled = $1, next_due_at = case when $1 then coalesce(next_due_at, now() + interval '1 hour') else null end,
                updated_at = now()
          where id = $2 and deleted_at is null returning id`,
        [body.enabled, id],
      );
      if (!result.rows[0]) throw new ApiError("Reminder not found.", 404, "not_found");
    });
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
      const result = await db.query(
        `update reminders set deleted_at = now(), enabled = false where id = $1 returning id`,
        [id],
      );
      if (!result.rows[0]) throw new ApiError("Reminder not found.", 404, "not_found");
    });
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
