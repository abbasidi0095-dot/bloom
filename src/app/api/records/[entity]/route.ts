import { ApiError, assertSameOrigin, fail, json, parseLimit } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { assertBabyAccess, canWrite } from "@/lib/family";
import { getEntity, insertRecord, validateBody } from "@/lib/records";

export async function GET(request: Request, context: { params: Promise<{ entity: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const { entity } = await context.params;
    const config = getEntity(entity);
    const url = new URL(request.url);
    const babyId = url.searchParams.get("babyId");
    if (!babyId) throw new ApiError("Baby is required.", 400, "baby_required");
    const access = await assertBabyAccess(user.id, babyId);
    if (!access) throw new ApiError("Baby not found.", 404, "not_found");

    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const search = url.searchParams.get("search")?.trim();
    const limit = parseLimit(url.searchParams.get("limit"), 200, 1000);
    const order = url.searchParams.get("order") === "asc" ? "asc" : config.defaultOrder.includes("desc") ? "desc" : "asc";
    const open = url.searchParams.get("open") === "true";

    const rows = await withUser(user.id, async (db) => {
      const where = [`t.baby_id = $1`, `t.deleted_at is null`];
      const values: unknown[] = [babyId];
      if (from) {
        values.push(from);
        where.push(`t.${config.timeColumn} >= $${values.length}`);
      }
      if (to) {
        values.push(to);
        where.push(`t.${config.timeColumn} <= $${values.length}`);
      }
      if (search) {
        values.push(`%${search}%`);
        const extra =
          entity === "notes"
            ? "t.body"
            : entity === "activities"
              ? "(coalesce(t.notes, '') || ' ' || coalesce(t.label, ''))"
              : "coalesce(t.notes, '')";
        where.push(`${extra} ilike $${values.length}`);
      }
      if (open) where.push(`t.ended_at is null`);
      const result = await db.query(
        `select t.*, u.name as recorded_by_name
           from ${config.table} t
           join users u on u.id = t.recorded_by
          where ${where.join(" and ")}
          order by t.${config.timeColumn} ${open ? "desc" : order}
          limit ${limit}`,
        values,
      );
      return result.rows;
    });

    return json({ ok: true, records: rows });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ entity: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const { entity } = await context.params;
    const config = getEntity(entity);
    const body = (await request.json()) as Record<string, unknown>;
    const babyId = body.babyId;
    if (typeof babyId !== "string") throw new ApiError("Baby is required.", 400, "baby_required");

    const access = await assertBabyAccess(user.id, babyId);
    if (!access) throw new ApiError("Baby not found.", 404, "not_found");
    if (!canWrite(access.role)) {
      throw new ApiError("You don't have permission to add records.", 403, "forbidden");
    }

    const { babyId: _babyId, familyId: _familyId, id: rawId, ...rest } = body;
    void _babyId;
    void _familyId;
    const clientId =
      typeof rawId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawId)
        ? rawId
        : undefined;
    const data = validateBody(config, rest, "create");

    const record = await withUser(user.id, async (db) => {
      const row = await insertRecord(db, entity, {
        familyId: access.family_id,
        babyId,
        userId: user.id,
        id: clientId,
      }, data);
      await db.query(
        `insert into audit_logs (family_id, actor_id, entity, entity_id, action)
         values ($1, $2, $3, $4, 'create')`,
        [access.family_id, user.id, entity, row.id],
      );
      if (entity === "feedings" && row.started_at) {
        await db.query(`select bump_feeding_reminders($1, $2, $3)`, [
          access.family_id,
          babyId,
          row.started_at,
        ]);
      }
      return row;
    });

    return json({ ok: true, record }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
