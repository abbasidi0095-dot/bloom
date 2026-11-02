import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const { id } = await context.params;
    await withUser(user.id, async (db) => {
      const result = await db.query(
        `update family_invitations set revoked_at = now()
          where id = $1 and revoked_at is null and accepted_at is null returning id`,
        [id],
      );
      if (!result.rows[0]) throw new ApiError("Invitation not found.", 404, "not_found");
    });
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
