import { z } from "zod";
import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const rows = await withUser(user.id, async (db) => {
      const result = await db.query(
        `select id, title, body, url, read_at, created_at
           from notifications where user_id = $1
          order by created_at desc limit 60`,
        [user.id],
      );
      return result.rows;
    });
    return json({ ok: true, notifications: rows });
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const body = z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() }).parse(await request.json());
    await withUser(user.id, async (db) => {
      if (body.all) {
        await db.query(`update notifications set read_at = now() where user_id = $1 and read_at is null`, [user.id]);
      } else if (body.id) {
        await db.query(`update notifications set read_at = now() where id = $1 and user_id = $2`, [body.id, user.id]);
      }
    });
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
