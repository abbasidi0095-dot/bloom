import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { ApiError, assertSameOrigin, fail } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { assertBabyAccess } from "@/lib/family";
import { endOfDay, startOfDay } from "@/lib/format";
import { getReportData } from "@/lib/reportData";
import { reportSchema } from "@/lib/schemas";
import { ReportDocument } from "@/lib/pdf/report";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/server";

export const maxDuration = 60;

const allowedSections = new Set([
  "feeding",
  "diapers",
  "sleep",
  "growth",
  "health",
  "activities",
  "milestones",
  "notes",
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const body = reportSchema.parse(await request.json());
    const access = await assertBabyAccess(user.id, body.babyId);
    if (!access) throw new ApiError("Baby not found.", 404, "not_found");
    if (body.from > body.to) throw new ApiError("The start date must be before the end date.", 400, "invalid_range");
    const sections = body.sections.filter((section) => allowedSections.has(section));
    if (!sections.length) throw new ApiError("Choose at least one section.", 400, "sections_required");

    const locale = await getLocale();
    const dict = getDictionary(locale);
    const timeZone = new URL(request.url).searchParams.get("tz") || "UTC";
    const start = startOfDay(body.from, timeZone).toISOString();
    const end = endOfDay(body.to, timeZone).toISOString();

    const data = await withUser(user.id, (db) =>
      getReportData(db, {
        babyId: body.babyId,
        familyId: access.family_id,
        from: body.from,
        to: body.to,
        start,
        end,
        timeZone,
      }),
    );

    if (!data.baby) throw new ApiError("Baby not found.", 404, "not_found");

    let photo: string | null = null;
    const photoUrl = typeof data.baby.photo_url === "string" ? data.baby.photo_url : null;
    if (photoUrl && /^https?:\/\//.test(photoUrl)) {
      photo = photoUrl;
    } else if (photoUrl?.startsWith("/api/files/")) {
      const attachmentId = photoUrl.split("/").pop();
      const attachment = await withUser(user.id, async (db) => {
        const rows = await db.query<{ storage_key: string; mime_type: string }>(
          `select storage_key, mime_type from attachments where id = $1`,
          [attachmentId],
        );
        return rows.rows[0] ?? null;
      });
      if (attachment) {
        try {
          const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
          const bytes = await readFile(path.join(dir, attachment.storage_key));
          photo = `data:${attachment.mime_type};base64,${bytes.toString("base64")}`;
        } catch {
          photo = null;
        }
      }
    }

    const title = body.title?.trim() || dict["reports.defaultTitle"] || "Baby care report";
    const buffer = await renderToBuffer(
      <ReportDocument
        data={data}
        dict={dict}
        locale={locale}
        sections={sections}
        title={title}
        note={body.note}
        photo={photo}
      />,
    );

    const name = String((data.baby as { first_name?: string }).first_name ?? "baby")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="bloom-${name}-${body.from}-${body.to}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
