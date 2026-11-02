import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { getEntity, softDeleteRecord, updateRecord, validateBody } from "@/lib/records";

export async function PATCH(request: Request, context: { params: Promise<{ entity: string; id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const { entity, id } = await context.params;
    const config = getEntity(entity);
    const body = (await request.json()) as Record<string, unknown>;
    const { id: _id, babyId: _babyId, familyId: _familyId, ...rest } = body;
    void _id;
    void _babyId;
    void _familyId;
    const data = validateBody(config, rest, "update");
    if (!Object.keys(data).length) return json({ ok: true });

    const result = await withUser(user.id, async (db) => {
      const existing = await db.query<{ family_id: string; baby_id: string }>(
        `select family_id, baby_id from ${config.table} where id = $1 and deleted_at is null`,
        [id],
      );
      if (!existing.rows[0]) return { status: "missing" as const };
      const row = await updateRecord(db, entity, id, data);
      if (!row) return { status: "forbidden" as const };
      await db.query(
        `insert into audit_logs (family_id, actor_id, entity, entity_id, action, details)
         values ($1, $2, $3, $4, 'update', $5)`,
        [existing.rows[0].family_id, user.id, entity, id, JSON.stringify(Object.keys(data))],
      );
      return { status: "ok" as const, row };
    });

    if (result.status === "missing") throw new ApiError("Record not found.", 404, "not_found");
    if (result.status === "forbidden") {
      throw new ApiError("You don't have permission to edit this entry.", 403, "forbidden");
    }
    return json({ ok: true, record: result.row });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ entity: string; id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const { entity, id } = await context.params;
    const config = getEntity(entity);

    const result = await withUser(user.id, async (db) => {
      const existing = await db.query<{ family_id: string }>(
        `select family_id from ${config.table} where id = $1 and deleted_at is null`,
        [id],
      );
      if (!existing.rows[0]) return { status: "missing" as const };
      const deleted = await softDeleteRecord(db, entity, id);
      if (!deleted) return { status: "forbidden" as const };
      await db.query(
        `insert into audit_logs (family_id, actor_id, entity, entity_id, action)
         values ($1, $2, $3, $4, 'delete')`,
        [existing.rows[0].family_id, user.id, entity, id],
      );
      return { status: "ok" as const };
    });

    if (result.status === "missing") throw new ApiError("Record not found.", 404, "not_found");
    if (result.status === "forbidden") {
      throw new ApiError("You don't have permission to delete this entry.", 403, "forbidden");
    }
    return json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
