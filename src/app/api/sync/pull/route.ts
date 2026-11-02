import { ApiError, fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { records } from "@/lib/records";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const url = new URL(request.url);
    const familyId = url.searchParams.get("familyId");
    if (!familyId) throw new ApiError("Family is required.", 400, "family_required");
    const since = url.searchParams.get("since") || new Date(0).toISOString();

    const data = await withUser(user.id, async (db) => {
      const member = await db.query(
        `select role from family_members where family_id = $1 and user_id = $2 and status = 'active'`,
        [familyId, user.id],
      );
      if (!member.rows[0]) throw new ApiError("You don't have access to this family.", 403, "forbidden");

      const changes: Record<string, unknown[]> = {};
      for (const [entity, config] of Object.entries(records)) {
        const rows = await db.query(
          `select * from ${config.table}
            where family_id = $1 and updated_at > $2
            order by updated_at asc limit 2000`,
          [familyId, since],
        );
        changes[entity] = rows.rows;
      }
      const babies = await db.query(
        `select * from babies where family_id = $1 order by created_at asc`,
        [familyId],
      );
      const now = await db.query<{ now: string }>("select now()");
      return { changes, babies: babies.rows, cursor: now.rows[0].now };
    });

    return json({ ok: true, ...data });
  } catch (error) {
    return fail(error);
  }
}
