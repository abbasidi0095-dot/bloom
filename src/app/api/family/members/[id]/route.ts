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
    const body = z.object({ role: z.enum(["parent", "caregiver", "viewer"]) }).parse(await request.json());
    await withUser(user.id, async (db) => {
      const target = await db.query<{ id: string; role: string }>(
        `select id, role from family_members where id = $1 and status = 'active'`,
        [id],
      );
      if (!target.rows[0]) throw new ApiError("Member not found.", 404, "not_found");
      if (target.rows[0].role === "owner") throw new ApiError("The owner's role cannot be changed.", 403, "owner_protected");
      const result = await db.query(`update family_members set role = $1 where id = $2 returning id`, [body.role, id]);
      if (!result.rows[0]) throw new ApiError("You don't have permission to change this role.", 403, "forbidden");
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
      const target = await db.query<{ family_id: string; user_id: string; role: string }>(
        `select family_id, user_id, role from family_members where id = $1 and status = 'active'`,
        [id],
      );
      const member = target.rows[0];
      if (!member) throw new ApiError("Member not found.", 404, "not_found");
      if (member.role === "owner") throw new ApiError("The family owner cannot be removed.", 403, "owner_protected");
      const result = await db.query(`update family_members set status = 'removed' where id = $1 returning id`, [id]);
      if (!result.rows[0]) throw new ApiError("You don't have permission to remove this member.", 403, "forbidden");
      await db.query(
        `insert into audit_logs (family_id, actor_id, entity, entity_id, action, details)
         values ($1, $2, 'member', $3, 'remove', $4)`,
        [member.family_id, user.id, id, JSON.stringify({ removed_user: member.user_id })],
      );
    });
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
