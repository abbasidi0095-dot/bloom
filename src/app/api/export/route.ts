import { ApiError, fail } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { assertBabyAccess } from "@/lib/family";
import { endOfDay, startOfDay, todayKey } from "@/lib/format";
import { records } from "@/lib/records";
import { getTimeline } from "@/lib/timeline";

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const url = new URL(request.url);
    const babyId = url.searchParams.get("babyId");
    if (!babyId) throw new ApiError("Baby is required.", 400, "baby_required");
    const access = await assertBabyAccess(user.id, babyId);
    if (!access) throw new ApiError("Baby not found.", 404, "not_found");
    const timeZone = url.searchParams.get("tz") || "UTC";
    const to = url.searchParams.get("to") || todayKey(timeZone);
    const from = url.searchParams.get("from") || "2000-01-01";
    const format = url.searchParams.get("format") || "json";
    const start = startOfDay(from, timeZone).toISOString();
    const end = endOfDay(to, timeZone).toISOString();
    const stamp = `${from}_${to}`;

    if (format === "csv") {
      const entries = await withUser(user.id, (db) =>
        getTimeline(db, { babyId, from: start, to: end, limit: 1000, ascending: true }),
      );
      const header = [
        "date",
        "time",
        "type",
        "title",
        "amount_ml",
        "duration_seconds",
        "notes",
        "recorded_by",
      ];
      const lines = [header.join(",")];
      for (const entry of entries) {
        lines.push(
          [
            entry.occurred_at,
            entry.kind,
            entry.entity,
            entry.title,
            entry.amount_ml,
            entry.duration_seconds,
            entry.notes,
            entry.recorded_by_name,
          ]
            .map(csvCell)
            .join(","),
        );
      }
      return new Response(`\ufeff${lines.join("\n")}`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="bloom-${stamp}.csv"`,
        },
      });
    }

    const payload = await withUser(user.id, async (db) => {
      const output: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
        familyId: access.family_id,
        babyId,
        from,
        to,
        timeZone,
      };
      for (const [entity, config] of Object.entries(records)) {
        const rows = await db.query(
          `select * from ${config.table}
            where baby_id = $1 and ${config.timeColumn} >= $2 and ${config.timeColumn} <= $3
            order by ${config.timeColumn} asc`,
          [babyId, start, end],
        );
        output[entity] = rows.rows;
      }
      const baby = await db.query(`select * from babies where id = $1`, [babyId]);
      output.baby = baby.rows[0] ?? null;
      return output;
    });

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="bloom-${stamp}.json"`,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
