import { readFile } from "node:fs/promises";
import path from "node:path";
import { ApiError, fail } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { withUser } from "@/lib/db";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user) throw new ApiError("Please sign in to continue.", 401, "unauthorized");
    const { id } = await context.params;
    const attachment = await withUser(user.id, async (db) => {
      const rows = await db.query<{ storage_key: string; mime_type: string; file_name: string }>(
        `select storage_key, mime_type, file_name from attachments where id = $1`,
        [id],
      );
      return rows.rows[0] ?? null;
    });
    if (!attachment) throw new ApiError("Image not found.", 404, "not_found");
    const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
    const bytes = await readFile(path.join(dir, attachment.storage_key));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": attachment.mime_type,
        "Cache-Control": "private, max-age=86400",
        "Content-Disposition": `inline; filename="${attachment.file_name.replace(/"/g, "")}"`,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
