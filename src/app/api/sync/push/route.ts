import { z } from "zod";
import { ApiError, assertSameOrigin, fail, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { getEntity, insertRecord, softDeleteRecord, updateRecord, validateBody } from "@/lib/records";
import { canWrite, type Role } from "@/lib/family";

const bodySchema = z.object({
  familyId: z.string().uuid(),
  mutations: z.array(
    z.object({
      entity: z.string().max(40),
      op: z.enum(["create", "update", "delete"]),
      id: z.string().uuid(),
      data: z.record(z.string(), z.unknown()).optional(),
      baseVersion: z.coerce.number().int().min(0).optional(),
    }),
  ).max(100),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const body = bodySchema.parse(await request.json());

    const results = await withUser(user.id, async (db) => {
      const memberships = await db.query<{ family_id: string; role: Role }>(
        `select family_id, role from family_members where user_id = $1 and status = 'active'`,
        [user.id],
      );
      const roles = new Map(memberships.rows.map((row) => [row.family_id, row.role]));
      if (!roles.has(body.familyId)) {
        throw new ApiError("You don't have access to this family.", 403, "forbidden");
      }
      const output: Array<Record<string, unknown>> = [];

      for (const mutation of body.mutations) {
        let config;
        try {
          config = getEntity(mutation.entity);
        } catch {
          output.push({ id: mutation.id, status: "error", error: "Unknown record type" });
          continue;
        }

        const savepoint = `m_${mutation.id.replace(/-/g, "")}`;
        await db.query(`savepoint ${savepoint}`);
        try {
          if (mutation.op === "create") {
            const babyId = mutation.data?.babyId;
            if (typeof babyId !== "string") throw new Error("baby_required");
            const baby = await db.query<{ family_id: string; role: Role }>(
              `select b.family_id, fm.role from babies b
                 join family_members fm on fm.family_id = b.family_id
                where b.id = $1 and fm.user_id = $2 and fm.status = 'active'`,
              [babyId, user.id],
            );
            if (!baby.rows[0] || baby.rows[0].family_id !== body.familyId) {
              throw new ApiError("Baby not found.", 404, "not_found");
            }
            if (!canWrite(baby.rows[0].role)) throw new ApiError("Read-only access.", 403, "forbidden");
            const data = { ...mutation.data };
            delete data.babyId;
            const parsed = validateBody(config, data, "create");
            const row = await insertRecord(db, mutation.entity, {
              familyId: body.familyId,
              babyId,
              userId: user.id,
              id: mutation.id,
            }, parsed);
            if (mutation.entity === "feedings" && row.started_at) {
              await db.query(`select bump_feeding_reminders($1, $2, $3)`, [
                body.familyId,
                babyId,
                row.started_at,
              ]);
            }
            output.push({ id: mutation.id, status: "applied", record: row });
          } else if (mutation.op === "update") {
            const current = await db.query<{ version: number; family_id: string; baby_id: string }>(
              `select version, family_id, baby_id from ${config.table} where id = $1`,
              [mutation.id],
            );
            const row = current.rows[0];
            if (!row || row.family_id !== body.familyId) {
              output.push({ id: mutation.id, status: "error", error: "Record not found" });
            } else if (
              mutation.baseVersion !== undefined &&
              row.version > mutation.baseVersion
            ) {
              const server = await db.query(`select * from ${config.table} where id = $1`, [mutation.id]);
              output.push({ id: mutation.id, status: "conflict", record: server.rows[0] });
            } else {
              const data = { ...(mutation.data ?? {}) };
              delete data.babyId;
              const parsed = validateBody(config, data, "update");
              const updated = await updateRecord(db, mutation.entity, mutation.id, parsed);
              output.push(
                updated
                  ? { id: mutation.id, status: "applied", record: updated }
                  : { id: mutation.id, status: "error", error: "Update not permitted" },
              );
            }
          } else {
            const current = await db.query<{ family_id: string }>(
              `select family_id from ${config.table} where id = $1`,
              [mutation.id],
            );
            if (!current.rows[0] || current.rows[0].family_id !== body.familyId) {
              output.push({ id: mutation.id, status: "error", error: "Record not found" });
            } else {
              const deleted = await softDeleteRecord(db, mutation.entity, mutation.id);
              output.push(
                deleted
                  ? { id: mutation.id, status: "applied" }
                  : { id: mutation.id, status: "error", error: "Delete not permitted" },
              );
            }
          }
          await db.query(`release savepoint ${savepoint}`);
        } catch (error) {
          await db.query(`rollback to savepoint ${savepoint}`);
          output.push({
            id: mutation.id,
            status: "error",
            error: error instanceof Error ? error.message : "Could not apply",
          });
        }
      }
      const now = await db.query<{ now: string }>("select now()");
      return { results: output, serverTime: now.rows[0].now };
    });

    return json({ ok: true, ...results });
  } catch (error) {
    return fail(error);
  }
}
